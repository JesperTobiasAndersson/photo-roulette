import React, { useEffect, useRef, useMemo, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { CopyToast } from "../src/components/CopyToast";
import {
  advanceChicagoPokerScore,
  declareChicago,
  playChicagoCard,
  startChicagoRound,
  submitChicagoDraw,
} from "../src/games/chicago/api";
import { cardId, evaluatePokerHand } from "../src/games/chicago/logic";
import type { ChicagoCard, ChicagoSuit } from "../src/games/chicago/types";
import { useChicagoRoom } from "../src/games/chicago/useChicagoRoom";
import { useI18n } from "../src/lib/i18n";

const BUY_STOP_SCORE = 46;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getSuitSymbol(suit: ChicagoSuit): string {
  switch (suit) {
    case "clubs":
      return "\u2663";
    case "diamonds":
      return "\u2666";
    case "hearts":
      return "\u2665";
    case "spades":
      return "\u2660";
    default:
      return "";
  }
}

function getSuitColor(suit: ChicagoSuit): string {
  return suit === "hearts" || suit === "diamonds" ? "#B91C1C" : "#111827";
}

function PlayingCard({
  card,
  selected = false,
  compact = false,
  onPress,
}: {
  card: ChicagoCard;
  selected?: boolean;
  compact?: boolean;
  onPress?: () => void;
}) {
  const suitColor = getSuitColor(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);
  const width = compact ? 68 : 82;
  const height = compact ? 98 : 122;
  const rankSize = compact ? 16 : 20;
  const cornerSuitSize = compact ? 11 : 13;
  const pipSize = compact ? 28 : 38;
  const paperTone = "#FFFFFF";
  const edgeTone = selected ? "#38BDF8" : "#E7E5E4";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        width,
        height,
        borderRadius: 12,
        paddingHorizontal: compact ? 7 : 9,
        paddingVertical: compact ? 7 : 8,
        justifyContent: "space-between",
        backgroundColor: paperTone,
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: edgeTone,
        boxShadow: selected ? "0px 14px 24px rgba(15,23,42,0.22)" : "0px 8px 16px rgba(15,23,42,0.14)",
        elevation: selected ? 8 : 4,
        transform: [{ translateY: selected ? -6 : pressed ? -2 : 0 }],
        opacity: pressed ? 0.95 : 1,
        overflow: "hidden",
      })}
    >
      <View style={{ alignSelf: "flex-start", alignItems: "center", minWidth: 18, gap: 0 }}>
        <Text style={{ color: suitColor, fontSize: rankSize, fontWeight: "900", lineHeight: rankSize + 1 }}>{card.rank}</Text>
        <Text style={{ color: suitColor, fontSize: cornerSuitSize, fontWeight: "900", lineHeight: cornerSuitSize }}>{suitSymbol}</Text>
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        <Text style={{ color: suitColor, fontSize: pipSize, fontWeight: "700", lineHeight: pipSize + 2 }}>{suitSymbol}</Text>
      </View>

      <View style={{ alignSelf: "flex-end", alignItems: "center", minWidth: 18, gap: 0, transform: [{ rotate: "180deg" }] }}>
        <Text style={{ color: suitColor, fontSize: rankSize, fontWeight: "900", lineHeight: rankSize + 1 }}>{card.rank}</Text>
        <Text style={{ color: suitColor, fontSize: cornerSuitSize, fontWeight: "900", lineHeight: cornerSuitSize }}>{suitSymbol}</Text>
      </View>
    </Pressable>
  );
}

export default function ChicagoRoomScreen() {
  const { t, translateChicagoPublicMessage, translatePokerName } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showPokerRevealModal, setShowPokerRevealModal] = useState(false);
  const [shownPokerRevealKey, setShownPokerRevealKey] = useState<string | null>(null);
  const [showTrickWinnerModal, setShowTrickWinnerModal] = useState(false);
  const [shownTrickWinnerKey, setShownTrickWinnerKey] = useState<string | null>(null);
  const [buyStopEvent, setBuyStopEvent] = useState<{ title: string; message: string; tone: "warning" | "penalty" } | null>(null);
  const { room, players, myPlayer, round, myHand, playedCards, loading, refresh } = useChicagoRoom(roomId, playerId);
  const previousRoomStateRef = useRef<string | null>(null);
  const previousScoresRef = useRef<Record<string, number>>({});
  const scheduledPokerScoreKeyRef = useRef<string | null>(null);
  const pokerScoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pokerRevealOpacity = useRef(new Animated.Value(0)).current;
  const pokerRevealScale = useRef(new Animated.Value(0.9)).current;
  const pokerRevealTranslateY = useRef(new Animated.Value(28)).current;
  const trickWinnerOpacity = useRef(new Animated.Value(0)).current;
  const trickWinnerScale = useRef(new Animated.Value(0.92)).current;
  const trickWinnerTranslateY = useRef(new Animated.Value(24)).current;
  const buyStopOpacity = useRef(new Animated.Value(0)).current;
  const buyStopScale = useRef(new Animated.Value(0.88)).current;
  const buyStopRotate = useRef(new Animated.Value(-0.06)).current;

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const isMyTurn = room?.current_turn_player_id === playerId;
  const isBuyStopped = (myPlayer?.score ?? 0) >= BUY_STOP_SCORE;
  const myEvaluation = myHand ? evaluatePokerHand(myHand.cards) : null;
  const chicagoCaller = players.find((player) => player.chicago_declared) ?? null;
  const canDeclareChicago =
    room?.state === "trick_phase" &&
    round?.trick_number === 1 &&
    playedCards.length === 0 &&
    !players.some((player) => player.chicago_declared);
  const currentTurnPlayer = players.find((player) => player.id === room?.current_turn_player_id) ?? null;
  const trickWinnerMatch = room?.public_message?.match(/^Trick (\d+) resolved\. (.+) leads next\.$/);
  const trickWinnerName = trickWinnerMatch?.[2] ?? null;
  const translatedPublicMessage = translateChicagoPublicMessage(room?.public_message) ?? t("common.waiting_next_move");

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      setSelectedCards([]);
      await refresh();
    } catch (error) {
      Alert.alert(t("common.action_failed"), String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const selectedDiscardCards = useMemo(
    () => (myHand?.cards ?? []).filter((card) => selectedCards.includes(cardId(card))),
    [myHand?.cards, selectedCards]
  );

  useEffect(() => {
    if (!room) return;
    if (!["poker_score_1", "poker_score_2"].includes(room.state)) return;
    if (busy) return;
    const phaseKey = `${room.state}-${room.phase_number}`;
    if (scheduledPokerScoreKeyRef.current === phaseKey) return;

    scheduledPokerScoreKeyRef.current = phaseKey;
    pokerScoreTimeoutRef.current = setTimeout(() => {
      setBusy("score-phase");
      advanceChicagoPokerScore(roomId, playerId)
        .then(() => refresh())
        .catch((error) => {
          Alert.alert(t("common.action_failed"), String((error as Error)?.message ?? error));
        })
        .finally(() => {
          scheduledPokerScoreKeyRef.current = null;
          pokerScoreTimeoutRef.current = null;
          setBusy(null);
        });
    }, 1800);

    return () => {
      if (pokerScoreTimeoutRef.current) {
        clearTimeout(pokerScoreTimeoutRef.current);
        pokerScoreTimeoutRef.current = null;
        scheduledPokerScoreKeyRef.current = null;
      }
    };
  }, [busy, playerId, refresh, room?.phase_number, room?.state, roomId]);

  useEffect(() => {
    if (!room) return;
    if (["poker_score_1", "poker_score_2"].includes(room.state)) return;
    if (pokerScoreTimeoutRef.current) {
      clearTimeout(pokerScoreTimeoutRef.current);
      pokerScoreTimeoutRef.current = null;
    }
    scheduledPokerScoreKeyRef.current = null;
  }, [room]);

  useEffect(() => {
    if (!room) return;

    const previousState = previousRoomStateRef.current;
    previousRoomStateRef.current = room.state;

    const isScoringReveal =
      (previousState === "poker_score_1" && room.state === "draw_phase_2") ||
      (previousState === "poker_score_2" && room.state === "draw_phase_3");
    const modalKey = isScoringReveal ? `${room.phase_number}-${room.public_message ?? ""}` : null;

    if (!modalKey || shownPokerRevealKey === modalKey) return;

    setShownPokerRevealKey(modalKey);
    setShowPokerRevealModal(true);
    pokerRevealOpacity.setValue(0);
    pokerRevealScale.setValue(0.9);
    pokerRevealTranslateY.setValue(28);

    Animated.parallel([
      Animated.timing(pokerRevealOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(pokerRevealScale, {
        toValue: 1,
        tension: 72,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(pokerRevealTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pokerRevealOpacity, pokerRevealScale, pokerRevealTranslateY, room, shownPokerRevealKey]);

  useEffect(() => {
    if (!showPokerRevealModal) return;

    const timeoutId = setTimeout(() => {
      Animated.parallel([
        Animated.timing(pokerRevealOpacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pokerRevealScale, {
          toValue: 0.96,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pokerRevealTranslateY, {
          toValue: 14,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShowPokerRevealModal(false);
        }
      });
    }, 4300);

    return () => clearTimeout(timeoutId);
  }, [pokerRevealOpacity, pokerRevealScale, pokerRevealTranslateY, showPokerRevealModal]);

  useEffect(() => {
    if (!room) return;
    if (room.state !== "trick_phase") return;
    if (!trickWinnerMatch) return;

    const modalKey = `${room.phase_number}-${room.public_message}`;
    if (shownTrickWinnerKey === modalKey) return;

    setShownTrickWinnerKey(modalKey);
    setShowTrickWinnerModal(true);
    trickWinnerOpacity.setValue(0);
    trickWinnerScale.setValue(0.92);
    trickWinnerTranslateY.setValue(24);

    Animated.parallel([
      Animated.timing(trickWinnerOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(trickWinnerScale, {
        toValue: 1,
        tension: 72,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(trickWinnerTranslateY, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [room, shownTrickWinnerKey, trickWinnerMatch, trickWinnerOpacity, trickWinnerScale, trickWinnerTranslateY]);

  useEffect(() => {
    if (!showTrickWinnerModal) return;

    const timeoutId = setTimeout(() => {
      setShowTrickWinnerModal(false);
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [showTrickWinnerModal]);

  useEffect(() => {
    if (players.length === 0) return;

    const previousScores = previousScoresRef.current;
    let nextEvent: { title: string; message: string; tone: "warning" | "penalty" } | null = null;

    for (const player of players) {
      const previousScore = previousScores[player.id];
      if (typeof previousScore === "number" && previousScore < BUY_STOP_SCORE && player.score >= BUY_STOP_SCORE) {
        nextEvent = {
          title: t("modal.buy_stop"),
          message: t("modal.buy_stop_message", { name: player.display_name, score: BUY_STOP_SCORE }),
          tone: "warning",
        };
      }
      if (typeof previousScore === "number" && previousScore >= BUY_STOP_SCORE && player.score === 0) {
        nextEvent = {
          title: t("modal.uh_oh"),
          message: t("modal.buy_stop_penalty", { name: player.display_name }),
          tone: "penalty",
        };
      }
    }

    previousScoresRef.current = Object.fromEntries(players.map((player) => [player.id, player.score]));

    if (!nextEvent) return;

    setBuyStopEvent(nextEvent);
    buyStopOpacity.setValue(0);
    buyStopScale.setValue(0.88);
    buyStopRotate.setValue(-0.06);

    Animated.parallel([
      Animated.timing(buyStopOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(buyStopScale, {
        toValue: 1,
        tension: 78,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(buyStopRotate, {
          toValue: 0.04,
          duration: 130,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buyStopRotate, {
          toValue: -0.025,
          duration: 120,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(buyStopRotate, {
          toValue: 0,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [buyStopOpacity, buyStopRotate, buyStopScale, players, t]);

  useEffect(() => {
    if (!buyStopEvent) return;

    const timeoutId = setTimeout(() => {
      setBuyStopEvent(null);
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [buyStopEvent]);

  useEffect(() => {
    if (!isBuyStopped) return;
    if (selectedCards.length === 0) return;
    setSelectedCards([]);
  }, [isBuyStopped, selectedCards.length]);

  if (loading || !room || !myPlayer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900" }}>{t("common.loading_chicago")}</Text>
      </View>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://picklo.app";
  const inviteUrl = `${baseUrl}/chicago?code=${room.code}`;
  const copyInviteLink = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 1400);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      {showPokerRevealModal ? (
        <View
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            backgroundColor: "rgba(2,6,23,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 28,
              padding: 24,
              backgroundColor: "#0E1726",
              borderWidth: 1,
              borderColor: "rgba(125,211,252,0.32)",
              shadowColor: "#38BDF8",
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 16 },
              elevation: 18,
              alignItems: "center",
              opacity: pokerRevealOpacity,
              transform: [{ scale: pokerRevealScale }, { translateY: pokerRevealTranslateY }],
            }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(3,105,161,0.26)",
                borderWidth: 1,
                borderColor: "rgba(125,211,252,0.34)",
                marginBottom: 18,
              }}
            >
              <Text style={{ color: "#7DD3FC", fontSize: 42, fontWeight: "900" }}>H</Text>
            </View>
            <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>
              {t("modal.best_hand_revealed")}
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center", marginTop: 12 }}>
              {t("modal.poker_scoring").toUpperCase()}
            </Text>
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: 16, textAlign: "center", marginTop: 10 }}>
              {translatedPublicMessage ?? t("modal.poker_fallback")}
            </Text>
          </Animated.View>
        </View>
      ) : null}
      {showTrickWinnerModal ? (
        <View
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 19,
            backgroundColor: "rgba(2,6,23,0.48)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 390,
              borderRadius: 24,
              padding: 22,
              backgroundColor: "#0F172A",
              borderWidth: 1,
              borderColor: "rgba(125,211,252,0.28)",
              shadowColor: "#38BDF8",
              shadowOpacity: 0.24,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 12 },
              elevation: 16,
              alignItems: "center",
              opacity: trickWinnerOpacity,
              transform: [{ scale: trickWinnerScale }, { translateY: trickWinnerTranslateY }],
              gap: 8,
            }}
          >
            <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 12, letterSpacing: 1.8, textTransform: "uppercase" }}>
              {t("modal.trick_winner")}
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center" }}>
              {trickWinnerName ?? "A player"}
            </Text>
            <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 15, textAlign: "center" }}>
              {t("modal.won_this_trick").toUpperCase()}
            </Text>
          </Animated.View>
        </View>
      ) : null}
      {buyStopEvent ? (
        <View
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 21,
            backgroundColor: "rgba(2,6,23,0.58)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 28,
              paddingVertical: 26,
              paddingHorizontal: 24,
              backgroundColor: buyStopEvent.tone === "penalty" ? "#2A0F16" : "#1E1B0E",
              borderWidth: 1,
              borderColor: buyStopEvent.tone === "penalty" ? "rgba(251,113,133,0.42)" : "rgba(251,191,36,0.38)",
              shadowColor: buyStopEvent.tone === "penalty" ? "#FB7185" : "#FBBF24",
              shadowOpacity: 0.32,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 18 },
              elevation: 20,
              alignItems: "center",
              gap: 10,
              opacity: buyStopOpacity,
              transform: [{ scale: buyStopScale }, { rotate: buyStopRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-1rad", "1rad"] }) }],
            }}
          >
            <Text style={{ fontSize: 52 }}>{buyStopEvent.tone === "penalty" ? "\ud83d\udca5" : "\ud83d\uded2" }</Text>
            <Text
              style={{
                color: buyStopEvent.tone === "penalty" ? "#FDA4AF" : "#FCD34D",
                fontWeight: "900",
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {buyStopEvent.title}
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center" }}>
              {buyStopEvent.tone === "penalty" ? t("modal.no_swap_only_chaos") : t("modal.buy_stop_activated")}
            </Text>
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: 16, textAlign: "center", lineHeight: 24 }}>
              {buyStopEvent.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <AnimatedEntrance enterKey={`header-${room.state}-${room.phase_number}`}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Chicago</Text>
            <Text style={{ color: "#94A3B8" }}>{t("room.room_code", { code: room.code, round: room.current_round || 0 })}</Text>
            <Text style={{ color: "#CBD5E1" }}>{translatedPublicMessage}</Text>
          </View>
        </AnimatedEntrance>

        {room.state === "lobby" ? (
          <AnimatedEntrance enterKey="lobby-card" delay={40}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{t("room.players")}</Text>
              {players.map((player) => (
                <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{player.display_name}</Text>
                  <Text style={{ color: player.id === room.host_player_id ? "#7DD3FC" : "#64748B", fontWeight: "800" }}>
                    {player.id === room.host_player_id ? t("common.host").toUpperCase() : `${player.score} PTS`}
                  </Text>
                </View>
              ))}
              <Pressable
                onPress={copyInviteLink}
                style={({ pressed }) => ({
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#111827",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("common.copy_invite_link").toUpperCase()}</Text>
              </Pressable>
              {showCopiedToast ? <CopyToast visible={showCopiedToast} /> : null}
              {isHost ? (
                <Pressable
                  onPress={() => run("start-round", () => startChicagoRound(roomId, playerId))}
                  disabled={busy === "start-round" || players.length < 2}
                  style={({ pressed }) => ({
                    height: 54,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0369A1",
                    opacity: busy === "start-round" || players.length < 2 ? 0.5 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("room.deal_round").toUpperCase()}</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>{t("room.wait_host_start")}</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {myHand && room.state !== "trick_phase" && room.state !== "result" ? (
          <AnimatedEntrance enterKey={`hand-${room.phase_number}`} delay={60}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{t("room.your_hand")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {myHand.cards.map((card) => {
                  const selected = selectedCards.includes(cardId(card));
                  return (
                    <PlayingCard
                      key={cardId(card)}
                      card={card}
                      selected={selected}
                      onPress={
                        (room.state === "draw_phase_1" || room.state === "draw_phase_2" || room.state === "draw_phase_3") && !isBuyStopped
                          ? () =>
                              setSelectedCards((current) =>
                                current.includes(cardId(card)) ? current.filter((id) => id !== cardId(card)) : [...current, cardId(card)]
                              )
                          : undefined
                      }
                    />
                  );
                })}
              </View>
              {myEvaluation ? (
                <Text style={{ color: "#94A3B8" }}>
                  {t("room.current_read")} <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>{translatePokerName(myEvaluation.name).toUpperCase()}</Text>
                </Text>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "draw_phase_1" || room.state === "draw_phase_2" || room.state === "draw_phase_3" ? (
          <AnimatedEntrance enterKey={`draw-${room.state}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{t("room.draw_cards").toUpperCase()}</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                {t("room.draw_help")}
              </Text>
              {isBuyStopped ? (
                <View
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: "rgba(251,191,36,0.14)",
                    borderWidth: 1,
                    borderColor: "rgba(251,191,36,0.34)",
                    gap: 4,
                  }}
                >
                  <Text style={{ color: "#FCD34D", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>{t("room.buy_stop_active")}</Text>
                  <Text style={{ color: "#F8FAFC", lineHeight: 21 }}>
                    {t("room.buy_stop_body", { score: BUY_STOP_SCORE })}
                  </Text>
                </View>
              ) : null}
              {myPlayer.draw_ready ? (
                <View
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: "rgba(125,211,252,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(125,211,252,0.3)",
                    gap: 4,
                  }}
                >
                  <Text style={{ color: "#7DD3FC", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>
                    {t("room.decision_locked")}
                  </Text>
                  <Text style={{ color: "#E2E8F0", lineHeight: 21 }}>
                    {selectedDiscardCards.length > 0
                      ? t("room.exchange_waiting", { count: selectedDiscardCards.length, cards: selectedDiscardCards.length === 1 ? "card" : "cards" })
                      : t("room.waiting_table")}
                  </Text>
                </View>
              ) : null}
              {selectedDiscardCards.length === 0 ? (
                <Text style={{ color: "#7DD3FC", fontWeight: "800" }}>
                  {t("room.no_cards_selected")}
                </Text>
              ) : null}
              <Pressable
                onPress={() => run("submit-draw", () => submitChicagoDraw(roomId, playerId, selectedDiscardCards))}
                disabled={busy === "submit-draw" || !myHand || myPlayer.draw_ready}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#0369A1",
                  opacity: busy === "submit-draw" || myPlayer.draw_ready ? 0.6 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>
                  {myPlayer.draw_ready
                    ? t("room.exchange_submitted").toUpperCase()
                    : isBuyStopped
                      ? t("room.buy_stop_keep").toUpperCase()
                    : selectedDiscardCards.length === 0
                      ? t("room.keep_current").toUpperCase()
                      : t("room.exchange_cards", { count: selectedDiscardCards.length, cards_upper: selectedDiscardCards.length === 1 ? "CARD" : "CARDS" }).toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "poker_score_1" || room.state === "poker_score_2" ? (
          <AnimatedEntrance enterKey={`score-${room.state}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{t("room.best_hand_scoring").toUpperCase()}</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                {t("room.best_hand_body")}
              </Text>
              <Text style={{ color: "#7DD3FC", fontWeight: "800" }}>
                {t("room.best_hand_wait")}
              </Text>
              <View
                style={{
                  minHeight: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#111827",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>
                  {t("room.revealing_best_hand").toUpperCase()}
                </Text>
              </View>
              <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
                {t("room.best_hand_hint")}
              </Text>
              <Pressable
                onPress={() => run("score-phase", () => advanceChicagoPokerScore(roomId, playerId))}
                disabled={busy === "score-phase"}
                style={({ pressed }) => ({
                  height: 48,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#0B1220",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  opacity: busy === "score-phase" ? 0.6 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "#E2E8F0", fontWeight: "900", textTransform: "uppercase" }}>{t("room.reveal_now").toUpperCase()}</Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "trick_phase" ? (
          <AnimatedEntrance enterKey={`tricks-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{t("room.trick_phase").toUpperCase()}</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                {t("room.trick_body")}
              </Text>
              <View
                style={{
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: isMyTurn ? "rgba(56,189,248,0.14)" : "rgba(148,163,184,0.1)",
                  borderWidth: 1,
                  borderColor: isMyTurn ? "rgba(125,211,252,0.34)" : "rgba(148,163,184,0.2)",
                  gap: 4,
                }}
              >
                <Text style={{ color: isMyTurn ? "#7DD3FC" : "#CBD5E1", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>
                  {isMyTurn ? t("room.your_turn") : t("room.waiting")}
                </Text>
                <Text style={{ color: "#F8FAFC", fontWeight: "800", lineHeight: 22 }}>
                  {isMyTurn
                    ? t("room.your_turn_body")
                    : t("room.waiting_body", { name: currentTurnPlayer?.display_name ?? t("common.player") })}
                </Text>
              </View>
              {canDeclareChicago ? (
                <View
                  style={{
                    borderRadius: 18,
                    padding: 14,
                    backgroundColor: "rgba(124,45,18,0.2)",
                    borderWidth: 1,
                    borderColor: "rgba(251,146,60,0.3)",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: "#FDBA74", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>{t("room.chicago_open")}</Text>
                  <Text style={{ color: "#F8FAFC", lineHeight: 21 }}>
                    {t("room.chicago_open_body")}
                  </Text>
                  <Pressable
                    onPress={() => run("declare-chicago", () => declareChicago(roomId, playerId))}
                    disabled={busy === "declare-chicago"}
                    style={({ pressed }) => ({
                      minHeight: 52,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#7C2D12",
                      borderWidth: 1,
                      borderColor: "rgba(251,146,60,0.26)",
                      opacity: busy === "declare-chicago" ? 0.6 : pressed ? 0.92 : 1,
                    })}
                  >
                    <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>
                      {t("room.call_chicago").toUpperCase()}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {chicagoCaller ? (
                <View
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    backgroundColor: "rgba(124,45,18,0.18)",
                    borderWidth: 1,
                    borderColor: "rgba(251,146,60,0.28)",
                    gap: 4,
                  }}
                >
                  <Text style={{ color: "#FDBA74", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>{t("room.chicago_claimed")}</Text>
                  <Text style={{ color: "#E2E8F0", lineHeight: 21 }}>
                    {t("room.chicago_claimed_body", { name: chicagoCaller.display_name })}
                  </Text>
                </View>
              ) : null}
              <View style={{ gap: 8 }}>
                <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>{t("room.current_trick")}</Text>
                {playedCards.length === 0 ? <Text style={{ color: "#94A3B8" }}>{t("room.no_cards_played")}</Text> : null}
                {playedCards.map((entry) => {
                  const player = players.find((candidate) => candidate.id === entry.player_id);
                  return (
                    <View key={`${entry.trick_id}-${entry.player_id}`} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "white", fontWeight: "800", flex: 1 }}>{player?.display_name ?? t("common.player")}</Text>
                      <PlayingCard card={entry.card} compact />
                    </View>
                  );
                })}
              </View>
              <View
                style={{
                  gap: 10,
                  borderRadius: 20,
                  padding: 14,
                  backgroundColor: isMyTurn ? "rgba(2,132,199,0.12)" : "rgba(15,23,42,0.82)",
                  borderWidth: 1,
                  borderColor: isMyTurn ? "rgba(125,211,252,0.34)" : "#243041",
                  shadowColor: isMyTurn ? "#38BDF8" : "#020617",
                  shadowOpacity: isMyTurn ? 0.18 : 0.08,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: isMyTurn ? 8 : 4,
                }}
              >
                <Text style={{ color: isMyTurn ? "#7DD3FC" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>
                  {isMyTurn ? t("room.use_these_cards") : t("room.cards_standby")}
                </Text>
                <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>
                  {isMyTurn ? t("room.tap_card") : t("room.cards_standby_title")}
                </Text>
                <Text style={{ color: isMyTurn ? "#CFFAFE" : "#CBD5E1", lineHeight: 21 }}>
                  {isMyTurn
                    ? t("room.use_cards_body")
                    : t("room.cards_standby_body")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {(myHand?.cards ?? []).map((card) => (
                    <PlayingCard
                      key={`play-${cardId(card)}`}
                      card={card}
                      compact
                      onPress={isMyTurn ? () => run(`play-${cardId(card)}`, () => playChicagoCard(roomId, playerId, card)) : undefined}
                    />
                  ))}
                </View>
              </View>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "result" ? (
          <AnimatedEntrance enterKey={`result-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{t("room.round_result").toUpperCase()}</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{translatedPublicMessage}</Text>
              {isHost ? (
                <Pressable
                  onPress={() => run("next-round", () => startChicagoRound(roomId, playerId))}
                  disabled={busy === "next-round"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0369A1",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("room.deal_next_round").toUpperCase()}</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>{t("room.wait_host_next")}</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "game_over" ? (
          <AnimatedEntrance enterKey={`game-over-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{t("room.game_over")}</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{translatedPublicMessage}</Text>
              <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 18 }}>
                {t("room.winner")} {players.find((player) => player.id === room.winner_player_id)?.display_name ?? t("common.unknown")}
              </Text>
            </View>
          </AnimatedEntrance>
        ) : null}

        <AnimatedEntrance enterKey={`scores-${players.length}`} delay={100}>
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{t("room.scoreboard")}</Text>
            {players.map((player) => (
              <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{player.display_name}</Text>
                  <Text style={{ color: "#64748B" }}>
                    {player.score >= BUY_STOP_SCORE ? t("room.buy_stop_row", { score: BUY_STOP_SCORE }) : player.id === room.host_player_id ? t("common.host") : t("room.seat", { seat: player.seat_order })}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {player.score >= BUY_STOP_SCORE ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(251,191,36,0.16)", borderWidth: 1, borderColor: "rgba(251,191,36,0.3)" }}>
                      <Text style={{ color: "#FCD34D", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{t("room.no_swaps")}</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 18 }}>{player.score}</Text>
                </View>
              </View>
            ))}
          </View>
        </AnimatedEntrance>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            height: 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("common.back_to_games").toUpperCase()}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
