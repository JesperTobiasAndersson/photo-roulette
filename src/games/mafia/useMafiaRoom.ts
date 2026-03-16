import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  MafiaDayVoteDto,
  MafiaGameEventDto,
  MafiaNightActionDto,
  MafiaPlayerDto,
  MafiaPoliceReportDto,
  MafiaRoleDto,
  MafiaRoomDto,
  MafiaRoomState,
} from "./types";

export function useMafiaRoom(roomId: string, playerId: string): MafiaRoomState {
  const [room, setRoom] = useState<MafiaRoomDto | null>(null);
  const [players, setPlayers] = useState<MafiaPlayerDto[]>([]);
  const [myPlayer, setMyPlayer] = useState<MafiaPlayerDto | null>(null);
  const [myRole, setMyRole] = useState<MafiaRoleDto | null>(null);
  const [myNightAction, setMyNightAction] = useState<MafiaNightActionDto | null>(null);
  const [mafiaNightActions, setMafiaNightActions] = useState<MafiaNightActionDto[]>([]);
  const [myPoliceReports, setMyPoliceReports] = useState<MafiaPoliceReportDto[]>([]);
  const [myDayVote, setMyDayVote] = useState<MafiaDayVoteDto | null>(null);
  const [currentDayVotes, setCurrentDayVotes] = useState<MafiaDayVoteDto[]>([]);
  const [events, setEvents] = useState<MafiaGameEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const refresh = useCallback(async () => {
    if (!roomId || !playerId) return;
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    const [{ data: roomData }, { data: publicPlayers }, { data: selfPlayer }] = await Promise.all([
      supabase.from("mafia_rooms").select("*").eq("id", roomId).single(),
      supabase.from("mafia_room_players").select("id,room_id,display_name,seat_order,status,role_reveal_ready,discussion_ready").eq("room_id", roomId).order("seat_order"),
      supabase.from("mafia_room_players").select("id,room_id,display_name,seat_order,status,role_reveal_ready,discussion_ready").eq("room_id", roomId).eq("id", playerId).single(),
    ]);

    setRoom((roomData as MafiaRoomDto) ?? null);
    setPlayers((publicPlayers as MafiaPlayerDto[]) ?? []);
    setMyPlayer((selfPlayer as MafiaPlayerDto) ?? null);

    if (selfPlayer && roomData) {
      const phaseNumber = (roomData as MafiaRoomDto).phase_number;
      const [{ data: roleData }, { data: nightActionData }, { data: policeReportsData }, { data: voteData }, { data: currentVotesData }, { data: eventData }] =
        await Promise.all([
          supabase.from("mafia_player_roles").select("*").eq("player_id", selfPlayer.id).maybeSingle(),
          supabase.from("mafia_night_actions").select("*").eq("actor_player_id", selfPlayer.id).eq("phase_number", phaseNumber).maybeSingle(),
          supabase.from("mafia_police_reports").select("*").eq("police_player_id", selfPlayer.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("mafia_day_votes").select("phase_number,voter_player_id,target_player_id").eq("voter_player_id", selfPlayer.id).eq("phase_number", phaseNumber).maybeSingle(),
          supabase.from("mafia_day_votes").select("phase_number,voter_player_id,target_player_id").eq("room_id", roomId).eq("phase_number", phaseNumber),
          supabase.from("mafia_game_events").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20),
        ]);

      setMyRole((roleData as MafiaRoleDto) ?? null);
      setMyNightAction((nightActionData as MafiaNightActionDto) ?? null);
      setMyPoliceReports((policeReportsData as MafiaPoliceReportDto[]) ?? []);
      setMyDayVote((voteData as MafiaDayVoteDto) ?? null);
      setCurrentDayVotes((currentVotesData as MafiaDayVoteDto[]) ?? []);
      setEvents(((eventData as MafiaGameEventDto[]) ?? []).reverse());

      if ((roleData as MafiaRoleDto | null)?.role === "mafia") {
        const { data: mafiaActionsData } = await supabase
          .from("mafia_night_actions")
          .select("actor_player_id,actor_role,target_player_id,fake_ready,confirmed,locked_at")
          .eq("room_id", roomId)
          .eq("phase_number", phaseNumber)
          .eq("actor_role", "mafia");
        setMafiaNightActions((mafiaActionsData as MafiaNightActionDto[]) ?? []);
      } else {
        setMafiaNightActions([]);
      }
    } else {
      setMyRole(null);
      setMyNightAction(null);
      setMyPoliceReports([]);
      setMyDayVote(null);
      setCurrentDayVotes([]);
      setEvents([]);
      setMafiaNightActions([]);
    }

    setHasLoadedOnce(true);
    setLoading(false);
  }, [hasLoadedOnce, roomId, playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`mafia-room-state-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_rooms", filter: `id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const playersChannel = supabase
      .channel(`mafia-room-players-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_room_players", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const actionsChannel = supabase
      .channel(`mafia-night-actions-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_night_actions", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const eventsChannel = supabase
      .channel(`mafia-events-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_game_events", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();
    const votesChannel = supabase
      .channel(`mafia-votes-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_day_votes", filter: `room_id=eq.${roomId}` }, () => refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(actionsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [roomId, refresh]);

  return {
    room,
    players,
    myPlayer,
    myRole,
    myNightAction,
    mafiaNightActions,
    myPoliceReports,
    myDayVote,
    currentDayVotes,
    events,
    loading,
    refresh,
  };
}
