import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { PartyAnswerDto, PartyPlayerDto, PartyRoomDto, PartyRoundDto } from "./types";

export function usePartyRoom(roomId: string, playerId: string) {
  const [room, setRoom] = useState<PartyRoomDto | null>(null);
  const [players, setPlayers] = useState<PartyPlayerDto[]>([]);
  const [round, setRound] = useState<PartyRoundDto | null>(null);
  const [answers, setAnswers] = useState<PartyAnswerDto[]>([]);
  const [loading, setLoading] = useState(true);
  // Realtime events and polling overlap: only the newest refresh may write state, and room,
  // round and answers are applied together so the screen never mixes two rounds.
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    const seq = ++latest.current;
    const [{ data: roomData }, { data: playerData }] = await Promise.all([
      supabase.from("party_rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("party_players").select("*").eq("room_id", roomId).order("seat_order"),
    ]);
    const nextRoom = (roomData as PartyRoomDto | null) ?? null;
    let nextRound: PartyRoundDto | null = null;
    let nextAnswers: PartyAnswerDto[] = [];
    if (nextRoom && nextRoom.current_round > 0) {
      const { data: roundData } = await supabase
        .from("party_rounds")
        .select("*")
        .eq("room_id", roomId)
        .eq("round_number", nextRoom.current_round)
        .maybeSingle();
      nextRound = (roundData as PartyRoundDto | null) ?? null;
      if (nextRound) {
        const { data: answerData } = await supabase.from("party_answers").select("*").eq("round_id", nextRound.id);
        nextAnswers = (answerData as PartyAnswerDto[]) ?? [];
      }
    }
    if (seq !== latest.current) return;
    setRoom(nextRoom);
    setPlayers((playerData as PartyPlayerDto[]) ?? []);
    setRound(nextRound);
    setAnswers(nextAnswers);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;
    // Each hook instance needs its own channel name (supabase.channel() reuses existing ones).
    const channel = supabase
      .channel(`party-${roomId}-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_rooms", filter: `id=eq.${roomId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_players", filter: `room_id=eq.${roomId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "party_rounds", filter: `room_id=eq.${roomId}` }, refresh)
      .subscribe();
    // Safety net for phones that drop the realtime socket (locked screen, flaky network).
    const interval = setInterval(refresh, 3000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [refresh, roomId]);

  const me = players.find((player) => player.id === playerId) ?? null;
  const myAnswer = answers.find((answer) => answer.player_id === playerId) ?? null;
  const isHost = !!room && room.host_player_id === playerId;
  return { room, players, round, answers, me, myAnswer, isHost, loading, refresh };
}
