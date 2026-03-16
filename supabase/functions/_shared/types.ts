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

export type RoomRow = {
  id: string;
  code: string;
  state: MafiaPhase;
  host_player_id: string | null;
  phase_number: number;
  phase_ends_at: string | null;
  winner: "mafia" | "village" | null;
  public_message: string | null;
};

export type PlayerRow = {
  id: string;
  room_id: string;
  auth_user_id: string;
  display_name: string;
  seat_order: number;
  status: "alive" | "eliminated";
  role_reveal_ready: boolean;
};

export type RoleRow = {
  player_id: string;
  room_id: string;
  role: MafiaRole;
  is_alive: boolean;
};

export type NightActionRow = {
  actor_player_id: string;
  actor_role: MafiaRole;
  target_player_id: string | null;
  fake_ready: boolean;
  confirmed: boolean;
};
