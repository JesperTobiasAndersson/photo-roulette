import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createImposterRoom, joinImposterRoom } from "../src/games/imposter/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/imposter-lobby",
  params: { roomId, playerId },
});

export default function ImposterHome() {
  return (
    <GameEntryScreen
      gameId="imposter"
      createRoom={async (name) => toRoom(await createImposterRoom(name))}
      joinRoom={async (code, name) => toRoom(await joinImposterRoom(code, name))}
    />
  );
}
