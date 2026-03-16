import type { MafiaRole, NightActionRow, PlayerRow, RoleRow, RoomRow } from "./types.ts";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function assignRoles(playerIds: string[]): Record<string, MafiaRole> {
  const shuffled = shuffle(playerIds);
  const assignments: Record<string, MafiaRole> = {};
  const mafiaCount = shuffled.length >= 7 ? 2 : 1;

  shuffled.forEach((playerId, index) => {
    if (index < mafiaCount) assignments[playerId] = "mafia";
    else if (index === mafiaCount) assignments[playerId] = "doctor";
    else if (index === mafiaCount + 1) assignments[playerId] = "police";
    else assignments[playerId] = "villager";
  });

  return assignments;
}

export function getAlivePlayers(players: PlayerRow[], roles: RoleRow[]) {
  const aliveSet = new Set(roles.filter((role) => role.is_alive).map((role) => role.player_id));
  return players.filter((player) => aliveSet.has(player.id));
}

export function getWinner(roles: RoleRow[]) {
  const alive = roles.filter((role) => role.is_alive);
  const mafiaAlive = alive.filter((role) => role.role === "mafia").length;
  const villageAlive = alive.length - mafiaAlive;

  if (mafiaAlive === 0) return "village";
  if (mafiaAlive >= villageAlive) return "mafia";
  return null;
}

export function resolveNight(actions: NightActionRow[], roles: RoleRow[]) {
  const mafiaActions = actions.filter((action) => action.actor_role === "mafia");
  const doctorAction = actions.find((action) => action.actor_role === "doctor");
  const policeAction = actions.find((action) => action.actor_role === "police");

  const allConfirmedSameTarget =
    mafiaActions.length > 0 &&
    mafiaActions.every((action) => action.confirmed) &&
    new Set(mafiaActions.map((action) => action.target_player_id)).size === 1;

  let killTarget: string | null = null;
  if (allConfirmedSameTarget) {
    killTarget = mafiaActions[0].target_player_id;
  } else {
    const counts: Record<string, number> = {};
    mafiaActions.forEach((action) => {
      if (!action.target_player_id) return;
      counts[action.target_player_id] = (counts[action.target_player_id] ?? 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 1) killTarget = sorted[0][0];
    if (sorted.length > 1 && sorted[0][1] > sorted[1][1]) killTarget = sorted[0][0];
  }

  const doctorTarget = doctorAction?.target_player_id ?? null;
  const eliminatedPlayerId = killTarget && killTarget !== doctorTarget ? killTarget : null;
  const policeTarget = policeAction?.target_player_id ?? null;
  const policeAlignment = policeTarget
    ? roles.find((role) => role.player_id === policeTarget)?.role === "mafia"
      ? "mafia"
      : "village"
    : null;

  return {
    eliminatedPlayerId,
    policeTarget,
    policeAlignment,
    summary: eliminatedPlayerId ? "Someone was eliminated during the night." : "Nobody was eliminated during the night.",
  };
}

export function resolveDayVote(votes: { target_player_id: string }[]) {
  const counts: Record<string, number> = {};
  votes.forEach((vote) => {
    counts[vote.target_player_id] = (counts[vote.target_player_id] ?? 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { eliminatedPlayerId: null, summary: "No votes were cast." };
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return { eliminatedPlayerId: null, summary: "The vote tied. Nobody was eliminated." };
  }
  return { eliminatedPlayerId: sorted[0][0], summary: "The village eliminated a player." };
}

export function nextPhaseAfterNight(room: RoomRow) {
  return { state: "night_result", phase_number: room.phase_number + 1 } as const;
}

export function nextPhaseAfterVote(room: RoomRow) {
  return { state: "vote_result", phase_number: room.phase_number + 1 } as const;
}
