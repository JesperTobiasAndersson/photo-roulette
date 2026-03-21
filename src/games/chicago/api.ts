import { supabase } from "../../lib/supabase";
import {
  canFollowSuit,
  cardId,
  comparePokerEvaluations,
  evaluatePokerHand,
  getPokerWinnerWithTie,
  makeDeck,
  resolveTrick,
  shuffleDeck,
} from "./logic";
import type {
  ChicagoCard,
  ChicagoHandDto,
  ChicagoPlayedCardDto,
  ChicagoPlayerDto,
  ChicagoRoomDto,
  ChicagoRoundDto,
  ChicagoTrickDto,
} from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function removeCardsFromHand(hand: ChicagoCard[], cardsToRemove: ChicagoCard[]) {
  const counts = new Map<string, number>();
  cardsToRemove.forEach((card) => {
    const id = cardId(card);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  return hand.filter((card) => {
    const id = cardId(card);
    const count = counts.get(id) ?? 0;
    if (count > 0) {
      counts.set(id, count - 1);
      return false;
    }
    return true;
  });
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("chicago_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as ChicagoRoomDto;
}

async function getPlayers(roomId: string) {
  const { data, error } = await supabase.from("chicago_room_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as ChicagoPlayerDto[]) ?? [];
}

async function getActivePlayers(roomId: string) {
  const players = await getPlayers(roomId);
  return players.filter((player) => player.status === "active");
}

async function getCurrentRound(roomId: string) {
  const { data, error } = await supabase
    .from("chicago_rounds")
    .select("*")
    .eq("room_id", roomId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ChicagoRoundDto | null) ?? null;
}

async function getHand(playerId: string) {
  const { data, error } = await supabase.from("chicago_player_hands").select("*").eq("player_id", playerId).single();
  if (error) throw error;
  return data as ChicagoHandDto;
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

async function addScore(playerId: string, amount: number) {
  const { data: player, error } = await supabase.from("chicago_room_players").select("*").eq("id", playerId).single();
  if (error) throw error;
  const nextScore = (player?.score ?? 0) + amount;
  const { error: updateError } = await supabase.from("chicago_room_players").update({ score: nextScore }).eq("id", playerId);
  if (updateError) throw updateError;
  return nextScore;
}

async function maybeFinishGame(roomId: string) {
  const players = await getPlayers(roomId);
  const winner = players.find((player) => player.score >= 52) ?? null;
  if (!winner) return null;

  const { error } = await supabase
    .from("chicago_rooms")
    .update({
      state: "game_over",
      winner_player_id: winner.id,
      current_turn_player_id: null,
      public_message: `${winner.display_name} reached 52 points and wins Chicago.`,
    })
    .eq("id", roomId);
  if (error) throw error;
  return winner;
}

export async function createChicagoRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("chicago_rooms")
    .insert({ code: makeRoomCode(), state: "lobby", public_message: "Waiting for players to join Chicago." })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("chicago_room_players")
    .insert({
      room_id: room.id,
      display_name: trimmedName,
      seat_order: 1,
      score: 0,
      status: "active",
      draw_ready: false,
      trick_ready: false,
      chicago_declared: false,
    })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("chicago_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function joinChicagoRoom(code: string, displayName: string) {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = displayName.trim();
  if (!trimmedCode || !trimmedName) throw new Error("Enter your name and room code");

  const { data: room, error: roomError } = await supabase.from("chicago_rooms").select("*").eq("code", trimmedCode).single();
  if (roomError) throw roomError;
  if (room.state === "game_over") throw new Error("This Chicago game has already ended");

  const { count, error: countError } = await supabase.from("chicago_room_players").select("*", { count: "exact", head: true }).eq("room_id", room.id);
  if (countError) throw countError;
  if ((count ?? 0) >= 6) throw new Error("Chicago supports up to 6 players");

  const { data: player, error: playerError } = await supabase
    .from("chicago_room_players")
    .insert({
      room_id: room.id,
      display_name: trimmedName,
      seat_order: (count ?? 0) + 1,
      score: 0,
      status: "active",
      draw_ready: false,
      trick_ready: false,
      chicago_declared: false,
    })
    .select("*")
    .single();
  if (playerError) throw playerError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function startChicagoRound(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  const activePlayers = await getActivePlayers(roomId);
  if (activePlayers.length < 2 || activePlayers.length > 6) throw new Error("Chicago requires 2 to 6 active players");

  const dealerIndex = room.current_round > 0 ? room.current_round % activePlayers.length : 0;
  const dealer = activePlayers[dealerIndex];
  const lead = activePlayers[(dealerIndex + 1) % activePlayers.length];
  const deck = shuffleDeck(makeDeck());
  const roundNumber = room.current_round + 1;

  const { data: round, error: roundError } = await supabase
    .from("chicago_rounds")
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      dealer_player_id: dealer.id,
      active_phase: "draw_phase_1",
      draw_number: 1,
      trick_number: 0,
      deck: deck.slice(activePlayers.length * 5),
      chicago_declared_by: null,
      chicago_failed: false,
      chicago_resolved: false,
      last_trick_winner_player_id: null,
    })
    .select("*")
    .single();
  if (roundError) throw roundError;

  const { error: clearHandsError } = await supabase.from("chicago_player_hands").delete().eq("room_id", roomId);
  if (clearHandsError) throw clearHandsError;

  const handRows = activePlayers.map((player, index) => ({
    player_id: player.id,
    room_id: roomId,
    round_id: round.id,
    cards: deck.slice(index * 5, index * 5 + 5),
    last_poker_hand_name: null,
    last_poker_points: 0,
  }));
  const { error: handsError } = await supabase.from("chicago_player_hands").insert(handRows);
  if (handsError) throw handsError;

  await supabase.from("chicago_draw_actions").delete().eq("round_id", round.id);
  await supabase.from("chicago_cards_played").delete().in(
    "trick_id",
    ((await supabase.from("chicago_tricks").select("id").eq("round_id", round.id)).data ?? []).map((entry) => entry.id)
  );
  await supabase.from("chicago_tricks").delete().eq("round_id", round.id);

  const { error: playerResetError } = await supabase
    .from("chicago_room_players")
    .update({ draw_ready: false, trick_ready: false, chicago_declared: false })
    .eq("room_id", roomId)
    .eq("status", "active");
  if (playerResetError) throw playerResetError;

  const { error: roomUpdateError } = await supabase
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
  if (roomUpdateError) throw roomUpdateError;

  return { ok: true };
}

export async function submitChicagoDraw(roomId: string, playerId: string, discardedCards: ChicagoCard[]) {
  const room = await getRoom(roomId);
  if (!["draw_phase_1", "draw_phase_2", "draw_phase_3"].includes(room.state)) throw new Error("Draw phase is not active");

  const round = await getCurrentRound(roomId);
  if (!round) throw new Error("No active round");
  const hand = await getHand(playerId);

  const remainingCards = removeCardsFromHand(hand.cards, discardedCards ?? []);
  const drawCount = (discardedCards ?? []).length;
  const deck = [...round.deck];
  const newCards = deck.splice(0, drawCount);
  const updatedHand = [...remainingCards, ...newCards];

  const { error: handError } = await supabase.from("chicago_player_hands").update({ cards: updatedHand }).eq("player_id", playerId);
  if (handError) throw handError;

  const { error: drawError } = await supabase.from("chicago_draw_actions").upsert(
    {
      player_id: playerId,
      round_id: round.id,
      draw_number: round.draw_number,
      discarded_cards: discardedCards ?? [],
    },
    { onConflict: "player_id,round_id,draw_number" }
  );
  if (drawError) throw drawError;

  const { error: deckError } = await supabase.from("chicago_rounds").update({ deck }).eq("id", round.id);
  if (deckError) throw deckError;

  await supabase.from("chicago_room_players").update({ draw_ready: true }).eq("id", playerId);

  const activePlayers = await getActivePlayers(roomId);
  const everyoneReady = activePlayers.every((player) => player.draw_ready);
  if (!everyoneReady) return { ok: true, waiting: true };

  await supabase.from("chicago_room_players").update({ draw_ready: false }).eq("room_id", roomId).eq("status", "active");

  if (room.state === "draw_phase_1") {
    await supabase
      .from("chicago_rooms")
      .update({ state: "poker_score_1", phase_number: room.phase_number + 1, public_message: "All draws submitted. Score the first poker hand." })
      .eq("id", roomId);
    await supabase.from("chicago_rounds").update({ active_phase: "poker_score_1" }).eq("id", round.id);
    return { ok: true };
  }

  if (room.state === "draw_phase_2") {
    await supabase
      .from("chicago_rooms")
      .update({ state: "poker_score_2", phase_number: room.phase_number + 1, public_message: "All draws submitted. Score the second poker hand." })
      .eq("id", roomId);
    await supabase.from("chicago_rounds").update({ active_phase: "poker_score_2" }).eq("id", round.id);
    return { ok: true };
  }

  const { data: trick, error: trickError } = await supabase
    .from("chicago_tricks")
    .insert({ round_id: round.id, trick_number: 1, lead_suit: null, winner_player_id: null })
    .select("*")
    .single();
  if (trickError) throw trickError;

  await supabase.from("chicago_rounds").update({ active_phase: "trick_phase", trick_number: 1 }).eq("id", round.id);
  await supabase
    .from("chicago_rooms")
    .update({
      state: "trick_phase",
      current_turn_player_id: room.lead_player_id ?? activePlayers[0]?.id ?? null,
      phase_number: room.phase_number + 1,
      public_message: "Final draw complete. Play tricks and fight for the last one.",
    })
    .eq("id", roomId);

  return { ok: true, trickId: trick.id };
}

export async function advanceChicagoPokerScore(roomId: string, _playerId: string) {
  const room = await getRoom(roomId);
  if (!["poker_score_1", "poker_score_2"].includes(room.state)) throw new Error("Poker scoring is not active");

  const lockIsStale =
    !!room.phase_ends_at && Date.now() - new Date(room.phase_ends_at).getTime() > 15000;
  if (lockIsStale) {
    await supabase
      .from("chicago_rooms")
      .update({ phase_ends_at: null })
      .eq("id", roomId)
      .eq("state", room.state)
      .eq("phase_ends_at", room.phase_ends_at);
  }

  const freshRoom = lockIsStale ? await getRoom(roomId) : room;
  const lockToken = new Date().toISOString();
  const { data: claimedRoom, error: claimError } = await supabase
    .from("chicago_rooms")
    .update({ phase_ends_at: lockToken })
    .eq("id", roomId)
    .eq("state", freshRoom.state)
    .is("phase_ends_at", null)
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimedRoom) {
    return { ok: true, waiting: true };
  }

  try {
    const { data: hands, error: handsError } = await supabase.from("chicago_player_hands").select("*").eq("room_id", roomId);
    if (handsError) throw handsError;
    if (!hands || hands.length === 0) throw new Error("No hands found");

    const { winner, tied } = getPokerWinnerWithTie(hands.map((hand) => ({ playerId: hand.player_id, cards: hand.cards })));
    if (!winner) throw new Error("Could not determine poker winner");
    const players = await getPlayers(roomId);
    const winnerPlayer = players.find((player) => player.id === winner.playerId) ?? null;
    const winnerName = winnerPlayer?.display_name ?? "A player";

    const { error: handError } = await supabase
      .from("chicago_player_hands")
      .update({
        last_poker_hand_name: winner.evaluation.name,
        last_poker_points: winner.evaluation.points,
      })
      .eq("player_id", winner.playerId);
    if (handError) throw handError;

    const shouldAwardPoints = !tied && winner.evaluation.points > 0;
    const nextScore = shouldAwardPoints ? await addScore(winner.playerId, winner.evaluation.points) : winnerPlayer?.score ?? 0;
    if (shouldAwardPoints && (winner.evaluation.points >= 52 || nextScore >= 52)) {
      await maybeFinishGame(roomId);
      await supabase.from("chicago_rooms").update({ phase_ends_at: null }).eq("id", roomId);
      return { ok: true };
    }

    const round = await getCurrentRound(roomId);
    if (!round) throw new Error("No active round");

    const nextState = freshRoom.state === "poker_score_1" ? "draw_phase_2" : "draw_phase_3";
    const nextDrawNumber = freshRoom.state === "poker_score_1" ? 2 : 3;
    await supabase.from("chicago_rounds").update({ active_phase: nextState, draw_number: nextDrawNumber }).eq("id", round.id);

    const { error: roomError } = await supabase
      .from("chicago_rooms")
      .update({
        state: nextState,
        phase_number: freshRoom.phase_number + 1,
        phase_ends_at: null,
        public_message:
          freshRoom.state === "poker_score_1"
            ? tied
              ? "The first poker scoring tied. No points were awarded."
              : winner.evaluation.points > 0
                ? `${winnerName} wins the first scoring with ${winner.evaluation.label} for ${winner.evaluation.points} point${winner.evaluation.points === 1 ? "" : "s"}.`
                : `${winnerName} had the best high card in the first scoring. No points were awarded.`
            : tied
              ? "The second poker scoring tied. No points were awarded."
              : winner.evaluation.points > 0
                ? `${winnerName} wins the second scoring with ${winner.evaluation.label} for ${winner.evaluation.points} point${winner.evaluation.points === 1 ? "" : "s"}.`
                : `${winnerName} had the best high card in the second scoring. No points were awarded.`,
      })
      .eq("id", roomId);
    if (roomError) throw roomError;

    return { ok: true };
  } catch (error) {
    await supabase.from("chicago_rooms").update({ phase_ends_at: null }).eq("id", roomId);
    throw error;
  }
}

export async function declareChicago(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.state !== "trick_phase") throw new Error("Chicago can only be declared in the trick phase");

  const { data: player, error: playerError } = await supabase.from("chicago_room_players").select("*").eq("id", playerId).single();
  if (playerError) throw playerError;
  if (player.chicago_declared) throw new Error("You already declared Chicago this round");

  const round = await getCurrentRound(roomId);
  if (!round) throw new Error("No active round");
  if (round.chicago_declared_by) throw new Error("Chicago has already been claimed this round");

  const { data: trickIdsData, error: trickIdsError } = await supabase.from("chicago_tricks").select("id").eq("round_id", round.id);
  if (trickIdsError) throw trickIdsError;
  const trickIds = (trickIdsData ?? []).map((entry) => entry.id);
  if (trickIds.length > 0) {
    const { data: playedRows, error: playedError } = await supabase.from("chicago_cards_played").select("id").in("trick_id", trickIds).limit(1);
    if (playedError) throw playedError;
    if ((playedRows?.length ?? 0) > 0) throw new Error("Chicago must be declared before the first card is played");
  }

  const { data: claimedRound, error: claimError } = await supabase
    .from("chicago_rounds")
    .update({ chicago_declared_by: playerId })
    .eq("id", round.id)
    .is("chicago_declared_by", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimedRound) throw new Error("Another player claimed CHICAGO first");

  await supabase.from("chicago_room_players").update({ chicago_declared: true }).eq("id", playerId);
  await supabase
    .from("chicago_rooms")
    .update({
      lead_player_id: playerId,
      current_turn_player_id: playerId,
      public_message: `${player.display_name} declared CHICAGO and leads the first trick.`,
    })
    .eq("id", roomId);
  return { ok: true };
}

export async function playChicagoCard(roomId: string, playerId: string, card: ChicagoCard) {
  const room = await getRoom(roomId);
  const round = await getCurrentRound(roomId);
  if (!round) throw new Error("No active round");
  if (room.state !== "trick_phase") throw new Error("Trick phase is not active");
  if (room.current_turn_player_id !== playerId) throw new Error("It is not your turn");

  const hand = await getHand(playerId);
  if (!hand.cards.some((entry) => cardId(entry) === cardId(card))) throw new Error("That card is not in your hand");

  let { data: trick, error: trickError } = await supabase
    .from("chicago_tricks")
    .select("*")
    .eq("round_id", round.id)
    .eq("trick_number", round.trick_number)
    .maybeSingle();
  if (trickError) throw trickError;

  if (!trick) {
    const { data: insertedTrick, error: insertError } = await supabase
      .from("chicago_tricks")
      .insert({ round_id: round.id, trick_number: 1, lead_suit: null, winner_player_id: null })
      .select("*")
      .single();
    if (insertError) throw insertError;
    trick = insertedTrick as ChicagoTrickDto;
  }

  const { data: playedRows, error: playedError } = await supabase.from("chicago_cards_played").select("*").eq("trick_id", trick.id).order("play_order");
  if (playedError) throw playedError;
  const playedCards = (playedRows as ChicagoPlayedCardDto[]) ?? [];

  if (!canFollowSuit(hand.cards, trick.lead_suit, card)) throw new Error("You must follow suit if possible");

  const { error: playError } = await supabase.from("chicago_cards_played").insert({
    trick_id: trick.id,
    player_id: playerId,
    card,
    play_order: playedCards.length + 1,
  });
  if (playError) throw playError;

  const updatedHand = removeCardsFromHand(hand.cards, [card]);
  await supabase.from("chicago_player_hands").update({ cards: updatedHand }).eq("player_id", playerId);

  if (!trick.lead_suit) {
    await supabase.from("chicago_tricks").update({ lead_suit: card.suit }).eq("id", trick.id);
    trick.lead_suit = card.suit;
  }

  const activePlayers = await getActivePlayers(roomId);
  const refreshedPlayedCards = [...playedCards, { trick_id: trick.id, player_id: playerId, card, play_order: playedCards.length + 1 }];

  if (refreshedPlayedCards.length < activePlayers.length) {
    const currentIndex = activePlayers.findIndex((player) => player.id === playerId);
    const nextPlayer = activePlayers[(currentIndex + 1) % activePlayers.length];
    await supabase.from("chicago_rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", roomId);
    return { ok: true, waiting: true };
  }

  const winningPlay = resolveTrick(trick.lead_suit!, refreshedPlayedCards);
  const winnerPlayerId = winningPlay?.player_id ?? null;
  await supabase.from("chicago_tricks").update({ winner_player_id: winnerPlayerId }).eq("id", trick.id);

  if (round.chicago_declared_by && winnerPlayerId !== round.chicago_declared_by) {
    await addScore(round.chicago_declared_by, -15);
    await supabase.from("chicago_rounds").update({ chicago_failed: true, chicago_resolved: true }).eq("id", round.id);
    await supabase
      .from("chicago_rooms")
      .update({
        state: "result",
        current_turn_player_id: null,
        phase_number: room.phase_number + 1,
        public_message: "Chicago failed. The round ends immediately and the caller loses 15 points.",
      })
      .eq("id", roomId);
    await maybeFinishGame(roomId);
    return { ok: true };
  }

  if (round.trick_number >= 5) {
    if (winnerPlayerId) {
      await addScore(winnerPlayerId, 5);
    }

    if (round.chicago_declared_by && winnerPlayerId === round.chicago_declared_by) {
      await addScore(round.chicago_declared_by, 15);
    }

    const { data: trickIdsData, error: trickIdsError } = await supabase.from("chicago_tricks").select("id").eq("round_id", round.id);
    if (trickIdsError) throw trickIdsError;
    const trickIds = (trickIdsData ?? []).map((entry) => entry.id);

    const { data: allPlayedRows, error: allPlayedError } = await supabase.from("chicago_cards_played").select("*").in("trick_id", trickIds);
    if (allPlayedError) throw allPlayedError;
    const allPlayed = (allPlayedRows as ChicagoPlayedCardDto[]) ?? [];

    const byPlayer = new Map<string, ChicagoCard[]>();
    allPlayed.forEach((entry) => {
      byPlayer.set(entry.player_id, [...(byPlayer.get(entry.player_id) ?? []), entry.card]);
    });

    let finalWinner: { playerId: string; evaluation: ReturnType<typeof evaluatePokerHand> } | null = null;
    for (const [currentPlayerId, cards] of byPlayer.entries()) {
      const evaluation = evaluatePokerHand(cards);
      if (!finalWinner || comparePokerEvaluations(evaluation, finalWinner.evaluation) > 0) {
        finalWinner = { playerId: currentPlayerId, evaluation };
      }
    }

    if (finalWinner && finalWinner.evaluation.points > 0) {
      await addScore(finalWinner.playerId, finalWinner.evaluation.points);
    }

    await supabase.from("chicago_rounds").update({ last_trick_winner_player_id: winnerPlayerId }).eq("id", round.id);
    await supabase
      .from("chicago_rooms")
      .update({
        state: "result",
        current_turn_player_id: null,
        phase_number: room.phase_number + 1,
        public_message: "Round complete. Review the scores and deal the next hand.",
      })
      .eq("id", roomId);

    await maybeFinishGame(roomId);
    return { ok: true };
  }

  const nextTrickNumber = round.trick_number + 1;
  const { data: nextTrick, error: nextTrickError } = await supabase
    .from("chicago_tricks")
    .insert({ round_id: round.id, trick_number: nextTrickNumber, lead_suit: null, winner_player_id: null })
    .select("*")
    .single();
  if (nextTrickError) throw nextTrickError;

  await supabase.from("chicago_rounds").update({ trick_number: nextTrickNumber }).eq("id", round.id);
  await supabase
    .from("chicago_rooms")
    .update({
      current_turn_player_id: winnerPlayerId,
      lead_player_id: winnerPlayerId,
      public_message: `Trick ${round.trick_number} resolved. ${activePlayers.find((player) => player.id === winnerPlayerId)?.display_name ?? "A player"} leads next.`,
    })
    .eq("id", roomId);

  return { ok: true, nextTrickId: nextTrick.id };
}

export async function getChicagoPublicState(roomId: string) {
  const [room, players, round] = await Promise.all([getRoom(roomId), getPlayers(roomId), getCurrentRound(roomId)]);
  return { room, players, round };
}
