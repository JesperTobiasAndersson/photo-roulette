import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createTriviaRoom, joinTriviaRoom } from "../src/games/trivia/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/trivia-room",
  params: { roomId, playerId },
});

export default function TriviaHome() {
  return (
    <GameEntryScreen
      gameId="trivia"
      createRoom={async (name) => toRoom(await createTriviaRoom(name))}
      joinRoom={async (code, name) => toRoom(await joinTriviaRoom(code, name))}
    />
  );
}
