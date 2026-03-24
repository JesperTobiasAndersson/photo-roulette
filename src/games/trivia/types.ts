export type TriviaRoomStateValue = "lobby" | "question" | "reveal" | "completed";

export type TriviaRoomDto = {
  id: string;
  code: string;
  state: TriviaRoomStateValue;
  host_player_id: string | null;
  current_turn_id: string | null;
  selected_categories: string[];
  questions_per_player: number;
  phase_number: number;
  public_message: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TriviaPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  score: number;
  correct_answers: number;
  created_at?: string;
  updated_at?: string;
};

export type TriviaTurnDto = {
  id: string;
  room_id: string;
  player_id: string;
  turn_number: number;
  player_question_number: number;
  category: string;
  question_text: string;
  answer_text: string;
  revealed_at: string | null;
  judged_at: string | null;
  awarded_points: number;
  is_correct: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type TriviaRoomState = {
  room: TriviaRoomDto | null;
  players: TriviaPlayerDto[];
  myPlayer: TriviaPlayerDto | null;
  currentTurn: TriviaTurnDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
