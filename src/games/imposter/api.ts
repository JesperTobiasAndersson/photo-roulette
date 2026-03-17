import { supabase } from "../../lib/supabase";
import { assignImposterRoles, getWinnerAfterElimination, pickPromptForCategory, resolveVotes } from "./logic";
import type { ImposterPlayerDto, ImposterRoleDto, ImposterRoomDto, ImposterVoteDto } from "./types";

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

export async function joinImposterRoom(code: string, displayName: string) {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");
  if (!trimmedCode) throw new Error("Enter a room code");

  const { data: room, error: roomError } = await supabase.from("imposter_rooms").select("*").eq("code", trimmedCode).single();
  if (roomError) throw roomError;
  if (room.state !== "lobby") throw new Error("Game already started");

  const { count, error: countError } = await supabase
    .from("imposter_room_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countError) throw countError;

  const { data: player, error: playerError } = await supabase
    .from("imposter_room_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: (count ?? 0) + 1, status: "alive", role_reveal_ready: false, discussion_ready: false })
    .select("*")
    .single();
  if (playerError) throw playerError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function updateImposterCategory(roomId: string, playerId: string, categoryId: string) {
  await requireHost(roomId, playerId);
  const { error } = await supabase.from("imposter_rooms").update({ category_id: categoryId }).eq("id", roomId);
  if (error) throw error;
}

export async function startImposterGame(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  const players = await getRoomPlayers(roomId);
  if (players.length < 3) throw new Error("At least 3 players are required");
  if (!room.category_id) throw new Error("Choose a category first");

  const prompt = pickPromptForCategory(room.category_id);
  const { roles } = assignImposterRoles(
    players.map((player) => player.id),
    prompt
  );

  const { error: clearRolesError } = await supabase.from("imposter_player_roles").delete().eq("room_id", roomId);
  if (clearRolesError) throw clearRolesError;
  const { error: clearVotesError } = await supabase.from("imposter_votes").delete().eq("room_id", roomId);
  if (clearVotesError) throw clearVotesError;

  const { error: rolesError } = await supabase.from("imposter_player_roles").insert(
    players.map((player) => ({
      player_id: player.id,
      room_id: roomId,
      role: roles[player.id].role,
      prompt: roles[player.id].prompt,
      revealed_at: null,
    }))
  );
  if (rolesError) throw rolesError;

  const { error: playersResetError } = await supabase
    .from("imposter_room_players")
    .update({ status: "alive", role_reveal_ready: false, discussion_ready: false })
    .eq("room_id", roomId);
  if (playersResetError) throw playersResetError;

  const { error: roomError } = await supabase
    .from("imposter_rooms")
    .update({
      state: "role_reveal",
      secret_prompt: prompt,
      phase_number: room.phase_number + 1,
      phase_ends_at: null,
      winner: null,
      public_message: "Roles assigned. Reveal your card privately.",
    })
    .eq("id", roomId);
  if (roomError) throw roomError;
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
  if (room.state !== "discussion") throw new Error("Discussion is not active");

  const { error } = await supabase
    .from("imposter_room_players")
    .update({ discussion_ready: true })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (error) throw error;

  const players = await getRoomPlayers(roomId);
  if (players.length > 0 && players.every((player) => player.discussion_ready)) {
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

export async function resolveImposterVoting(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "voting") throw new Error("Voting is not active");

  const [{ data: votes, error: votesError }, { data: roles, error: rolesError }, { data: players, error: playersError }] = await Promise.all([
    supabase.from("imposter_votes").select("*").eq("room_id", roomId).eq("phase_number", room.phase_number),
    supabase.from("imposter_player_roles").select("*").eq("room_id", roomId),
    supabase.from("imposter_room_players").select("*").eq("room_id", roomId).order("seat_order"),
  ]);
  if (votesError) throw votesError;
  if (rolesError) throw rolesError;
  if (playersError) throw playersError;

  const result = resolveVotes((votes as ImposterVoteDto[]) ?? [], (roles as ImposterRoleDto[]) ?? []);
  const playerRows = (players as ImposterPlayerDto[]) ?? [];
  const winner = getWinnerAfterElimination(playerRows, (roles as ImposterRoleDto[]) ?? [], result.eliminatedPlayerId);

  if (result.eliminatedPlayerId) {
    const { error: eliminateError } = await supabase
      .from("imposter_room_players")
      .update({ status: "eliminated" })
      .eq("id", result.eliminatedPlayerId)
      .eq("room_id", roomId);
    if (eliminateError) throw eliminateError;
  }

  if (winner) {
    const { error } = await supabase
      .from("imposter_rooms")
      .update({
        state: "ended",
        winner,
        phase_number: room.phase_number + 1,
        phase_ends_at: null,
        public_message: winner === "crew" ? result.summary : "Only two players remain. The imposter takes the win.",
      })
      .eq("id", roomId);
    if (error) throw error;
    return;
  }

  const { error: resetReadyError } = await supabase
    .from("imposter_room_players")
    .update({ discussion_ready: false })
    .eq("room_id", roomId)
    .eq("status", "alive");
  if (resetReadyError) throw resetReadyError;

  const { error } = await supabase
    .from("imposter_rooms")
    .update({
      state: "discussion",
      winner: null,
      phase_number: room.phase_number + 1,
      phase_ends_at: futureIso(DISCUSSION_MS),
      public_message: result.eliminatedPlayerId
        ? "The group voted out the wrong player. The game continues."
        : "Nobody was eliminated. Keep discussing.",
    })
    .eq("id", roomId);
  if (error) throw error;
}
