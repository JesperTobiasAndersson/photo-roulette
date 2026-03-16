import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { code, displayName } = await req.json();
    if (!code?.trim() || !displayName?.trim()) return error("Code and display name are required");

    const { data: room, error: roomError } = await service.from("mafia_rooms").select("*").eq("code", code.trim().toUpperCase()).single();
    if (roomError) return error("Room not found", 404);
    if (room.state !== "lobby") return error("Game already started", 409);

    const { count } = await service
      .from("mafia_room_players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);

    const { data: player, error: playerError } = await service
      .from("mafia_room_players")
      .insert({
        room_id: room.id,
        display_name: displayName.trim(),
        seat_order: (count ?? 0) + 1,
      })
      .select("*")
      .single();
    if (playerError) return error(playerError.message);

    return json({ roomId: room.id, playerId: player.id, code: room.code });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
