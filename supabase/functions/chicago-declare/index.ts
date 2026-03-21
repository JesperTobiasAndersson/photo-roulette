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
    if (round.chicago_declared_by) return error("Chicago has already been claimed this round", 400);

    const { data: trickIdsData } = await service.from("chicago_tricks").select("id").eq("round_id", round.id);
    const trickIds = (trickIdsData ?? []).map((entry) => entry.id);
    if (trickIds.length > 0) {
      const { data: playedRows } = await service.from("chicago_cards_played").select("id").in("trick_id", trickIds).limit(1);
      if ((playedRows?.length ?? 0) > 0) return error("Chicago must be declared before the first card is played", 400);
    }

    await service.from("chicago_rounds").update({ chicago_declared_by: playerId }).eq("id", round.id);
    await service.from("chicago_room_players").update({ chicago_declared: true }).eq("id", playerId);
    await service
      .from("chicago_rooms")
      .update({
        lead_player_id: playerId,
        current_turn_player_id: playerId,
        public_message: `${player.display_name} declared CHICAGO and leads the first trick.`,
      })
      .eq("id", roomId);

    return json({ ok: true });
  } catch (thrown) {
    return thrown instanceof Response ? thrown : error("Unexpected error", 500);
  }
});
