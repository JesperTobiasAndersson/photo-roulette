import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { CHARADES_CATEGORIES, CHARADES_WORDS, type CharadesCategory } from "../src/games/charades/data";
import { Countdown, LocalScoreboard, LocalTopBar } from "../src/games/local/components";
import { shuffled, useLocalGame } from "../src/games/local/useLocalGame";
import { useI18n, type Language } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel, SegmentedControl, TextField } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.charades;
const ACCENT = GAME.accent;
const SECONDS = ["30", "60", "90"] as const;
const TURNS = ["3", "5"] as const;

type CharadesGame = {
  teams: { id: string; name: string; score: number }[];
  /** Word ids in the order they come up (no repeats within a game). */
  deck: string[];
  deckIndex: number;
  seconds: number;
  turnsPerTeam: number;
  turn: number;
  phase: "handover" | "acting" | "turn_end";
  endsAt: number;
  turnWords: { id: string; got: boolean }[];
};

const COPY = {
  en: {
    title: "Charades",
    setupTitle: "Two teams, one phone",
    setupBody: "Name the teams and pick categories. The actor acts out the words without talking while their team guesses.",
    teams: "Teams",
    team: (n: number) => `Team ${n}`,
    categories: "Categories",
    seconds: "Seconds per turn",
    turns: "Turns per team",
    start: "Start the game",
    turnOf: (name: string) => `${name}'s turn`,
    progress: (a: number, b: number) => `Turn ${a}/${b}`,
    handover: "Pick an actor and give them the phone. Only the actor may look at the screen. The clock starts when you tap Start.",
    go: "Start",
    timeLeft: "Time left",
    actIt: "Act it out – no talking!",
    skip: "Skip",
    gotIt: "Got it",
    timeUp: "Time's up!",
    turnScore: (name: string, n: number) => `${name} got ${n} right`,
    nextTeam: "Next team",
    seeResults: "See the results",
    finished: "Game over",
    winner: (name: string) => `${name} wins!`,
    draw: "It's a draw!",
    scoreboard: "Score",
    playAgain: "Play again",
    changeSetup: "Change teams or categories",
  },
  sv: {
    title: "Charader",
    setupTitle: "Två lag, en telefon",
    setupBody: "Namnge lagen och välj kategorier. Den som spelar gestaltar orden utan att prata medan laget gissar.",
    teams: "Lag",
    team: (n: number) => `Lag ${n}`,
    categories: "Kategorier",
    seconds: "Sekunder per tur",
    turns: "Turer per lag",
    start: "Starta spelet",
    turnOf: (name: string) => `${name}s tur`,
    progress: (a: number, b: number) => `Tur ${a}/${b}`,
    handover: "Välj vem som ska spela och ge hen telefonen. Bara den som spelar får titta på skärmen. Klockan startar när du trycker på Starta.",
    go: "Starta",
    timeLeft: "Tid kvar",
    actIt: "Spela upp det – utan att prata!",
    skip: "Hoppa över",
    gotIt: "Rätt",
    timeUp: "Tiden är slut!",
    turnScore: (name: string, n: number) => `${name} fick ${n} rätt`,
    nextTeam: "Nästa lag",
    seeResults: "Visa resultatet",
    finished: "Spelet är slut",
    winner: (name: string) => `${name} vinner!`,
    draw: "Det blev oavgjort!",
    scoreboard: "Poäng",
    playAgain: "Spela igen",
    changeSetup: "Byt lag eller kategorier",
  },
} satisfies Record<Language, unknown>;

const WORDS = new Map(CHARADES_WORDS.map((word) => [word.id, word]));

function newGame(teamNames: string[], categories: CharadesCategory[], seconds: number, turnsPerTeam: number): CharadesGame {
  return {
    teams: teamNames.map((name, index) => ({ id: `t${index + 1}`, name, score: 0 })),
    deck: shuffled(CHARADES_WORDS.filter((word) => categories.includes(word.category))).map((word) => word.id),
    deckIndex: 0,
    seconds,
    turnsPerTeam,
    turn: 0,
    phase: "handover",
    endsAt: 0,
    turnWords: [],
  };
}

export default function CharadesLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<CharadesGame>("charades");
  const [teamNames, setTeamNames] = useState<string[]>(["", ""]);
  const [categories, setCategories] = useState<CharadesCategory[]>(CHARADES_CATEGORIES.map((category) => category.id));
  const [seconds, setSeconds] = useState<(typeof SECONDS)[number]>("60");
  const [turns, setTurns] = useState<(typeof TURNS)[number]>("3");

  // End the turn when the clock runs out (also after a reload mid-turn).
  const acting = game?.phase === "acting";
  const endsAt = game?.endsAt ?? 0;
  useEffect(() => {
    if (!acting) return;
    const id = setInterval(() => {
      if (Date.now() >= endsAt) setGame((g) => (g.phase === "acting" ? { ...g, phase: "turn_end" } : g));
    }, 250);
    return () => clearInterval(id);
  }, [acting, endsAt, setGame]);

  const totalTurns = game ? game.turnsPerTeam * game.teams.length : 0;
  const done = !!game && game.turn >= totalTurns;
  const topBar = <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && !done} onQuit={() => setGame(null)} />;

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  if (!game) {
    const names = teamNames.map((name, index) => name.trim() || copy.team(index + 1));
    const toggle = (id: CharadesCategory) =>
      setCategories((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.start}
            icon="play"
            accent={ACCENT}
            disabled={categories.length === 0}
            onPress={() => setGame(newGame(names, categories, Number(seconds), Number(turns)))}
          />
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.teams}</SectionLabel>
          {teamNames.map((name, index) => (
            <TextField
              key={index}
              value={name}
              onChangeText={(value) => setTeamNames((current) => current.map((n, i) => (i === index ? value : n)))}
              placeholder={copy.team(index + 1)}
              maxLength={24}
              accent={ACCENT}
            />
          ))}
        </View>
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.categories}</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {CHARADES_CATEGORIES.map((category) => {
              const on = categories.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggle(category.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: "45%",
                    minHeight: touch.min,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: on ? withAlpha(ACCENT, 0.16) : colors.surface,
                    borderWidth: on ? 2 : 1,
                    borderColor: on ? ACCENT : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 20 }}>{category.emoji}</Text>
                  <Text style={{ flex: 1, color: on ? colors.text : colors.textSecondary, fontSize: 15, fontWeight: "800" }}>{category[language]}</Text>
                  <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? ACCENT : colors.textSubtle} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.seconds}</SectionLabel>
          <SegmentedControl value={seconds} onChange={setSeconds} accent={ACCENT} options={SECONDS.map((n) => ({ value: n, label: n }))} />
        </View>
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.turns}</SectionLabel>
          <SegmentedControl value={turns} onChange={setTurns} accent={ACCENT} options={TURNS.map((n) => ({ value: n, label: n }))} />
        </View>
      </Screen>
    );
  }

  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{copy.scoreboard}</SectionLabel>
      <LocalScoreboard players={game.teams} accent={ACCENT} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  if (done) {
    const [a, b] = game.teams;
    const winner = a.score === b.score ? null : a.score > b.score ? a : b;
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button
              label={copy.playAgain}
              icon="refresh"
              accent={ACCENT}
              onPress={() =>
                setGame({
                  ...newGame(game.teams.map((t) => t.name), [], game.seconds, game.turnsPerTeam),
                  // Keep going through the same shuffled deck, so words don't repeat.
                  deck: game.deck,
                  deckIndex: game.deckIndex,
                })
              }
            />
            <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
          </>
        }
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="trophy" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>{winner ? copy.winner(winner.name) : copy.draw}</Text>
          </Card>
          {scoreboard}
        </AnimatedEntrance>
      </Screen>
    );
  }

  const team = game.teams[game.turn % game.teams.length];
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
      <Text numberOfLines={1} style={[type.title, { color: colors.text, flex: 1 }]}>
        {copy.turnOf(team.name)}
      </Text>
      <Chip label={copy.progress(game.turn + 1, totalTurns)} color={ACCENT} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Hand the phone to the actor
  // ---------------------------------------------------------------------------
  if (game.phase === "handover") {
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.go}
            icon="timer"
            accent={ACCENT}
            onPress={() => setGame((g) => ({ ...g, phase: "acting", endsAt: Date.now() + g.seconds * 1000, turnWords: [] }))}
          />
        }
      >
        <AnimatedEntrance enterKey={`handover-${game.turn}`} style={{ gap: space.md }}>
          {header}
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="body" size={56} color={ACCENT} />
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{copy.handover}</Text>
          </Card>
          {scoreboard}
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Acting
  // ---------------------------------------------------------------------------
  if (game.phase === "acting") {
    // Endless play: start over with a reshuffled deck if every word has come up.
    const wordId = game.deck[game.deckIndex % game.deck.length];
    const word = WORDS.get(wordId);
    const answer = (got: boolean) =>
      setGame((g) => ({
        ...g,
        deckIndex: g.deckIndex + 1,
        teams: got ? g.teams.map((t) => (t.id === team.id ? { ...t, score: t.score + 1 } : t)) : g.teams,
        turnWords: [...g.turnWords, { id: wordId, got }],
      }));
    const category = CHARADES_CATEGORIES.find((c) => c.id === word?.category);
    return (
      <Screen
        topBar={topBar}
        footer={
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={copy.skip} icon="play-skip-forward" variant="secondary" style={{ flex: 1 }} onPress={() => answer(false)} />
            <Button label={copy.gotIt} icon="checkmark" accent={colors.success} style={{ flex: 1 }} onPress={() => answer(true)} />
          </View>
        }
      >
        <View style={{ gap: space.md }}>
          <Countdown endsAt={game.endsAt} accent={ACCENT} label={copy.timeLeft} />
          <AnimatedEntrance enterKey={`word-${game.deckIndex}`} distance={8}>
            <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.md }}>
              {category ? <Chip label={`${category.emoji} ${category[language]}`} color={ACCENT} /> : null}
              <Text adjustsFontSizeToFit numberOfLines={3} style={{ color: colors.text, fontSize: 40, lineHeight: 48, fontWeight: "900", textAlign: "center" }}>
                {word ? word[language] : ""}
              </Text>
              <Text style={[type.small, { color: colors.textMuted }]}>{copy.actIt}</Text>
            </Card>
          </AnimatedEntrance>
          <Chip label={`${team.name}: ${game.turnWords.filter((w) => w.got).length}`} color={colors.success} icon="checkmark" />
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Turn summary
  // ---------------------------------------------------------------------------
  const lastTurn = game.turn + 1 >= totalTurns;
  return (
    <Screen
      topBar={topBar}
      footer={
        <Button
          label={lastTurn ? copy.seeResults : copy.nextTeam}
          icon={lastTurn ? "flag" : "swap-horizontal"}
          accent={ACCENT}
          onPress={() => setGame((g) => ({ ...g, turn: g.turn + 1, phase: "handover", turnWords: [] }))}
        />
      }
    >
      <AnimatedEntrance enterKey={`end-${game.turn}`} style={{ gap: space.md }}>
        <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
          <Ionicons name="alarm" size={48} color={ACCENT} />
          <Text style={[type.title, { color: colors.text }]}>{copy.timeUp}</Text>
          <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>
            {copy.turnScore(team.name, game.turnWords.filter((w) => w.got).length)}
          </Text>
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {game.turnWords.map((w, i) => {
            const word = WORDS.get(w.id);
            return (
              <Chip
                key={`${w.id}-${i}`}
                label={word ? word[language] : w.id}
                color={w.got ? colors.success : colors.textMuted}
                icon={w.got ? "checkmark" : "play-skip-forward"}
              />
            );
          })}
        </View>
        {scoreboard}
      </AnimatedEntrance>
    </Screen>
  );
}
