import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { MusicQuizAnswerDto, MusicQuizPlayerDto, MusicQuizRoomDto, MusicQuizRoomState, MusicQuizRoundDto } from "./types";

export function useMusicQuizRoom(roomId: string, playerId: string): MusicQuizRoomState {
  const [room, setRoom] = useState<MusicQuizRoomDto | null>(null);
  const [players, setPlayers] = useState<MusicQuizPlayerDto[]>([]);
  const [myPlayer, setMyPlayer] = useState<MusicQuizPlayerDto | null>(null);
  const [currentRound, setCurrentRound] = useState<MusicQuizRoundDto | null>(null);
  const [answers, setAnswers] = useState<MusicQuizAnswerDto[]>([]);
  const [myAnswer, setMyAnswer] = useState<MusicQuizAnswerDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) setLoading(true);

    const [{ data: roomData }, { data: playersData }, { data: myPlayerData }] = await Promise.all([
      supabase.from("music_quiz_rooms").select("*").eq("id", roomId).single(),
      supabase.from("music_quiz_players").select("*").eq("room_id", roomId).order("seat_order"),
      supabase.from("music_quiz_players").select("*").eq("id", playerId).maybeSingle(),
    ]);

    const nextRoom = (roomData as MusicQuizRoomDto) ?? null;
    setRoom(nextRoom);
    setPlayers((playersData as MusicQuizPlayerDto[]) ?? []);
    setMyPlayer((myPlayerData as MusicQuizPlayerDto) ?? null);

    if (nextRoom?.current_round_id) {
      const [{ data: roundData }, { data: answersData }, { data: myAnswerData }] = await Promise.all([
        supabase.from("music_quiz_rounds").select("*").eq("id", nextRoom.current_round_id).maybeSingle(),
        supabase.from("music_quiz_answers").select("*").eq("round_id", nextRoom.current_round_id),
        supabase.from("music_quiz_answers").select("*").eq("round_id", nextRoom.current_round_id).eq("player_id", playerId).maybeSingle(),
      ]);

      setCurrentRound((roundData as MusicQuizRoundDto) ?? null);
      setAnswers((answersData as MusicQuizAnswerDto[]) ?? []);
      setMyAnswer((myAnswerData as MusicQuizAnswerDto) ?? null);
    } else {
      setCurrentRound(null);
      setAnswers([]);
      setMyAnswer(null);
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
      .channel(`music-quiz-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_quiz_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const playersChannel = supabase
      .channel(`music-quiz-players-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_quiz_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const roundsChannel = supabase
      .channel(`music-quiz-rounds-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_quiz_rounds", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const answersChannel = supabase
      .channel(`music-quiz-answers-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "music_quiz_answers" }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roundsChannel);
      supabase.removeChannel(answersChannel);
    };
  }, [refresh, roomId]);

  useEffect(() => {
    if (!roomId) return;

    const intervalId = setInterval(() => {
      refresh();
    }, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [refresh, roomId]);

  return {
    room,
    players,
    myPlayer,
    currentRound,
    answers,
    myAnswer,
    loading,
    refresh,
  };
}
