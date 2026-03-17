import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { makeDeck } from "../_shared/chicago.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();

    const { data: room } = await service.from("chicago_rooms").select("*").eq("id", roomId).single();
    if (!room || room.host_player_id !== playerId) return error("Only the host can start the round", 403);

    const { data: players } = await service.from("chicago_room_players").select("*").eq("room_id", roomId).order("seat_order");
    if (!players || players.length < 2 || players.length > 6) return error("Chicago requires 2 to 6 players");

    const activePlayers = players.filter((player) => player.status === "active");
    const dealerIndex = room.current_round > 0 ? room.current_round % activePlayers.length : 0;
    const dealer = activePlayers[dealerIndex];
    const lead = activePlayers[(dealerIndex + 1) % activePlayers.length];
    const deck = makeDeck();
    const roundNumber = room.current_round + 1;

    const { data: round, error: roundError } = await service
      .from("chicago_rounds")
      .insert({
        room_id: roomId,
        round_number: roundNumber,
        dealer_player_id: dealer.id,
        active_phase: "draw_phase_1",
        draw_number: 1,
        trick_number: 0,
        deck: deck.slice(activePlayers.length * 5),
      })
      .select("*")
      .single();
    if (roundError) return error(roundError.message, 400);

    await service.from("chicago_player_hands").delete().eq("room_id", roomId);
    const handRows = activePlayers.map((player, index) => ({
      player_id: player.id,
      room_id: roomId,
      round_id: round.id,
      cards: deck.slice(index * 5, index * 5 + 5),
      last_poker_hand_name: null,
      last_poker_points: 0,
    }));
    await service.from("chicago_player_hands").insert(handRows);
    await service.from("chicago_draw_actions").delete().eq("round_id", round.id);
    await service.from("chicago_tricks").delete().eq("round_id", round.id);

    await service
      .from("chicago_room_players")
      .update({ draw_ready: false, trick_ready: false, chicago_declared: false })
      .eq("room_id", roomId);

    await service
      .from("chicago_rooms")
      .update({
        state: "draw_phase_1",
        current_round: roundNumber,
        dealer_player_id: dealer.id,
        lead_player_id: lead.id,
        current_turn_player_id: null,
        phase_number: room.phase_number + 1,
        winner_player_id: null,
        public_message: "Round dealt. Choose cards to exchange.",
      })
      .eq("id", roomId);

    return json({ ok: true });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
