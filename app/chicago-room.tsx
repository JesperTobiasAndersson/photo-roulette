import React, { useEffect, useRef, useMemo, useState } from "react";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { ShareButton } from "../src/components/ShareButton";
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
import { GAMES } from "../src/games/catalog";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { Button, Card, Chip, RoomCodeBadge, Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, gameAccents, radius, space, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const BUY_STOP_SCORE = 46;
const WIN_SCORE = 52;
const ACCENT = gameAccents.chicago;
const CHICAGO_COLOR = colors.warning;
const RED_SUIT = "#FB7185";

const COPY = {
  en: {
    leaveTitle: "Leave the game?",
    leaveBody: "You will drop out of this Chicago game and the table may get stuck without you.",
    leaveConfirm: "Leave",
    cancel: "Cancel",
    declareTitle: "Call CHICAGO?",
    declareBody: "You must win every trick this round. If you lose a single trick you lose 15 points.",
    declareConfirm: "Call Chicago",
    playCard: "Play {card}",
    pickCard: "Tap a card to play",
    waitingFor: "Waiting for {name}…",
    raceTo: "First to {score}",
    turn: "Turn",
    needPlayers: "At least 2 players are needed to deal.",
    selected: "{count} selected",
    tapToSwap: "Tap the cards you want to swap",
    shareMessage: "Join my Chicago game on Picklo! Room code {code}",
    waitingDraws: "Waiting for the rest of the table…",
  },
  sv: {
    leaveTitle: "Lämna spelet?",
    leaveBody: "Du lämnar det här Chicago-spelet och bordet kan fastna utan dig.",
    leaveConfirm: "Lämna",
    cancel: "Avbryt",
    declareTitle: "Ropa CHICAGO?",
    declareBody: "Du måste vinna varje stick den här rundan. Förlorar du ett enda stick förlorar du 15 poäng.",
    declareConfirm: "Ropa Chicago",
    playCard: "Spela {card}",
    pickCard: "Tryck på ett kort för att spela",
    waitingFor: "Väntar på {name}…",
    raceTo: "Först till {score}",
    turn: "Tur",
    needPlayers: "Minst 2 spelare behövs för att dela ut.",
    selected: "{count} valda",
    tapToSwap: "Tryck på korten du vill byta",
    shareMessage: "Häng med i mitt Chicago-spel på Picklo! Rumskod {code}",
    waitingDraws: "Väntar på resten av bordet…",
  },
} as const;

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getSuitSymbol(suit: ChicagoSuit): string {
  switch (suit) {
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
    case "spades":
      return "♠";
    default:
      return "";
  }
}

function getSuitColor(suit: ChicagoSuit): string {
  return suit === "hearts" || suit === "diamonds" ? RED_SUIT : colors.text;
}

function cardLabel(card: ChicagoCard) {
  return `${card.rank}${getSuitSymbol(card.suit)}`;
}

/**
 * Dark-faced playing card. "hand" cards share the row width (five always fit a 360px phone);
 * "mini" cards are used for the cards on the table.
 */
function PlayingCard({
  card,
  selected = false,
  size = "hand",
  dimmed = false,
  onPress,
}: {
  card: ChicagoCard;
  selected?: boolean;
  size?: "hand" | "mini";
  dimmed?: boolean;
  onPress?: () => void;
}) {
  const suitColor = getSuitColor(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);
  const mini = size === "mini";
  const rankSize = mini ? 17 : 22;
  const cornerSuitSize = mini ? 13 : 16;
  const pipSize = mini ? 22 : 26;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityLabel={`${card.rank} ${card.suit}`}
      style={({ pressed }) => ({
        ...(mini ? { width: 52, height: 72 } : { flex: 1, maxWidth: 84, aspectRatio: 5 / 7 }),
        borderRadius: mini ? radius.sm - 2 : radius.sm,
        paddingHorizontal: mini ? 5 : 6,
        paddingVertical: mini ? 4 : 6,
        backgroundColor: selected ? withAlpha(ACCENT, 0.2) : colors.surfaceRaised,
        borderWidth: selected ? 2.5 : 1.5,
        borderColor: selected ? ACCENT : onPress ? colors.borderStrong : colors.border,
        opacity: dimmed ? 0.55 : 1,
        transform: [{ translateY: selected ? -12 : pressed ? -3 : 0 }],
        overflow: "hidden",
      })}
    >
      <View style={{ alignSelf: "flex-start", alignItems: "center", minWidth: 16 }}>
        <Text style={{ color: suitColor, fontSize: rankSize, fontWeight: "900", lineHeight: rankSize + 2 }}>{card.rank}</Text>
        <Text style={{ color: suitColor, fontSize: cornerSuitSize, fontWeight: "900", lineHeight: cornerSuitSize + 1 }}>{suitSymbol}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: suitColor, fontSize: pipSize, lineHeight: pipSize + 2 }}>{suitSymbol}</Text>
      </View>
      {selected && !mini ? (
        <View
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: ACCENT,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" size={13} color={colors.bg} />
        </View>
      ) : null}
    </Pressable>
  );
}

function HandRow({ children }: { children: React.ReactNode }) {
  // Top padding leaves room for selected cards to lift without being clipped.
  return <View style={{ flexDirection: "row", gap: 6, paddingTop: 14, justifyContent: "center" }}>{children}</View>;
}

function Notice({ color, title, body }: { color: string; title: string; body: string }) {
  return (
    <View
      style={{
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        backgroundColor: withAlpha(color, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(color, 0.35),
        gap: 4,
      }}
    >
      <Text style={[type.caption, { color, textTransform: "uppercase" }]}>{title}</Text>
      <Text style={[type.small, { color: colors.text }]}>{body}</Text>
    </View>
  );
}

function WaitingLine({ label }: { label: string }) {
  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }}>
      <ActivityIndicator color={colors.textMuted} size="small" />
      <Text style={[type.small, { color: colors.textSecondary, flexShrink: 1, textAlign: "center" }]}>{label}</Text>
    </View>
  );
}

function ModalShell({ children, zIndex, dim = 0.72 }: { children: React.ReactNode; zIndex: number; dim?: number }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex,
        backgroundColor: `rgba(4,8,18,${dim})`,
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
      }}
    >
      {children}
    </View>
  );
}

export default function ChicagoRoomScreen() {
  const { t, language, translateChicagoPublicMessage, translatePokerName } = useI18n();
  const copy = COPY[language === "sv" ? "sv" : "en"];
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedPlayCard, setSelectedPlayCard] = useState<string | null>(null);
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
      setSelectedPlayCard(null);
      await refresh();
    } catch (error) {
      showAlert(t("common.action_failed"), String((error as Error)?.message ?? error));
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
          showAlert(t("common.action_failed"), String((error as Error)?.message ?? error));
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

  const myHandIds = (myHand?.cards ?? []).map((card) => cardId(card)).join(",");
  useEffect(() => {
    // Drop a pending "play" selection once it is no longer our turn or the card left the hand.
    if (!selectedPlayCard) return;
    if (room?.state !== "trick_phase" || !isMyTurn || !myHandIds.split(",").includes(selectedPlayCard)) {
      setSelectedPlayCard(null);
    }
  }, [isMyTurn, myHandIds, room?.state, selectedPlayCard]);

  const leaveGame = async () => {
    const midGame = !!room && room.state !== "lobby" && room.state !== "game_over";
    if (midGame) {
      const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, {
        confirmLabel: copy.leaveConfirm,
        cancelLabel: copy.cancel,
        destructive: true,
      });
      if (!ok) return;
    }
    router.replace(GAMES.chicago.href as any);
  };

  const topBar = <TopBar title="Chicago" onBack={leaveGame} />;

  if (loading || !room || !myPlayer) {
    return (
      <Screen topBar={topBar} centered>
        <View style={{ alignItems: "center", gap: space.lg }}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[type.heading, { color: colors.text }]}>{t("common.loading_chicago")}</Text>
        </View>
      </Screen>
    );
  }

  const baseUrl = SITE_URL;
  const inviteUrl = `${baseUrl}/chicago?code=${room.code}`;

  const isDrawPhase = room.state === "draw_phase_1" || room.state === "draw_phase_2" || room.state === "draw_phase_3";
  const isPokerScore = room.state === "poker_score_1" || room.state === "poker_score_2";
  const cardsWord = (count: number) => (language === "sv" ? "kort" : count === 1 ? "card" : "cards");
  const playCard = (myHand?.cards ?? []).find((card) => cardId(card) === selectedPlayCard) ?? null;

  const declare = async () => {
    const ok = await confirmAction(copy.declareTitle, copy.declareBody, {
      confirmLabel: copy.declareConfirm,
      cancelLabel: copy.cancel,
      destructive: true,
    });
    if (!ok) return;
    await run("declare-chicago", () => declareChicago(roomId, playerId));
  };

  // -------------------------------------------------------------------------
  // Sticky footer: the phase's main action.
  // -------------------------------------------------------------------------
  let footer: React.ReactNode = null;
  if (room.state === "lobby") {
    footer = isHost ? (
      <>
        {players.length < 2 ? (
          <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.needPlayers}</Text>
        ) : null}
        <Button
          label={t("room.deal_round")}
          icon="play"
          accent={ACCENT}
          loading={busy === "start-round"}
          disabled={players.length < 2}
          onPress={() => run("start-round", () => startChicagoRound(roomId, playerId))}
        />
      </>
    ) : (
      <WaitingLine label={t("room.wait_host_start")} />
    );
  } else if (isDrawPhase) {
    footer = (
      <Button
        label={
          myPlayer.draw_ready
            ? t("room.exchange_submitted")
            : isBuyStopped
              ? t("room.buy_stop_keep")
              : selectedDiscardCards.length === 0
                ? t("room.keep_current")
                : t("room.exchange_cards", {
                    count: selectedDiscardCards.length,
                    cards_upper: cardsWord(selectedDiscardCards.length),
                  })
        }
        icon={myPlayer.draw_ready ? "checkmark-circle" : selectedDiscardCards.length > 0 ? "swap-horizontal" : "hand-left"}
        accent={ACCENT}
        variant={selectedDiscardCards.length > 0 || myPlayer.draw_ready ? "primary" : "secondary"}
        loading={busy === "submit-draw"}
        disabled={!myHand || myPlayer.draw_ready}
        onPress={() => run("submit-draw", () => submitChicagoDraw(roomId, playerId, selectedDiscardCards))}
      />
    );
  } else if (isPokerScore) {
    footer = (
      <Button
        label={t("room.reveal_now")}
        icon="eye"
        variant="secondary"
        loading={busy === "score-phase"}
        onPress={() => run("score-phase", () => advanceChicagoPokerScore(roomId, playerId))}
      />
    );
  } else if (room.state === "trick_phase") {
    footer = (
      <>
        {canDeclareChicago ? (
          <Button
            label={t("room.call_chicago")}
            icon="flame"
            accent={CHICAGO_COLOR}
            size="md"
            loading={busy === "declare-chicago"}
            onPress={declare}
          />
        ) : null}
        {isMyTurn ? (
          <Button
            label={playCard ? fill(copy.playCard, { card: cardLabel(playCard) }) : copy.pickCard}
            icon="arrow-up-circle"
            accent={ACCENT}
            loading={!!busy && busy.startsWith("play-")}
            disabled={!playCard}
            onPress={() => {
              if (!playCard) return;
              run(`play-${cardId(playCard)}`, () => playChicagoCard(roomId, playerId, playCard));
            }}
          />
        ) : (
          <WaitingLine label={fill(copy.waitingFor, { name: currentTurnPlayer?.display_name ?? t("common.player") })} />
        )}
      </>
    );
  } else if (room.state === "result") {
    footer = isHost ? (
      <Button
        label={t("room.deal_next_round")}
        icon="play"
        accent={ACCENT}
        loading={busy === "next-round"}
        onPress={() => run("next-round", () => startChicagoRound(roomId, playerId))}
      />
    ) : (
      <WaitingLine label={t("room.wait_host_next")} />
    );
  } else if (room.state === "game_over") {
    footer = (
      <Button
        label={t("common.play_again")}
        icon="refresh"
        accent={ACCENT}
        onPress={() => router.replace(GAMES.chicago.href as any)}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Scoreboard: one compact row per player, race to 52.
  // -------------------------------------------------------------------------
  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel right={<Text style={[type.caption, { color: colors.textSubtle }]}>{fill(copy.raceTo, { score: WIN_SCORE })}</Text>}>
        {t("room.scoreboard")}
      </SectionLabel>
      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: "hidden",
        }}
      >
        {players.map((player, index) => {
          const isTurn = room.state === "trick_phase" && player.id === room.current_turn_player_id;
          const isMe = player.id === playerId;
          const buyStop = player.score >= BUY_STOP_SCORE;
          const progress = Math.max(0, Math.min(1, player.score / WIN_SCORE));
          const barColor = room.winner_player_id === player.id ? colors.success : buyStop ? colors.warning : ACCENT;
          return (
            <View
              key={player.id}
              style={{
                paddingHorizontal: space.md,
                paddingVertical: 10,
                gap: 6,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: isTurn ? withAlpha(ACCENT, 0.12) : "transparent",
                borderLeftWidth: 3,
                borderLeftColor: isTurn ? ACCENT : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                {isTurn ? <Ionicons name="caret-forward" size={14} color={ACCENT} /> : null}
                <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
                  {player.display_name}
                </Text>
                {isMe ? <Text style={[type.caption, { color: ACCENT }]}>{t("common.you").toUpperCase()}</Text> : null}
                {player.id === room.host_player_id ? (
                  <Ionicons name="star" size={12} color={colors.textMuted} accessibilityLabel={t("common.host")} />
                ) : null}
                {player.chicago_declared ? <Ionicons name="flame" size={14} color={CHICAGO_COLOR} /> : null}
                <View style={{ flex: 1 }} />
                {buyStop ? <Chip label={t("room.no_swaps")} color={colors.warning} /> : null}
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", minWidth: 28, textAlign: "right" }}>
                  {player.score}
                </Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.sunken, overflow: "hidden" }}>
                <View style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 2, backgroundColor: barColor }} />
                <View
                  style={{
                    position: "absolute",
                    left: `${(BUY_STOP_SCORE / WIN_SCORE) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1.5,
                    backgroundColor: withAlpha(colors.warning, 0.7),
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const handTitle = (right?: React.ReactNode) => <SectionLabel right={right}>{t("room.your_hand")}</SectionLabel>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen topBar={topBar} footer={footer}>
        {/* Status */}
        <AnimatedEntrance enterKey={`header-${room.state}-${room.phase_number}`}>
          <View style={{ gap: 6 }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>
              {t("room.room_code", { code: room.code, round: room.current_round || 0 })}
            </Text>
            <Text style={[type.bodyStrong, { color: colors.text }]}>{translatedPublicMessage}</Text>
          </View>
        </AnimatedEntrance>

        {/* Lobby */}
        {room.state === "lobby" ? (
          <AnimatedEntrance enterKey="lobby-card" delay={40}>
            <View style={{ gap: space.lg }}>
              <Card accent={ACCENT} style={{ alignItems: "stretch" }}>
                <RoomCodeBadge code={room.code} label={t("common.room_code")} accent={ACCENT} inviteUrl={inviteUrl || undefined} />
                <ShareButton
                  label={t("common.invite")}
                  message={fill(copy.shareMessage, { code: room.code })}
                  url={inviteUrl}
                  accentColor={ACCENT}
                />
              </Card>
              <View style={{ gap: space.sm }}>
                <SectionLabel right={<Text style={[type.caption, { color: colors.textSubtle }]}>{players.length}</Text>}>
                  {t("room.players")}
                </SectionLabel>
                {players.map((player) => {
                  const isMe = player.id === playerId;
                  return (
                    <View
                      key={player.id}
                      style={{
                        minHeight: 52,
                        paddingHorizontal: space.md,
                        borderRadius: radius.md,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: isMe ? withAlpha(ACCENT, 0.5) : colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.sm,
                      }}
                    >
                      <Ionicons name="person-circle" size={24} color={isMe ? ACCENT : colors.textSubtle} />
                      <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
                        {player.display_name}
                      </Text>
                      {isMe ? <Text style={[type.caption, { color: ACCENT }]}>{t("common.you").toUpperCase()}</Text> : null}
                      <View style={{ flex: 1 }} />
                      {player.id === room.host_player_id ? <Chip label={t("common.host")} color={ACCENT} icon="star" /> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </AnimatedEntrance>
        ) : null}

        {/* Draw / poker phases: the hand comes first */}
        {myHand && room.state !== "trick_phase" && room.state !== "result" && room.state !== "lobby" ? (
          <AnimatedEntrance enterKey={`hand-${room.phase_number}`} delay={40}>
            <View style={{ gap: space.xs }}>
              {handTitle(
                isDrawPhase && selectedDiscardCards.length > 0 ? (
                  <Text style={[type.caption, { color: ACCENT }]}>
                    {fill(copy.selected, { count: selectedDiscardCards.length }).toUpperCase()}
                  </Text>
                ) : undefined
              )}
              <HandRow>
                {myHand.cards.map((card) => {
                  const selected = selectedCards.includes(cardId(card));
                  return (
                    <PlayingCard
                      key={cardId(card)}
                      card={card}
                      selected={selected}
                      onPress={
                        isDrawPhase && !isBuyStopped && !myPlayer.draw_ready
                          ? () =>
                              setSelectedCards((current) =>
                                current.includes(cardId(card)) ? current.filter((id) => id !== cardId(card)) : [...current, cardId(card)]
                              )
                          : undefined
                      }
                    />
                  );
                })}
              </HandRow>
              {myEvaluation ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: space.sm }}>
                  <Text style={[type.small, { color: colors.textMuted }]}>{t("room.current_read")}</Text>
                  <Text style={[type.bodyStrong, { color: ACCENT }]}>{translatePokerName(myEvaluation.name)}</Text>
                </View>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {isDrawPhase ? (
          <AnimatedEntrance enterKey={`draw-${room.state}`} delay={80}>
            <View style={{ gap: space.md }}>
              {isBuyStopped ? (
                <Notice
                  color={colors.warning}
                  title={t("room.buy_stop_active")}
                  body={t("room.buy_stop_body", { score: BUY_STOP_SCORE })}
                />
              ) : null}
              {myPlayer.draw_ready ? (
                <Notice
                  color={ACCENT}
                  title={t("room.decision_locked")}
                  body={
                    selectedDiscardCards.length > 0
                      ? t("room.exchange_waiting", {
                          count: selectedDiscardCards.length,
                          cards: cardsWord(selectedDiscardCards.length),
                        })
                      : t("room.waiting_table")
                  }
                />
              ) : !isBuyStopped ? (
                <View style={{ gap: 4 }}>
                  <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{t("room.draw_cards")}</Text>
                  <Text style={[type.small, { color: colors.textSecondary }]}>
                    {selectedDiscardCards.length === 0 ? `${copy.tapToSwap}. ${t("room.no_cards_selected")}` : t("room.draw_help")}
                  </Text>
                </View>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {isPokerScore ? (
          <AnimatedEntrance enterKey={`score-${room.state}`} delay={80}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <ActivityIndicator color={ACCENT} size="small" />
                <Text style={[type.heading, { color: colors.text, flex: 1 }]}>{t("room.revealing_best_hand")}</Text>
              </View>
              <Text style={[type.small, { color: colors.textSecondary }]}>{t("room.best_hand_body")}</Text>
            </Card>
          </AnimatedEntrance>
        ) : null}

        {/* Trick phase */}
        {room.state === "trick_phase" ? (
          <AnimatedEntrance enterKey={`tricks-${room.phase_number}`} delay={40}>
            <View style={{ gap: space.lg }}>
              <View
                style={{
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  paddingVertical: space.md,
                  backgroundColor: isMyTurn ? withAlpha(ACCENT, 0.16) : colors.surface,
                  borderWidth: 1,
                  borderColor: isMyTurn ? withAlpha(ACCENT, 0.6) : colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                }}
              >
                <Ionicons name={isMyTurn ? "hand-right" : "hourglass-outline"} size={22} color={isMyTurn ? ACCENT : colors.textMuted} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.caption, { color: isMyTurn ? ACCENT : colors.textMuted, textTransform: "uppercase" }]}>
                    {isMyTurn ? t("room.your_turn") : t("room.waiting")}
                  </Text>
                  <Text style={[type.small, { color: colors.text }]}>
                    {isMyTurn ? t("room.your_turn_body") : fill(copy.waitingFor, { name: currentTurnPlayer?.display_name ?? t("common.player") })}
                  </Text>
                </View>
                {round?.trick_number ? <Chip label={`${round.trick_number}/5`} color={colors.textMuted} icon="layers" /> : null}
              </View>

              {canDeclareChicago ? (
                <Notice color={CHICAGO_COLOR} title={t("room.chicago_open")} body={t("room.chicago_open_body")} />
              ) : null}
              {chicagoCaller ? (
                <Notice
                  color={CHICAGO_COLOR}
                  title={t("room.chicago_claimed")}
                  body={t("room.chicago_claimed_body", { name: chicagoCaller.display_name })}
                />
              ) : null}

              <View style={{ gap: space.sm }}>
                <SectionLabel>{t("room.current_trick")}</SectionLabel>
                {playedCards.length === 0 ? (
                  <View
                    style={{
                      minHeight: 96,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: colors.borderStrong,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: space.md,
                    }}
                  >
                    <Text style={[type.small, { color: colors.textMuted }]}>{t("room.no_cards_played")}</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
                    {playedCards.map((entry) => {
                      const player = players.find((candidate) => candidate.id === entry.player_id);
                      return (
                        <View key={`${entry.trick_id}-${entry.player_id}`} style={{ alignItems: "center", gap: 4, width: 64 }}>
                          <PlayingCard card={entry.card} size="mini" />
                          <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", maxWidth: 64 }}>
                            {player?.display_name ?? t("common.player")}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={{ gap: space.xs }}>
                {handTitle(
                  <Text style={[type.caption, { color: isMyTurn ? ACCENT : colors.textSubtle }]}>
                    {(isMyTurn ? t("room.use_these_cards") : t("room.cards_standby")).toUpperCase()}
                  </Text>
                )}
                <HandRow>
                  {(myHand?.cards ?? []).map((card) => {
                    const id = cardId(card);
                    return (
                      <PlayingCard
                        key={`play-${id}`}
                        card={card}
                        selected={selectedPlayCard === id}
                        dimmed={!isMyTurn}
                        onPress={isMyTurn && !busy ? () => setSelectedPlayCard((current) => (current === id ? null : id)) : undefined}
                      />
                    );
                  })}
                </HandRow>
              </View>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "result" ? (
          <AnimatedEntrance enterKey={`result-${room.phase_number}`} delay={80}>
            <Card accent={ACCENT}>
              <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{t("room.round_result")}</Text>
              <Text style={[type.body, { color: colors.text }]}>{translatedPublicMessage}</Text>
            </Card>
          </AnimatedEntrance>
        ) : null}

        {room.state === "game_over" ? (
          <AnimatedEntrance enterKey={`game-over-${room.phase_number}`} delay={80}>
            <Card accent={colors.success} style={{ alignItems: "center" }}>
              <Ionicons name="trophy" size={40} color={colors.warning} />
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{t("room.game_over")}</Text>
              <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
                {t("room.winner")} {players.find((player) => player.id === room.winner_player_id)?.display_name ?? t("common.unknown")}
              </Text>
              <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>{translatedPublicMessage}</Text>
            </Card>
            <SupportPicklo />
          </AnimatedEntrance>
        ) : null}

        {room.state !== "lobby" ? (
          <AnimatedEntrance enterKey={`scores-${players.length}`} delay={100}>
            {scoreboard}
          </AnimatedEntrance>
        ) : null}
      </Screen>

      {/* Overlays */}
      {showTrickWinnerModal ? (
        <ModalShell zIndex={19} dim={0.5}>
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: radius.xl,
              padding: space.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(ACCENT, 0.45),
              alignItems: "center",
              gap: space.sm,
              opacity: trickWinnerOpacity,
              transform: [{ scale: trickWinnerScale }, { translateY: trickWinnerTranslateY }],
            }}
          >
            <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{t("modal.trick_winner")}</Text>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{trickWinnerName ?? t("common.player")}</Text>
            <Text style={[type.small, { color: colors.textSecondary, textAlign: "center", fontWeight: "700" }]}>
              {t("modal.won_this_trick")}
            </Text>
          </Animated.View>
        </ModalShell>
      ) : null}
      {showPokerRevealModal ? (
        <ModalShell zIndex={20}>
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: radius.xl,
              padding: space.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(ACCENT, 0.45),
              alignItems: "center",
              gap: space.sm,
              opacity: pokerRevealOpacity,
              transform: [{ scale: pokerRevealScale }, { translateY: pokerRevealTranslateY }],
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(ACCENT, 0.18),
                borderWidth: 1,
                borderColor: withAlpha(ACCENT, 0.45),
                marginBottom: space.xs,
              }}
            >
              <Ionicons name="trophy" size={34} color={ACCENT} />
            </View>
            <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{t("modal.best_hand_revealed")}</Text>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{t("modal.poker_scoring")}</Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center", fontWeight: "700" }]}>
              {translatedPublicMessage ?? t("modal.poker_fallback")}
            </Text>
          </Animated.View>
        </ModalShell>
      ) : null}
      {buyStopEvent ? (
        <ModalShell zIndex={21} dim={0.6}>
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: radius.xl,
              paddingVertical: space.xl,
              paddingHorizontal: space.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(buyStopEvent.tone === "penalty" ? colors.danger : colors.warning, 0.5),
              alignItems: "center",
              gap: space.sm,
              opacity: buyStopOpacity,
              transform: [
                { scale: buyStopScale },
                { rotate: buyStopRotate.interpolate({ inputRange: [-1, 1], outputRange: ["-1rad", "1rad"] }) },
              ],
            }}
          >
            <Text style={{ fontSize: 48 }}>{buyStopEvent.tone === "penalty" ? "💥" : "🛒"}</Text>
            <Text
              style={[type.caption, { color: buyStopEvent.tone === "penalty" ? colors.danger : colors.warning, textTransform: "uppercase" }]}
            >
              {buyStopEvent.title}
            </Text>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
              {buyStopEvent.tone === "penalty" ? t("modal.no_swap_only_chaos") : t("modal.buy_stop_activated")}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{buyStopEvent.message}</Text>
          </Animated.View>
        </ModalShell>
      ) : null}
    </View>
  );
}
