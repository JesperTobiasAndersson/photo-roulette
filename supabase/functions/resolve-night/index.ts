import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getWinner, resolveNight } from "../_shared/game.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.state !== "night") return error("Night is not active", 409);
    if (room.host_player_id !== playerId) return error("Only the host can resolve night", 403);

    const [{ data: actions }, { data: players }, { data: roles }] = await Promise.all([
      service.from("mafia_night_actions").select("*").eq("room_id", roomId).eq("phase_number", room.phase_number),
      service.from("mafia_room_players").select("*").eq("room_id", roomId),
      service.from("mafia_player_roles").select("*").eq("room_id", roomId),
    ]);

    const outcome = resolveNight(actions ?? [], roles ?? []);
    if (outcome.eliminatedPlayerId) {
      await service.from("mafia_player_roles").update({ is_alive: false }).eq("player_id", outcome.eliminatedPlayerId);
      await service.from("mafia_room_players").update({ status: "eliminated" }).eq("id", outcome.eliminatedPlayerId);
    }

    if (outcome.policeTarget) {
      const { data: policeAction } = await service
        .from("mafia_night_actions")
        .select("*")
        .eq("room_id", roomId)
        .eq("phase_number", room.phase_number)
        .eq("actor_role", "police")
        .maybeSingle();

      if (policeAction && outcome.policeAlignment) {
        await service.from("mafia_police_reports").upsert(
          {
            room_id: roomId,
            phase_number: room.phase_number,
            police_player_id: policeAction.actor_player_id,
            target_player_id: outcome.policeTarget,
            result_alignment: outcome.policeAlignment,
          },
          { onConflict: "room_id,phase_number,police_player_id" }
        );
      }
    }

    const updatedRoles = (roles ?? []).map((row) =>
      outcome.eliminatedPlayerId && row.player_id === outcome.eliminatedPlayerId ? { ...row, is_alive: false } : row
    );
    const winner = getWinner(updatedRoles);

    await service.from("mafia_game_events").insert({
      room_id: roomId,
      phase_number: room.phase_number,
      phase: "night_result",
      visible_to: "all",
      event_type: "night_result",
      payload: { summary: outcome.summary, eliminatedPlayerId: outcome.eliminatedPlayerId },
    });

    await service
      .from("mafia_rooms")
      .update({
        state: winner ? "ended" : "night_result",
        winner,
        phase_number: room.phase_number + 1,
        public_message: outcome.summary,
        phase_ends_at: winner ? null : new Date(Date.now() + 10_000).toISOString(),
      })
      .eq("id", roomId);

    return json({ ok: true, winner });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
