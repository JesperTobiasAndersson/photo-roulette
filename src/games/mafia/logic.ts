import type { MafiaAction, MafiaPlayer, MafiaRole, MafiaWinner } from "./types";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function countVotes(targetIds: string[]) {
  const counts: Record<string, number> = {};
  for (const targetId of targetIds) {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }
  return counts;
}

function getTopTarget(targetIds: string[]): string | null {
  const entries = Object.entries(countVotes(targetIds)).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

export function assignRoles(playerIds: string[]): Record<string, MafiaRole> {
  const shuffled = shuffle(playerIds);
  const assignments: Record<string, MafiaRole> = {};
  const mafiaCount = shuffled.length >= 7 ? 2 : 1;
  const hasDoctor = shuffled.length >= 5;

  shuffled.forEach((playerId, index) => {
    if (index < mafiaCount) assignments[playerId] = "mafia";
    else if (index === mafiaCount) assignments[playerId] = "detective";
    else if (hasDoctor && index === mafiaCount + 1) assignments[playerId] = "doctor";
    else assignments[playerId] = "villager";
  });

  return assignments;
}

export function getRoleSummaryText(playerCount: number): string {
  if (playerCount < 4) return "Recommended: at least 4 players.";
  if (playerCount < 5) return "Roles: 1 Mafia, 1 Detective, 2 Villagers.";
  if (playerCount < 7) return "Roles: 1 Mafia, 1 Detective, 1 Doctor, rest Villagers.";
  return "Roles: 2 Mafia, 1 Detective, 1 Doctor, rest Villagers.";
}

export function getRoleDescription(role: MafiaRole): string {
  if (role === "mafia") return "Blend in during the day and secretly choose who gets eliminated at night.";
  if (role === "detective") return "Investigate one player each night to learn whether they are Mafia or Town.";
  if (role === "doctor") return "Protect one player each night. If the Mafia targets them, they survive.";
  return "Stay alive, read the room, and vote carefully to eliminate the Mafia.";
}

export function getAlivePlayers(players: MafiaPlayer[]): MafiaPlayer[] {
  return players.filter((player) => player.is_alive);
}

export function getPlayerById(players: MafiaPlayer[], playerId: string): MafiaPlayer | undefined {
  return players.find((player) => player.id === playerId);
}

export function getRequiredNightActors(players: MafiaPlayer[]): string[] {
  return players
    .filter((player) => player.is_alive && (player.role === "mafia" || player.role === "detective" || player.role === "doctor"))
    .map((player) => player.id);
}

export function hasNightAction(actorId: string, actions: MafiaAction[], players: MafiaPlayer[]): boolean {
  const actor = getPlayerById(players, actorId);
  if (!actor?.is_alive) return true;
  if (actor.role === "mafia") return actions.some((action) => action.actor_player_id === actorId && action.action_type === "mafia_target");
  if (actor.role === "detective") return actions.some((action) => action.actor_player_id === actorId && action.action_type === "detective_check");
  if (actor.role === "doctor") return actions.some((action) => action.actor_player_id === actorId && action.action_type === "doctor_save");
  return true;
}

export function getWinner(players: MafiaPlayer[]): MafiaWinner {
  const alive = players.filter((player) => player.is_alive);
  const mafiaAlive = alive.filter((player) => player.role === "mafia").length;
  const townAlive = alive.length - mafiaAlive;

  if (mafiaAlive === 0) return "town";
  if (mafiaAlive >= townAlive) return "mafia";
  return null;
}

export function resolveNightState(players: MafiaPlayer[], actions: MafiaAction[]) {
  const mafiaTarget = getTopTarget(actions.filter((action) => action.action_type === "mafia_target").map((action) => action.target_player_id));
  const savedTarget = getTopTarget(actions.filter((action) => action.action_type === "doctor_save").map((action) => action.target_player_id));
  const detectiveActions = actions.filter((action) => action.action_type === "detective_check");
  const eliminatedPlayerId = mafiaTarget && mafiaTarget !== savedTarget ? mafiaTarget : null;
  const detectiveMessages: Record<string, string> = {};

  detectiveActions.forEach((action) => {
    const target = getPlayerById(players, action.target_player_id);
    if (!target) return;
    detectiveMessages[action.actor_player_id] = `${target.name} is ${target.role === "mafia" ? "Mafia" : "Town"}.`;
  });

  const eliminatedPlayer = eliminatedPlayerId ? getPlayerById(players, eliminatedPlayerId) : null;
  const summary = eliminatedPlayer
    ? `${eliminatedPlayer.name} was eliminated during the night.`
    : "Nobody was eliminated during the night.";

  return { eliminatedPlayerId, detectiveMessages, summary };
}

export function resolveDayVote(players: MafiaPlayer[], actions: MafiaAction[]) {
  const eliminatedPlayerId = getTopTarget(actions.map((action) => action.target_player_id));
  const eliminatedPlayer = eliminatedPlayerId ? getPlayerById(players, eliminatedPlayerId) : null;

  return {
    eliminatedPlayerId: eliminatedPlayer?.id ?? null,
    summary: eliminatedPlayer
      ? `${eliminatedPlayer.name} was voted out by the town.`
      : "The town could not agree. Nobody was eliminated.",
  };
}
