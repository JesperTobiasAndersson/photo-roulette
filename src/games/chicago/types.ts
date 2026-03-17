export type ChicagoSuit = "clubs" | "diamonds" | "hearts" | "spades";

export type ChicagoRank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "A";

export type ChicagoCard = {
  rank: ChicagoRank;
  suit: ChicagoSuit;
};

export type ChicagoPhase =
  | "lobby"
  | "dealing"
  | "draw_phase_1"
  | "draw_phase_2"
  | "draw_phase_3"
  | "poker_score_1"
  | "poker_score_2"
  | "trick_phase"
  | "result"
  | "game_over";

export type ChicagoPokerHandName =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_straight_flush";

export type ChicagoRoomDto = {
  id: string;
  code: string;
  state: ChicagoPhase;
  host_player_id: string | null;
  current_round: number;
  dealer_player_id: string | null;
  lead_player_id: string | null;
  current_turn_player_id: string | null;
  phase_number: number;
  phase_ends_at: string | null;
  winner_player_id: string | null;
  public_message: string | null;
};

export type ChicagoPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  score: number;
  status: "active" | "eliminated";
  draw_ready: boolean;
  trick_ready: boolean;
  chicago_declared: boolean;
};

export type ChicagoRoundDto = {
  id: string;
  room_id: string;
  round_number: number;
  dealer_player_id: string;
  active_phase: ChicagoPhase;
  draw_number: number;
  trick_number: number;
  deck: ChicagoCard[];
  chicago_declared_by: string | null;
  chicago_failed: boolean;
  chicago_resolved: boolean;
  last_trick_winner_player_id: string | null;
  created_at: string;
};

export type ChicagoHandDto = {
  player_id: string;
  room_id: string;
  round_id: string;
  cards: ChicagoCard[];
  last_poker_hand_name: ChicagoPokerHandName | null;
  last_poker_points: number;
};

export type ChicagoDrawActionDto = {
  player_id: string;
  round_id: string;
  draw_number: number;
  discarded_cards: ChicagoCard[];
  completed_at: string;
};

export type ChicagoTrickDto = {
  id: string;
  round_id: string;
  trick_number: number;
  lead_suit: ChicagoSuit | null;
  winner_player_id: string | null;
  created_at: string;
};

export type ChicagoPlayedCardDto = {
  trick_id: string;
  player_id: string;
  card: ChicagoCard;
  play_order: number;
};

export type ChicagoPokerEvaluation = {
  name: ChicagoPokerHandName;
  label: string;
  points: number;
  tiebreak: number[];
};

export type ChicagoRoomState = {
  room: ChicagoRoomDto | null;
  players: ChicagoPlayerDto[];
  myPlayer: ChicagoPlayerDto | null;
  round: ChicagoRoundDto | null;
  myHand: ChicagoHandDto | null;
  currentTrick: ChicagoTrickDto | null;
  playedCards: ChicagoPlayedCardDto[];
  currentPokerLeaderPlayerId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
