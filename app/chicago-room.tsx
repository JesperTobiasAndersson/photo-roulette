import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
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
  const width = compact ? 68 : 76;
  const height = compact ? 94 : 112;
  const rankSize = compact ? 19 : 22;
  const pipSize = compact ? 24 : 30;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        width,
        height,
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 7,
        justifyContent: "space-between",
        backgroundColor: "#FFFEFB",
        borderWidth: selected ? 3 : 1.5,
        borderColor: selected ? "#0EA5E9" : "#D4D4D8",
        boxShadow: selected ? "0px 10px 18px rgba(0,0,0,0.22)" : "0px 6px 12px rgba(0,0,0,0.14)",
        elevation: selected ? 8 : 4,
        transform: [{ translateY: selected ? -6 : pressed ? -2 : 0 }],
        opacity: pressed ? 0.95 : 1,
      })}
    >
      <View style={{ alignSelf: "flex-start", alignItems: "center", minWidth: 18 }}>
        <Text style={{ color: suitColor, fontSize: rankSize, fontWeight: "900", lineHeight: rankSize + 2 }}>{card.rank}</Text>
        <Text style={{ color: suitColor, fontSize: compact ? 14 : 16, fontWeight: "800", lineHeight: compact ? 16 : 18 }}>{suitSymbol}</Text>
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        <Text style={{ color: suitColor, fontSize: pipSize, fontWeight: "700" }}>{suitSymbol}</Text>
      </View>

      <View style={{ alignSelf: "flex-end", alignItems: "center", minWidth: 18, transform: [{ rotate: "180deg" }] }}>
        <Text style={{ color: suitColor, fontSize: rankSize, fontWeight: "900", lineHeight: rankSize + 2 }}>{card.rank}</Text>
        <Text style={{ color: suitColor, fontSize: compact ? 14 : 16, fontWeight: "800", lineHeight: compact ? 16 : 18 }}>{suitSymbol}</Text>
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
  const { room, players, myPlayer, myHand, playedCards, loading, refresh } = useChicagoRoom(roomId, playerId);

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const isMyTurn = room?.current_turn_player_id === playerId;
  const myEvaluation = myHand ? evaluatePokerHand(myHand.cards) : null;
  const canDeclareChicago = (myPlayer?.score ?? 0) >= 15 && !(myPlayer?.chicago_declared ?? false) && room?.state === "trick_phase";

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

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
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
                onPress={() => Clipboard.setStringAsync(inviteUrl)}
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
                <Text style={{ color: "white", fontWeight: "900" }}>Copy invite link</Text>
              </Pressable>
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Deal round</Text>
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
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Draw cards</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Select 0-5 cards to exchange, then submit your draw. Everyone draws at the same time.
              </Text>
              <Pressable
                onPress={() => run("submit-draw", () => submitChicagoDraw(roomId, playerId, selectedDiscardCards))}
                disabled={busy === "submit-draw" || !myHand}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#0369A1",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Exchange {selectedDiscardCards.length} card{selectedDiscardCards.length === 1 ? "" : "s"}</Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "poker_score_1" || room.state === "poker_score_2" ? (
          <AnimatedEntrance enterKey={`score-${room.state}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Best hand scoring</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Declare your hand in table order. The best poker hand this phase gets the points.
              </Text>
              {isHost ? (
                <Pressable
                  onPress={() => run("score-phase", () => advanceChicagoPokerScore(roomId, playerId))}
                  disabled={busy === "score-phase"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0369A1",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Score best hand</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to score the phase.</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "trick_phase" ? (
          <AnimatedEntrance enterKey={`tricks-${room.phase_number}`} delay={80}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Trick phase</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Only the last trick matters for normal scoring. If you have at least 15 points, you can call CHICAGO and try to take all 5 tricks.
              </Text>
              <Text style={{ color: isMyTurn ? "#7DD3FC" : "#94A3B8" }}>
                {isMyTurn ? "It is your turn to play." : "Wait for the current player."}
              </Text>
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Declare Chicago</Text>
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Deal next round</Text>
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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to games</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
