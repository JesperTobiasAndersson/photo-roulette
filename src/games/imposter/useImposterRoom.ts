import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { ImposterPlayerDto, ImposterRoleDto, ImposterRoomDto, ImposterRoomState, ImposterVoteDto } from "./types";

export function useImposterRoom(roomId: string, playerId: string): ImposterRoomState {
  const [room, setRoom] = useState<ImposterRoomDto | null>(null);
  const [players, setPlayers] = useState<ImposterPlayerDto[]>([]);
  const [myPlayer, setMyPlayer] = useState<ImposterPlayerDto | null>(null);
  const [myRole, setMyRole] = useState<ImposterRoleDto | null>(null);
  const [playerRoles, setPlayerRoles] = useState<ImposterRoleDto[]>([]);
  const [myVote, setMyVote] = useState<ImposterVoteDto | null>(null);
  const [currentVotes, setCurrentVotes] = useState<ImposterVoteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Several refreshes can overlap (realtime events + polling). Only the newest one may
  // write state, and room + roles are applied together, so a phone never shows the new
  // round with the previous round's card.
  const latestRequestRef = useRef(0);
  // supabase.channel() reuses a channel with the same name, so each hook instance gets its own
  // names; otherwise the screen being left (lobby -> results -> lobby) would remove the new screen's channels.
  const [channelSuffix] = useState(() => Math.random().toString(36).slice(2, 10));

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) setLoading(true);
    const requestId = ++latestRequestRef.current;

    const [{ data: roomData }, { data: playersData }, { data: selfPlayerData }] = await Promise.all([
      supabase.from("imposter_rooms").select("*").eq("id", roomId).single(),
      supabase.from("imposter_room_players").select("*").eq("room_id", roomId).order("seat_order"),
      supabase.from("imposter_room_players").select("*").eq("room_id", roomId).eq("id", playerId).maybeSingle(),
    ]);

    let myRoleData: unknown = null;
    let allRolesData: unknown = null;
    let myVoteData: unknown = null;
    let votesData: unknown = null;
    if (roomData && selfPlayerData) {
      const roomState = roomData as ImposterRoomDto;
      const phaseNumber = roomState.phase_number;
      const votePhaseNumber = roomState.state === "ended" ? Math.max(0, phaseNumber - 1) : phaseNumber;
      [{ data: myRoleData }, { data: allRolesData }, { data: myVoteData }, { data: votesData }] = await Promise.all([
        supabase.from("imposter_player_roles").select("*").eq("player_id", playerId).maybeSingle(),
        supabase.from("imposter_player_roles").select("*").eq("room_id", roomId),
        supabase.from("imposter_votes").select("*").eq("room_id", roomId).eq("phase_number", votePhaseNumber).eq("voter_player_id", playerId).maybeSingle(),
        supabase.from("imposter_votes").select("*").eq("room_id", roomId).eq("phase_number", votePhaseNumber),
      ]);
    }

    if (requestId !== latestRequestRef.current) return;

    setRoom((roomData as ImposterRoomDto) ?? null);
    setPlayers((playersData as ImposterPlayerDto[]) ?? []);
    setMyPlayer((selfPlayerData as ImposterPlayerDto) ?? null);
    setMyRole((myRoleData as ImposterRoleDto) ?? null);
    setPlayerRoles((allRolesData as ImposterRoleDto[]) ?? []);
    setMyVote((myVoteData as ImposterVoteDto) ?? null);
    setCurrentVotes((votesData as ImposterVoteDto[]) ?? []);

    setHasLoadedOnce(true);
    setLoading(false);
  }, [hasLoadedOnce, playerId, roomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`imposter-room-${roomId}-${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const playersChannel = supabase
      .channel(`imposter-players-${roomId}-${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_room_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const rolesChannel = supabase
      .channel(`imposter-roles-${roomId}-${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_player_roles", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const votesChannel = supabase
      .channel(`imposter-votes-${roomId}-${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_votes", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(rolesChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [channelSuffix, refresh, roomId]);

  useEffect(() => {
    if (!roomId) return;

    const intervalId = setInterval(() => {
      refresh();
    }, 2500);

    return () => {
      clearInterval(intervalId);
    };
  }, [channelSuffix, refresh, roomId]);

  return {
    room,
    players,
    myPlayer,
    myRole,
    playerRoles,
    myVote,
    currentVotes,
    loading,
    refresh,
  };
}
