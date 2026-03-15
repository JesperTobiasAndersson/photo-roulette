export type MafiaRole = "mafia" | "detective" | "doctor" | "villager";
export type MafiaPhase = "lobby" | "night" | "day" | "finished";
export type MafiaWinner = "mafia" | "town" | null;
export type MafiaActionType = "mafia_target" | "doctor_save" | "detective_check" | "day_vote";

export type MafiaRoom = {
  id: string;
  code: string;
  host_player_id: string | null;
  phase: MafiaPhase;
  day_number: number;
  winner: MafiaWinner;
  night_result: string | null;
  last_eliminated_player_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MafiaPlayer = {
  id: string;
  room_id: string;
  name: string;
  role: MafiaRole | null;
  is_alive: boolean;
  private_message: string | null;
  joined_at: string;
};

export type MafiaAction = {
  id: string;
  room_id: string;
  day_number: number;
  phase: MafiaPhase;
  action_type: MafiaActionType;
  actor_player_id: string;
  target_player_id: string;
  created_at: string;
};
