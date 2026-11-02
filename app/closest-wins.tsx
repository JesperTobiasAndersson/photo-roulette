import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createPartyRoom, joinPartyRoom } from "../src/games/party/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/party-room",
  params: { roomId, playerId },
});

export default function ClosestWinsHome() {
  return (
    <GameEntryScreen
      gameId="estimate"
      createRoom={async (name) => toRoom(await createPartyRoom("estimate", name))}
      joinRoom={async (code, name) => toRoom(await joinPartyRoom("estimate", code, name))}
      localHref="/closest-wins-local"
    />
  );
}
