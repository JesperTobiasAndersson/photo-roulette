import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getWinner, resolveDayVote } from "../_shared/game.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.state !== "day_voting") return error("Day voting is not active", 409);
    if (room.host_player_id !== playerId) return error("Only the host can resolve the vote", 403);

    const [{ data: votes }, { data: roles }] = await Promise.all([
      service.from("mafia_day_votes").select("*").eq("room_id", roomId).eq("phase_number", room.phase_number),
      service.from("mafia_player_roles").select("*").eq("room_id", roomId),
    ]);

    const outcome = resolveDayVote(votes ?? []);
    if (outcome.eliminatedPlayerId) {
      await service.from("mafia_player_roles").update({ is_alive: false }).eq("player_id", outcome.eliminatedPlayerId);
      await service.from("mafia_room_players").update({ status: "eliminated" }).eq("id", outcome.eliminatedPlayerId);
    }

    const updatedRoles = (roles ?? []).map((row) =>
      outcome.eliminatedPlayerId && row.player_id === outcome.eliminatedPlayerId ? { ...row, is_alive: false } : row
    );
    const winner = getWinner(updatedRoles);

    await service.from("mafia_game_events").insert({
      room_id: roomId,
      phase_number: room.phase_number,
      phase: "vote_result",
      visible_to: "all",
      event_type: "vote_result",
      payload: { summary: outcome.summary, eliminatedPlayerId: outcome.eliminatedPlayerId },
    });

    await service
      .from("mafia_rooms")
      .update({
        state: winner ? "ended" : "vote_result",
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
