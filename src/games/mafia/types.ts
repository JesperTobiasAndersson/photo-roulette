export type MafiaPhase =
  | "lobby"
  | "role_reveal"
  | "night"
  | "night_result"
  | "day_discussion"
  | "day_voting"
  | "vote_result"
  | "ended";

export type MafiaRole = "mafia" | "doctor" | "police" | "villager";
export type MafiaAlignment = "mafia" | "village";

export type MafiaRoomDto = {
  id: string;
  code: string;
  state: MafiaPhase;
  host_player_id: string | null;
  phase_number: number;
  phase_ends_at: string | null;
  winner: MafiaAlignment | null;
  public_message: string | null;
};

export type MafiaPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  status: "alive" | "eliminated";
  role_reveal_ready: boolean;
  discussion_ready: boolean;
};

export type MafiaRoleDto = {
  player_id: string;
  room_id: string;
  role: MafiaRole;
  is_alive: boolean;
  revealed_at: string | null;
};

export type MafiaNightActionDto = {
  actor_player_id: string;
  actor_role: MafiaRole;
  target_player_id: string | null;
  fake_ready: boolean;
  confirmed: boolean;
  locked_at: string | null;
};

export type MafiaPoliceReportDto = {
  phase_number: number;
  target_player_id: string;
  result_alignment: MafiaAlignment;
  created_at: string;
};

export type MafiaDayVoteDto = {
  phase_number: number;
  voter_player_id?: string;
  target_player_id: string;
};

export type MafiaGameEventDto = {
  id: string;
  phase_number: number;
  phase: MafiaPhase;
  visible_to: "all" | "mafia" | "player";
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type MafiaRoomState = {
  room: MafiaRoomDto | null;
  players: MafiaPlayerDto[];
  myPlayer: MafiaPlayerDto | null;
  myRole: MafiaRoleDto | null;
  myNightAction: MafiaNightActionDto | null;
  mafiaNightActions: MafiaNightActionDto[];
  myPoliceReports: MafiaPoliceReportDto[];
  myDayVote: MafiaDayVoteDto | null;
  currentDayVotes: MafiaDayVoteDto[];
  events: MafiaGameEventDto[];
  loading: boolean;
  refresh: () => Promise<void>;
};
