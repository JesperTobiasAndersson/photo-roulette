import { useCallback, useEffect, useRef, useState } from "react";
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
  const [playerRoles, setPlayerRoles] = useState<MafiaRoleDto[]>([]);
  const [myNightAction, setMyNightAction] = useState<MafiaNightActionDto | null>(null);
  const [currentNightActions, setCurrentNightActions] = useState<MafiaNightActionDto[]>([]);
  const [mafiaNightActions, setMafiaNightActions] = useState<MafiaNightActionDto[]>([]);
  const [myPoliceReports, setMyPoliceReports] = useState<MafiaPoliceReportDto[]>([]);
  const [myDayVote, setMyDayVote] = useState<MafiaDayVoteDto | null>(null);
  const [currentDayVotes, setCurrentDayVotes] = useState<MafiaDayVoteDto[]>([]);
  const [events, setEvents] = useState<MafiaGameEventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Realtime events trigger many overlapping refreshes; only the newest one may write state,
  // otherwise a slow older response can put the screen back into a previous phase.
  // A superseded refresh resolves when the newest one has written its state, so callers that
  // await refresh() (e.g. after an action) always continue with fresh data.
  const refreshSeq = useRef(0);
  const latestRefresh = useRef<Promise<void> | null>(null);

  const loadSnapshot = useCallback(async (): Promise<void> => {
    if (!roomId || !playerId) return;
    const seq = ++refreshSeq.current;
    const stale = () => seq !== refreshSeq.current;
    const newer = () => latestRefresh.current ?? undefined;
    if (!hasLoadedOnce) {
      setLoading(true);
    }
    const [{ data: roomData }, { data: publicPlayers }, { data: selfPlayer }] = await Promise.all([
      supabase.from("mafia_rooms").select("*").eq("id", roomId).single(),
      supabase.from("mafia_room_players").select("id,room_id,display_name,seat_order,status,role_reveal_ready,discussion_ready").eq("room_id", roomId).order("seat_order"),
      supabase.from("mafia_room_players").select("id,room_id,display_name,seat_order,status,role_reveal_ready,discussion_ready").eq("room_id", roomId).eq("id", playerId).single(),
    ]);
    if (stale()) return newer();

    if (selfPlayer && roomData) {
      const phaseNumber = (roomData as MafiaRoomDto).phase_number;
      // Resolving a vote bumps phase_number, so the vote result shows the votes of the phase before.
      const votePhaseNumber = (roomData as MafiaRoomDto).state === "vote_result" ? phaseNumber - 1 : phaseNumber;
      const [{ data: roleData }, { data: allRolesData }, { data: nightActionData }, { data: currentNightActionsData }, { data: policeReportsData }, { data: voteData }, { data: currentVotesData }, { data: eventData }] =
        await Promise.all([
          supabase.from("mafia_player_roles").select("*").eq("player_id", selfPlayer.id).maybeSingle(),
          supabase.from("mafia_player_roles").select("*").eq("room_id", roomId),
          supabase.from("mafia_night_actions").select("*").eq("actor_player_id", selfPlayer.id).eq("phase_number", phaseNumber).maybeSingle(),
          supabase.from("mafia_night_actions").select("*").eq("room_id", roomId).eq("phase_number", phaseNumber),
          supabase.from("mafia_police_reports").select("*").eq("police_player_id", selfPlayer.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("mafia_day_votes").select("phase_number,voter_player_id,target_player_id").eq("voter_player_id", selfPlayer.id).eq("phase_number", phaseNumber).maybeSingle(),
          supabase.from("mafia_day_votes").select("phase_number,voter_player_id,target_player_id").eq("room_id", roomId).eq("phase_number", votePhaseNumber),
          supabase.from("mafia_game_events").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20),
        ]);
      if (stale()) return newer();

      const nightActions = (currentNightActionsData as MafiaNightActionDto[]) ?? [];
      // Write everything from one consistent snapshot so the phase and its data never disagree.
      setRoom(roomData as MafiaRoomDto);
      setPlayers((publicPlayers as MafiaPlayerDto[]) ?? []);
      setMyPlayer(selfPlayer as MafiaPlayerDto);
      setMyRole((roleData as MafiaRoleDto) ?? null);
      setPlayerRoles((allRolesData as MafiaRoleDto[]) ?? []);
      setMyNightAction((nightActionData as MafiaNightActionDto) ?? null);
      setCurrentNightActions(nightActions);
      setMyPoliceReports((policeReportsData as MafiaPoliceReportDto[]) ?? []);
      setMyDayVote((voteData as MafiaDayVoteDto) ?? null);
      setCurrentDayVotes((currentVotesData as MafiaDayVoteDto[]) ?? []);
      setEvents(((eventData as MafiaGameEventDto[]) ?? []).reverse());
      setMafiaNightActions((roleData as MafiaRoleDto | null)?.role === "mafia" ? nightActions.filter((action) => action.actor_role === "mafia") : []);
    } else {
      setRoom((roomData as MafiaRoomDto) ?? null);
      setPlayers((publicPlayers as MafiaPlayerDto[]) ?? []);
      setMyPlayer((selfPlayer as MafiaPlayerDto) ?? null);
      setMyRole(null);
      setPlayerRoles([]);
      setMyNightAction(null);
      setCurrentNightActions([]);
      setMyPoliceReports([]);
      setMyDayVote(null);
      setCurrentDayVotes([]);
      setEvents([]);
      setMafiaNightActions([]);
    }

    setHasLoadedOnce(true);
    setLoading(false);
  }, [hasLoadedOnce, roomId, playerId]);

  const refresh = useCallback(() => {
    const run = loadSnapshot();
    latestRefresh.current = run;
    return run;
  }, [loadSnapshot]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!roomId) return;

    // supabase.channel() hands back an existing channel with the same name, so every hook
    // instance needs its own name: otherwise the screen being left (lobby -> results -> lobby)
    // removes the channel the new screen is listening on and that phone stops updating.
    const channelName = `mafia-room-${roomId}-${Math.random().toString(36).slice(2, 10)}`;
    const onChange = () => {
      refresh();
    };
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_rooms", filter: `id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_room_players", filter: `room_id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_night_actions", filter: `room_id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_game_events", filter: `room_id=eq.${roomId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_day_votes", filter: `room_id=eq.${roomId}` }, onChange)
      .subscribe();

    // Safety net: phones drop the realtime socket when locked or on flaky networks, so
    // re-check regularly and immediately when the app becomes visible again.
    const intervalId = setInterval(onChange, 4000);
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") onChange();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(intervalId);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [roomId, refresh]);

  return {
    room,
    players,
    myPlayer,
    myRole,
    playerRoles,
    myNightAction,
    currentNightActions,
    mafiaNightActions,
    myPoliceReports,
    myDayVote,
    currentDayVotes,
    events,
    loading,
    refresh,
  };
}
