import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId, targetPlayerId = null, confirm = false } = await req.json();

    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.state !== "night") return error("Night phase is not active", 409);

    const { data: player } = await service
      .from("mafia_room_players")
      .select("*")
      .eq("id", playerId)
      .eq("room_id", roomId)
      .single();
    if (!player) return error("Player not found", 404);

    const { data: roleRow } = await service.from("mafia_player_roles").select("*").eq("player_id", player.id).single();
    if (!roleRow || !roleRow.is_alive) return error("Only living players can act", 403);

    const payload = {
      room_id: roomId,
      phase_number: room.phase_number,
      actor_player_id: player.id,
      actor_role: roleRow.role,
      target_player_id: targetPlayerId,
      fake_ready: roleRow.role === "villager",
      confirmed: roleRow.role === "villager" ? true : !!confirm,
    };

    const { error: upsertError } = await service.from("mafia_night_actions").upsert(payload, {
      onConflict: "room_id,phase_number,actor_player_id",
    });
    if (upsertError) return error(upsertError.message);

    const { data: mafiaActions } = await service
      .from("mafia_night_actions")
      .select("*")
      .eq("room_id", roomId)
      .eq("phase_number", room.phase_number)
      .eq("actor_role", "mafia");

    const sameTarget =
      mafiaActions && mafiaActions.length > 0 && mafiaActions.every((row) => row.confirmed) && new Set(mafiaActions.map((row) => row.target_player_id)).size === 1;

    if (sameTarget) {
      await service
        .from("mafia_night_actions")
        .update({ locked_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("phase_number", room.phase_number)
        .eq("actor_role", "mafia");
    }

    return json({ ok: true });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
