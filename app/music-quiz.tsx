import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createMusicQuizRoom, joinMusicQuizRoom } from "../src/games/music-quiz/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/music-quiz-room",
  params: { roomId, playerId },
});

export default function MusicQuizHome() {
  return (
    <GameEntryScreen
      gameId="musicQuiz"
      createRoom={async (name) => toRoom(await createMusicQuizRoom(name))}
      joinRoom={async (code, name) => toRoom(await joinMusicQuizRoom(code, name))}
    />
  );
}
