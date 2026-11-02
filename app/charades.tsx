import { GameEntryScreen } from "../src/components/GameEntryScreen";

// Charades is played on one phone only, so there is no room to create or join.
export default function CharadesHome() {
  return <GameEntryScreen gameId="charades" localHref="/charades-local" />;
}
