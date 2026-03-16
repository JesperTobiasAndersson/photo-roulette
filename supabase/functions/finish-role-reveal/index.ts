import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();

    const { data: player } = await service
      .from("mafia_room_players")
      .select("*")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single();
    if (!player) return error("Player not found", 404);

    await service.from("mafia_room_players").update({ role_reveal_ready: true }).eq("id", player.id);

    const { data: players } = await service.from("mafia_room_players").select("*").eq("room_id", roomId);
    const allReady = (players ?? []).every((row) => row.role_reveal_ready);
    if (allReady) {
      await service
        .from("mafia_rooms")
        .update({
          state: "night",
          phase_number: 2,
          phase_ends_at: new Date(Date.now() + 45_000).toISOString(),
          public_message: "Night has started. Everyone has something to do.",
        })
        .eq("id", roomId);
    }

    return json({ ok: true, allReady });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
