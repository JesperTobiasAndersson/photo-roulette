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
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showPokerRevealModal, setShowPokerRevealModal] = useState(false);
  const [shownPokerRevealKey, setShownPokerRevealKey] = useState<string | null>(null);
  const [scheduledPokerScoreKey, setScheduledPokerScoreKey] = useState<string | null>(null);
  const [showTrickWinnerModal, setShowTrickWinnerModal] = useState(false);
  const [shownTrickWinnerKey, setShownTrickWinnerKey] = useState<string | null>(null);
  const { room, players, myPlayer, myHand, playedCards, loading, refresh } = useChicagoRoom(roomId, playerId);
  const previousRoomStateRef = useRef<string | null>(null);
  const pokerRevealOpacity = useRef(new Animated.Value(0)).current;
  const pokerRevealScale = useRef(new Animated.Value(0.9)).current;
  const pokerRevealTranslateY = useRef(new Animated.Value(28)).current;
  const trickWinnerOpacity = useRef(new Animated.Value(0)).current;
  const trickWinnerScale = useRef(new Animated.Value(0.92)).current;
  const trickWinnerTranslateY = useRef(new Animated.Value(24)).current;

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const isMyTurn = room?.current_turn_player_id === playerId;
  const myEvaluation = myHand ? evaluatePokerHand(myHand.cards) : null;
  const chicagoCaller = players.find((player) => player.chicago_declared) ?? null;
  const canDeclareChicago = room?.state === "trick_phase" && !players.some((player) => player.chicago_declared);
  const trickWinnerMatch = room?.public_message?.match(/^Trick (\d+) resolved\. (.+) leads next\.$/);
  const trickWinnerName = trickWinnerMatch?.[2] ?? null;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      setSelectedCards([]);
      await refresh();
    } catch (error) {
      Alert.alert("Action failed", String((error as Error)?.message ?? error));
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
    if (scheduledPokerScoreKey === phaseKey) return;

    setScheduledPokerScoreKey(phaseKey);
    const timeoutId = setTimeout(() => {
      setBusy("score-phase");
      advanceChicagoPokerScore(roomId, playerId)
        .then(() => refresh())
        .catch((error) => {
          Alert.alert("Action failed", String((error as Error)?.message ?? error));
        })
        .finally(() => {
          setScheduledPokerScoreKey(null);
          setBusy(null);
        });
    }, 1800);

    return () => clearTimeout(timeoutId);
  }, [busy, playerId, refresh, room, roomId, scheduledPokerScoreKey]);

  useEffect(() => {
    if (!room) return;
    if (["poker_score_1", "poker_score_2"].includes(room.state)) return;
    setScheduledPokerScoreKey(null);
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
      setShowPokerRevealModal(false);
    }, 4300);

    return () => clearTimeout(timeoutId);
  }, [showPokerRevealModal]);

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

  if (loading || !room || !myPlayer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900" }}>Loading Chicago</Text>
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
              Best hand revealed
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center", marginTop: 12 }}>
              POKER SCORING
            </Text>
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: 16, textAlign: "center", marginTop: 10 }}>
              {room.public_message ?? "The table is revealing the winning hand."}
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
              Trick winner
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center" }}>
              {trickWinnerName ?? "A player"}
            </Text>
            <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 15, textAlign: "center" }}>
              WON THIS TRICK
            </Text>
          </Animated.View>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <AnimatedEntrance enterKey={`header-${room.state}-${room.phase_number}`}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Chicago</Text>
            <Text style={{ color: "#94A3B8" }}>Room {room.code} - Round {room.current_round || 0}</Text>
            <Text style={{ color: "#CBD5E1" }}>{room.public_message ?? "Waiting for the next move."}</Text>
          </View>
        </AnimatedEntrance>

        {room.state === "lobby" ? (
          <AnimatedEntrance enterKey="lobby-card" delay={40}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Players</Text>
              {players.map((player) => (
                <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{player.display_name}</Text>
                  <Text style={{ color: player.id === room.host_player_id ? "#7DD3FC" : "#64748B", fontWeight: "800" }}>
                    {player.id === room.host_player_id ? "HOST" : `${player.score} PTS`}
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
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>COPY INVITE LINK</Text>
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
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>DEAL ROUND</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to start the round.</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {myHand ? (
          <AnimatedEntrance enterKey={`hand-${room.phase_number}`} delay={60}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Your hand</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {myHand.cards.map((card) => {
                  const selected = selectedCards.includes(cardId(card));
                  return (
                    <PlayingCard
                      key={cardId(card)}
                      card={card}
                      selected={selected}
                      onPress={
                        room.state === "draw_phase_1" || room.state === "draw_phase_2" || room.state === "draw_phase_3"
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
                  Current read: <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>{myEvaluation.label.toUpperCase()}</Text>
                </Text>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "draw_phase_1" || room.state === "draw_phase_2" || room.state === "draw_phase_3" ? (
          <AnimatedEntrance enterKey={`draw-${room.state}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>DRAW CARDS</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Select 0-5 cards to exchange, then submit your draw. Everyone draws at the same time.
              </Text>
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
                    Decision locked in
                  </Text>
                  <Text style={{ color: "#E2E8F0", lineHeight: 21 }}>
                    {selectedDiscardCards.length > 0
                      ? `You chose to exchange ${selectedDiscardCards.length} card${selectedDiscardCards.length === 1 ? "" : "s"}.`
                      : "You chose to keep your current hand."} Waiting for the rest of the table.
                  </Text>
                </View>
              ) : null}
              {selectedDiscardCards.length === 0 ? (
                <Text style={{ color: "#7DD3FC", fontWeight: "800" }}>
                  No cards selected means you will keep your current hand and continue.
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
                    ? "EXCHANGE SUBMITTED"
                    : selectedDiscardCards.length === 0
                      ? "KEEP CURRENT HAND"
                      : `EXCHANGE ${selectedDiscardCards.length} CARD${selectedDiscardCards.length === 1 ? "" : "S"}`}
                </Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "poker_score_1" || room.state === "poker_score_2" ? (
          <AnimatedEntrance enterKey={`score-${room.state}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>BEST HAND SCORING</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                The table is scoring automatically. A reveal will appear as soon as the best hand is confirmed.
              </Text>
              <Text style={{ color: "#7DD3FC", fontWeight: "800" }}>
                Giving everyone a quick moment to settle before the winning hand is revealed.
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
                  REVEALING BEST HAND...
                </Text>
              </View>
              <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
                Any open player screen can trigger this automatically, so the round should keep moving even if one client misses the timing.
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
                <Text style={{ color: "#E2E8F0", fontWeight: "900", textTransform: "uppercase" }}>REVEAL BEST HAND NOW</Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "trick_phase" ? (
          <AnimatedEntrance enterKey={`tricks-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>TRICK PHASE</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Only the last trick matters for normal scoring. Any player can press CHICAGO once per round. The first player to claim it must win every trick or they lose 15 points.
              </Text>
              <Text style={{ color: isMyTurn ? "#7DD3FC" : "#94A3B8" }}>
                {isMyTurn ? "It is your turn to play." : "Wait for the current player."}
              </Text>
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
                  <Text style={{ color: "#FDBA74", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>Chicago claimed</Text>
                  <Text style={{ color: "#E2E8F0", lineHeight: 21 }}>
                    {chicagoCaller.display_name} has CHICAGO. They must win every trick in this round or lose 15 points.
                  </Text>
                </View>
              ) : null}
              {canDeclareChicago ? (
                <Pressable
                  onPress={() => run("declare-chicago", () => declareChicago(roomId, playerId))}
                  disabled={busy === "declare-chicago"}
                  style={({ pressed }) => ({
                    height: 50,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#7C2D12",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>CHICAGO</Text>
                </Pressable>
              ) : null}
              <View style={{ gap: 8 }}>
                <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>Current trick</Text>
                {playedCards.length === 0 ? <Text style={{ color: "#94A3B8" }}>No cards played yet.</Text> : null}
                {playedCards.map((entry) => {
                  const player = players.find((candidate) => candidate.id === entry.player_id);
                  return (
                    <View key={`${entry.trick_id}-${entry.player_id}`} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: "white", fontWeight: "800", flex: 1 }}>{player?.display_name ?? "Player"}</Text>
                      <PlayingCard card={entry.card} compact />
                    </View>
                  );
                })}
              </View>
              {isMyTurn ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>Play a card</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {(myHand?.cards ?? []).map((card) => (
                      <PlayingCard
                        key={`play-${cardId(card)}`}
                        card={card}
                        compact
                        onPress={() => run(`play-${cardId(card)}`, () => playChicagoCard(roomId, playerId, card))}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "result" ? (
          <AnimatedEntrance enterKey={`result-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Round result</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
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
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>DEAL NEXT ROUND</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to deal the next round.</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "game_over" ? (
          <AnimatedEntrance enterKey={`game-over-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Game over</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
              <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 18 }}>
                Winner: {players.find((player) => player.id === room.winner_player_id)?.display_name ?? "Unknown"}
              </Text>
            </View>
          </AnimatedEntrance>
        ) : null}

        <AnimatedEntrance enterKey={`scores-${players.length}`} delay={100}>
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Scoreboard</Text>
            {players.map((player) => (
              <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{player.display_name}</Text>
                  <Text style={{ color: "#64748B" }}>{player.id === room.host_player_id ? "Host" : `Seat ${player.seat_order}`}</Text>
                </View>
                <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 18 }}>{player.score}</Text>
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
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>BACK TO GAMES</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
