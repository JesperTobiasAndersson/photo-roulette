import { supabase } from "../../lib/supabase";
import { buildTriviaDeck, type TriviaCategory } from "./data";
import type { TriviaPlayerDto, TriviaRoomDto, TriviaTurnDto } from "./types";

const QUESTIONS_PER_PLAYER = 6;

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("trivia_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as TriviaRoomDto;
}

async function getPlayers(roomId: string) {
  const { data, error } = await supabase.from("trivia_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as TriviaPlayerDto[]) ?? [];
}

async function getCurrentTurn(roomId: string) {
  const room = await getRoom(roomId);
  if (!room.current_turn_id) return null;
  const { data, error } = await supabase.from("trivia_turns").select("*").eq("id", room.current_turn_id).maybeSingle();
  if (error) throw error;
  return (data as TriviaTurnDto | null) ?? null;
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

export async function createTriviaRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("trivia_rooms")
    .insert({
      code: makeRoomCode(),
      state: "lobby",
      selected_categories: [],
      questions_per_player: QUESTIONS_PER_PLAYER,
      public_message: "Waiting for the host to choose categories and start Trivia.",
    })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("trivia_players")
    .insert({
      room_id: room.id,
      display_name: trimmedName,
      seat_order: 1,
      score: 0,
      correct_answers: 0,
    })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("trivia_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function joinTriviaRoom(code: string, displayName: string) {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");
  if (!trimmedCode) throw new Error("Enter a room code");

  const { data: room, error: roomError } = await supabase.from("trivia_rooms").select("*").eq("code", trimmedCode).single();
  if (roomError) throw roomError;
  if ((room as TriviaRoomDto).state !== "lobby") throw new Error("This Trivia game has already started");

  const { count, error: countError } = await supabase
    .from("trivia_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countError) throw countError;

  const { data: player, error: playerError } = await supabase
    .from("trivia_players")
    .insert({
      room_id: room.id,
      display_name: trimmedName,
      seat_order: (count ?? 0) + 1,
      score: 0,
      correct_answers: 0,
    })
    .select("*")
    .single();
  if (playerError) throw playerError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function startTriviaGame(roomId: string, playerId: string, selectedCategories: TriviaCategory[]) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "lobby") throw new Error("The game has already started");
  if (selectedCategories.length < 1) throw new Error("Choose at least one category");

  const players = await getPlayers(roomId);
  if (players.length < 2) throw new Error("At least 2 players are required");

  const deck = buildTriviaDeck(selectedCategories, QUESTIONS_PER_PLAYER, players.length);
  if (deck.length < QUESTIONS_PER_PLAYER * players.length) throw new Error("Not enough questions available");

  const turns = deck.map((question, index) => {
    const player = players[index % players.length];
    return {
      room_id: roomId,
      player_id: player.id,
      turn_number: index + 1,
      player_question_number: Math.floor(index / players.length) + 1,
      category: question.category,
      question_text: question.prompt,
      answer_text: question.answer,
      awarded_points: 0,
      is_correct: null,
      revealed_at: null,
      judged_at: null,
    };
  });

  const { error: deleteTurnsError } = await supabase.from("trivia_turns").delete().eq("room_id", roomId);
  if (deleteTurnsError) throw deleteTurnsError;

  const { error: resetPlayersError } = await supabase
    .from("trivia_players")
    .update({ score: 0, correct_answers: 0 })
    .eq("room_id", roomId);
  if (resetPlayersError) throw resetPlayersError;

  const { data: insertedTurns, error: turnsError } = await supabase.from("trivia_turns").insert(turns).select("*");
  if (turnsError) throw turnsError;

  const firstTurn = (insertedTurns as TriviaTurnDto[])[0];
  const firstPlayer = players[0];

  const { error: roomError } = await supabase
    .from("trivia_rooms")
    .update({
      state: "question",
      current_turn_id: firstTurn.id,
      selected_categories: selectedCategories,
      phase_number: room.phase_number + 1,
      public_message: `${firstPlayer.display_name} is up first. Read the question out loud before revealing the answer.`,
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
}

export async function revealTriviaAnswer(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  const turn = await getCurrentTurn(roomId);
  if (!turn) throw new Error("There is no active question");
  if (room.state !== "question") throw new Error("The answer is already revealed");
  if (room.host_player_id !== playerId && turn.player_id !== playerId) {
    throw new Error("Only the host or the active player can reveal the answer");
  }

  const now = new Date().toISOString();
  const { error: turnError } = await supabase.from("trivia_turns").update({ revealed_at: now }).eq("id", turn.id);
  if (turnError) throw turnError;

  const { error: roomError } = await supabase
    .from("trivia_rooms")
    .update({
      state: "reveal",
      public_message: "The answer is revealed. The host can now mark the turn right or wrong.",
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
}

export async function scoreTriviaTurn(roomId: string, playerId: string, wasCorrect: boolean) {
  const room = await requireHost(roomId, playerId);
  const turn = await getCurrentTurn(roomId);
  if (!turn) throw new Error("There is no active turn");
  if (room.state !== "reveal") throw new Error("Reveal the answer first");

  const nextPoints = wasCorrect ? 1 : 0;
  const previousPoints = turn.awarded_points ?? 0;
  const previousCorrect = turn.is_correct === true ? 1 : 0;

  const { error: turnError } = await supabase
    .from("trivia_turns")
    .update({
      awarded_points: nextPoints,
      is_correct: wasCorrect,
      judged_at: new Date().toISOString(),
    })
    .eq("id", turn.id);
  if (turnError) throw turnError;

  const { data: player, error: playerError } = await supabase.from("trivia_players").select("*").eq("id", turn.player_id).single();
  if (playerError) throw playerError;

  const currentPlayer = player as TriviaPlayerDto;
  const nextScore = Math.max(0, (currentPlayer.score ?? 0) + (nextPoints - previousPoints));
  const nextCorrectAnswers = Math.max(0, (currentPlayer.correct_answers ?? 0) + ((wasCorrect ? 1 : 0) - previousCorrect));
  const { error: updatePlayerError } = await supabase
    .from("trivia_players")
    .update({ score: nextScore, correct_answers: nextCorrectAnswers })
    .eq("id", turn.player_id);
  if (updatePlayerError) throw updatePlayerError;

  const { data: nextTurnData, error: nextTurnError } = await supabase
    .from("trivia_turns")
    .select("*")
    .eq("room_id", roomId)
    .gt("turn_number", turn.turn_number)
    .order("turn_number")
    .limit(1)
    .maybeSingle();
  if (nextTurnError) throw nextTurnError;

  if (!nextTurnData) {
    const { error: completeError } = await supabase
      .from("trivia_rooms")
      .update({
        state: "completed",
        current_turn_id: null,
        phase_number: room.phase_number + 1,
        public_message: "Trivia complete. Final scoreboard is ready.",
      })
      .eq("id", roomId);
    if (completeError) throw completeError;
    return;
  }

  const nextTurn = nextTurnData as TriviaTurnDto;
  const { data: nextPlayerData, error: nextPlayerError } = await supabase.from("trivia_players").select("*").eq("id", nextTurn.player_id).single();
  if (nextPlayerError) throw nextPlayerError;

  const { error: roomError } = await supabase
    .from("trivia_rooms")
    .update({
      state: "question",
      current_turn_id: nextTurn.id,
      phase_number: room.phase_number + 1,
      public_message: `${(nextPlayerData as TriviaPlayerDto).display_name} is up next. Read the question out loud before revealing the answer.`,
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
}

export async function resetTriviaToLobby(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);

  const { error: turnsError } = await supabase.from("trivia_turns").delete().eq("room_id", roomId);
  if (turnsError) throw turnsError;

  const { error: playersError } = await supabase
    .from("trivia_players")
    .update({ score: 0, correct_answers: 0 })
    .eq("room_id", roomId);
  if (playersError) throw playersError;

  const { error: roomError } = await supabase
    .from("trivia_rooms")
    .update({
      state: "lobby",
      current_turn_id: null,
      selected_categories: [],
      phase_number: room.phase_number + 1,
      public_message: "Waiting for the host to choose categories and start Trivia.",
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
}
