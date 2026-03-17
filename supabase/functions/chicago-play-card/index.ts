import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { canFollowSuit, evaluatePokerHand, removeCardsFromHand, resolveTrick } from "../_shared/chicago.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId, card } = await req.json();
    const [{ data: room }, { data: round }, { data: hand }, { data: players }] = await Promise.all([
      service.from("chicago_rooms").select("*").eq("id", roomId).single(),
      service.from("chicago_rounds").select("*").eq("room_id", roomId).order("round_number", { ascending: false }).limit(1).single(),
      service.from("chicago_player_hands").select("*").eq("player_id", playerId).single(),
      service.from("chicago_room_players").select("*").eq("room_id", roomId).eq("status", "active").order("seat_order"),
    ]);

    if (!room || room.state !== "trick_phase") return error("Trick phase is not active");
    if (room.current_turn_player_id !== playerId) return error("It is not your turn");
    if (!round || !hand || !players) return error("Missing Chicago round data", 400);

    let { data: trick } = await service
      .from("chicago_tricks")
      .select("*")
      .eq("round_id", round.id)
      .eq("trick_number", round.trick_number)
      .maybeSingle();

    if (!trick) {
      const inserted = await service
        .from("chicago_tricks")
        .insert({ round_id: round.id, trick_number: 1, lead_suit: null, winner_player_id: null })
        .select("*")
        .single();
      trick = inserted.data;
    }

    const { data: playedCards } = await service.from("chicago_cards_played").select("*").eq("trick_id", trick.id).order("play_order");
    if (!canFollowSuit(hand.cards, trick.lead_suit, card)) return error("You must follow suit if possible");

    await service.from("chicago_cards_played").insert({
      trick_id: trick.id,
      player_id: playerId,
      card,
      play_order: (playedCards?.length ?? 0) + 1,
    });

    const updatedHand = removeCardsFromHand(hand.cards, [card]);
    await service.from("chicago_player_hands").update({ cards: updatedHand }).eq("player_id", playerId);

    if (!trick.lead_suit) {
      await service.from("chicago_tricks").update({ lead_suit: card.suit }).eq("id", trick.id);
      trick.lead_suit = card.suit;
    }

    const refreshedPlayedCards = [...(playedCards ?? []), { player_id: playerId, card }];
    if (refreshedPlayedCards.length < players.length) {
      const currentIndex = players.findIndex((player) => player.id === playerId);
      const nextPlayer = players[(currentIndex + 1) % players.length];
      await service.from("chicago_rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", roomId);
      return json({ ok: true, waiting: true });
    }

    const winningPlay = resolveTrick(trick.lead_suit, refreshedPlayedCards);
    const winnerPlayerId = winningPlay?.player_id ?? null;
    await service.from("chicago_tricks").update({ winner_player_id: winnerPlayerId }).eq("id", trick.id);

    if (round.chicago_declared_by && winnerPlayerId !== round.chicago_declared_by) {
      const { data: declarer } = await service.from("chicago_room_players").select("*").eq("id", round.chicago_declared_by).single();
      await service.from("chicago_room_players").update({ score: (declarer?.score ?? 0) - 15 }).eq("id", round.chicago_declared_by);
      await service.from("chicago_rounds").update({ chicago_failed: true, chicago_resolved: true }).eq("id", round.id);
      await service
        .from("chicago_rooms")
        .update({
          state: "result",
          current_turn_player_id: null,
          phase_number: room.phase_number + 1,
          public_message: "Chicago failed. The round ends immediately and the caller loses 15 points.",
        })
        .eq("id", roomId);
      return json({ ok: true });
    }

    if (round.trick_number >= 5) {
      if (winnerPlayerId) {
        const { data: winnerPlayer } = await service.from("chicago_room_players").select("*").eq("id", winnerPlayerId).single();
        await service.from("chicago_room_players").update({ score: (winnerPlayer?.score ?? 0) + 5 }).eq("id", winnerPlayerId);
      }

      if (round.chicago_declared_by && winnerPlayerId === round.chicago_declared_by) {
        const { data: declarer } = await service.from("chicago_room_players").select("*").eq("id", round.chicago_declared_by).single();
        await service.from("chicago_room_players").update({ score: (declarer?.score ?? 0) + 15 }).eq("id", round.chicago_declared_by);
      }

      const { data: allPlayed } = await service
        .from("chicago_cards_played")
        .select("player_id,card")
        .in(
          "trick_id",
          (
            await service.from("chicago_tricks").select("id").eq("round_id", round.id)
          ).data?.map((entry) => entry.id) ?? []
        );

      const byPlayer = new Map<string, any[]>();
      (allPlayed ?? []).forEach((entry) => {
        byPlayer.set(entry.player_id, [...(byPlayer.get(entry.player_id) ?? []), entry.card]);
      });
      let finalWinner: { playerId: string; evaluation: ReturnType<typeof evaluatePokerHand> } | null = null;
      for (const [currentPlayerId, cards] of byPlayer.entries()) {
        const evaluation = evaluatePokerHand(cards as any[]);
        if (!finalWinner || evaluation.tiebreak.some((value, index) => value !== (finalWinner?.evaluation.tiebreak[index] ?? 0) ? value > (finalWinner?.evaluation.tiebreak[index] ?? 0) : false)) {
          finalWinner = { playerId: currentPlayerId, evaluation };
        }
      }

      if (finalWinner) {
        const { data: scorePlayer } = await service.from("chicago_room_players").select("*").eq("id", finalWinner.playerId).single();
        const newScore = (scorePlayer?.score ?? 0) + finalWinner.evaluation.points;
        await service.from("chicago_room_players").update({ score: newScore }).eq("id", finalWinner.playerId);
        if (newScore >= 52 || finalWinner.evaluation.points >= 52) {
          await service
            .from("chicago_rooms")
            .update({
              state: "game_over",
              winner_player_id: finalWinner.playerId,
              current_turn_player_id: null,
              phase_number: room.phase_number + 1,
              public_message: "A player hit 52 points and wins Chicago.",
            })
            .eq("id", roomId);
          return json({ ok: true });
        }
      }

      await service
        .from("chicago_rooms")
        .update({
          state: "result",
          current_turn_player_id: null,
          phase_number: room.phase_number + 1,
          public_message: "Round complete. Review the scores and deal the next hand.",
        })
        .eq("id", roomId);
      await service.from("chicago_rounds").update({ last_trick_winner_player_id: winnerPlayerId }).eq("id", round.id);
      return json({ ok: true });
    }

    const nextTrickNumber = round.trick_number + 1;
    const { data: nextTrick } = await service
      .from("chicago_tricks")
      .insert({ round_id: round.id, trick_number: nextTrickNumber, lead_suit: null, winner_player_id: null })
      .select("*")
      .single();

    await service.from("chicago_rounds").update({ trick_number: nextTrickNumber }).eq("id", round.id);
    await service
      .from("chicago_rooms")
      .update({
        current_turn_player_id: winnerPlayerId,
        lead_player_id: winnerPlayerId,
        public_message: `Trick ${round.trick_number} resolved. ${players.find((player) => player.id === winnerPlayerId)?.display_name ?? "A player"} leads next.`,
      })
      .eq("id", roomId);

    return json({ ok: true, nextTrickId: nextTrick?.id ?? null });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
