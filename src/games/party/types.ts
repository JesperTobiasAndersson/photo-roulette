/** Round-based party games that share the party_* tables. */
export type PartyGame = "most_likely" | "estimate";
export type PartyState = "lobby" | "question" | "reveal" | "ended";

export type PartyRoomDto = {
  id: string;
  game: PartyGame;
  code: string;
  state: PartyState;
  host_player_id: string | null;
  total_rounds: number;
  current_round: number;
};

export type PartyPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  score: number;
  /** Most Likely: rounds in which this player got the most votes. */
  titles: number;
  /** Last round this player answered. */
  answered_round: number;
};

export type PartyRoundDto = {
  id: string;
  room_id: string;
  round_number: number;
  prompt_id: string;
  text_sv: string;
  text_en: string;
  unit_sv: string;
  unit_en: string;
  /** Closest Wins: set when the round is revealed. */
  answer: number | null;
  revealed: boolean;
};

/** Before the reveal a phone only sees its own answer; afterwards everyone's. */
export type PartyAnswerDto = {
  round_id: string;
  player_id: string;
  target_player_id: string | null;
  number_value: number | null;
  points: number;
};
