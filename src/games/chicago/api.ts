import { joinRoomByCode, supabase } from "../../lib/supabase";
import type { ChicagoCard, ChicagoPlayerDto, ChicagoRoomDto, ChicagoRoundDto } from "./types";

function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

async function getRoom(roomId: string) {
  const { data, error } = await supabase.from("chicago_rooms").select("*").eq("id", roomId).single();
  if (error) throw error;
  return data as ChicagoRoomDto;
}

async function getPlayers(roomId: string) {
  const { data, error } = await supabase.from("chicago_room_players").select("*").eq("room_id", roomId).order("seat_order");
  if (error) throw error;
  return (data as ChicagoPlayerDto[]) ?? [];
}

async function getCurrentRound(roomId: string) {
  const { data, error } = await supabase
    .from("chicago_rounds")
    .select("*")
    .eq("room_id", roomId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ChicagoRoundDto | null) ?? null;
}

export async function createChicagoRoom(displayName: string) {
  const trimmedName = displayName.trim();
  if (!trimmedName) throw new Error("Enter a player name");

  const { data: room, error: roomError } = await supabase
    .from("chicago_rooms")
    .insert({ code: makeRoomCode(), state: "lobby", public_message: "Waiting for players to join Chicago." })
    .select("*")
    .single();
  if (roomError) throw roomError;

  const { data: player, error: playerError } = await supabase
    .from("chicago_room_players")
    .insert({
      room_id: room.id,
      display_name: trimmedName,
      seat_order: 1,
      score: 0,
      status: "active",
      draw_ready: false,
      trick_ready: false,
      chicago_declared: false,
    })
    .select("*")
    .single();
  if (playerError) throw playerError;

  const { error: hostError } = await supabase.from("chicago_rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostError) throw hostError;

  return { roomId: room.id, playerId: player.id, code: room.code };
}

// Joining goes through the database so it can check the room code, game state and
// player limit, and so a player re-joining from the same phone gets their old seat back.
export async function joinChicagoRoom(code: string, displayName: string) {
  return joinRoomByCode("chicago", code, displayName);
}

// Every move goes through the database, which deals, keeps the deck and the other hands
// secret, checks turns and suits, and does all the scoring.
async function call(fn: string, args: Record<string, unknown>) {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return { ok: true };
}

/** "Play again": same room and players, scores back to 0, everyone returns to the lobby. */
export function resetChicagoToLobby(roomId: string, _playerId: string) {
  return call("chicago_reset_to_lobby", { p_room: roomId });
}

export function startChicagoRound(roomId: string, _playerId: string) {
  return call("chicago_start_round", { p_room: roomId });
}

/** Exchanges queue up in the database, so two phones never draw the same card. */
export function submitChicagoDraw(roomId: string, _playerId: string, discardedCards: ChicagoCard[]) {
  return call("chicago_submit_draw", { p_room: roomId, p_discards: discardedCards ?? [] });
}

/** Every phone may ask; the first request scores the hands, the others find it done. */
export function advanceChicagoPokerScore(roomId: string, _playerId: string) {
  return call("chicago_score_poker", { p_room: roomId });
}

export function declareChicago(roomId: string, _playerId: string) {
  return call("chicago_declare", { p_room: roomId });
}

/** A double tap is harmless: the database ignores a card that was already played. */
export function playChicagoCard(roomId: string, _playerId: string, card: ChicagoCard) {
  return call("chicago_play_card", { p_room: roomId, p_card: card });
}

export async function getChicagoPublicState(roomId: string) {
  const [room, players, round] = await Promise.all([getRoom(roomId), getPlayers(roomId), getCurrentRound(roomId)]);
  return { room, players, round };
}
