import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId, targetPlayerId } = await req.json();
    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.state !== "day_voting") return error("Day voting is not active", 409);

    const { data: player } = await service
      .from("mafia_room_players")
      .select("*")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single();
    if (!player || player.status !== "alive") return error("Only living players can vote", 403);

    const { error: voteError } = await service.from("mafia_day_votes").upsert(
      {
        room_id: roomId,
        phase_number: room.phase_number,
        voter_player_id: player.id,
        target_player_id: targetPlayerId,
      },
      { onConflict: "room_id,phase_number,voter_player_id" }
    );
    if (voteError) return error(voteError.message);

    return json({ ok: true });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
