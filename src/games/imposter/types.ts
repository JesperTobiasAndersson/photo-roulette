export type ImposterPhase = "lobby" | "role_reveal" | "discussion" | "voting" | "ended";

export type ImposterRole = "imposter" | "crew";
export type ImposterWinner = "imposter" | "crew";

export type ImposterRoomDto = {
  id: string;
  code: string;
  state: ImposterPhase;
  host_player_id: string | null;
  category_id: string | null;
  secret_prompt: string | null;
  phase_number: number;
  phase_ends_at: string | null;
  winner: ImposterWinner | null;
  public_message: string | null;
};

export type ImposterPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  status: "alive" | "eliminated";
  role_reveal_ready: boolean;
  discussion_ready: boolean;
};

export type ImposterRoleDto = {
  player_id: string;
  room_id: string;
  role: ImposterRole;
  prompt: string | null;
  revealed_at: string | null;
};

export type ImposterVoteDto = {
  phase_number: number;
  voter_player_id: string;
  target_player_id: string;
};

export type ImposterRoomState = {
  room: ImposterRoomDto | null;
  players: ImposterPlayerDto[];
  myPlayer: ImposterPlayerDto | null;
  myRole: ImposterRoleDto | null;
  playerRoles: ImposterRoleDto[];
  myVote: ImposterVoteDto | null;
  currentVotes: ImposterVoteDto[];
  loading: boolean;
  refresh: () => Promise<void>;
};
