import { supabase } from "../../lib/supabase";
import { MUSIC_QUIZ_LIBRARY } from "./data";
import { loadSpotifyTrackPreview } from "./spotify";
import type { MusicQuizAnswerDto, MusicQuizPlayerDto, MusicQuizPromptType, MusicQuizRoomDto, MusicQuizSongPool } from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("music_quiz_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as MusicQuizRoomDto;
}

async function getPlayers(roomId: string) {
  const { data, error } = await supabase.from("music_quiz_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as MusicQuizPlayerDto[]) ?? [];
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") return String(error ?? "");
  const parts = [
    "message" in error ? String((error as { message?: unknown }).message ?? "") : "",
    "details" in error ? String((error as { details?: unknown }).details ?? "") : "",
    "hint" in error ? String((error as { hint?: unknown }).hint ?? "") : "",
  ];
  return parts.join(" ").toLowerCase();
}

function isMissingMusicQuizColumnError(error: unknown, column: string) {
  const text = getErrorText(error);
  return text.includes(column.toLowerCase()) && (text.includes("column") || text.includes("schema cache") || text.includes("could not find"));
}

function isCompletedStateConstraintError(error: unknown) {
  const text = getErrorText(error);
  return text.includes("completed") && (text.includes("check constraint") || text.includes("violates") || text.includes("invalid input value") || text.includes("state"));
}

export async function createMusicQuizRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("music_quiz_rooms")
    .insert({ code: makeRoomCode(), state: "lobby", public_message: "Waiting for the host to choose a category." })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("music_quiz_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: 1, score: 0 })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("music_quiz_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function joinMusicQuizRoom(code: string, displayName: string) {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");
  if (!trimmedCode) throw new Error("Enter a room code");

  const { data: room, error: roomError } = await supabase.from("music_quiz_rooms").select("*").eq("code", trimmedCode).single();
  if (roomError) throw roomError;

  const { count, error: countError } = await supabase
    .from("music_quiz_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countError) throw countError;

  const { data: player, error: playerError } = await supabase
    .from("music_quiz_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: (count ?? 0) + 1, score: 0 })
    .select("*")
    .single();
  if (playerError) throw playerError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function startMusicQuizRound(
  roomId: string,
  playerId: string,
  input: {
    songPool: MusicQuizSongPool;
    promptType: MusicQuizPromptType;
    spotifyUrl: string;
    spotifyTrackId: string;
    songTitle: string;
    artistName: string;
    artistSpotifyUrl?: string;
    coverImageUrl: string | null;
    pointValue: number;
  }
) {
  const room = await requireHost(roomId, playerId);
  if (room.state === "question") throw new Error("Finish the current round first");

  const { data: lastRound, error: lastRoundError } = await supabase
    .from("music_quiz_rounds")
    .select("round_number")
    .eq("room_id", roomId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRoundError) throw lastRoundError;

  const pointValue = Math.max(1, Math.min(10, Math.round(input.pointValue || 1)));

  const { data: round, error: roundError } = await supabase
    .from("music_quiz_rounds")
    .insert({
      room_id: roomId,
      round_number: (lastRound?.round_number ?? 0) + 1,
      prompt_type: input.promptType,
      spotify_url: input.spotifyUrl,
      spotify_track_id: input.spotifyTrackId,
      song_title: input.songTitle,
      artist_name: input.artistName,
      artist_spotify_url: input.artistSpotifyUrl ?? null,
      cover_image_url: input.coverImageUrl,
      point_value: pointValue,
      state: "question",
    })
    .select("*")
    .single();
  if (roundError) throw roundError;

  const promptText = input.promptType === "artist" ? "Guess the artist" : "Guess the song title";
  const nextRoomValues = {
    state: "question",
    current_round_id: round.id,
    selected_pool: input.songPool,
    phase_number: room.phase_number + 1,
    public_message: `${promptText}. Round ${round.round_number} is live.`,
  };
  const { error: roomUpdateError } = await supabase
    .from("music_quiz_rooms")
    .update(nextRoomValues)
    .eq("id", roomId);
  if (roomUpdateError) {
    if (!isMissingMusicQuizColumnError(roomUpdateError, "selected_pool")) throw roomUpdateError;
    const { error: fallbackError } = await supabase
      .from("music_quiz_rooms")
      .update({
        state: "question",
        current_round_id: round.id,
        phase_number: room.phase_number + 1,
        public_message: `${promptText}. Round ${round.round_number} is live.`,
      })
      .eq("id", roomId);
    if (fallbackError) throw fallbackError;
  }
}

export async function loadRandomMusicQuizTrack(roomId: string, playerId: string, pool: MusicQuizSongPool) {
  await requireHost(roomId, playerId);

  const { data: rounds, error } = await supabase.from("music_quiz_rounds").select("spotify_track_id").eq("room_id", roomId);
  if (error) throw error;

  const usedTrackIds = new Set((rounds ?? []).map((entry: { spotify_track_id: string }) => entry.spotify_track_id));
  const filteredLibrary = MUSIC_QUIZ_LIBRARY.filter((entry) => pool === "mix" || entry.category === pool);
  const unusedLibrary = filteredLibrary.filter((entry) => !usedTrackIds.has(entry.spotifyTrackId));
  const source = unusedLibrary.length > 0 ? unusedLibrary : filteredLibrary;
  if (source.length === 0) {
    throw new Error("No songs available in that playlist");
  }

  const nextEntry = source[Math.floor(Math.random() * source.length)];
  return loadSpotifyTrackPreview(nextEntry);
}

export async function submitMusicQuizAnswer(roomId: string, playerId: string, answerText: string) {
  const room = await getRoom(roomId);
  if (room.state !== "question" || !room.current_round_id) throw new Error("There is no active question");

  const trimmedAnswer = answerText.trim();
  if (!trimmedAnswer) throw new Error("Enter an answer first");

  const { error } = await supabase.from("music_quiz_answers").upsert(
    {
      round_id: room.current_round_id,
      player_id: playerId,
      answer_text: trimmedAnswer,
      awarded_points: 0,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "round_id,player_id" }
  );
  if (error) throw error;
}

export async function revealMusicQuizRound(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (!room.current_round_id) throw new Error("There is no active round");

  const { error: roundError } = await supabase.from("music_quiz_rounds").update({ state: "reveal" }).eq("id", room.current_round_id);
  if (roundError) throw roundError;

  const { error: roomError } = await supabase
    .from("music_quiz_rooms")
    .update({
      state: "reveal",
      public_message: "Answer reveal is live. Tap the cover to open the exact Spotify track.",
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
}

export async function awardMusicQuizPoints(roomId: string, playerId: string, targetPlayerId: string, points: number) {
  const room = await requireHost(roomId, playerId);
  if (!room.current_round_id) throw new Error("There is no round to score");
  if (room.state !== "reveal") throw new Error("Reveal the answer before awarding points");

  const { data: answer, error: answerError } = await supabase
    .from("music_quiz_answers")
    .select("*")
    .eq("round_id", room.current_round_id)
    .eq("player_id", targetPlayerId)
    .maybeSingle();
  if (answerError) throw answerError;

  const nextPoints = Math.max(0, Math.round(points));
  const previousPoints = (answer as MusicQuizAnswerDto | null)?.awarded_points ?? 0;
  if (!answer) {
    const { error: insertError } = await supabase.from("music_quiz_answers").insert({
      round_id: room.current_round_id,
      player_id: targetPlayerId,
      answer_text: "",
      awarded_points: nextPoints,
      submitted_at: null,
    });
    if (insertError) throw insertError;
  } else {
    const { error: updateAnswerError } = await supabase
      .from("music_quiz_answers")
      .update({ awarded_points: nextPoints })
      .eq("id", (answer as MusicQuizAnswerDto).id);
    if (updateAnswerError) throw updateAnswerError;
  }

  const { data: player, error: playerError } = await supabase.from("music_quiz_players").select("*").eq("id", targetPlayerId).single();
  if (playerError) throw playerError;

  const scoreDelta = nextPoints - previousPoints;
  const { error: playerUpdateError } = await supabase
    .from("music_quiz_players")
    .update({ score: Math.max(0, ((player as MusicQuizPlayerDto).score ?? 0) + scoreDelta) })
    .eq("id", targetPlayerId);
  if (playerUpdateError) throw playerUpdateError;
}

export async function resetMusicQuizToLobby(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  const { error } = await supabase
    .from("music_quiz_rooms")
    .update({
      state: "lobby",
      current_round_id: null,
      selected_pool: null,
      phase_number: room.phase_number + 1,
      public_message: "Waiting for the host to choose a category.",
    })
    .eq("id", roomId);
  if (error) {
    if (!isMissingMusicQuizColumnError(error, "selected_pool")) throw error;
    const { error: fallbackError } = await supabase
      .from("music_quiz_rooms")
      .update({
        state: "lobby",
        current_round_id: null,
        phase_number: room.phase_number + 1,
        public_message: "Waiting for the host to choose a category.",
      })
      .eq("id", roomId);
    if (fallbackError) throw fallbackError;
  }
}

export async function completeMusicQuizGame(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  const { error } = await supabase
    .from("music_quiz_rooms")
    .update({
      state: "completed",
      current_round_id: null,
      phase_number: room.phase_number + 1,
      public_message: "Game complete. Final scoreboard is locked in.",
    })
    .eq("id", roomId);
  if (error) {
    if (!isCompletedStateConstraintError(error)) throw error;
    const { error: fallbackError } = await supabase
      .from("music_quiz_rooms")
      .update({
        state: "reveal",
        current_round_id: null,
        phase_number: room.phase_number + 1,
        public_message: "Game complete. Final scoreboard is locked in.",
      })
      .eq("id", roomId);
    if (fallbackError) throw fallbackError;
  }
}
