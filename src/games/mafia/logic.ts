import type { MafiaAlignment, MafiaDayVoteDto, MafiaNightActionDto, MafiaPhase, MafiaRole, MafiaRoleDto } from "./types";

export function getRoleDescription(role: MafiaRole) {
  if (role === "mafia") return "Coordinate privately with the other mafia, choose a target, and confirm together.";
  if (role === "doctor") return "Choose one player to protect tonight.";
  if (role === "police") return "Investigate one player tonight. Only you will see the result.";
  return "Stay active at night so nobody can guess your role. Keep private reads on who feels safe or suspicious, then blend in.";
}

export function getPhaseTitle(phase: MafiaPhase) {
  if (phase === "lobby") return "Lobby";
  if (phase === "role_reveal") return "Role Reveal";
  if (phase === "night") return "Night";
  if (phase === "night_result") return "Night Result";
  if (phase === "day_discussion") return "Day Discussion";
  if (phase === "day_voting") return "Day Voting";
  if (phase === "vote_result") return "Vote Result";
  return "Game Ended";
}

export function getRecommendedPlayersText(title: string) {
  return title === "Mafia" ? "Recommended: 5-10 players" : "";
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function assignRoles(playerIds: string[]): Record<string, MafiaRole> {
  const shuffled = shuffle(playerIds);
  const roles: Record<string, MafiaRole> = {};
  const mafiaCount = shuffled.length >= 7 ? 2 : 1;

  shuffled.forEach((playerId, index) => {
    if (index < mafiaCount) {
      roles[playerId] = "mafia";
    } else if (index === mafiaCount) {
      roles[playerId] = "doctor";
    } else if (index === mafiaCount + 1) {
      roles[playerId] = "police";
    } else {
      roles[playerId] = "villager";
    }
  });

  return roles;
}

export function getWinner(roles: MafiaRoleDto[]): MafiaAlignment | null {
  const aliveRoles = roles.filter((role) => role.is_alive);
  const mafiaAlive = aliveRoles.filter((role) => role.role === "mafia").length;
  const villageAlive = aliveRoles.length - mafiaAlive;

  if (mafiaAlive === 0) return "village";
  if (mafiaAlive >= villageAlive) return "mafia";
  return null;
}

export function resolveNightActions(actions: MafiaNightActionDto[], roles: MafiaRoleDto[]) {
  const mafiaActions = actions.filter((action) => action.actor_role === "mafia" && action.target_player_id);
  const doctorAction = actions.find((action) => action.actor_role === "doctor");
  const policeAction = actions.find((action) => action.actor_role === "police");

  const counts: Record<string, number> = {};
  mafiaActions.forEach((action) => {
    if (!action.target_player_id) return;
    counts[action.target_player_id] = (counts[action.target_player_id] ?? 0) + 1;
  });

  const sortedTargets = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  let killTarget: string | null = null;

  if (
    mafiaActions.length > 0 &&
    mafiaActions.every((action) => action.confirmed) &&
    new Set(mafiaActions.map((action) => action.target_player_id)).size === 1
  ) {
    killTarget = mafiaActions[0].target_player_id;
  } else if (sortedTargets.length === 1) {
    killTarget = sortedTargets[0][0];
  } else if (sortedTargets.length > 1 && sortedTargets[0][1] > sortedTargets[1][1]) {
    killTarget = sortedTargets[0][0];
  }

  const doctorTarget = doctorAction?.target_player_id ?? null;
  const doctorSavedPlayerId = killTarget && killTarget === doctorTarget ? killTarget : null;
  const eliminatedPlayerId = killTarget && killTarget !== doctorTarget ? killTarget : null;
  const policeTarget = policeAction?.target_player_id ?? null;
  const policeAlignment =
    policeTarget && roles.find((role) => role.player_id === policeTarget)?.role === "mafia" ? "mafia" : "village";

  return {
    eliminatedPlayerId,
    doctorSavedPlayerId,
    doctorSaved: !!doctorSavedPlayerId,
    policeTarget,
    policeAlignment: policeTarget ? policeAlignment : null,
    summary: eliminatedPlayerId ? "Someone was eliminated during the night." : "Nobody was eliminated during the night.",
  };
}

export function resolveDayVotes(votes: MafiaDayVoteDto[]) {
  const counts: Record<string, number> = {};

  votes.forEach((vote) => {
    counts[vote.target_player_id] = (counts[vote.target_player_id] ?? 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { eliminatedPlayerId: null, summary: "No votes were cast." };
  }
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return { eliminatedPlayerId: null, summary: "The vote tied. Nobody was eliminated." };
  }
  return { eliminatedPlayerId: sorted[0][0], summary: "The village eliminated a player." };
}
