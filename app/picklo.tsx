import { GameEntryScreen } from "../src/components/GameEntryScreen";
import { createMemeMatchRoom, joinMemeMatchRoom } from "../src/games/memematch/api";
import { useI18n } from "../src/lib/i18n";

const toLobby = ({ roomId, playerId }: { roomId: string; playerId: string }) => ({
  pathname: "/lobby",
  params: { roomId, playerId },
});

export default function MemeMatchHome() {
  const { language } = useI18n();
  return (
    <GameEntryScreen
      gameId="memematch"
      createRoom={async (name) => toLobby(await createMemeMatchRoom(name))}
      joinRoom={async (code, name) => toLobby(await joinMemeMatchRoom(code, name))}
      notice={
        language === "sv"
          ? "Bilderna du väljer visas för alla spelare i rummet."
          : "Photos you pick are shown to everyone in the room."
      }
    />
  );
}
