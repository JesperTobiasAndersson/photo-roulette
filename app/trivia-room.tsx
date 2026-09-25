import React, { useEffect, useMemo, useRef, useState } from "react";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ShareButton } from "../src/components/ShareButton";
import { GAMES } from "../src/games/catalog";
import { TRIVIA_CATEGORIES, type TriviaCategory } from "../src/games/trivia/data";
import { revealTriviaAnswer, resetTriviaToLobby, scoreTriviaTurn, startTriviaGame } from "../src/games/trivia/api";
import { useTriviaRoom } from "../src/games/trivia/useTriviaRoom";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { Button, Card, Chip, RoomCodeBadge, Screen, SectionLabel, TopBar, type IconName } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const QUESTIONS_PER_PLAYER = 6;
const GAME = GAMES.trivia;
const ACCENT = GAME.accent;

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default function TriviaRoomScreen() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, myPlayer, currentTurn, loading, refresh } = useTriviaRoom(roomId, playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<TriviaCategory[]>(["Mat"]);
  const baseUrl = SITE_URL;
  const questionOpacity = useRef(new Animated.Value(1)).current;
  const questionTranslateY = useRef(new Animated.Value(0)).current;
  const questionScale = useRef(new Animated.Value(1)).current;
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslateY = useRef(new Animated.Value(18)).current;
  const revealScale = useRef(new Animated.Value(0.96)).current;
  const finalOpacity = useRef(new Animated.Value(0)).current;
  const finalScale = useRef(new Animated.Value(0.94)).current;

  const copy =
    language === "sv"
      ? {
          loading: "Laddar Trivia",
          actionFailed: "Åtgärden misslyckades",
          roomCode: "Rum {code}",
          host: "VÄRD",
          players: "Spelare",
          copyInvite: "Kopiera inbjudningslänk",
          waitingHost: "Väntar på att värden ska välja kategorier och starta spelet.",
          setup: "Spelupplägg",
          setupBody: "Välj vilka kategorier ni vill spela med. När värden startar får varje spelare 6 frågor var i turordning.",
          selected: "Valt",
          selectedCategories: "Valda kategorier",
          startGame: "Starta Trivia",
          chooseCategory: "Välj minst en kategori först.",
          needPlayers: "Det behövs minst 2 spelare för att starta.",
          turnLive: "Aktiv fråga",
          roundCount: "Fråga {current}/{total}",
          playerCount: "{player} får fråga {current} av {total}",
          activePlayer: "Spelare",
          spokenHint: "Svara muntligt. När svaret är sagt kan värden eller den aktiva spelaren visa facit.",
          reveal: "Visa svar",
          revealBody: "Nu kan värden markera om svaret var rätt eller fel.",
          markWrong: "Fel",
          markCorrect: "Rätt",
          waitingForTurn: "Väntar på din tur",
          waitingForReveal: "Väntar på att facit ska visas",
          currentQuestionFor: "{player} svarar just nu.",
          finalTitle: "Slutresultat",
          finalBody: "Alla spelare har nu svarat på 6 frågor var.",
          reset: "Tillbaka till lobby",
          back: "Tillbaka till spel",
          score: "Poängtavla",
          answered: "{count} rätt",
          category: "Kategori",
          question: "Fråga",
          answer: "Svar",
          // UI pass additions
          youHost: "Du är värd",
          youPlayer: "Du spelar",
          you: "Du",
          hostLobbyTitle: "Välj kategori och starta",
          playerLobbyTitle: "Väntar på värden",
          hostQuestionTitle: "Läs upp frågan högt",
          hostQuestionTitleSelf: "Din tur – läs upp och svara",
          hostQuestionBody: "Låt {player} svara muntligt och tryck sedan på Visa svar.",
          activeQuestionTitle: "Din tur! Svara högt",
          activeQuestionBody: "Värden visar facit när du har svarat.",
          hostRevealTitle: "Var svaret rätt?",
          hostRevealBody: "Tryck Rätt eller Fel nedan för {player}.",
          playerRevealTitle: "Värden dömer svaret",
          answering: "Svarar",
          playerDoneBody: "Värden kan starta en ny omgång från lobbyn.",
          leaveTitle: "Lämna rummet?",
          leaveBody: "Du lämnar spelet. Du kan gå med igen med rumskoden.",
          leave: "Lämna",
          cancel: "Avbryt",
          shareMessage: "Kör Trivia med mig på Picklo! Rumskod: {code}",
          categoryTurn: "Du väljer en kategori för hela spelet.",
        }
      : {
          loading: "Loading Trivia",
          actionFailed: "Action failed",
          roomCode: "Room {code}",
          host: "HOST",
          players: "Players",
          copyInvite: "Copy invite link",
          waitingHost: "Waiting for the host to choose categories and start the game.",
          setup: "Game setup",
          setupBody: "Choose the categories you want to play. When the host starts, every player gets 6 questions in turn order.",
          selected: "Selected",
          selectedCategories: "Selected categories",
          startGame: "Start Trivia",
          chooseCategory: "Choose at least one category first.",
          needPlayers: "At least 2 players are required to start.",
          turnLive: "Live question",
          roundCount: "Question {current}/{total}",
          playerCount: "{player} is on question {current} of {total}",
          activePlayer: "Player",
          spokenHint: "Answer out loud. Once the answer is said, the host or active player can reveal the answer.",
          reveal: "Show answer",
          revealBody: "The host can now mark whether the spoken answer was right or wrong.",
          markWrong: "Wrong",
          markCorrect: "Correct",
          waitingForTurn: "Waiting for your turn",
          waitingForReveal: "Waiting for the answer reveal",
          currentQuestionFor: "{player} is answering right now.",
          finalTitle: "Final results",
          finalBody: "Every player has now answered 6 questions.",
          reset: "Back to lobby",
          back: "Back to games",
          score: "Scoreboard",
          answered: "{count} correct",
          category: "Category",
          question: "Question",
          answer: "Answer",
          // UI pass additions
          youHost: "You're the host",
          youPlayer: "You're playing",
          you: "You",
          hostLobbyTitle: "Pick a category and start",
          playerLobbyTitle: "Waiting for the host",
          hostQuestionTitle: "Read the question out loud",
          hostQuestionTitleSelf: "Your turn: read it and answer",
          hostQuestionBody: "Let {player} answer out loud, then tap Show answer.",
          activeQuestionTitle: "Your turn! Answer out loud",
          activeQuestionBody: "The host reveals the answer once you've said it.",
          hostRevealTitle: "Was the answer right?",
          hostRevealBody: "Tap Correct or Wrong below for {player}.",
          playerRevealTitle: "The host is judging the answer",
          answering: "Answering",
          playerDoneBody: "The host can start a new round from the lobby.",
          leaveTitle: "Leave the room?",
          leaveBody: "You'll leave the game. You can rejoin with the room code.",
          leave: "Leave",
          cancel: "Cancel",
          shareMessage: "Play Trivia with me on Picklo! Room code: {code}",
          categoryTurn: "You pick one category for the whole game.",
        };

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const isActivePlayer = !!myPlayer && !!currentTurn && myPlayer.id === currentTurn.player_id;
  const canReveal = !!room && room.state === "question" && isHost;
  const inviteUrl = room?.code ? `${baseUrl}/trivia?code=${room.code}` : "";
  const totalTurns = (room?.questions_per_player ?? QUESTIONS_PER_PLAYER) * players.length;
  const gameInProgress = room?.state === "question" || room?.state === "reveal";
  const sortedPlayers = useMemo(
    () => players.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.seat_order - b.seat_order),
    [players]
  );
  const activePlayer = currentTurn ? players.find((player) => player.id === currentTurn.player_id) ?? null : null;
  const winner = sortedPlayers[0] ?? null;

  useEffect(() => {
    if (!currentTurn?.id) {
      return;
    }

    questionOpacity.setValue(0);
    questionTranslateY.setValue(26);
    questionScale.setValue(0.97);
    revealOpacity.setValue(room?.state === "reveal" ? 1 : 0);
    revealTranslateY.setValue(room?.state === "reveal" ? 0 : 18);
    revealScale.setValue(room?.state === "reveal" ? 1 : 0.96);

    Animated.parallel([
      Animated.timing(questionOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(questionTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 58,
        useNativeDriver: true,
      }),
      Animated.spring(questionScale, {
        toValue: 1,
        friction: 8,
        tension: 56,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentTurn?.id, questionOpacity, questionScale, questionTranslateY, revealOpacity, revealScale, revealTranslateY, room?.state]);

  useEffect(() => {
    if (room?.state !== "reveal") {
      revealOpacity.setValue(0);
      revealTranslateY.setValue(18);
      revealScale.setValue(0.96);
      return;
    }

    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(revealTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.spring(revealScale, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [revealOpacity, revealScale, revealTranslateY, room?.state]);

  useEffect(() => {
    if (room?.state !== "completed") {
      finalOpacity.setValue(0);
      finalScale.setValue(0.94);
      return;
    }

    Animated.parallel([
      Animated.timing(finalOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(finalScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [finalOpacity, finalScale, room?.state]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (error) {
      showAlert(copy.actionFailed, String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const toggleCategory = (category: TriviaCategory) => {
    setSelectedCategories([category]);
  };

  const beginGame = () =>
    run("start", async () => {
      if (players.length < 2) throw new Error(copy.needPlayers);
      if (selectedCategories.length < 1) throw new Error(copy.chooseCategory);
      await startTriviaGame(roomId, playerId, selectedCategories);
    });

  const revealAnswer = () => run("reveal", async () => revealTriviaAnswer(roomId, playerId));
  const markTurn = (wasCorrect: boolean) => run(wasCorrect ? "correct" : "wrong", async () => scoreTriviaTurn(roomId, playerId, wasCorrect));
  const resetGame = () => run("reset", async () => resetTriviaToLobby(roomId, playerId));

  const leaveRoom = async () => {
    if (room?.state !== "completed") {
      const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, { confirmLabel: copy.leave, cancelLabel: copy.cancel, destructive: true });
      if (!ok) return;
    }
    router.replace(GAME.href as any);
  };

  if (loading || !room) {
    return (
      <Screen topBar={<TopBar title={GAME.title} backHref={GAME.href} />} centered>
        <View style={{ alignItems: "center", gap: space.md }}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{copy.loading}</Text>
        </View>
      </Screen>
    );
  }

  const activeName = activePlayer?.display_name ?? "-";
  const inTurn = gameInProgress && !!currentTurn;

  // What this phone should do right now.
  const banner: { icon: IconName; title: string; body?: string | null } | null =
    room.state === "lobby"
      ? isHost
        ? { icon: "options", title: copy.hostLobbyTitle, body: copy.setupBody }
        : { icon: "hourglass", title: copy.playerLobbyTitle, body: room.public_message ?? copy.waitingHost }
      : inTurn
        ? room.state === "question"
          ? isHost
            ? {
                icon: "megaphone",
                title: isActivePlayer ? copy.hostQuestionTitleSelf : copy.hostQuestionTitle,
                body: copy.hostQuestionBody.replace("{player}", activeName),
              }
            : isActivePlayer
              ? { icon: "mic", title: copy.activeQuestionTitle, body: copy.activeQuestionBody }
              : { icon: "hourglass", title: copy.waitingForReveal, body: copy.currentQuestionFor.replace("{player}", activeName) }
          : isHost
            ? { icon: "checkmark-done", title: copy.hostRevealTitle, body: copy.hostRevealBody.replace("{player}", activeName) }
            : { icon: "hourglass", title: copy.playerRevealTitle, body: isActivePlayer ? null : copy.waitingForTurn }
        : room.state === "completed"
          ? isHost ? null : { icon: "trophy", title: copy.finalTitle, body: copy.playerDoneBody }
          : { icon: "hourglass", title: room.public_message ?? copy.waitingHost };

  // ---------------------------------------------------------------------------
  // Footer: host controls in thumb reach.
  // ---------------------------------------------------------------------------
  let footer: React.ReactNode = null;
  if (room.state === "lobby" && isHost) {
    footer = <Button label={copy.startGame} icon="play" accent={ACCENT} onPress={beginGame} loading={busy === "start"} />;
  } else if (inTurn && isHost && room.state === "question") {
    footer = <Button label={copy.reveal} icon="eye" accent={ACCENT} onPress={revealAnswer} loading={busy === "reveal"} disabled={!canReveal} />;
  } else if (inTurn && isHost && room.state === "reveal") {
    footer = (
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button
          label={copy.markWrong}
          icon="close-circle"
          variant="danger"
          onPress={() => markTurn(false)}
          loading={busy === "wrong"}
          disabled={busy === "correct"}
          style={{ flex: 1, minHeight: 64 }}
        />
        <Button
          label={copy.markCorrect}
          icon="checkmark-circle"
          accent={colors.success}
          onPress={() => markTurn(true)}
          loading={busy === "correct"}
          disabled={busy === "wrong"}
          style={{ flex: 1, minHeight: 64 }}
        />
      </View>
    );
  } else if (room.state === "completed" && isHost) {
    footer = <Button label={copy.reset} icon="refresh" accent={ACCENT} onPress={resetGame} loading={busy === "reset"} />;
  }

  return (
    <Screen
      topBar={
        <TopBar
          title={GAME.title}
          onBack={leaveRoom}
          right={room.state !== "lobby" ? <Chip label={room.code} icon="key" color={colors.textMuted} /> : undefined}
        />
      }
      footer={footer}
    >
      {banner ? <RoleBanner isHost={isHost} roleLabel={isHost ? copy.youHost : copy.youPlayer} icon={banner.icon} title={banner.title} body={banner.body} /> : null}

      {/* Lobby */}
      {room.state === "lobby" ? (
        <>
          <Card accent={ACCENT} style={{ alignItems: "center", gap: space.md }}>
            <RoomCodeBadge code={room.code} label={t("common.room_code")} accent={ACCENT} />
            <View style={{ alignSelf: "stretch" }}>
              <ShareButton label={t("common.invite")} message={copy.shareMessage.replace("{code}", room.code)} url={inviteUrl} accentColor={ACCENT} />
            </View>
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionLabel right={<Text style={[type.caption, { color: colors.textMuted }]}>{players.length}</Text>}>{copy.players}</SectionLabel>
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                name={player.display_name}
                isHost={player.id === room.host_player_id}
                isMe={player.id === myPlayer?.id}
                hostLabel={t("common.host")}
                youLabel={copy.you}
              />
            ))}
            {isHost && players.length < 2 ? <Text style={[type.small, { color: colors.warning }]}>{copy.needPlayers}</Text> : null}
          </View>

          {isHost ? (
            <Card>
              <Text style={[type.heading, { color: colors.text }]}>{copy.category}</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>{copy.categoryTurn}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {TRIVIA_CATEGORIES.map((category) => (
                  <CategoryChip key={category} label={category} active={selectedCategories.includes(category)} onPress={() => toggleCategory(category)} />
                ))}
              </View>
              <Text style={[type.small, { color: colors.textSecondary }]}>
                {copy.selectedCategories}: <Text style={{ color: ACCENT, fontWeight: "800" }}>{selectedCategories.join(", ")}</Text>
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}

      {/* Live question */}
      {inTurn && currentTurn ? (
        <>
          <Animated.View style={{ opacity: questionOpacity, transform: [{ translateY: questionTranslateY }, { scale: questionScale }] }}>
            <Card accent={ACCENT} style={{ gap: space.md, padding: space.xl }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                <Chip label={currentTurn.category.toUpperCase()} color={ACCENT} icon="pricetag" />
                <Chip
                  label={copy.roundCount.replace("{current}", String(currentTurn.turn_number)).replace("{total}", String(totalTurns))}
                  color={colors.textMuted}
                />
              </View>
              <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "900", fontSize: 30, lineHeight: 38 }}>
                {currentTurn.question_text}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Ionicons name={isActivePlayer ? "mic" : "person"} size={18} color={isActivePlayer ? ACCENT : colors.textMuted} />
                <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
                  <Text style={{ color: colors.textMuted, fontWeight: "700" }}>{copy.answering}: </Text>
                  {activeName}
                  {isActivePlayer ? <Text style={{ color: ACCENT }}>{` (${copy.you})`}</Text> : null}
                </Text>
                <Text style={[type.small, { color: colors.textMuted }]}>
                  {currentTurn.player_question_number}/{room.questions_per_player ?? QUESTIONS_PER_PLAYER}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {room.state === "reveal" ? (
            <Animated.View style={{ opacity: revealOpacity, transform: [{ translateY: revealTranslateY }, { scale: revealScale }] }}>
              <View
                style={{
                  padding: space.xl,
                  borderRadius: radius.lg,
                  backgroundColor: withAlpha(ACCENT, 0.12),
                  borderWidth: 2,
                  borderColor: ACCENT,
                  gap: space.sm,
                }}
              >
                <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.answer}</Text>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 28, lineHeight: 34 }}>{currentTurn.answer_text}</Text>
                <Text style={[type.small, { color: colors.textSecondary }]}>{copy.revealBody}</Text>
              </View>
            </Animated.View>
          ) : null}
        </>
      ) : null}

      {/* Completed */}
      {room.state === "completed" ? (
        <Animated.View style={{ opacity: finalOpacity, transform: [{ scale: finalScale }], gap: space.lg }}>
          <View
            style={{
              borderRadius: radius.xl,
              padding: space.xl,
              borderWidth: 1,
              borderColor: withAlpha(ACCENT, 0.45),
              backgroundColor: withAlpha(ACCENT, 0.1),
              alignItems: "center",
              gap: space.sm,
            }}
          >
            <Ionicons name="trophy" size={40} color={colors.warning} />
            <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.finalTitle}</Text>
            <Text style={[type.display, { color: colors.text, fontSize: 36, lineHeight: 42, textAlign: "center" }]}>{winner?.display_name ?? "-"}</Text>
            <Chip
              label={winner ? `${winner.score}p · ${copy.answered.replace("{count}", String(winner.correct_answers ?? 0))}` : ""}
              color={ACCENT}
            />
          </View>

          <View style={{ gap: space.sm }}>
            <SectionLabel>{copy.score}</SectionLabel>
            <Text style={[type.small, { color: colors.textMuted }]}>{copy.finalBody}</Text>
            {sortedPlayers.map((player, index) => (
              <ScoreRow
                key={`final-${player.id}`}
                rank={index + 1}
                name={player.display_name}
                detail={copy.answered.replace("{count}", String(player.correct_answers ?? 0))}
                score={player.score}
                leader={index === 0}
                isMe={player.id === myPlayer?.id}
                youLabel={copy.you}
              />
            ))}
          </View>
          <SupportPicklo />
        </Animated.View>
      ) : null}

      {/* Live scoreboard */}
      {gameInProgress ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.score}</SectionLabel>
          {sortedPlayers.map((player, index) => (
            <ScoreRow
              key={player.id}
              rank={index + 1}
              name={player.display_name}
              detail={copy.answered.replace("{count}", String(player.correct_answers ?? 0))}
              score={player.score}
              leader={index === 0 && (player.score ?? 0) > 0}
              isMe={player.id === myPlayer?.id}
              youLabel={copy.you}
              answering={player.id === currentTurn?.player_id}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

function RoleBanner({ isHost, roleLabel, icon, title, body }: { isHost: boolean; roleLabel: string; icon: IconName; title: string; body?: string | null }) {
  const tint = isHost ? ACCENT : colors.brand;
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        backgroundColor: withAlpha(tint, 0.1),
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.35),
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tint, 0.18) }}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Chip label={roleLabel} color={tint} icon={isHost ? "star" : "person"} />
        <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
        {body ? <Text style={[type.small, { color: colors.textSecondary }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

function PlayerRow({ name, isHost, isMe, hostLabel, youLabel }: { name: string; isHost: boolean; isMe: boolean; hostLabel: string; youLabel: string }) {
  return (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
        borderWidth: 1,
        borderColor: isMe ? withAlpha(ACCENT, 0.35) : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <Ionicons name="person-circle" size={24} color={isMe ? ACCENT : colors.textSubtle} />
      <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
        {name}
        {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{` (${youLabel})`}</Text> : null}
      </Text>
      {isHost ? <Chip label={hostLabel} color={ACCENT} icon="star" /> : null}
    </View>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: active ? withAlpha(ACCENT, 0.2) : colors.sunken,
        borderWidth: active ? 2 : 1,
        borderColor: active ? ACCENT : colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {active ? <Ionicons name="checkmark" size={16} color={ACCENT} /> : null}
      <Text style={{ color: active ? colors.text : colors.textSecondary, fontWeight: "800", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function ScoreRow({
  rank,
  name,
  detail,
  score,
  leader,
  isMe,
  youLabel,
  answering,
}: {
  rank: number;
  name: string;
  detail: string;
  score: number;
  leader: boolean;
  isMe: boolean;
  youLabel: string;
  answering?: boolean;
}) {
  return (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        backgroundColor: leader ? withAlpha(ACCENT, 0.12) : colors.surface,
        borderWidth: 1,
        borderColor: leader ? withAlpha(ACCENT, 0.45) : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      {leader ? (
        <Ionicons name="trophy" size={18} color={colors.warning} style={{ width: 24, textAlign: "center" }} />
      ) : (
        <Text style={{ width: 24, textAlign: "center", color: colors.textMuted, fontWeight: "900", fontSize: 14 }}>{rank}</Text>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>
          {name}
          {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{` (${youLabel})`}</Text> : null}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{detail}</Text>
      </View>
      {answering ? <Ionicons name="mic" size={18} color={ACCENT} /> : null}
      <Text style={{ color: leader ? ACCENT : colors.text, fontWeight: "900", fontSize: 18 }}>{score}p</Text>
    </View>
  );
}
