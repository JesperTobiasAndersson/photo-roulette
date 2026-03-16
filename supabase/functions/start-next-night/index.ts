import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.state !== "vote_result") return error("Vote result is not active", 409);
    if (room.host_player_id !== playerId) return error("Only the host can continue", 403);

    await service
      .from("mafia_rooms")
      .update({
        state: "night",
        phase_number: room.phase_number + 1,
        phase_ends_at: new Date(Date.now() + 45_000).toISOString(),
        public_message: "Night has started. Everyone has something to do.",
      })
      .eq("id", roomId);

    return json({ ok: true });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
