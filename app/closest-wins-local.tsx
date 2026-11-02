import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { ESTIMATE_QUESTIONS } from "../src/games/estimate/data";
import { LocalScoreboard, LocalTopBar, PlayerNamesEditor, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, shuffled, useLocalGame } from "../src/games/local/useLocalGame";
import { useI18n, type Language } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel, SegmentedControl } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.estimate;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const ROUND_OPTIONS = ["5", "10", "15"] as const;

type ClosestWinsLocalGame = {
  players: { id: string; name: string; score: number }[];
  questionIds: string[];
  index: number;
  phase: "question" | "answer";
  closestIds: string[];
};

const COPY = {
  en: {
    title: "Closest Wins · one phone",
    setupTitle: "One phone, everyone guesses",
    setupBody: "Add everyone who is playing. Read the question out loud, everyone says (or writes down) a guess, then show the answer.",
    rounds: "Questions",
    start: "Start the game",
    progress: (a: number, b: number) => `Question ${a}/${b}`,
    guessHint: "Everyone says a guess out loud – or writes it down so nobody can copy.",
    showAnswer: "Show the answer",
    answer: "The answer",
    whoClosest: "Who was closest? Tap everyone who shares the closest guess.",
    next: "Next question",
    finish: "Finish the game",
    scoreboard: "Scoreboard",
    finished: "Game over",
    winner: (names: string) => `Winner: ${names}`,
    playAgain: "Play again – new questions",
    changeSetup: "Change players",
  },
  sv: {
    title: "Closest Wins · en telefon",
    setupTitle: "En telefon, alla gissar",
    setupBody: "Lägg till alla som spelar. Läs frågan högt, alla säger (eller skriver ner) en gissning och sedan visar ni svaret.",
    rounds: "Frågor",
    start: "Starta spelet",
    progress: (a: number, b: number) => `Fråga ${a}/${b}`,
    guessHint: "Alla säger sin gissning högt – eller skriver ner den så att ingen kan härma.",
    showAnswer: "Visa svaret",
    answer: "Rätt svar",
    whoClosest: "Vem var närmast? Tryck på alla som delar den närmaste gissningen.",
    next: "Nästa fråga",
    finish: "Avsluta spelet",
    scoreboard: "Poängtavla",
    finished: "Spelet är slut",
    winner: (names: string) => `Vinnare: ${names}`,
    playAgain: "Spela igen – nya frågor",
    changeSetup: "Byt spelare",
  },
} satisfies Record<Language, unknown>;

const QUESTIONS = new Map(ESTIMATE_QUESTIONS.map((question) => [question.id, question]));

function newGame(names: string[], rounds: number): ClosestWinsLocalGame {
  return {
    players: names.map((name, index) => ({ id: localPlayerId(index), name, score: 0 })),
    questionIds: shuffled(ESTIMATE_QUESTIONS).slice(0, rounds).map((question) => question.id),
    index: 0,
    phase: "question",
    closestIds: [],
  };
}

export default function ClosestWinsLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<ClosestWinsLocalGame>("closest-wins");
  const [names, setNames] = useRememberedPlayerNames();
  const [rounds, setRounds] = useState<(typeof ROUND_OPTIONS)[number]>("10");

  const done = !!game && game.index >= game.questionIds.length;
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

  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{copy.scoreboard}</SectionLabel>
      <LocalScoreboard players={game.players} accent={ACCENT} />
    </View>
  );

  if (done) {
    const top = Math.max(...game.players.map((p) => p.score));
    const winners = game.players.filter((p) => p.score === top);
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button label={copy.playAgain} icon="refresh" accent={ACCENT} onPress={() => setGame(newGame(game.players.map((p) => p.name), game.questionIds.length))} />
            <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
          </>
        }
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="trophy" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>{copy.winner(winners.map((p) => p.name).join(", "))}</Text>
          </Card>
          {scoreboard}
        </AnimatedEntrance>
      </Screen>
    );
  }

  const question = QUESTIONS.get(game.questionIds[game.index]);
  const text = question ? (language === "sv" ? question.sv : question.en) : "";
  const unit = question ? (language === "sv" ? question.unitSv : question.unitEn) : "";
  const answer = question ? question.answer.toLocaleString(language === "sv" ? "sv-SE" : "en-US") : "";
  const last = game.index === game.questionIds.length - 1;

  const next = () =>
    setGame((g) => ({
      ...g,
      players: g.players.map((p) => (g.closestIds.includes(p.id) ? { ...p, score: p.score + 1 } : p)),
      index: g.index + 1,
      phase: "question",
      closestIds: [],
    }));

  return (
    <Screen
      topBar={topBar}
      footer={
        game.phase === "question" ? (
          <Button label={copy.showAnswer} icon="eye-outline" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "answer" }))} />
        ) : (
          <Button label={last ? copy.finish : copy.next} icon={last ? "flag" : "play-forward"} accent={ACCENT} onPress={next} />
        )
      }
    >
      <AnimatedEntrance enterKey={`q-${game.index}-${game.phase}`} style={{ gap: space.md }}>
        <Chip label={copy.progress(game.index + 1, game.questionIds.length)} color={ACCENT} icon="albums" />
        <Card accent={ACCENT} style={{ gap: space.md, paddingVertical: space.xl }}>
          <Text style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: "800" }}>{text}</Text>
          {game.phase === "answer" ? (
            <View style={{ gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: withAlpha(ACCENT, 0.14) }}>
              <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.answer}</Text>
              <Text style={{ color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: "900" }}>
                {answer}
                {unit ? <Text style={{ fontSize: 18, color: colors.textSecondary }}>{` ${unit}`}</Text> : null}
              </Text>
            </View>
          ) : (
            <Text style={[type.small, { color: colors.textMuted }]}>{copy.guessHint}</Text>
          )}
        </Card>

        {game.phase === "answer" ? (
          <View style={{ gap: space.sm }}>
            <Text style={[type.body, { color: colors.textSecondary }]}>{copy.whoClosest}</Text>
            {game.players.map((player) => {
              const on = game.closestIds.includes(player.id);
              return (
                <Pressable
                  key={player.id}
                  onPress={() =>
                    setGame((g) => ({ ...g, closestIds: on ? g.closestIds.filter((id) => id !== player.id) : [...g.closestIds, player.id] }))
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => ({
                    minHeight: touch.primary,
                    paddingHorizontal: space.lg,
                    borderRadius: radius.lg,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    backgroundColor: on ? withAlpha(colors.success, 0.16) : colors.surface,
                    borderWidth: 2,
                    borderColor: on ? colors.success : colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={26} color={on ? colors.success : colors.textSubtle} />
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }}>
                    {player.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontWeight: "800" }}>
                    {player.score}
                    {on ? <Text style={{ color: colors.success }}> +1</Text> : null}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          scoreboard
        )}
      </AnimatedEntrance>
    </Screen>
  );
}
