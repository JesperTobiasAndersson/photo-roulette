export type MusicQuizRoomStateValue = "lobby" | "question" | "reveal";
export type MusicQuizPromptType = "title" | "artist";
export type MusicQuizSongPool = "hits" | "classics" | "mix";

export type MusicQuizRoomDto = {
  id: string;
  code: string;
  state: MusicQuizRoomStateValue;
  host_player_id: string | null;
  current_round_id: string | null;
  phase_number: number;
  public_message: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MusicQuizPlayerDto = {
  id: string;
  room_id: string;
  display_name: string;
  seat_order: number;
  score: number;
  created_at?: string;
  updated_at?: string;
};

export type MusicQuizRoundDto = {
  id: string;
  room_id: string;
  round_number: number;
  prompt_type: MusicQuizPromptType;
  spotify_url: string;
  spotify_track_id: string;
  song_title: string;
  artist_name: string;
  cover_image_url: string | null;
  point_value: number;
  state: "question" | "reveal";
  created_at?: string;
  updated_at?: string;
};

export type MusicQuizAnswerDto = {
  id: string;
  round_id: string;
  player_id: string;
  answer_text: string;
  awarded_points: number;
  submitted_at: string | null;
  updated_at?: string;
};

export type MusicQuizRoomState = {
  room: MusicQuizRoomDto | null;
  players: MusicQuizPlayerDto[];
  myPlayer: MusicQuizPlayerDto | null;
  currentRound: MusicQuizRoundDto | null;
  answers: MusicQuizAnswerDto[];
  myAnswer: MusicQuizAnswerDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
};
