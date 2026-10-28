import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { LocalScoreboard, LocalTopBar, PlayerNamesEditor, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, useLocalGame } from "../src/games/local/useLocalGame";
import { TRIVIA_CATEGORIES, TRIVIA_QUESTIONS, buildTriviaDeck, triviaCategoryLabel, type TriviaCategory } from "../src/games/trivia/data";
import { useI18n } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel, SegmentedControl } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.trivia;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const QUESTION_COUNTS = ["3", "6", "10"] as const;

type TriviaLocalGame = {
  players: { id: string; name: string; score: number }[];
  categories: TriviaCategory[];
  questionsPerPlayer: number;
  /** Question ids in play order; turn i belongs to player i % players.length. */
  questionIds: string[];
  turnIndex: number;
  phase: "question" | "answer" | "ended";
};

const COPY = {
  en: {
    title: "Trivia · one phone",
    setupTitle: "One phone, passed around",
    setupBody: "Add everyone who is playing and pick categories. The phone shows whose turn it is – pass it on after every question.",
    categories: "Categories",
    perPlayer: "Questions per player",
    start: "Start the game",
    turn: (name: string) => `${name}'s turn`,
    progress: (a: number, b: number) => `Question ${a}/${b}`,
    readAloud: "Read the question out loud, answer, then show the answer.",
    showAnswer: "Show answer",
    answer: "Answer",
    correct: "Right +1",
    wrong: "Wrong",
    scoreboard: "Scoreboard",
    finished: "Trivia complete",
    winner: (names: string) => `Winner: ${names}`,
    playAgain: "Play again – new questions",
    changeSetup: "Change players or categories",
  },
  sv: {
    title: "Trivia · en telefon",
    setupTitle: "En telefon som skickas runt",
    setupBody: "Lägg till alla som spelar och välj kategorier. Telefonen visar vems tur det är – skicka vidare efter varje fråga.",
    categories: "Kategorier",
    perPlayer: "Frågor per spelare",
    start: "Starta spelet",
    turn: (name: string) => `${name}s tur`,
    progress: (a: number, b: number) => `Fråga ${a}/${b}`,
    readAloud: "Läs frågan högt, svara och visa sedan facit.",
    showAnswer: "Visa svaret",
    answer: "Svar",
    correct: "Rätt +1",
    wrong: "Fel",
    scoreboard: "Poängtavla",
    finished: "Trivia klar",
    winner: (names: string) => `Vinnare: ${names}`,
    playAgain: "Spela igen – nya frågor",
    changeSetup: "Byt spelare eller kategorier",
  },
};

const QUESTIONS_BY_ID = new Map(TRIVIA_QUESTIONS.map((question) => [question.id, question]));

function newGame(names: string[], categories: TriviaCategory[], questionsPerPlayer: number): TriviaLocalGame {
  return {
    players: names.map((name, index) => ({ id: localPlayerId(index), name, score: 0 })),
    categories,
    questionsPerPlayer,
    questionIds: buildTriviaDeck(categories, questionsPerPlayer, names.length).map((question) => question.id),
    turnIndex: 0,
    phase: "question",
  };
}

export default function TriviaLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<TriviaLocalGame>("trivia");
  const [names, setNames] = useRememberedPlayerNames();
  const [categories, setCategories] = useState<TriviaCategory[]>(TRIVIA_CATEGORIES);
  const [perPlayer, setPerPlayer] = useState<(typeof QUESTION_COUNTS)[number]>("6");

  const winners = useMemo(() => {
    if (!game) return [];
    const top = Math.max(...game.players.map((p) => p.score));
    return game.players.filter((p) => p.score === top);
  }, [game]);

  const topBar = <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && game.phase !== "ended"} onQuit={() => setGame(null)} />;

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  if (!game) {
    const toggle = (category: TriviaCategory) =>
      setCategories((current) => (current.includes(category) ? current.filter((c) => c !== category) : [...current, category]));
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.start}
            icon="play"
            accent={ACCENT}
            disabled={names.length < MIN_PLAYERS || categories.length === 0}
            onPress={() => setGame(newGame(names, categories, Number(perPlayer)))}
          />
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>

        <PlayerNamesEditor names={names} onChange={setNames} min={MIN_PLAYERS} max={MAX_PLAYERS} accent={ACCENT} />

        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.categories}</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {TRIVIA_CATEGORIES.map((category) => {
              const active = categories.includes(category);
              return (
                <Pressable
                  key={category}
                  onPress={() => toggle(category)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: "45%",
                    minHeight: touch.min,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: active ? withAlpha(ACCENT, 0.16) : colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? ACCENT : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name={active ? "checkbox" : "square-outline"} size={20} color={active ? ACCENT : colors.textSubtle} />
                  <Text style={{ flex: 1, color: active ? colors.text : colors.textSecondary, fontSize: 15, fontWeight: "800" }}>
                    {triviaCategoryLabel(category, language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.perPlayer}</SectionLabel>
          <SegmentedControl value={perPlayer} onChange={setPerPlayer} accent={ACCENT} options={QUESTION_COUNTS.map((n) => ({ value: n, label: n }))} />
        </View>
      </Screen>
    );
  }

  const total = game.questionIds.length;
  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{copy.scoreboard}</SectionLabel>
      <LocalScoreboard players={game.players} accent={ACCENT} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  if (game.phase === "ended") {
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
                setGame(
                  newGame(
                    game.players.map((p) => p.name),
                    game.categories,
                    game.questionsPerPlayer
                  )
                )
              }
            />
            <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
          </>
        }
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="trophy" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>{copy.winner(winners.map((p) => p.name).join(", "))}</Text>
          </Card>
          {scoreboard}
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Question / answer
  // ---------------------------------------------------------------------------
  const player = game.players[game.turnIndex % game.players.length];
  const question = QUESTIONS_BY_ID.get(game.questionIds[game.turnIndex]);
  const prompt = question ? (language === "en" ? question.promptEn : question.prompt) : "";
  const answer = question ? (language === "en" ? question.answerEn : question.answer) : "";

  const score = (wasCorrect: boolean) =>
    setGame((g) => {
      const current = g.players[g.turnIndex % g.players.length];
      const players = g.players.map((p) => (p.id === current.id && wasCorrect ? { ...p, score: p.score + 1 } : p));
      const next = g.turnIndex + 1;
      return next >= g.questionIds.length ? { ...g, players, phase: "ended" } : { ...g, players, turnIndex: next, phase: "question" };
    });

  return (
    <Screen
      topBar={topBar}
      footer={
        game.phase === "question" ? (
          <Button label={copy.showAnswer} icon="eye-outline" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "answer" }))} />
        ) : (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={copy.wrong} icon="close" variant="secondary" style={{ flex: 1 }} onPress={() => score(false)} />
            <Button label={copy.correct} icon="checkmark" accent={colors.success} style={{ flex: 1 }} onPress={() => score(true)} />
          </View>
        )
      }
    >
      <AnimatedEntrance enterKey={`turn-${game.turnIndex}`} style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
          <Text numberOfLines={1} style={[type.title, { color: colors.text, flex: 1 }]}>
            {copy.turn(player.name)}
          </Text>
          <Chip label={copy.progress(game.turnIndex + 1, total)} color={ACCENT} />
        </View>
        <Card accent={ACCENT} style={{ gap: space.lg, paddingVertical: space.xl }}>
          {question ? <Chip label={triviaCategoryLabel(question.category, language)} color={ACCENT} icon="pricetag" /> : null}
          <Text style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: "800" }}>{prompt}</Text>
          {game.phase === "answer" ? (
            <View style={{ gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.success, 0.12) }}>
              <Text style={[type.caption, { color: colors.success, textTransform: "uppercase" }]}>{copy.answer}</Text>
              <Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "900" }}>{answer}</Text>
            </View>
          ) : (
            <Text style={[type.small, { color: colors.textMuted }]}>{copy.readAloud}</Text>
          )}
        </Card>
      </AnimatedEntrance>
      {scoreboard}
    </Screen>
  );
}
