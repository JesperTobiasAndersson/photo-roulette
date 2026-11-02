import { ensureSession, supabase } from "../../lib/supabase";
import type { PartyGame } from "./types";

// Every move goes through the database: it picks the prompts, keeps answers private until the
// round is revealed, and does the scoring (supabase/migrations/20261103120000_party_games.sql).

async function call<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

type Joined = { room_id: string; player_id: string; code: string };
const toRoom = (joined: Joined) => ({ roomId: joined.room_id, playerId: joined.player_id, code: joined.code });

export async function createPartyRoom(game: PartyGame, displayName: string) {
  await ensureSession();
  return toRoom(await call<Joined>("party_create_room", { p_game: game, p_name: displayName }));
}

export async function joinPartyRoom(game: PartyGame, code: string, displayName: string) {
  await ensureSession();
  return toRoom(await call<Joined>("party_join_room", { p_game: game, p_code: code, p_name: displayName }));
}

export const startParty = (roomId: string, rounds: number) => call("party_start", { p_room: roomId, p_rounds: rounds });

/** Most Likely: the player voted for. */
export const voteForPlayer = (roomId: string, targetPlayerId: string) =>
  call("party_answer", { p_room: roomId, p_target: targetPlayerId, p_number: null });

/** Closest Wins: the guess. */
export const submitGuess = (roomId: string, value: number) => call("party_answer", { p_room: roomId, p_target: null, p_number: value });

/** Host: show the result without waiting for everyone. */
export const revealRound = (roomId: string) => call("party_reveal", { p_room: roomId });
export const nextRound = (roomId: string) => call("party_next", { p_room: roomId });
/** "Play again": same room and players, back to the lobby. */
export const resetParty = (roomId: string) => call("party_reset", { p_room: roomId });
export const leaveParty = (roomId: string) => call("party_leave", { p_room: roomId });
