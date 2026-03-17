import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  ChicagoHandDto,
  ChicagoPlayedCardDto,
  ChicagoPlayerDto,
  ChicagoRoomDto,
  ChicagoRoomState,
  ChicagoRoundDto,
  ChicagoTrickDto,
} from "./types";

export function useChicagoRoom(roomId: string, playerId: string): ChicagoRoomState {
  const [room, setRoom] = useState<ChicagoRoomDto | null>(null);
  const [players, setPlayers] = useState<ChicagoPlayerDto[]>([]);
  const [myPlayer, setMyPlayer] = useState<ChicagoPlayerDto | null>(null);
  const [round, setRound] = useState<ChicagoRoundDto | null>(null);
  const [myHand, setMyHand] = useState<ChicagoHandDto | null>(null);
  const [currentTrick, setCurrentTrick] = useState<ChicagoTrickDto | null>(null);
  const [playedCards, setPlayedCards] = useState<ChicagoPlayedCardDto[]>([]);
  const [currentPokerLeaderPlayerId, setCurrentPokerLeaderPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) setLoading(true);

    const [{ data: roomData }, { data: playersData }, { data: meData }, { data: roundData }, { data: handData }] = await Promise.all([
      supabase.from("chicago_rooms").select("*").eq("id", roomId).single(),
      supabase.from("chicago_room_players").select("*").eq("room_id", roomId).order("seat_order"),
      supabase.from("chicago_room_players").select("*").eq("id", playerId).maybeSingle(),
      supabase.from("chicago_rounds").select("*").eq("room_id", roomId).order("round_number", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("chicago_player_hands").select("*").eq("player_id", playerId).maybeSingle(),
    ]);

    setRoom((roomData as ChicagoRoomDto) ?? null);
    setPlayers((playersData as ChicagoPlayerDto[]) ?? []);
    setMyPlayer((meData as ChicagoPlayerDto) ?? null);
    setRound((roundData as ChicagoRoundDto) ?? null);
    setMyHand((handData as ChicagoHandDto) ?? null);

    if (roundData) {
      const { data: trickData } = await supabase
        .from("chicago_tricks")
        .select("*")
        .eq("round_id", roundData.id)
        .eq("trick_number", roundData.trick_number)
        .maybeSingle();

      const { data: playedData } = trickData
        ? await supabase.from("chicago_cards_played").select("*").eq("trick_id", trickData.id).order("play_order")
        : { data: [] };

      setCurrentTrick((trickData as ChicagoTrickDto) ?? null);
      setPlayedCards((playedData as ChicagoPlayedCardDto[]) ?? []);
      setCurrentPokerLeaderPlayerId(roundData.lead_player_id ?? null);
    } else {
      setCurrentTrick(null);
      setPlayedCards([]);
      setCurrentPokerLeaderPlayerId(null);
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
      .channel(`chicago-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const playersChannel = supabase
      .channel(`chicago-players-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_room_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const roundsChannel = supabase
      .channel(`chicago-rounds-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_rounds", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const handsChannel = supabase
      .channel(`chicago-hands-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_player_hands", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const tricksChannel = supabase
      .channel(`chicago-tricks-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_tricks" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chicago_cards_played" }, () => refresh())
      .subscribe();

    const intervalId = setInterval(() => {
      refresh();
    }, 2500);

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roundsChannel);
      supabase.removeChannel(handsChannel);
      supabase.removeChannel(tricksChannel);
    };
  }, [refresh, roomId]);

  return {
    room,
    players,
    myPlayer,
    round,
    myHand,
    currentTrick,
    playedCards,
    currentPokerLeaderPlayerId,
    loading,
    refresh,
  };
}
