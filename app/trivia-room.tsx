import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Image } from "react-native";
import { CopyToast } from "../src/components/CopyToast";
import { TRIVIA_CATEGORIES, type TriviaCategory } from "../src/games/trivia/data";
import { revealTriviaAnswer, resetTriviaToLobby, scoreTriviaTurn, startTriviaGame } from "../src/games/trivia/api";
import { useTriviaRoom } from "../src/games/trivia/useTriviaRoom";
import { useI18n } from "../src/lib/i18n";

const QUESTIONS_PER_PLAYER = 6;

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
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<TriviaCategory[]>(["Mat"]);
  const baseUrl = Platform.OS === "web" ? window.location.origin : "https://picklo.app";
  const questionOpacity = useRef(new Animated.Value(1)).current;
  const questionTranslateY = useRef(new Animated.Value(0)).current;
  const questionScale = useRef(new Animated.Value(1)).current;
  const questionGlow = useRef(new Animated.Value(0.18)).current;
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
    questionGlow.setValue(0.08);
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
      Animated.sequence([
        Animated.timing(questionGlow, {
          toValue: 0.34,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(questionGlow, {
          toValue: 0.18,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [currentTurn?.id, questionGlow, questionOpacity, questionScale, questionTranslateY, revealOpacity, revealScale, revealTranslateY, room?.state]);

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
      Alert.alert(copy.actionFailed, String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 1400);
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

  if (loading || !room) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900", textAlign: "center" }}>{copy.loading}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(249,115,22,0.35)",
                backgroundColor: "#111827",
              }}
            >
              <Image source={require("../assets/trivia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontSize: 30, fontWeight: "900" }}>Trivia</Text>
              <Text style={{ color: "#94A3B8" }}>{copy.roomCode.replace("{code}", room.code)}</Text>
            </View>
          </View>
          {!gameInProgress ? <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>{room.public_message ?? copy.waitingHost}</Text> : null}
        </View>

        {!gameInProgress ? (
        <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.players}</Text>
            <Text style={{ color: "#94A3B8", fontWeight: "900" }}>{players.length}</Text>
          </View>
          {players.map((player) => (
            <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                <Text style={{ color: "#94A3B8" }}>{copy.answered.replace("{count}", String(player.correct_answers ?? 0))}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {player.id === room.host_player_id ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(249,115,22,0.14)", borderWidth: 1, borderColor: "rgba(249,115,22,0.3)" }}>
                    <Text style={{ color: "#FDBA74", fontWeight: "900", fontSize: 12 }}>{copy.host}</Text>
                  </View>
                ) : null}
                <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>{player.score}p</Text>
              </View>
            </View>
          ))}
          <Pressable onPress={copyInvite} style={({ pressed }) => ({ height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", opacity: pressed ? 0.92 : 1 })}>
            <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.copyInvite}</Text>
          </Pressable>
          {showCopiedToast ? <CopyToast visible={showCopiedToast} /> : null}
        </View>
        ) : null}

        {room.state === "lobby" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.setup}</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.setupBody}</Text>
            {isHost ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {TRIVIA_CATEGORIES.map((category) => {
                    const active = selectedCategories.includes(category);
                    return (
                      <Pressable
                        key={category}
                        onPress={() => toggleCategory(category)}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 999,
                          backgroundColor: active ? "#7C2D12" : "#111827",
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? "#FDBA74" : "#334155",
                          opacity: pressed ? 0.92 : 1,
                        })}
                      >
                        <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{category}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", gap: 4 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>{copy.selected}</Text>
                  <Text style={{ color: "white", fontWeight: "900" }}>{copy.selectedCategories}: {selectedCategories.join(", ")}</Text>
                </View>
                <Pressable onPress={beginGame} disabled={busy === "start"} style={({ pressed }) => ({ minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EA580C", opacity: busy === "start" ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.startGame}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ color: "#CBD5E1" }}>{copy.waitingHost}</Text>
            )}
          </View>
        ) : null}

        {(room.state === "question" || room.state === "reveal") && currentTurn ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.turnLive}</Text>
            <Animated.View
              style={{
                opacity: questionOpacity,
                transform: [{ translateY: questionTranslateY }, { scale: questionScale }],
              }}
            >
              <View
                style={{
                  padding: 16,
                  borderRadius: 20,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  gap: 10,
                  shadowColor: "#FB923C",
                  shadowOpacity: questionGlow as any,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 12,
                }}
              >
                <Text style={{ color: "#94A3B8", fontWeight: "800", textTransform: "uppercase", fontSize: 12 }}>{copy.question}</Text>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 28, lineHeight: 36 }}>{currentTurn.question_text}</Text>
                <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "#7C2D12", borderWidth: 1, borderColor: "#FDBA74" }}>
                  <Text style={{ color: "white", fontWeight: "900" }}>
                    {copy.category.toUpperCase()}: {currentTurn.category.toUpperCase()}
                  </Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={{
                opacity: questionOpacity,
                transform: [{ translateY: questionTranslateY.interpolate({ inputRange: [0, 26], outputRange: [0, 10] }) }],
              }}
            >
              <View style={{ padding: 16, borderRadius: 18, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", gap: 8 }}>
                <Text style={{ color: "#94A3B8", fontWeight: "800", textTransform: "uppercase", fontSize: 12 }}>{copy.activePlayer}</Text>
                <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 26 }}>{activePlayer?.display_name ?? "-"}</Text>
                <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
                  {copy.roundCount.replace("{current}", String(currentTurn.turn_number)).replace("{total}", String(totalTurns))}
                </Text>
                <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                  {copy.playerCount.replace("{player}", activePlayer?.display_name ?? "-").replace("{current}", String(currentTurn.player_question_number)).replace("{total}", String(room.questions_per_player ?? QUESTIONS_PER_PLAYER))}
                </Text>
                <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                  {isActivePlayer || isHost ? copy.spokenHint : copy.currentQuestionFor.replace("{player}", activePlayer?.display_name ?? "-")}
                </Text>
              </View>
            </Animated.View>

            {room.state === "reveal" || isActivePlayer || isHost ? (
              <View style={{ gap: 12 }}>
                {room.state === "question" ? (
                  isHost ? (
                    <Pressable onPress={revealAnswer} disabled={!canReveal || busy === "reveal"} style={({ pressed }) => ({ minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EA580C", opacity: !canReveal || busy === "reveal" ? 0.6 : pressed ? 0.92 : 1 })}>
                      <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.reveal}</Text>
                    </Pressable>
                  ) : null
                ) : (
                  <Animated.View
                    style={{
                      opacity: revealOpacity,
                      transform: [{ translateY: revealTranslateY }, { scale: revealScale }],
                    }}
                  >
                  <View style={{ padding: 16, borderRadius: 18, backgroundColor: "#1A0F03", borderWidth: 1, borderColor: "#FB923C", gap: 8, shadowColor: "#FB923C", shadowOpacity: 0.34, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
                    <Text style={{ color: "#FDBA74", fontWeight: "800", textTransform: "uppercase", fontSize: 12 }}>{copy.answer}</Text>
                    <Text style={{ color: "#FFF7ED", fontWeight: "900", fontSize: 24, lineHeight: 32 }}>{currentTurn.answer_text}</Text>
                    <Text style={{ color: "#FED7AA", lineHeight: 22 }}>{copy.revealBody}</Text>
                  </View>
                  </Animated.View>
                )}
              </View>
            ) : (
              <View style={{ padding: 18, borderRadius: 18, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", gap: 8 }}>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 20 }}>
                  {room.state === "question" ? copy.waitingForReveal : copy.waitingForTurn}
                </Text>
                <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{copy.currentQuestionFor.replace("{player}", activePlayer?.display_name ?? "-")}</Text>
              </View>
            )}

            {room.state === "reveal" && isHost ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable onPress={() => markTurn(false)} disabled={busy === "wrong"} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#475569", opacity: busy === "wrong" ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.markWrong}</Text>
                </Pressable>
                <Pressable onPress={() => markTurn(true)} disabled={busy === "correct"} style={({ pressed }) => ({ flex: 1, minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#15803D", opacity: busy === "correct" ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.markCorrect}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {room.state === "completed" ? (
          <Animated.View style={{ opacity: finalOpacity, transform: [{ scale: finalScale }] }}>
            <View
              style={{
                borderRadius: 28,
                padding: 20,
                borderWidth: 1,
                borderColor: "rgba(251,146,60,0.32)",
                backgroundColor: "#120A02",
                overflow: "hidden",
                gap: 14,
                shadowColor: "#FB923C",
                shadowOpacity: 0.3,
                shadowRadius: 28,
                shadowOffset: { width: 0, height: 12 },
                elevation: 14,
              }}
            >
              <View style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, borderRadius: 999, backgroundColor: "rgba(251,146,60,0.14)" }} />
              <View style={{ position: "absolute", bottom: -70, left: -20, width: 180, height: 180, borderRadius: 999, backgroundColor: "rgba(245,158,11,0.12)" }} />

              <Text style={{ color: "#FDBA74", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
                {copy.finalTitle}
              </Text>
              <Text style={{ color: "#FFF7ED", fontWeight: "900", fontSize: 40, lineHeight: 44 }}>
                {winner?.display_name ?? "-"}
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(251,146,60,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(253,186,116,0.34)",
                }}
              >
                <Text style={{ color: "#FFF7ED", fontWeight: "900", fontSize: 18 }}>
                  {winner ? `${winner.score}p · ${copy.answered.replace("{count}", String(winner.correct_answers ?? 0))}` : ""}
                </Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 14,
                backgroundColor: "#0F172A",
                borderRadius: 22,
                padding: 16,
                borderWidth: 1,
                borderColor: "#1E293B",
                gap: 10,
              }}
            >
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.score}</Text>
              {sortedPlayers.map((player, index) => (
                <View
                  key={`final-${player.id}`}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    backgroundColor: index === 0 ? "rgba(251,146,60,0.14)" : index === 1 ? "rgba(148,163,184,0.12)" : index === 2 ? "rgba(180,83,9,0.16)" : "#020617",
                    borderWidth: 1,
                    borderColor: index === 0 ? "rgba(253,186,116,0.34)" : "#1F2937",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <Text style={{ color: index === 0 ? "#FDBA74" : "#94A3B8", fontWeight: "900", width: 26 }}>
                      #{index + 1}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{player.display_name}</Text>
                      <Text style={{ color: "#94A3B8" }}>{copy.answered.replace("{count}", String(player.correct_answers ?? 0))}</Text>
                    </View>
                  </View>
                  <Text style={{ color: "#FFF7ED", fontWeight: "900", fontSize: 22 }}>{player.score}p</Text>
                </View>
              ))}
              {isHost ? (
                <Pressable onPress={resetGame} disabled={busy === "reset"} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#EA580C", opacity: busy === "reset" ? 0.6 : pressed ? 0.92 : 1, marginTop: 4 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.reset}</Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {room.state !== "completed" ? (
        <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.score}</Text>
          {sortedPlayers.map((player, index) => (
            <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: index === 0 ? "rgba(234,88,12,0.14)" : "#020617", borderWidth: 1, borderColor: index === 0 ? "rgba(253,186,116,0.3)" : "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                <Text style={{ color: "#94A3B8" }}>{copy.answered.replace("{count}", String(player.correct_answers ?? 0))}</Text>
              </View>
              <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>{player.score}p</Text>
            </View>
          ))}
        </View>
        ) : null}

        <Pressable onPress={() => router.replace("/")} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", opacity: pressed ? 0.92 : 1 })}>
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.back || t("common.back_to_games")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
