import { IMPOSTER_CATEGORIES } from "./data";
import type { ImposterPlayerDto, ImposterRole, ImposterRoleDto, ImposterVoteDto, ImposterWinner } from "./types";

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getCategoryById(categoryId: string | null) {
  return IMPOSTER_CATEGORIES.find((category) => category.id === categoryId) ?? null;
}

export function assignImposterRoles(playerIds: string[], prompt: string) {
  const shuffled = shuffle(playerIds);
  const imposterPlayerId = shuffled[0] ?? null;

  const roles: Record<string, { role: ImposterRole; prompt: string | null }> = {};
  playerIds.forEach((playerId) => {
    roles[playerId] =
      playerId === imposterPlayerId
        ? { role: "imposter", prompt: null }
        : { role: "crew", prompt };
  });

  return { roles, imposterPlayerId };
}

export function pickPromptForCategory(categoryId: string) {
  const category = getCategoryById(categoryId);
  if (!category || category.prompts.length === 0) {
    throw new Error("Choose a valid category");
  }
  return category.prompts[Math.floor(Math.random() * category.prompts.length)];
}

export function getRoleDescription(role: ImposterRole) {
  if (role === "imposter") return "You are the imposter. Blend in, improvise, and try not to get caught.";
  return "You are on the crew. You know the secret prompt, so talk carefully and expose the imposter.";
}

export function resolveVotes(votes: ImposterVoteDto[], roles: ImposterRoleDto[]) {
  const counts = new Map<string, number>();
  votes.forEach((vote) => {
    counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const imposter = roles.find((role) => role.role === "imposter") ?? null;

  if (!imposter) {
    return {
      eliminatedPlayerId: null,
      winner: "crew" as ImposterWinner,
      summary: "The round ended without an assigned imposter.",
    };
  }

  if (sorted.length === 0) {
    return {
      eliminatedPlayerId: null,
      winner: "imposter" as ImposterWinner,
      summary: "Nobody voted. The imposter slipped through.",
    };
  }

  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) {
    return {
      eliminatedPlayerId: null,
      winner: "imposter" as ImposterWinner,
      summary: "The vote tied. The imposter survives the round.",
    };
  }

  const eliminatedPlayerId = sorted[0][0];
  const winner: ImposterWinner = eliminatedPlayerId === imposter.player_id ? "crew" : "imposter";
  const summary =
    winner === "crew"
      ? "The group found the imposter."
      : "The group voted out the wrong player. The imposter wins.";

  return { eliminatedPlayerId, winner, summary };
}

export function getWinnerAfterElimination(players: ImposterPlayerDto[], roles: ImposterRoleDto[], eliminatedPlayerId: string | null) {
  const imposter = roles.find((role) => role.role === "imposter") ?? null;
  if (!imposter) return "crew" as ImposterWinner;
  if (eliminatedPlayerId === imposter.player_id) return "crew" as ImposterWinner;

  const alivePlayerIds = players
    .filter((player) => player.status === "alive" && player.id !== eliminatedPlayerId)
    .map((player) => player.id);

  if (alivePlayerIds.length <= 2 && alivePlayerIds.includes(imposter.player_id)) {
    return "imposter" as ImposterWinner;
  }

  return null;
}
