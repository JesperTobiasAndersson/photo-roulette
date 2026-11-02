import { joinRoomByCode, supabase } from "../../lib/supabase";
import type { MafiaPlayerDto, MafiaRoomDto } from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

const NIGHT_MS = 45000;
const DISCUSSION_MS = 300000;
const VOTING_MS = 35000;

function futureIso(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("mafia_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as MafiaRoomDto;
}

async function getRoomPlayers(roomId: string) {
  const { data, error } = await supabase.from("mafia_room_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as MafiaPlayerDto[]) ?? [];
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

export async function createMafiaRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("mafia_rooms")
    .insert({ code: makeRoomCode(), state: "lobby", public_message: "Waiting for players." })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("mafia_room_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: 1, status: "alive", role_reveal_ready: false, discussion_ready: false })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("mafia_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

// Joining goes through the database so it can check the room code, game state and
// player limit, and so a player re-joining from the same phone gets their old seat back.
export async function joinMafiaRoom(code: string, displayName: string) {
  return joinRoomByCode("mafia", code, displayName);
}

/** "Play again": same room and players back in the lobby; roles are dealt fresh on start. */
export async function returnMafiaToLobby(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("mafia_return_to_lobby", { p_room: roomId });
  if (error) throw error;
}

// Roles are dealt by the database, so no phone (not even the host's) learns anyone else's role.
export async function startMafiaGame(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("mafia_start_game", { p_room: roomId });
  if (error) throw error;
}

export async function finishRoleReveal(roomId: string, playerId: string) {
  const { error } = await supabase.from("mafia_room_players").update({ role_reveal_ready: true }).eq("id", playerId).eq("room_id", roomId);
  if (error) throw error;

  const { data: players, error: playersError } = await supabase.from("mafia_room_players").select("*").eq("room_id", roomId);
  if (playersError) throw playersError;
  if ((players ?? []).every((player: MafiaPlayerDto) => player.role_reveal_ready)) {
    const { error: updateError } = await supabase
      .from("mafia_rooms")
      .update({
        state: "night",
        phase_number: 2,
        phase_ends_at: futureIso(NIGHT_MS),
        public_message: "Night has started. Everyone has something to do.",
      })
      .eq("id", roomId);
    if (updateError) throw updateError;
  }
}

// The database fills in the actor's role, so a phone can't act as a role it doesn't have.
export async function submitNightAction(roomId: string, _playerId: string, targetPlayerId: string | null, confirm = false) {
  const { error } = await supabase.rpc("mafia_submit_night_action", { p_room: roomId, p_target: targetPlayerId, p_confirm: confirm });
  if (error) throw error;
}

export async function submitNightContinue(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.state !== "night") throw new Error("Night is not active");

  const [{ data: player, error: playerError }, { data: role, error: roleError }, { data: action, error: actionError }] = await Promise.all([
    supabase.from("mafia_room_players").select("*").eq("id", playerId).eq("room_id", roomId).single(),
    supabase.from("mafia_player_roles").select("*").eq("player_id", playerId).single(),
    supabase.from("mafia_night_actions").select("*").eq("actor_player_id", playerId).eq("room_id", roomId).eq("phase_number", room.phase_number).maybeSingle(),
  ]);

  if (playerError) throw playerError;
  if (roleError) throw roleError;
  if (actionError) throw actionError;
  if (player.status !== "alive" || !role.is_alive) throw new Error("Only living players can continue");
  if (!action?.confirmed) throw new Error("Confirm your night action first");

  const { error } = await supabase
    .from("mafia_room_players")
    .update({ discussion_ready: true })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (error) throw error;
}

// Resolved by the database, the only place that sees every night action.
export async function resolveNight(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("mafia_resolve_night", { p_room: roomId });
  if (error) throw error;
}

export async function startDayDiscussion(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "night_result") throw new Error("You can only continue after the night result");

  const { error: resetReadyError } = await supabase.from("mafia_room_players").update({ discussion_ready: false }).eq("room_id", roomId);
  if (resetReadyError) throw resetReadyError;

  const { error } = await supabase
    .from("mafia_rooms")
    .update({
      state: "day_discussion",
      phase_number: room.phase_number + 1,
      phase_ends_at: futureIso(DISCUSSION_MS),
      public_message: "Discuss what happened and decide who to accuse.",
    })
    .eq("id", roomId);
  if (error) throw error;
}

export async function submitDiscussionReady(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.state !== "day_discussion") throw new Error("Discussion is not active");

  const { data: player, error: playerError } = await supabase.from("mafia_room_players").select("*").eq("id", playerId).eq("room_id", roomId).single();
  if (playerError) throw playerError;
  if (player.status !== "alive") throw new Error("Only living players can mark ready");

  const { error: readyError } = await supabase.from("mafia_room_players").update({ discussion_ready: true }).eq("id", playerId).eq("room_id", roomId);
  if (readyError) throw readyError;

  const players = await getRoomPlayers(roomId);
  const alivePlayers = players.filter((currentPlayer) => currentPlayer.status === "alive");
  if (alivePlayers.length > 0 && alivePlayers.every((currentPlayer) => currentPlayer.discussion_ready)) {
    const { error: updateError } = await supabase
      .from("mafia_rooms")
      .update({
        state: "day_voting",
        phase_number: room.phase_number + 1,
        phase_ends_at: futureIso(VOTING_MS),
        public_message: "Everyone is ready. Vote for the player you want to eliminate.",
      })
      .eq("id", roomId);
    if (updateError) throw updateError;
  }
}

export async function startDayVoting(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "day_discussion") throw new Error("Discussion must finish before voting starts");

  const { error: resetReadyError } = await supabase.from("mafia_room_players").update({ discussion_ready: false }).eq("room_id", roomId);
  if (resetReadyError) throw resetReadyError;

  const { error } = await supabase
    .from("mafia_rooms")
    .update({
      state: "day_voting",
      phase_number: room.phase_number + 1,
      phase_ends_at: futureIso(VOTING_MS),
      public_message: "Vote for the player you want to eliminate.",
    })
    .eq("id", roomId);
  if (error) throw error;
}

export async function submitDayVote(roomId: string, playerId: string, targetPlayerId: string) {
  const room = await getRoom(roomId);
  if (room.state !== "day_voting") throw new Error("Voting is closed");

  if (targetPlayerId === playerId) throw new Error("You cannot vote for yourself");

  // Alive/out is public on the player rows (roles are private).
  const players = await getRoomPlayers(roomId);
  if (players.find((player) => player.id === playerId)?.status !== "alive") throw new Error("Only living players can vote");
  if (players.find((player) => player.id === targetPlayerId)?.status !== "alive") throw new Error("Choose a living player");

  const { error } = await supabase.from("mafia_day_votes").upsert(
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

export async function resolveDayVote(roomId: string, _playerId: string) {
  const { error } = await supabase.rpc("mafia_resolve_day_vote", { p_room: roomId });
  if (error) throw error;
}

export async function startNextNight(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "vote_result") throw new Error("You can only continue after the vote result");

  const { error: resetReadyError } = await supabase
    .from("mafia_room_players")
    .update({ discussion_ready: false, night_action_confirmed: false })
    .eq("room_id", roomId);
  if (resetReadyError) throw resetReadyError;

  const { error } = await supabase
    .from("mafia_rooms")
    .update({
      state: "night",
      phase_number: room.phase_number + 1,
      phase_ends_at: futureIso(NIGHT_MS),
      public_message: "Night has started. Everyone has something to do.",
    })
    .eq("id", roomId);
  if (error) throw error;
}
