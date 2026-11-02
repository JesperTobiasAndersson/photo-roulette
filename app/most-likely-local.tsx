import React, { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { LocalScoreboard, LocalTopBar, PlayerNamesEditor, PlayerPicker, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, shuffled, useLocalGame } from "../src/games/local/useLocalGame";
import { MOST_LIKELY_STATEMENTS } from "../src/games/most-likely/data";
import { useI18n, type Language } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel, SegmentedControl } from "../src/ui/components";
import { colors, space, type } from "../src/ui/theme";

const GAME = GAMES.mostLikely;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const ROUND_OPTIONS = ["5", "10", "15"] as const;

type MostLikelyLocalGame = {
  players: { id: string; name: string; score: number }[];
  statementIds: string[];
  index: number;
  /** Who got the title in each round so far (null = tie / skipped). */
  winners: (string | null)[];
};

const COPY = {
  en: {
    title: "Most Likely · one phone",
    setupTitle: "One phone for the whole group",
    setupBody: "Add everyone who is playing. For each statement, count to three and everybody points at the player who fits best.",
    rounds: "Statements",
    start: "Start the game",
    progress: (a: number, b: number) => `${a}/${b}`,
    lead: "Who's most likely to…",
    howTo: "Count to three and everyone points at someone. Tap the player most people pointed at.",
    give: (name: string) => `${name} gets the title`,
    pick: "Pick a player",
    tie: "It was a tie – skip",
    finished: "That's all the statements",
    champion: (names: string) => `Most titles: ${names}`,
    nobody: "Nobody got a title this time.",
    standings: "Titles",
    playAgain: "Play again – new statements",
    changeSetup: "Change players",
  },
  sv: {
    title: "Most Likely · en telefon",
    setupTitle: "En telefon för hela gänget",
    setupBody: "Lägg till alla som spelar. För varje påstående räknar ni till tre och alla pekar på den som passar bäst.",
    rounds: "Påståenden",
    start: "Starta spelet",
    progress: (a: number, b: number) => `${a}/${b}`,
    lead: "Vem är mest trolig att…",
    howTo: "Räkna till tre och peka samtidigt på någon. Tryck på den som flest pekade på.",
    give: (name: string) => `${name} får titeln`,
    pick: "Välj en spelare",
    tie: "Det blev lika – hoppa över",
    finished: "Det var alla påståenden",
    champion: (names: string) => `Flest titlar: ${names}`,
    nobody: "Ingen fick någon titel den här gången.",
    standings: "Titlar",
    playAgain: "Spela igen – nya påståenden",
    changeSetup: "Byt spelare",
  },
} satisfies Record<Language, unknown>;

const STATEMENTS = new Map(MOST_LIKELY_STATEMENTS.map((statement) => [statement.id, statement]));

function newGame(names: string[], rounds: number): MostLikelyLocalGame {
  return {
    players: names.map((name, index) => ({ id: localPlayerId(index), name, score: 0 })),
    statementIds: shuffled(MOST_LIKELY_STATEMENTS).slice(0, rounds).map((statement) => statement.id),
    index: 0,
    winners: [],
  };
}

export default function MostLikelyLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<MostLikelyLocalGame>("most-likely");
  const [names, setNames] = useRememberedPlayerNames();
  const [rounds, setRounds] = useState<(typeof ROUND_OPTIONS)[number]>("10");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const done = !!game && game.index >= game.statementIds.length;
  const topBar = <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && !done} onQuit={() => setGame(null)} />;

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  if (!game) {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.start} icon="play" accent={ACCENT} disabled={names.length < MIN_PLAYERS} onPress={() => setGame(newGame(names, Number(rounds)))} />}
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>
        <PlayerNamesEditor names={names} onChange={setNames} min={MIN_PLAYERS} max={MAX_PLAYERS} accent={ACCENT} />
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.rounds}</SectionLabel>
          <SegmentedControl value={rounds} onChange={setRounds} accent={ACCENT} options={ROUND_OPTIONS.map((n) => ({ value: n, label: n }))} />
        </View>
      </Screen>
    );
  }

  const standings = <LocalScoreboard players={game.players} accent={ACCENT} />;

  if (done) {
    const top = Math.max(...game.players.map((p) => p.score));
    const champions = game.players.filter((p) => p.score === top);
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button label={copy.playAgain} icon="refresh" accent={ACCENT} onPress={() => setGame(newGame(game.players.map((p) => p.name), game.statementIds.length))} />
            <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
          </>
        }
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="ribbon" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>
              {top > 0 ? copy.champion(champions.map((p) => p.name).join(", ")) : copy.nobody}
            </Text>
          </Card>
          <SectionLabel>{copy.standings}</SectionLabel>
          {standings}
        </AnimatedEntrance>
      </Screen>
    );
  }

  const statement = STATEMENTS.get(game.statementIds[game.index]);
  const text = statement ? statement[language] : "";
  const selected = game.players.find((p) => p.id === selectedId) ?? null;
  const decide = (winnerId: string | null) => {
    setSelectedId(null);
    setGame((g) => ({
      ...g,
      players: g.players.map((p) => (p.id === winnerId ? { ...p, score: p.score + 1 } : p)),
      winners: [...g.winners, winnerId],
      index: g.index + 1,
    }));
  };

  return (
    <Screen
      topBar={topBar}
      footer={
        <>
          <Button label={selected ? copy.give(selected.name) : copy.pick} icon="ribbon" accent={ACCENT} disabled={!selected} onPress={() => selected && decide(selected.id)} />
          <Button label={copy.tie} variant="ghost" size="md" onPress={() => decide(null)} />
        </>
      }
    >
      <AnimatedEntrance enterKey={`s-${game.index}`} style={{ gap: space.md }}>
        <Chip label={copy.progress(game.index + 1, game.statementIds.length)} color={ACCENT} icon="albums" />
        <Card accent={ACCENT} style={{ gap: space.sm, paddingVertical: space.xl }}>
          <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.lead}</Text>
          <Text style={{ color: colors.text, fontSize: 26, lineHeight: 34, fontWeight: "800" }}>{text}?</Text>
        </Card>
        <Text style={[type.small, { color: colors.textMuted }]}>{copy.howTo}</Text>
        <PlayerPicker
          players={game.players.map((p) => ({ id: p.id, name: p.name, note: p.score > 0 ? `${p.score}` : undefined }))}
          selectedId={selectedId}
          onSelect={setSelectedId}
          accent={ACCENT}
        />
      </AnimatedEntrance>
    </Screen>
  );
}
