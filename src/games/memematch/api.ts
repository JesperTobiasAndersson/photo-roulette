import { joinRoomByCode, supabase } from "../../lib/supabase";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export async function createMemeMatchRoom(name: string) {
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({ code: makeCode(4), status: "lobby" })
    .select()
    .single();
  if (roomErr) throw roomErr;

  const { data: player, error: playerErr } = await supabase
    .from("players")
    .insert({ room_id: room.id, name })
    .select()
    .single();
  if (playerErr) throw playerErr;

  const { error: hostErr } = await supabase.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);
  if (hostErr) throw hostErr;

  return { roomId: room.id as string, playerId: player.id as string };
}

/** "Play again": host restarts the room with the same players (they keep their photos). */
export async function playMemeMatchAgain(roomId: string) {
  const { error } = await supabase.rpc("memematch_play_again", { p_room_id: roomId });
  if (error) throw error;
}

// Joining goes through the database so it can check the room code, game state and
// player limit, and so a player re-joining from the same phone gets their old seat back.
export async function joinMemeMatchRoom(code: string, displayName: string) {
  return joinRoomByCode("memematch", code, displayName);
}
