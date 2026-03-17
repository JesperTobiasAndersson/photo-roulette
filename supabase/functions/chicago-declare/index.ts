import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const [{ data: room }, { data: player }, { data: round }] = await Promise.all([
      service.from("chicago_rooms").select("*").eq("id", roomId).single(),
      service.from("chicago_room_players").select("*").eq("id", playerId).single(),
      service.from("chicago_rounds").select("*").eq("room_id", roomId).eq("round_number", (await service.from("chicago_rooms").select("current_round").eq("id", roomId).single()).data.current_round).single(),
    ]);

    if (!room || room.state !== "trick_phase") return error("Chicago can only be declared before or during tricks");
    if (!player || player.score < 15) return error("You need at least 15 points to declare Chicago");
    if (!round) return error("No active round", 400);

    await service.from("chicago_rounds").update({ chicago_declared_by: playerId }).eq("id", round.id);
    await service.from("chicago_room_players").update({ chicago_declared: true }).eq("id", playerId);
    await service.from("chicago_rooms").update({ public_message: `${player.display_name} declared CHICAGO.` }).eq("id", roomId);

    return json({ ok: true });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
