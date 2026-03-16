import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { makeRoomCode } from "../_shared/game.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { displayName } = await req.json();
    if (!displayName?.trim()) return error("Display name is required");

    const roomCode = makeRoomCode();
    const { data: room, error: roomError } = await service
      .from("mafia_rooms")
      .insert({ code: roomCode, public_message: "Waiting for players." })
      .select("*")
      .single();
    if (roomError) return error(roomError.message);

    const { data: player, error: playerError } = await service
      .from("mafia_room_players")
      .insert({
        room_id: room.id,
        display_name: displayName.trim(),
        seat_order: 1,
      })
      .select("*")
      .single();
    if (playerError) return error(playerError.message);

    await service.from("mafia_rooms").update({ host_player_id: player.id }).eq("id", room.id);
    return json({ roomId: room.id, playerId: player.id, code: room.code });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
