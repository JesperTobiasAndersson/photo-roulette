import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { PlayAgainFooter } from "../src/components/PlayAgainFooter";
import { ShareButton } from "../src/components/ShareButton";
import { GAMES } from "../src/games/catalog";
import { LocalScoreboard, PlayerPicker } from "../src/games/local/components";
import { leaveParty, nextRound, resetParty, revealRound, startParty, submitGuess, voteForPlayer } from "../src/games/party/api";
import type { PartyGame } from "../src/games/party/types";
import { usePartyRoom } from "../src/games/party/usePartyRoom";
import { useI18n, type Language } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { SITE_URL } from "../src/lib/site";
import { Button, Card, Chip, RoomCodeBadge, Screen, SectionLabel, SegmentedControl, TextField, TopBar, goBackOr } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

const GAME_INFO: Record<PartyGame, (typeof GAMES)["mostLikely"]> = { most_likely: GAMES.mostLikely, estimate: GAMES.estimate };
const MIN_PLAYERS: Record<PartyGame, number> = { most_likely: 3, estimate: 2 };
const ROUND_OPTIONS = ["5", "10", "15"] as const;

const COPY = {
  en: {
    loading: "Loading the room…",
    notInRoom: "You're not in this room any more.",
    toStart: "Back to the game",
    roomCode: "Room code",
    invite: "Invite friends",
    inviteMessage: (title: string, code: string) => `Play ${title} with me on Picklo! Room code: ${code}`,
    players: "Players",
    you: "You",
    host: "Host",
    rounds: "Rounds",
    start: "Start the game",
    needPlayers: (n: number, min: number) => `At least ${min} players are needed (${n}/${min}).`,
    waitingHost: "Waiting for the host to start the game.",
    round: (a: number, b: number) => `Round ${a}/${b}`,
    mostLikely: "Who's most likely to…",
    voteHint: "Vote for the player who fits best. You can vote for yourself.",
    guessHint: (unit: string) => (unit ? `Your guess (${unit})` : "Your guess"),
    guessPlaceholder: "Type a number",
    send: "Send answer",
    change: "Change answer",
    sent: "Answer sent. You can change it until everyone has answered.",
    answered: (a: number, b: number) => `${a}/${b} answered`,
    revealNow: "Show the result now",
    votes: (n: number) => `${n} vote${n === 1 ? "" : "s"}`,
    groupPicked: "The group picked",
    nobodyVoted: "Nobody voted this round.",
    correct: "The answer",
    noGuess: "No guess",
    off: (d: string) => `off by ${d}`,
    exact: "spot on!",
    youScored: (n: number) => `You scored +${n}`,
    noPoints: "No points this round",
    scoreboard: "Scoreboard",
    next: "Next round",
    finish: "See the results",
    waitingNext: "Waiting for the host to continue…",
    finished: "Game over",
    winner: (names: string) => `Winner: ${names}`,
    titles: "Most titles",
    titlesCount: (n: number) => `${n} title${n === 1 ? "" : "s"}`,
    leaveTitle: "Leave the room?",
    leaveBody: "You'll leave this game. You can rejoin with the room code while it's in the lobby.",
    leave: "Leave",
    stay: "Stay",
    failed: "Something went wrong",
    enterNumber: "Enter a number",
  },
  sv: {
    loading: "Laddar rummet…",
    notInRoom: "Du är inte med i det här rummet längre.",
    toStart: "Tillbaka till spelet",
    roomCode: "Rumskod",
    invite: "Bjud in vänner",
    inviteMessage: (title: string, code: string) => `Spela ${title} med mig på Picklo! Rumskod: ${code}`,
    players: "Spelare",
    you: "Du",
    host: "Värd",
    rounds: "Rundor",
    start: "Starta spelet",
    needPlayers: (n: number, min: number) => `Minst ${min} spelare behövs (${n}/${min}).`,
    waitingHost: "Väntar på att värden startar spelet.",
    round: (a: number, b: number) => `Runda ${a}/${b}`,
    mostLikely: "Vem är mest trolig att…",
    voteHint: "Rösta på den som passar bäst. Du får rösta på dig själv.",
    guessHint: (unit: string) => (unit ? `Din gissning (${unit})` : "Din gissning"),
    guessPlaceholder: "Skriv ett tal",
    send: "Skicka svar",
    change: "Ändra svar",
    sent: "Svaret är skickat. Du kan ändra det tills alla har svarat.",
    answered: (a: number, b: number) => `${a}/${b} har svarat`,
    revealNow: "Visa resultatet nu",
    votes: (n: number) => `${n} ${n === 1 ? "röst" : "röster"}`,
    groupPicked: "Gruppen valde",
    nobodyVoted: "Ingen röstade den här rundan.",
    correct: "Rätt svar",
    noGuess: "Ingen gissning",
    off: (d: string) => `${d} fel`,
    exact: "exakt rätt!",
    youScored: (n: number) => `Du fick +${n}`,
    noPoints: "Inga poäng den här rundan",
    scoreboard: "Poängtavla",
    next: "Nästa runda",
    finish: "Visa resultatet",
    waitingNext: "Väntar på att värden går vidare…",
    finished: "Spelet är slut",
    winner: (names: string) => `Vinnare: ${names}`,
    titles: "Flest titlar",
    titlesCount: (n: number) => `${n} ${n === 1 ? "titel" : "titlar"}`,
    leaveTitle: "Lämna rummet?",
    leaveBody: "Du lämnar spelet. Du kan gå med igen med rumskoden medan rummet är i lobbyn.",
    leave: "Lämna",
    stay: "Stanna",
    failed: "Något gick fel",
    enterNumber: "Skriv ett tal",
  },
} satisfies Record<Language, unknown>;

const formatNumber = (value: number, language: Language) =>
  value.toLocaleString(language === "sv" ? "sv-SE" : "en-US", { maximumFractionDigits: 2 });

/** "1 234,5" / "1,234.5" / "1234" → 1234.5; null when it isn't a number. */
function parseGuess(input: string): number | null {
  const cleaned = input.replace(/[\s ]/g, "").replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export default function PartyRoomScreen() {
  const { language, translateError } = useI18n();
  const copy = COPY[language];
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, round, answers, me, myAnswer, isHost, loading, refresh } = usePartyRoom(roomId, playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [rounds, setRounds] = useState<(typeof ROUND_OPTIONS)[number]>("10");
  const [target, setTarget] = useState<string | null>(null);
  const [guess, setGuess] = useState("");

  // A new round starts with an empty answer form.
  useEffect(() => {
    setTarget(null);
    setGuess("");
  }, [round?.id]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (error) {
      showAlert(copy.failed, translateError(error));
    } finally {
      setBusy(null);
    }
  };

  const game = room ? GAME_INFO[room.game] : null;
  const accent = game?.accent ?? colors.brand;
  const nameOf = (id: string | null) => players.find((player) => player.id === id)?.display_name ?? "?";
  const answeredCount = room ? players.filter((player) => player.answered_round >= room.current_round).length : 0;

  const leave = async () => {
    const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, { confirmLabel: copy.leave, cancelLabel: copy.stay, destructive: true });
    if (!ok) return;
    await leaveParty(roomId).catch(() => undefined);
    goBackOr(game?.href ?? "/");
  };

  const ranked = useMemo(() => players.slice().sort((a, b) => b.score - a.score || a.seat_order - b.seat_order), [players]);
  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{copy.scoreboard}</SectionLabel>
      <LocalScoreboard players={ranked.map((p) => ({ id: p.id, name: p.id === playerId ? `${p.display_name} (${copy.you})` : p.display_name, score: p.score }))} accent={accent} />
    </View>
  );

  if (loading || !room || !game) {
    return (
      <Screen topBar={<TopBar backHref="/" />} centered>
        <View style={{ alignItems: "center", gap: space.md }}>
          {loading ? <ActivityIndicator color={colors.brand} /> : null}
          <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{loading ? copy.loading : copy.notInRoom}</Text>
        </View>
      </Screen>
    );
  }
  if (!me) {
    return (
      <Screen topBar={<TopBar backHref={game.href} />} centered>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{copy.notInRoom}</Text>
        <Button label={copy.toStart} accent={accent} onPress={() => router.replace(game.href as any)} />
      </Screen>
    );
  }

  const topBar = <TopBar title={game.title} onBack={leave} />;
  const minPlayers = MIN_PLAYERS[room.game];

  // ---------------------------------------------------------------------------
  // Lobby
  // ---------------------------------------------------------------------------
  if (room.state === "lobby") {
    const inviteUrl = `${SITE_URL}${game.href}?code=${room.code}`;
    return (
      <Screen
        topBar={topBar}
        footer={
          isHost ? (
            <>
              {players.length < minPlayers ? (
                <Text style={[type.small, { color: colors.warning, textAlign: "center" }]}>{copy.needPlayers(players.length, minPlayers)}</Text>
              ) : null}
              <Button
                label={copy.start}
                icon="play"
                accent={accent}
                loading={busy === "start"}
                disabled={players.length < minPlayers}
                onPress={() => run("start", () => startParty(roomId, Number(rounds)))}
              />
            </>
          ) : (
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.waitingHost}</Text>
          )
        }
      >
        <Card accent={accent} style={{ alignItems: "center", paddingVertical: space.xl }}>
          <RoomCodeBadge code={room.code} label={copy.roomCode} accent={accent} inviteUrl={inviteUrl} />
          <View style={{ alignSelf: "stretch" }}>
            <ShareButton label={copy.invite} message={copy.inviteMessage(game.title, room.code)} url={inviteUrl} accentColor={accent} />
          </View>
        </Card>
        {isHost ? (
          <View style={{ gap: space.sm }}>
            <SectionLabel>{copy.rounds}</SectionLabel>
            <SegmentedControl value={rounds} onChange={setRounds} accent={accent} options={ROUND_OPTIONS.map((n) => ({ value: n, label: n }))} />
          </View>
        ) : null}
        <View style={{ gap: space.sm }}>
          <SectionLabel right={<Chip label={`${players.length}`} color={accent} icon="people" />}>{copy.players}</SectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {players.map((p) => (
              <Chip
                key={p.id}
                label={`${p.display_name}${p.id === playerId ? ` · ${copy.you}` : ""}${p.id === room.host_player_id ? ` · ${copy.host}` : ""}`}
                color={p.id === room.host_player_id ? accent : colors.textSecondary}
                icon={p.id === room.host_player_id ? "star" : "person"}
              />
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  if (room.state === "ended") {
    const top = ranked[0]?.score ?? 0;
    const winners = ranked.filter((p) => p.score === top);
    const byTitles = players.slice().sort((a, b) => b.titles - a.titles || a.seat_order - b.seat_order).filter((p) => p.titles > 0);
    return (
      <Screen
        topBar={topBar}
        footer={<PlayAgainFooter isHost={isHost} onPlayAgain={() => run("again", () => resetParty(roomId))} loading={busy === "again"} accent={accent} newRoomHref={game.href} />}
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={accent} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="trophy" size={48} color={accent} />
            <Text style={[type.title, { color: colors.text }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: accent, textAlign: "center" }]}>{copy.winner(winners.map((p) => p.display_name).join(", "))}</Text>
          </Card>
          {scoreboard}
          {room.game === "most_likely" && byTitles.length ? (
            <View style={{ gap: space.sm }}>
              <SectionLabel>{copy.titles}</SectionLabel>
              {byTitles.map((p) => (
                <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{p.display_name}</Text>
                  <Chip label={copy.titlesCount(p.titles)} color={accent} icon="ribbon" />
                </View>
              ))}
            </View>
          ) : null}
        </AnimatedEntrance>
      </Screen>
    );
  }

  if (!round) {
    return (
      <Screen topBar={topBar} centered>
        <ActivityIndicator color={accent} />
      </Screen>
    );
  }

  const prompt = language === "sv" ? round.text_sv : round.text_en;
  const unit = language === "sv" ? round.unit_sv : round.unit_en;
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
      <Chip label={copy.round(round.round_number, room.total_rounds)} color={accent} icon="albums" />
      {room.state === "question" ? <Chip label={copy.answered(answeredCount, players.length)} color={colors.textSecondary} icon="checkmark-done" /> : null}
    </View>
  );
  const promptCard = (
    <Card accent={accent} style={{ gap: space.sm, paddingVertical: space.xl }}>
      {room.game === "most_likely" ? (
        <Text style={[type.caption, { color: accent, textTransform: "uppercase" }]}>{copy.mostLikely}</Text>
      ) : null}
      <Text style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: "800" }}>
        {room.game === "most_likely" ? `${prompt}?` : prompt}
      </Text>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Question
  // ---------------------------------------------------------------------------
  if (room.state === "question") {
    const parsed = parseGuess(guess);
    const canSend = room.game === "most_likely" ? !!target : parsed !== null;
    const send = () =>
      run("answer", async () => {
        if (room.game === "most_likely") {
          if (target) await voteForPlayer(roomId, target);
        } else {
          if (parsed === null) throw new Error(copy.enterNumber);
          await submitGuess(roomId, parsed);
        }
      });
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button label={myAnswer ? copy.change : copy.send} icon="send" accent={accent} loading={busy === "answer"} disabled={!canSend} onPress={send} />
            {isHost ? <Button label={copy.revealNow} variant="ghost" size="md" loading={busy === "reveal"} onPress={() => run("reveal", () => revealRound(roomId))} /> : null}
          </>
        }
      >
        <AnimatedEntrance enterKey={`q-${round.id}`} style={{ gap: space.md }}>
          {header}
          {promptCard}
          {myAnswer ? (
            <View style={{ flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.success, 0.12) }}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[type.small, { color: colors.text, flex: 1 }]}>
                {copy.sent}
                {room.game === "most_likely" && myAnswer.target_player_id ? ` (${nameOf(myAnswer.target_player_id)})` : ""}
                {room.game === "estimate" && myAnswer.number_value !== null ? ` (${formatNumber(Number(myAnswer.number_value), language)})` : ""}
              </Text>
            </View>
          ) : null}
          {room.game === "most_likely" ? (
            <View style={{ gap: space.sm }}>
              <Text style={[type.small, { color: colors.textMuted }]}>{copy.voteHint}</Text>
              <PlayerPicker
                players={players.map((p) => ({ id: p.id, name: p.display_name, note: p.id === playerId ? copy.you : undefined }))}
                selectedId={target ?? myAnswer?.target_player_id ?? null}
                onSelect={setTarget}
                accent={accent}
              />
            </View>
          ) : (
            <TextField
              label={copy.guessHint(unit)}
              value={guess}
              onChangeText={setGuess}
              placeholder={copy.guessPlaceholder}
              keyboardType="decimal-pad"
              inputMode="decimal"
              returnKeyType="send"
              onSubmitEditing={() => canSend && send()}
              accent={accent}
              maxLength={20}
            />
          )}
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Reveal
  // ---------------------------------------------------------------------------
  const myPoints = myAnswer?.points ?? 0;
  const last = round.round_number >= room.total_rounds;
  let result: React.ReactNode;
  if (room.game === "most_likely") {
    const counts = new Map<string, number>();
    answers.forEach((a) => a.target_player_id && counts.set(a.target_player_id, (counts.get(a.target_player_id) ?? 0) + 1));
    const tally = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = tally[0]?.[1] ?? 0;
    result = tally.length ? (
      <View style={{ gap: space.sm }}>
        <SectionLabel>{copy.groupPicked}</SectionLabel>
        {tally.map(([id, n]) => (
          <View
            key={id}
            style={{
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: n === top ? withAlpha(accent, 0.16) : colors.sunken,
              borderWidth: 1,
              borderColor: n === top ? accent : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            {n === top ? <Ionicons name="ribbon" size={20} color={accent} /> : null}
            <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{nameOf(id)}</Text>
            <Text style={{ color: n === top ? accent : colors.textMuted, fontWeight: "900" }}>{copy.votes(n)}</Text>
          </View>
        ))}
      </View>
    ) : (
      <Text style={[type.body, { color: colors.textMuted }]}>{copy.nobodyVoted}</Text>
    );
  } else {
    const correct = round.answer === null ? null : Number(round.answer);
    const guesses = players
      .map((p) => ({ p, a: answers.find((a) => a.player_id === p.id) ?? null }))
      .sort((x, y) => {
        const dx = x.a?.number_value == null || correct === null ? Infinity : Math.abs(Number(x.a.number_value) - correct);
        const dy = y.a?.number_value == null || correct === null ? Infinity : Math.abs(Number(y.a.number_value) - correct);
        return dx - dy;
      });
    result = (
      <View style={{ gap: space.md }}>
        <Card style={{ alignItems: "center" }}>
          <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.correct}</Text>
          <Text style={{ color: accent, fontSize: 40, lineHeight: 46, fontWeight: "900" }}>
            {correct === null ? "?" : formatNumber(correct, language)}
            {unit ? <Text style={{ fontSize: 20, color: colors.textSecondary }}>{` ${unit}`}</Text> : null}
          </Text>
        </Card>
        {guesses.map(({ p, a }) => {
          const value = a?.number_value == null ? null : Number(a.number_value);
          const diff = value === null || correct === null ? null : Math.abs(value - correct);
          return (
            <View
              key={p.id}
              style={{
                padding: space.md,
                borderRadius: radius.md,
                backgroundColor: a?.points ? withAlpha(accent, 0.14) : colors.sunken,
                borderWidth: 1,
                borderColor: a?.points ? withAlpha(accent, 0.6) : colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: colors.text }]}>{p.display_name}</Text>
                <Text style={[type.small, { color: colors.textMuted }]}>
                  {value === null ? copy.noGuess : `${formatNumber(value, language)}${unit ? ` ${unit}` : ""} · ${diff === 0 ? copy.exact : copy.off(formatNumber(diff ?? 0, language))}`}
                </Text>
              </View>
              {a?.points ? <Chip label={`+${a.points}`} color={accent} /> : null}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <Screen
      topBar={topBar}
      footer={
        isHost ? (
          <Button label={last ? copy.finish : copy.next} icon={last ? "flag" : "play-forward"} accent={accent} loading={busy === "next"} onPress={() => run("next", () => nextRound(roomId))} />
        ) : (
          <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.waitingNext}</Text>
        )
      }
    >
      <AnimatedEntrance enterKey={`r-${round.id}`} style={{ gap: space.md }}>
        {header}
        {promptCard}
        <Chip label={myPoints > 0 ? copy.youScored(myPoints) : copy.noPoints} color={myPoints > 0 ? colors.success : colors.textMuted} icon={myPoints > 0 ? "sparkles" : "remove"} />
        {result}
        {scoreboard}
      </AnimatedEntrance>
    </Screen>
  );
}
