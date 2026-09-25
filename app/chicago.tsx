import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createChicagoRoom, joinChicagoRoom } from "../src/games/chicago/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/chicago-room",
  params: { roomId, playerId },
});

export default function ChicagoHome() {
  return (
    <GameEntryScreen
      gameId="chicago"
      createRoom={async (name) => toRoom(await createChicagoRoom(name))}
      joinRoom={async (code, name) => toRoom(await joinChicagoRoom(code, name))}
    />
  );
}
