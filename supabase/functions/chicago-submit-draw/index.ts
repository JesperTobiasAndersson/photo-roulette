import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { removeCardsFromHand } from "../_shared/chicago.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId, discardedCards } = await req.json();
    const { data: room } = await service.from("chicago_rooms").select("*").eq("id", roomId).single();
    if (!room || !["draw_phase_1", "draw_phase_2", "draw_phase_3"].includes(room.state)) return error("Draw phase is not active");

    const { data: round } = await service.from("chicago_rounds").select("*").eq("room_id", roomId).eq("round_number", room.current_round).single();
    const { data: hand } = await service.from("chicago_player_hands").select("*").eq("player_id", playerId).single();
    if (!round || !hand) return error("Missing round or hand data", 400);

    const remainingCards = removeCardsFromHand(hand.cards, discardedCards ?? []);
    const drawCount = (discardedCards ?? []).length;
    const deck = [...round.deck];
    const newCards = deck.splice(0, drawCount);
    const updatedHand = [...remainingCards, ...newCards];

    await service
      .from("chicago_player_hands")
      .update({ cards: updatedHand })
      .eq("player_id", playerId);

    await service.from("chicago_draw_actions").upsert(
      {
        player_id: playerId,
        round_id: round.id,
        draw_number: round.draw_number,
        discarded_cards: discardedCards ?? [],
      },
      { onConflict: "player_id,round_id,draw_number" }
    );

    await service.from("chicago_rounds").update({ deck }).eq("id", round.id);
    await service.from("chicago_room_players").update({ draw_ready: true }).eq("id", playerId);

    const { data: players } = await service.from("chicago_room_players").select("*").eq("room_id", roomId).eq("status", "active");
    const everyoneReady = (players ?? []).every((player) => player.draw_ready);
    if (!everyoneReady) return json({ ok: true, waiting: true });

    await service.from("chicago_room_players").update({ draw_ready: false }).eq("room_id", roomId).eq("status", "active");

    if (room.state === "draw_phase_1") {
      await service
        .from("chicago_rooms")
        .update({ state: "poker_score_1", phase_number: room.phase_number + 1, public_message: "All draws submitted. Score the first poker hand." })
        .eq("id", roomId);
      return json({ ok: true });
    }

    if (room.state === "draw_phase_2") {
      await service
        .from("chicago_rooms")
        .update({ state: "poker_score_2", phase_number: room.phase_number + 1, public_message: "All draws submitted. Score the second poker hand." })
        .eq("id", roomId);
      return json({ ok: true });
    }

    const leadPlayerId = room.lead_player_id ?? players?.[0]?.id ?? null;
    const { data: trick } = await service
      .from("chicago_tricks")
      .insert({ round_id: round.id, trick_number: 1, lead_suit: null, winner_player_id: null })
      .select("*")
      .single();

    await service.from("chicago_rounds").update({ active_phase: "trick_phase", trick_number: 1 }).eq("id", round.id);
    await service
      .from("chicago_rooms")
      .update({
        state: "trick_phase",
        current_turn_player_id: leadPlayerId,
        phase_number: room.phase_number + 1,
        public_message: "Final draw complete. Play tricks and fight for the last one.",
      })
      .eq("id", roomId);

    return json({ ok: true, trickId: trick?.id ?? null });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
