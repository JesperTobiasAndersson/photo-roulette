import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getWinner } from "../_shared/game.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId } = await req.json();
    const { data: roles } = await service.from("mafia_player_roles").select("*").eq("room_id", roomId);
    const winner = getWinner(roles ?? []);

    if (winner) {
      await service.from("mafia_rooms").update({ state: "ended", winner, phase_ends_at: null }).eq("id", roomId);
    }

    return json({ winner });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
