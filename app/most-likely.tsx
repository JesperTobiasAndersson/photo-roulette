import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createPartyRoom, joinPartyRoom } from "../src/games/party/api";

const toRoom = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/party-room",
  params: { roomId, playerId },
});

export default function MostLikelyHome() {
  return (
    <GameEntryScreen
      gameId="mostLikely"
      createRoom={async (name) => toRoom(await createPartyRoom("most_likely", name))}
      joinRoom={async (code, name) => toRoom(await joinPartyRoom("most_likely", code, name))}
      localHref="/most-likely-local"
    />
  );
}
