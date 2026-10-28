import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { IMPOSTER_CATEGORIES, imposterCategoryLabel, imposterWordLabel } from "../src/games/imposter/data";
import { assignImposterRoles, getCategoryById, pickPromptForCategory } from "../src/games/imposter/logic";
import { WordPicture } from "../src/games/imposter/WordPicture";
import { Countdown, LocalTopBar, PassPhoneCard, PlayerNamesEditor, PlayerPicker, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, shuffled, useLocalGame } from "../src/games/local/useLocalGame";
import { useI18n } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.imposter;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const DISCUSSION_MS = 4 * 60 * 1000;

type Player = { id: string; name: string; out: boolean };

type ImposterLocalGame = {
  players: Player[];
  categoryId: string;
  word: string;
  imposterId: string;
  /** Who gives the first clue in the current discussion. */
  starterId: string;
  phase: "reveal" | "discussion" | "voting" | "vote_result" | "ended";
  revealIndex: number;
  revealShown: boolean;
  discussionEndsAt: number;
  /** Player voted out in the last vote; null when the vote tied. */
  lastOutId: string | null;
  winner: "crew" | "imposter" | null;
};

const COPY = {
  en: {
    title: "Imposter · one phone",
    setupTitle: "One phone, passed around",
    setupBody: "Add everyone who is playing, pick a category and pass the phone around so each player can see their card in secret.",
    category: "Category",
    start: "Start the game",
    yourCard: "Your card",
    yourWord: "Your secret word",
    youAreImposter: "You are the imposter",
    imposterDesc: "You don't know the word. Listen, blend in and try not to get caught.",
    crewDesc: "Give clues that show you know the word, without making it too easy for the imposter.",
    hideAndPass: "Hide and pass on",
    hideAndStart: "Hide and start the discussion",
    discussion: "Discussion",
    timeLeft: "Time left",
    starts: (name: string) => `${name} starts`,
    discussionBody: "Go around the table: everyone says one word or clue about the secret word. Then discuss who the imposter is.",
    toVoting: "Time to vote",
    voting: "Vote",
    votingBody: "Count to three and everyone points at who they think the imposter is. Tap the player who got the most votes.",
    voteOut: (name: string) => `Vote out ${name}`,
    pickPlayer: "Pick a player",
    tie: "It was a tie – nobody is out",
    wasNotImposter: (name: string) => `${name} was not the imposter`,
    tieTitle: "Nobody was voted out",
    continues: "The game continues. Discuss again and find the imposter.",
    keepDiscussing: "Keep discussing",
    crewWins: "CREW WINS",
    imposterWins: "IMPOSTER WINS",
    crewWinsSub: (name: string) => `The group found the imposter: ${name}.`,
    imposterWinsSub: (name: string) => `${name} was the imposter and got away with it.`,
    theImposter: "The imposter",
    theWord: "The secret word",
    playAgain: "Play again – new word",
    changeSetup: "Change players or category",
    out: "Out",
  },
  sv: {
    title: "Imposter · en telefon",
    setupTitle: "En telefon som skickas runt",
    setupBody: "Lägg till alla som spelar, välj en kategori och skicka runt telefonen så att alla får se sitt kort i hemlighet.",
    category: "Kategori",
    start: "Starta spelet",
    yourCard: "Ditt kort",
    yourWord: "Ditt hemliga ord",
    youAreImposter: "Du är impostern",
    imposterDesc: "Du vet inte ordet. Lyssna, smält in och försök att inte bli avslöjad.",
    crewDesc: "Ge ledtrådar som visar att du kan ordet, utan att göra det för lätt för impostern.",
    hideAndPass: "Dölj och skicka vidare",
    hideAndStart: "Dölj och börja diskutera",
    discussion: "Diskussion",
    timeLeft: "Tid kvar",
    starts: (name: string) => `${name} börjar`,
    discussionBody: "Gå laget runt: alla säger ett ord eller en ledtråd om det hemliga ordet. Diskutera sedan vem som är impostern.",
    toVoting: "Dags att rösta",
    voting: "Rösta",
    votingBody: "Räkna till tre och peka samtidigt på den ni tror är impostern. Tryck på spelaren som fick flest röster.",
    voteOut: (name: string) => `Rösta ut ${name}`,
    pickPlayer: "Välj en spelare",
    tie: "Det blev lika – ingen åker ut",
    wasNotImposter: (name: string) => `${name} var inte impostern`,
    tieTitle: "Ingen röstades ut",
    continues: "Spelet fortsätter. Diskutera igen och hitta impostern.",
    keepDiscussing: "Fortsätt diskutera",
    crewWins: "LAGET VINNER",
    imposterWins: "IMPOSTERN VINNER",
    crewWinsSub: (name: string) => `Gruppen hittade impostern: ${name}.`,
    imposterWinsSub: (name: string) => `${name} var impostern och kom undan.`,
    theImposter: "Impostern",
    theWord: "Det hemliga ordet",
    playAgain: "Spela igen – nytt ord",
    changeSetup: "Byt spelare eller kategori",
    out: "Ute",
  },
};

function newGame(names: string[], categoryId: string, avoidWord: string | null = null): ImposterLocalGame {
  const players = names.map((name, index) => ({ id: localPlayerId(index), name, out: false }));
  const word = pickPromptForCategory(categoryId, avoidWord);
  const { imposterPlayerId } = assignImposterRoles(
    players.map((p) => p.id),
    word
  );
  return {
    players,
    categoryId,
    word,
    imposterId: imposterPlayerId ?? players[0].id,
    starterId: shuffled(players)[0].id,
    phase: "reveal",
    revealIndex: 0,
    revealShown: false,
    discussionEndsAt: 0,
    lastOutId: null,
    winner: null,
  };
}

export default function ImposterLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<ImposterLocalGame>("imposter");
  const [names, setNames] = useRememberedPlayerNames();
  const [categoryId, setCategoryId] = useState(IMPOSTER_CATEGORIES[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const topBar = (
    <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && game.phase !== "ended"} onQuit={() => setGame(null)} />
  );

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  if (!game) {
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.start}
            icon="play"
            accent={ACCENT}
            disabled={names.length < MIN_PLAYERS}
            onPress={() => setGame(newGame(names, categoryId))}
          />
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>

        <PlayerNamesEditor names={names} onChange={setNames} min={MIN_PLAYERS} max={MAX_PLAYERS} accent={ACCENT} />

        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.category}</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {IMPOSTER_CATEGORIES.map((entry) => {
              const active = categoryId === entry.id;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setCategoryId(entry.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    flexGrow: 1,
                    flexBasis: "45%",
                    minHeight: touch.primary,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: active ? withAlpha(entry.accent, 0.18) : colors.surface,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? entry.accent : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 24 }}>{entry.emoji}</Text>
                  <Text numberOfLines={2} style={{ flex: 1, color: active ? colors.text : colors.textSecondary, fontSize: 15, fontWeight: "800" }}>
                    {imposterCategoryLabel(entry, language)}
                  </Text>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={entry.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Screen>
    );
  }

  const category = getCategoryById(game.categoryId);
  const categoryChip = category ? (
    <Chip label={`${copy.category}: ${category.emoji} ${imposterCategoryLabel(category, language)}`} color={category.accent} icon="pricetag" />
  ) : null;
  const alive = game.players.filter((p) => !p.out);
  const nameOf = (id: string | null) => game.players.find((p) => p.id === id)?.name ?? "";

  const startDiscussion = (current: ImposterLocalGame): ImposterLocalGame => ({
    ...current,
    phase: "discussion",
    discussionEndsAt: Date.now() + DISCUSSION_MS,
    starterId: shuffled(current.players.filter((p) => !p.out))[0].id,
  });

  const voteOut = (outId: string | null) => {
    setSelectedId(null);
    setGame((current) => {
      const players = current.players.map((p) => (p.id === outId ? { ...p, out: true } : p));
      const remaining = players.filter((p) => !p.out).length;
      const winner = outId === current.imposterId ? "crew" : remaining <= 2 ? "imposter" : null;
      return { ...current, players, lastOutId: outId, winner, phase: winner ? "ended" : "vote_result" };
    });
  };

  // ---------------------------------------------------------------------------
  // Secret cards, one player at a time
  // ---------------------------------------------------------------------------
  if (game.phase === "reveal") {
    const player = game.players[game.revealIndex];
    const isImposter = player.id === game.imposterId;
    const last = game.revealIndex === game.players.length - 1;
    const step = `${game.revealIndex + 1}/${game.players.length}`;

    if (!game.revealShown) {
      return (
        <Screen topBar={topBar}>
          <AnimatedEntrance enterKey={`pass-${game.revealIndex}`}>
            <PassPhoneCard name={player.name} accent={ACCENT} step={step} onReady={() => setGame((g) => ({ ...g, revealShown: true }))} />
          </AnimatedEntrance>
        </Screen>
      );
    }

    const tone = isImposter ? colors.danger : ACCENT;
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={last ? copy.hideAndStart : copy.hideAndPass}
            icon="eye-off-outline"
            accent={ACCENT}
            onPress={() =>
              setGame((g) =>
                last ? startDiscussion({ ...g, revealShown: false }) : { ...g, revealIndex: g.revealIndex + 1, revealShown: false }
              )
            }
          />
        }
      >
        <AnimatedEntrance enterKey={`card-${game.revealIndex}`} style={{ gap: space.md }}>
          <Chip label={`${player.name} · ${step}`} color={ACCENT} icon="person" />
          <View
            style={{
              borderRadius: radius.xl,
              padding: space.xl,
              alignItems: "center",
              gap: space.sm,
              backgroundColor: withAlpha(tone, 0.12),
              borderWidth: 2,
              borderColor: withAlpha(tone, 0.7),
            }}
          >
            <Text style={[type.caption, { color: tone, textTransform: "uppercase" }]}>{isImposter ? copy.yourCard : copy.yourWord}</Text>
            {isImposter ? (
              <Text style={{ fontSize: 72, lineHeight: 84 }}>🕵️</Text>
            ) : (
              <WordPicture word={game.word} size={168} language={language} />
            )}
            <Text
              adjustsFontSizeToFit
              numberOfLines={2}
              style={{ color: isImposter ? colors.danger : colors.text, fontSize: 36, lineHeight: 42, fontWeight: "900", textAlign: "center" }}
            >
              {(isImposter ? copy.youAreImposter : imposterWordLabel(game.word, language)).toUpperCase()}
            </Text>
            <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>{isImposter ? copy.imposterDesc : copy.crewDesc}</Text>
          </View>
          {categoryChip}
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Discussion
  // ---------------------------------------------------------------------------
  if (game.phase === "discussion") {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.toVoting} icon="hand-right" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "voting" }))} />}
      >
        <AnimatedEntrance enterKey={`discussion-${game.discussionEndsAt}`} style={{ gap: space.md }}>
          <Card accent={ACCENT} style={{ alignItems: "center" }}>
            <Countdown endsAt={game.discussionEndsAt} accent={ACCENT} label={copy.timeLeft} />
            <Chip label={copy.starts(nameOf(game.starterId))} color={ACCENT} icon="mic" />
            <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>{copy.discussionBody}</Text>
          </Card>
          {categoryChip}
          <PlayersList players={game.players} outLabel={copy.out} />
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Voting: the group votes out loud, the phone records the result
  // ---------------------------------------------------------------------------
  if (game.phase === "voting") {
    const selected = alive.find((p) => p.id === selectedId) ?? null;
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button
              label={selected ? copy.voteOut(selected.name) : copy.pickPlayer}
              icon="flag"
              accent={ACCENT}
              disabled={!selected}
              onPress={() => selected && voteOut(selected.id)}
            />
            <Button label={copy.tie} variant="ghost" size="md" onPress={() => voteOut(null)} />
          </>
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.voting}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.votingBody}</Text>
        </View>
        <PlayerPicker players={alive} selectedId={selectedId} onSelect={setSelectedId} accent={ACCENT} />
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Wrong player (or a tie): the game goes on
  // ---------------------------------------------------------------------------
  if (game.phase === "vote_result") {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.keepDiscussing} icon="chatbubbles" accent={ACCENT} onPress={() => setGame((g) => startDiscussion(g))} />}
      >
        <AnimatedEntrance enterKey={`result-${game.lastOutId}`}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name={game.lastOutId ? "close-circle" : "remove-circle"} size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
              {game.lastOutId ? copy.wasNotImposter(nameOf(game.lastOutId)) : copy.tieTitle}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{copy.continues}</Text>
          </Card>
        </AnimatedEntrance>
        <PlayersList players={game.players} outLabel={copy.out} />
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  const crewWon = game.winner === "crew";
  const winnerTone = crewWon ? ACCENT : colors.danger;
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
                  game.categoryId,
                  game.word
                )
              )
            }
          />
          <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
        </>
      }
    >
      <AnimatedEntrance enterKey="ended" style={{ gap: space.md }}>
        <Card accent={winnerTone} style={{ alignItems: "center", paddingVertical: space.xl }}>
          <Text style={{ color: winnerTone, fontSize: 32, lineHeight: 38, fontWeight: "900", textAlign: "center" }}>
            {crewWon ? copy.crewWins : copy.imposterWins}
          </Text>
          <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>
            {crewWon ? copy.crewWinsSub(nameOf(game.imposterId)) : copy.imposterWinsSub(nameOf(game.imposterId))}
          </Text>
        </Card>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Card style={{ flex: 1, alignItems: "center" }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.theImposter}</Text>
            <Text style={{ fontSize: 48, lineHeight: 56 }}>🕵️</Text>
            <Text numberOfLines={1} style={[type.heading, { color: colors.danger }]}>
              {nameOf(game.imposterId)}
            </Text>
          </Card>
          <Card style={{ flex: 1, alignItems: "center" }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.theWord}</Text>
            <WordPicture word={game.word} size={56} language={language} />
            <Text numberOfLines={2} style={[type.heading, { color: colors.text, textAlign: "center" }]}>
              {imposterWordLabel(game.word, language)}
            </Text>
          </Card>
        </View>
      </AnimatedEntrance>
    </Screen>
  );
}

function PlayersList({ players, outLabel }: { players: Player[]; outLabel: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {players.map((p) => (
        <Chip key={p.id} label={p.out ? `${p.name} · ${outLabel}` : p.name} color={p.out ? colors.danger : colors.textSecondary} icon={p.out ? "close" : "person"} />
      ))}
    </View>
  );
}
