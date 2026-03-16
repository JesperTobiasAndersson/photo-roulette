import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { assignRoles } from "../_shared/game.ts";
import { error, json } from "../_shared/responses.ts";
import { getServiceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  try {
    const service = getServiceClient();
    const { roomId, playerId } = await req.json();
    const { data: room } = await service.from("mafia_rooms").select("*").eq("id", roomId).single();
    if (!room || room.host_player_id !== playerId) return error("Only the host can start the game", 403);

    const { data: players } = await service.from("mafia_room_players").select("*").eq("room_id", roomId).order("seat_order");
    if (!players || players.length < 4) return error("At least 4 players are required");

    const roles = assignRoles(players.map((player) => player.id));
    await service.from("mafia_player_roles").delete().eq("room_id", roomId);
    await service.from("mafia_player_roles").insert(
      players.map((player) => ({
        player_id: player.id,
        room_id: roomId,
        role: roles[player.id],
        is_alive: true,
      }))
    );

    await service
      .from("mafia_rooms")
      .update({
        state: "role_reveal",
        phase_number: 1,
        phase_ends_at: new Date(Date.now() + 12_000).toISOString(),
        public_message: "Roles assigned. Reveal your role privately.",
      })
      .eq("id", roomId);

    return json({ ok: true });
  } catch (response) {
    return response instanceof Response ? response : error("Unexpected error", 500);
  }
});
