import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { evaluatePokerHand, getPokerWinner } from "../_shared/chicago.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const { data: room } = await service.from("chicago_rooms").select("*").eq("id", roomId).single();
    if (!room || room.host_player_id !== playerId) return error("Only the host can score Chicago phases", 403);
    if (!["poker_score_1", "poker_score_2"].includes(room.state)) return error("Poker scoring is not active");

    const { data: hands } = await service.from("chicago_player_hands").select("*").eq("room_id", roomId);
    if (!hands || hands.length === 0) return error("No hands found");

    const winner = getPokerWinner(hands.map((hand) => ({ playerId: hand.player_id, cards: hand.cards })));
    if (!winner) return error("Could not determine poker winner", 400);

    await service
      .from("chicago_player_hands")
      .update({
        last_poker_hand_name: winner.evaluation.name,
        last_poker_points: winner.evaluation.points,
      })
      .eq("player_id", winner.playerId);

    const { data: player } = await service.from("chicago_room_players").select("*").eq("id", winner.playerId).single();
    const nextScore = (player?.score ?? 0) + winner.evaluation.points;
    await service.from("chicago_room_players").update({ score: nextScore }).eq("id", winner.playerId);

    if (winner.evaluation.points >= 52 || nextScore >= 52) {
      await service
        .from("chicago_rooms")
        .update({
          state: "game_over",
          winner_player_id: winner.playerId,
          phase_number: room.phase_number + 1,
          public_message: "A player hit 52 points and wins Chicago.",
        })
        .eq("id", roomId);
      return json({ ok: true });
    }

    const nextState = room.state === "poker_score_1" ? "draw_phase_2" : "draw_phase_3";
    const nextDrawNumber = room.state === "poker_score_1" ? 2 : 3;
    await service.from("chicago_rounds").update({ active_phase: nextState, draw_number: nextDrawNumber }).eq("room_id", roomId).eq("round_number", room.current_round);
    await service
      .from("chicago_rooms")
      .update({
        state: nextState,
        phase_number: room.phase_number + 1,
        public_message:
          room.state === "poker_score_1"
            ? `First poker score awarded. ${winner.evaluation.name.replaceAll("_", " ")} wins ${winner.evaluation.points} point${winner.evaluation.points === 1 ? "" : "s"}.`
            : `Second poker score awarded. ${winner.evaluation.name.replaceAll("_", " ")} wins ${winner.evaluation.points} point${winner.evaluation.points === 1 ? "" : "s"}.`,
      })
      .eq("id", roomId);

    return json({ ok: true, evaluation: evaluatePokerHand(hands.find((hand) => hand.player_id === winner.playerId)?.cards ?? []) });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
