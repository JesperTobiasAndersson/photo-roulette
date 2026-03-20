import { supabase } from "../../lib/supabase";
import { assignRoles, getWinner, resolveDayVotes, resolveNightActions } from "./logic";
import type { MafiaNightActionDto, MafiaPlayerDto, MafiaRoleDto, MafiaRoomDto } from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

const ROLE_REVEAL_MS = 12000;
const NIGHT_MS = 45000;
const NIGHT_RESULT_MS = 10000;
const DISCUSSION_MS = 300000;
const VOTING_MS = 35000;
const VOTE_RESULT_MS = 10000;

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

async function getRoles(roomId: string) {
  const { data, error } = await supabase.from("mafia_player_roles").select("*").eq("room_id", roomId);
  if (error) throw error;
  return (data as MafiaRoleDto[]) ?? [];
}

function chooseRolesForNewGame(playerIds: string[], hostPlayerId: string | null, previousRoles: MafiaRoleDto[]) {
  const previousHostRole = hostPlayerId ? previousRoles.find((role) => role.player_id === hostPlayerId)?.role ?? null : null;
  let roles = assignRoles(playerIds);

  if (hostPlayerId && previousHostRole === "mafia" && playerIds.length > 4) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (roles[hostPlayerId] !== "mafia") break;
      roles = assignRoles(playerIds);
    }
  }

  return roles;
}

async function requireHost(roomId: string, playerId: string) {
  const room = await getRoom(roomId);
  if (room.host_player_id !== playerId) throw new Error("Only the host can do that");
  return room;
}

async function updatePlayerElimination(playerId: string) {
  const { error: roleError } = await supabase.from("mafia_player_roles").update({ is_alive: false }).eq("player_id", playerId);
  if (roleError) throw roleError;
  const { error: playerError } = await supabase.from("mafia_room_players").update({ status: "eliminated" }).eq("id", playerId);
  if (playerError) throw playerError;
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

export async function joinMafiaRoom(code: string, displayName: string) {
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");
  if (!trimmedCode) throw new Error("Enter a room code");

  const { data: room, error: roomError } = await supabase.from("mafia_rooms").select("*").eq("code", trimmedCode).single();
  if (roomError) throw roomError;
  if (room.state !== "lobby") throw new Error("Game already started");

  const { count, error: countError } = await supabase
    .from("mafia_room_players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);
  if (countError) throw countError;

  const { data: player, error: playerError } = await supabase
    .from("mafia_room_players")
    .insert({ room_id: room.id, display_name: trimmedName, seat_order: (count ?? 0) + 1, status: "alive", role_reveal_ready: false, discussion_ready: false })
    .select("*")
    .single();
  if (playerError) throw playerError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

export async function startMafiaGame(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  const players = await getRoomPlayers(roomId);
  if (!players || players.length < 4) throw new Error("At least 4 players are required");

  const previousRoles = await getRoles(roomId);
  const roles = chooseRolesForNewGame(
    players.map((player) => player.id),
    room.host_player_id,
    previousRoles
  );

  const { error: clearRolesError } = await supabase.from("mafia_player_roles").delete().eq("room_id", roomId);
  if (clearRolesError) throw clearRolesError;
  const { error: clearActionsError } = await supabase.from("mafia_night_actions").delete().eq("room_id", roomId);
  if (clearActionsError) throw clearActionsError;
  const { error: clearVotesError } = await supabase.from("mafia_day_votes").delete().eq("room_id", roomId);
  if (clearVotesError) throw clearVotesError;
  const { error: clearReportsError } = await supabase.from("mafia_police_reports").delete().eq("room_id", roomId);
  if (clearReportsError) throw clearReportsError;
  const { error: clearEventsError } = await supabase.from("mafia_game_events").delete().eq("room_id", roomId);
  if (clearEventsError) throw clearEventsError;

  const { error: rolesError } = await supabase.from("mafia_player_roles").insert(
    players.map((player) => ({
      player_id: player.id,
      room_id: roomId,
      role: roles[player.id],
      is_alive: true,
      revealed_at: null,
    }))
  );
  if (rolesError) throw rolesError;

  const { error: roomUpdateError } = await supabase
    .from("mafia_rooms")
    .update({
      state: "role_reveal",
      phase_number: 1,
      winner: null,
      phase_ends_at: futureIso(ROLE_REVEAL_MS),
      public_message: "Roles assigned. Reveal your role privately.",
    })
    .eq("id", roomId);
  if (roomUpdateError) throw roomUpdateError;

  const { error: playerResetError } = await supabase
    .from("mafia_room_players")
    .update({ status: "alive", role_reveal_ready: false, discussion_ready: false })
    .eq("room_id", roomId);
  if (playerResetError) throw playerResetError;
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

export async function submitNightAction(roomId: string, playerId: string, targetPlayerId: string | null, confirm = false) {
  const room = await getRoom(roomId);
  if (room.state !== "night") throw new Error("Night actions are closed");

  const { data: role, error: roleError } = await supabase.from("mafia_player_roles").select("*").eq("player_id", playerId).single();
  if (roleError) throw roleError;
  if (!role.is_alive) throw new Error("Only living players can act");
  if (role.room_id !== roomId) throw new Error("Player is not in this room");

  if (role.role !== "villager" && !targetPlayerId) {
    throw new Error("Choose a target first");
  }

  const { data: targetRole } =
    targetPlayerId
      ? await supabase.from("mafia_player_roles").select("player_id,is_alive").eq("player_id", targetPlayerId).eq("room_id", roomId).maybeSingle()
      : { data: null };
  if (targetPlayerId && (!targetRole || !targetRole.is_alive)) {
    throw new Error("Choose a living player");
  }

  const { error } = await supabase.from("mafia_night_actions").upsert(
    {
      room_id: roomId,
      phase_number: room.phase_number,
      actor_player_id: playerId,
      actor_role: role.role,
      target_player_id: targetPlayerId,
      fake_ready: role.role === "villager",
      confirmed: role.role === "villager" ? true : !!confirm,
    },
    { onConflict: "room_id,phase_number,actor_player_id" }
  );
  if (error) throw error;

  const { error: resetContinueError } = await supabase
    .from("mafia_room_players")
    .update({ discussion_ready: false })
    .eq("id", playerId)
    .eq("room_id", roomId);
  if (resetContinueError) throw resetContinueError;

  const { data: mafiaActions } = await supabase
    .from("mafia_night_actions")
    .select("*")
    .eq("room_id", roomId)
    .eq("phase_number", room.phase_number)
    .eq("actor_role", "mafia");

  const sameTarget =
    mafiaActions &&
    mafiaActions.length > 0 &&
    mafiaActions.every((row: MafiaNightActionDto) => row.confirmed) &&
    new Set(mafiaActions.map((row: MafiaNightActionDto) => row.target_player_id)).size === 1;

  if (sameTarget) {
    const { error: lockError } = await supabase
      .from("mafia_night_actions")
      .update({ locked_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("phase_number", room.phase_number)
      .eq("actor_role", "mafia");
    if (lockError) throw lockError;
  }
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

export async function resolveNight(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "night") throw new Error("Night is not active");

  const [{ data: actions, error: actionsError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("mafia_night_actions").select("*").eq("room_id", roomId).eq("phase_number", room.phase_number),
    supabase.from("mafia_player_roles").select("*").eq("room_id", roomId),
  ]);
  if (actionsError) throw actionsError;
  if (rolesError) throw rolesError;

  const result = resolveNightActions((actions as MafiaNightActionDto[]) ?? [], (roles as MafiaRoleDto[]) ?? []);
  if (result.eliminatedPlayerId) {
    await updatePlayerElimination(result.eliminatedPlayerId);
  }

  if (result.policeTarget) {
    const policeAction = (actions as MafiaNightActionDto[]).find((action) => action.actor_role === "police");
    if (policeAction && result.policeAlignment) {
      await supabase.from("mafia_police_reports").upsert(
        {
          room_id: roomId,
          phase_number: room.phase_number,
          police_player_id: policeAction.actor_player_id,
          target_player_id: result.policeTarget,
          result_alignment: result.policeAlignment,
        },
        { onConflict: "room_id,phase_number,police_player_id" }
      );
    }
  }

  const updatedRoles = ((roles as MafiaRoleDto[]) ?? []).map((row) =>
    result.eliminatedPlayerId && row.player_id === result.eliminatedPlayerId ? { ...row, is_alive: false } : row
  );
  const winner = getWinner(updatedRoles);

  await supabase.from("mafia_game_events").insert({
    room_id: roomId,
    phase_number: room.phase_number,
    phase: "night_result",
    visible_to: "all",
    event_type: "night_result",
    payload: {
      summary: result.summary,
      eliminatedPlayerId: result.eliminatedPlayerId,
      doctorSaved: result.doctorSaved,
      doctorSavedPlayerId: result.doctorSavedPlayerId,
    },
  });

  const { error: updateError } = await supabase
    .from("mafia_rooms")
    .update({
      state: winner ? "ended" : "night_result",
      winner,
      phase_number: room.phase_number + 1,
      public_message: result.summary,
      phase_ends_at: winner ? null : futureIso(NIGHT_RESULT_MS),
    })
    .eq("id", roomId);
  if (updateError) throw updateError;
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

  const { data: voterRole, error: voterRoleError } = await supabase.from("mafia_player_roles").select("*").eq("player_id", playerId).single();
  if (voterRoleError) throw voterRoleError;
  if (!voterRole.is_alive) throw new Error("Only living players can vote");
  if (targetPlayerId === playerId) throw new Error("You cannot vote for yourself");

  const { data: targetRole, error: targetRoleError } = await supabase.from("mafia_player_roles").select("*").eq("player_id", targetPlayerId).single();
  if (targetRoleError) throw targetRoleError;
  if (!targetRole.is_alive) throw new Error("Choose a living player");

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

export async function resolveDayVote(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "day_voting") throw new Error("Voting is not active");

  const [{ data: votes, error: votesError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase.from("mafia_day_votes").select("*").eq("room_id", roomId).eq("phase_number", room.phase_number),
    supabase.from("mafia_player_roles").select("*").eq("room_id", roomId),
  ]);
  if (votesError) throw votesError;
  if (rolesError) throw rolesError;

  const result = resolveDayVotes((votes as { phase_number: number; target_player_id: string }[]) ?? []);
  if (result.eliminatedPlayerId) {
    await updatePlayerElimination(result.eliminatedPlayerId);
  }

  const updatedRoles = ((roles as MafiaRoleDto[]) ?? []).map((row) =>
    result.eliminatedPlayerId && row.player_id === result.eliminatedPlayerId ? { ...row, is_alive: false } : row
  );
  const winner = getWinner(updatedRoles);

  await supabase.from("mafia_game_events").insert({
    room_id: roomId,
    phase_number: room.phase_number,
    phase: "vote_result",
    visible_to: "all",
    event_type: "vote_result",
    payload: { summary: result.summary, eliminatedPlayerId: result.eliminatedPlayerId },
  });

  const { error: updateError } = await supabase
    .from("mafia_rooms")
    .update({
      state: winner ? "ended" : "vote_result",
      winner,
      phase_number: room.phase_number + 1,
      public_message: result.summary,
      phase_ends_at: winner ? null : futureIso(VOTE_RESULT_MS),
    })
    .eq("id", roomId);
  if (updateError) throw updateError;
}

export async function checkWinCondition(roomId: string) {
  const { data: roles, error } = await supabase.from("mafia_player_roles").select("*").eq("room_id", roomId);
  if (error) throw error;
  const winner = getWinner((roles as MafiaRoleDto[]) ?? []);
  if (winner) {
    const { error: updateError } = await supabase.from("mafia_rooms").update({ state: "ended", winner, phase_ends_at: null }).eq("id", roomId);
    if (updateError) throw updateError;
  }
  return { winner };
}

export async function startNextNight(roomId: string, playerId: string) {
  const room = await requireHost(roomId, playerId);
  if (room.state !== "vote_result") throw new Error("You can only continue after the vote result");

  const { error: resetReadyError } = await supabase.from("mafia_room_players").update({ discussion_ready: false }).eq("room_id", roomId);
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
