import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { TriviaPlayerDto, TriviaRoomDto, TriviaRoomState, TriviaTurnDto } from "./types";

// supabase.channel() returns an EXISTING channel with the same name. When one screen replaces
// another (e.g. round -> next round, results -> lobby), the old screen's cleanup would remove the
// channel the new screen is using, so every subscription gets its own unique name.
const uniqueChannelSuffix = () => Math.random().toString(36).slice(2, 10);

export function useTriviaRoom(roomId: string, playerId: string): TriviaRoomState {
  const [room, setRoom] = useState<TriviaRoomDto | null>(null);
  const [players, setPlayers] = useState<TriviaPlayerDto[]>([]);
  const [myPlayer, setMyPlayer] = useState<TriviaPlayerDto | null>(null);
  const [currentTurn, setCurrentTurn] = useState<TriviaTurnDto | null>(null);
  const [totalTurns, setTotalTurns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) setLoading(true);

    const [{ data: roomData }, { data: playersData }, { data: myPlayerData }] = await Promise.all([
      supabase.from("trivia_rooms").select("*").eq("id", roomId).single(),
      supabase.from("trivia_players").select("*").eq("room_id", roomId).order("seat_order"),
      supabase.from("trivia_players").select("*").eq("id", playerId).maybeSingle(),
    ]);

    const nextRoom = (roomData as TriviaRoomDto) ?? null;
    setRoom(nextRoom);
    setPlayers((playersData as TriviaPlayerDto[]) ?? []);
    setMyPlayer((myPlayerData as TriviaPlayerDto) ?? null);

    if (nextRoom?.current_turn_id) {
      // The game's length is fixed when it starts (one turn row per question), so count the
      // turns instead of multiplying by the current player list.
      const [{ data: turnData }, { count }] = await Promise.all([
        supabase.from("trivia_turns").select("*").eq("id", nextRoom.current_turn_id).maybeSingle(),
        supabase.from("trivia_turns").select("id", { count: "exact", head: true }).eq("room_id", roomId),
      ]);
      setCurrentTurn((turnData as TriviaTurnDto) ?? null);
      if (typeof count === "number") setTotalTurns(count);
    } else {
      setCurrentTurn(null);
    }

    setHasLoadedOnce(true);
    setLoading(false);
  }, [hasLoadedOnce, playerId, roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`trivia-room-${roomId}-${uniqueChannelSuffix()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trivia_rooms", filter: `id=eq.${roomId}` }, refresh)
      .subscribe();
    const playersChannel = supabase
      .channel(`trivia-players-${roomId}-${uniqueChannelSuffix()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trivia_players", filter: `room_id=eq.${roomId}` }, refresh)
      .subscribe();
    const turnsChannel = supabase
      .channel(`trivia-turns-${roomId}-${uniqueChannelSuffix()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trivia_turns", filter: `room_id=eq.${roomId}` }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(turnsChannel);
    };
  }, [refresh, roomId]);

  useEffect(() => {
    if (!roomId) return;
    const intervalId = setInterval(() => {
      refresh();
    }, 2500);
    return () => clearInterval(intervalId);
  }, [refresh, roomId]);

  return { room, players, myPlayer, currentTurn, totalTurns, loading, refresh };
}
