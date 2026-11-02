import { joinRoomByCode, supabase } from "../../lib/supabase";
import type { ImposterPlayerDto, ImposterRoomDto } from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

const DISCUSSION_MS = 240000;
const VOTING_MS = 45000;

function futureIso(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("imposter_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as ImposterRoomDto;
}

async function getRoomPlayers(roomId: string) {
  const { data, error } = await supabase.from("imposter_room_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as ImposterPlayerDto[]) ?? [];
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

export async function createImposterRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("imposter_rooms")
    .insert({ code: makeRoomCode(), state: "lobby", public_message: "Waiting for players to join." })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("imposter_room_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: 1, status: "alive", role_reveal_ready: false, discussion_ready: false })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("imposter_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

// Joining goes through the database so it can check the room code, game state and
// player limit, and so a player re-joining from the same phone gets their old seat back.
export async function joinImposterRoom(code: string, displayName: string) {
  return joinRoomByCode("imposter", code, displayName);
}

export async function updateImposterCategory(roomId: string, playerId: string, categoryId: string) {
  await requireHost(roomId, playerId);
  const { error } = await supabase.from("imposter_rooms").update({ category_id: categoryId }).eq("id", roomId);
  if (error) throw error;
}

/** "Play again": same room and players back in the lobby; a new word is dealt on start. */
export async function returnImposterToLobby(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("imposter_return_to_lobby", { p_room: roomId });
  if (error) throw error;
}

// The database picks the word and the imposter, so no phone (not even the host's) knows
// anyone else's card. It also checks the host, the player count and the category.
export async function startImposterGame(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("imposter_start_game", { p_room: roomId });
  if (error) throw error;
}

export async function finishImposterReveal(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  const { error } = await supabase
    .from("imposter_room_players")
    .update({ role_reveal_ready: true })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (error) throw error;

  const players = await getRoomPlayers(roomId);
  if (players.length > 0 && players.every((player) => player.role_reveal_ready)) {
    const { error: roomError } = await supabase
      .from("imposter_rooms")
      .update({
        state: "discussion",
        phase_number: room.phase_number + 1,
        phase_ends_at: futureIso(DISCUSSION_MS),
        public_message: "Discuss the word and figure out who the imposter is.",
      })
      .eq("id", roomId);
    if (roomError) throw roomError;
  }
}

export async function submitImposterDiscussionReady(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  // Tapped just as the clock ran out and the voting opened: nothing left to do.
  if (room.state !== "discussion") return;

  const { error } = await supabase
    .from("imposter_room_players")
    .update({ discussion_ready: true })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (error) throw error;

  // Eliminated players can't press "ready", so only the players still in the game count.
  const alivePlayers = (await getRoomPlayers(roomId)).filter((player) => player.status === "alive");
  if (alivePlayers.length > 0 && alivePlayers.every((player) => player.discussion_ready)) {
    const { error: roomError } = await supabase
      .from("imposter_rooms")
      .update({
        state: "voting",
        phase_number: room.phase_number + 1,
        phase_ends_at: futureIso(VOTING_MS),
        public_message: "Vote for the player you think is the imposter.",
      })
      .eq("id", roomId);
    if (roomError) throw roomError;
  }
}

export async function startImposterVoting(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "discussion") throw new Error("Discussion must finish before voting");

  const { error: resetError } = await supabase
    .from("imposter_room_players")
    .update({ discussion_ready: false })
    .eq("room_id", roomId)
    .eq("status", "alive");
  if (resetError) throw resetError;

  const { error } = await supabase
    .from("imposter_rooms")
    .update({
      state: "voting",
      phase_number: room.phase_number + 1,
      phase_ends_at: futureIso(VOTING_MS),
      public_message: "Vote for the player you think is the imposter.",
    })
    .eq("id", roomId);
  if (error) throw error;
}

export async function submitImposterVote(roomId: string, playerId: string, targetPlayerId: string) {
  const room = await getRoom(roomId);
  if (room.state !== "voting") throw new Error("Voting is closed");
  if (playerId === targetPlayerId) throw new Error("You cannot vote for yourself");

  const { data: voter, error: voterError } = await supabase.from("imposter_room_players").select("*").eq("id", playerId).single();
  if (voterError) throw voterError;
  if (voter.status !== "alive") throw new Error("Only living players can vote");

  const { data: target, error: targetError } = await supabase.from("imposter_room_players").select("*").eq("id", targetPlayerId).single();
  if (targetError) throw targetError;
  if (target.status !== "alive") throw new Error("Choose a living player");

  const { error } = await supabase.from("imposter_votes").upsert(
    {
      room_id: roomId,
      phase_number: room.phase_number,
      voter_player_id: playerId,
      target_player_id: targetPlayerId,
    },
    { onConflict: "room_id,phase_number,voter_player_id" }
  );
  if (error) throw error;
}

// Counted by the database, which is the only place that knows who the imposter is.
export async function resolveImposterVoting(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("imposter_resolve_voting", { p_room: roomId });
  if (error) throw error;
}
