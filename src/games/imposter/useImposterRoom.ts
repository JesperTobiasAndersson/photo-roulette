import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) setLoading(true);

    const [{ data: roomData }, { data: playersData }, { data: selfPlayerData }] = await Promise.all([
      supabase.from("imposter_rooms").select("*").eq("id", roomId).single(),
      supabase.from("imposter_room_players").select("*").eq("room_id", roomId).order("seat_order"),
      supabase.from("imposter_room_players").select("*").eq("room_id", roomId).eq("id", playerId).maybeSingle(),
    ]);

    setRoom((roomData as ImposterRoomDto) ?? null);
    setPlayers((playersData as ImposterPlayerDto[]) ?? []);
    setMyPlayer((selfPlayerData as ImposterPlayerDto) ?? null);

    if (roomData && selfPlayerData) {
      const roomState = roomData as ImposterRoomDto;
      const phaseNumber = roomState.phase_number;
      const votePhaseNumber = roomState.state === "ended" ? Math.max(0, phaseNumber - 1) : phaseNumber;
      const [{ data: myRoleData }, { data: allRolesData }, { data: myVoteData }, { data: votesData }] = await Promise.all([
        supabase.from("imposter_player_roles").select("*").eq("player_id", playerId).maybeSingle(),
        supabase.from("imposter_player_roles").select("*").eq("room_id", roomId),
        supabase.from("imposter_votes").select("*").eq("room_id", roomId).eq("phase_number", votePhaseNumber).eq("voter_player_id", playerId).maybeSingle(),
        supabase.from("imposter_votes").select("*").eq("room_id", roomId).eq("phase_number", votePhaseNumber),
      ]);

      setMyRole((myRoleData as ImposterRoleDto) ?? null);
      setPlayerRoles((allRolesData as ImposterRoleDto[]) ?? []);
      setMyVote((myVoteData as ImposterVoteDto) ?? null);
      setCurrentVotes((votesData as ImposterVoteDto[]) ?? []);
    } else {
      setMyRole(null);
      setPlayerRoles([]);
      setMyVote(null);
      setCurrentVotes([]);
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
      .channel(`imposter-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const playersChannel = supabase
      .channel(`imposter-players-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_room_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const rolesChannel = supabase
      .channel(`imposter-roles-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_player_roles", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const votesChannel = supabase
      .channel(`imposter-votes-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imposter_votes", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(rolesChannel);
      supabase.removeChannel(votesChannel);
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
    myRole,
    playerRoles,
    myVote,
    currentVotes,
    loading,
    refresh,
  };
}
