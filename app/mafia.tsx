import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createMafiaRoom, joinMafiaRoom } from "../src/games/mafia/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/mafia-lobby",
  params: { roomId, playerId },
});

export default function MafiaHome() {
  return (
    <GameEntryScreen
      gameId="mafia"
      createRoom={async (name) => toRoom(await createMafiaRoom(name))}
      joinRoom={async (code, name) => toRoom(await joinMafiaRoom(code, name))}
    />
  );
}
