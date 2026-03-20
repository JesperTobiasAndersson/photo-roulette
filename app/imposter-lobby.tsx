import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Image } from "react-native";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { CopyToast } from "../src/components/CopyToast";
import { IMPOSTER_CATEGORIES } from "../src/games/imposter/data";
import {
  finishImposterReveal,
  resolveImposterVoting,
  startImposterGame,
  startImposterVoting,
  submitImposterDiscussionReady,
  submitImposterVote,
  updateImposterCategory,
} from "../src/games/imposter/api";
import { getCategoryById, getRoleDescription } from "../src/games/imposter/logic";
import { useImposterRoom } from "../src/games/imposter/useImposterRoom";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getRoleColor(role: string | undefined) {
  if (role === "imposter") return "#FCA5A5";
  return "#FCD34D";
}

export default function ImposterLobbyScreen() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showRoundContinueModal, setShowRoundContinueModal] = useState(false);
  const [shownRoundContinueKey, setShownRoundContinueKey] = useState<string | null>(null);
  const [showVoteRevealModal, setShowVoteRevealModal] = useState(false);
  const [shownVoteRevealKey, setShownVoteRevealKey] = useState<string | null>(null);
  const [showEndgameRevealModal, setShowEndgameRevealModal] = useState(false);
  const [shownEndgameRevealKey, setShownEndgameRevealKey] = useState<string | null>(null);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);
  const { room, players, myPlayer, myRole, playerRoles, myVote, currentVotes, loading, refresh } = useImposterRoom(roomId, playerId);
  const previousStatusesRef = useRef<Record<string, "alive" | "eliminated">>({});
  const voteRevealOpacity = useRef(new Animated.Value(0)).current;
  const voteRevealScale = useRef(new Animated.Value(0.9)).current;
  const voteRevealTranslateY = useRef(new Animated.Value(28)).current;
  const endgameRevealOpacity = useRef(new Animated.Value(0)).current;
  const endgameRevealScale = useRef(new Animated.Value(0.92)).current;
  const endgameRevealTranslateY = useRef(new Animated.Value(32)).current;
  const endgamePulseScale = useRef(new Animated.Value(0.72)).current;
  const endgamePulseOpacity = useRef(new Animated.Value(0)).current;
  const endgameVerdictOpacity = useRef(new Animated.Value(0)).current;
  const endgameVerdictTranslateY = useRef(new Animated.Value(14)).current;
  const endgameWinnerOpacity = useRef(new Animated.Value(0)).current;
  const endgameWinnerTranslateY = useRef(new Animated.Value(24)).current;
  const endgameSubtitleOpacity = useRef(new Animated.Value(0)).current;
  const endgameSubtitleTranslateY = useRef(new Animated.Value(18)).current;

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const alivePlayers = useMemo(() => players.filter((player) => player.status === "alive"), [players]);
  const category = getCategoryById(room?.category_id ?? null);
  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([targetPlayerId, count]) => ({
        player: players.find((player) => player.id === targetPlayerId) ?? null,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentVotes, players]);
  const discussionReadyCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const phaseSecondsLeft = room?.phase_ends_at ? Math.max(0, Math.ceil((new Date(room.phase_ends_at).getTime() - now) / 1000)) : 0;
  const phaseMinutesText = `${Math.floor(phaseSecondsLeft / 60)}:${String(phaseSecondsLeft % 60).padStart(2, "0")}`;
  const revealedVotedOutPlayer =
    room && shownVoteRevealKey?.startsWith(`${room.phase_number}-`)
      ? players.find((player) => shownVoteRevealKey.includes(player.id)) ?? null
      : null;
  const revealedVotedOutRole = revealedVotedOutPlayer
    ? playerRoles.find((role) => role.player_id === revealedVotedOutPlayer.id)?.role ?? null
    : null;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (error) {
      Alert.alert("Action failed", String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!room?.phase_ends_at || room.state === "lobby" || room.state === "role_reveal" || room.state === "ended") return;
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [room?.phase_ends_at, room?.state]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "voting") return;
    if (busy) return;

    const uniqueVoters = new Set(currentVotes.map((vote) => vote.voter_player_id));
    if (alivePlayers.length > 0 && uniqueVoters.size === alivePlayers.length) {
      run("auto-resolve-voting", () => resolveImposterVoting(roomId, playerId));
    }
  }, [alivePlayers.length, busy, currentVotes, isHost, playerId, room, roomId]);

  useEffect(() => {
    if (!room) return;

    const shouldShowMessage =
      room.state === "discussion" &&
      room.public_message === "The group voted out the wrong player. The game continues.";
    const modalKey = shouldShowMessage ? `${room.state}-${room.phase_number}-${room.public_message}` : null;

    if (!shouldShowMessage || !modalKey) return;
    if (shownRoundContinueKey === modalKey) return;

    setShowRoundContinueModal(true);
    setShownRoundContinueKey(modalKey);
  }, [room, shownRoundContinueKey]);

  useEffect(() => {
    if (!showRoundContinueModal) return;

    const timeoutId = setTimeout(() => {
      setShowRoundContinueModal(false);
    }, 1800);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [showRoundContinueModal]);

  useEffect(() => {
    if (!room || players.length === 0) return;

    const previousStatuses = previousStatusesRef.current;
    const newlyEliminatedPlayer =
      room.state !== "voting"
        ? players.find((player) => previousStatuses[player.id] === "alive" && player.status === "eliminated") ?? null
        : null;

    const nextStatuses = Object.fromEntries(players.map((player) => [player.id, player.status])) as Record<string, "alive" | "eliminated">;
    previousStatusesRef.current = nextStatuses;

    if (!newlyEliminatedPlayer) return;

    const revealKey = `${room.phase_number}-${newlyEliminatedPlayer.id}-${room.state}`;
    if (shownVoteRevealKey === revealKey) return;

    setShownVoteRevealKey(revealKey);
    setShowVoteRevealModal(true);
    voteRevealOpacity.setValue(0);
    voteRevealScale.setValue(0.9);
    voteRevealTranslateY.setValue(28);

    Animated.parallel([
      Animated.timing(voteRevealOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(voteRevealScale, {
        toValue: 1,
        tension: 72,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(voteRevealTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [players, room, shownVoteRevealKey, voteRevealOpacity, voteRevealScale, voteRevealTranslateY]);

  useEffect(() => {
    if (!showVoteRevealModal) return;

    const timeoutId = setTimeout(() => {
      setShowVoteRevealModal(false);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [showVoteRevealModal]);

  useEffect(() => {
    if (!room) return;
    if (room.state !== "ended") {
      setHasNavigatedToResults(false);
      return;
    }
    if (showVoteRevealModal || showEndgameRevealModal || hasNavigatedToResults) return;

    const revealKey = `${room.id}-${room.phase_number}-${room.winner ?? "unknown"}`;
    if (shownEndgameRevealKey === revealKey) return;

    setShownEndgameRevealKey(revealKey);
    setShowEndgameRevealModal(true);
    endgameRevealOpacity.setValue(0);
    endgameRevealScale.setValue(0.92);
    endgameRevealTranslateY.setValue(32);
    endgamePulseScale.setValue(0.72);
    endgamePulseOpacity.setValue(0);
    endgameVerdictOpacity.setValue(0);
    endgameVerdictTranslateY.setValue(14);
    endgameWinnerOpacity.setValue(0);
    endgameWinnerTranslateY.setValue(24);
    endgameSubtitleOpacity.setValue(0);
    endgameSubtitleTranslateY.setValue(18);

    Animated.parallel([
      Animated.timing(endgameRevealOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(endgameRevealScale, {
        toValue: 1,
        tension: 74,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(endgameRevealTranslateY, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(endgamePulseScale, {
            toValue: 1.24,
            duration: 920,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(endgamePulseOpacity, {
            toValue: 0.32,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(endgamePulseScale, {
            toValue: 1.42,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(endgamePulseOpacity, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(endgamePulseScale, {
          toValue: 0.72,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    ).start();

    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(endgameVerdictOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameVerdictTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(endgameWinnerOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameWinnerTranslateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(140),
      Animated.parallel([
        Animated.timing(endgameSubtitleOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameSubtitleTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    endgamePulseOpacity,
    endgamePulseScale,
    endgameRevealOpacity,
    endgameRevealScale,
    endgameRevealTranslateY,
    endgameSubtitleOpacity,
    endgameSubtitleTranslateY,
    endgameVerdictOpacity,
    endgameVerdictTranslateY,
    endgameWinnerOpacity,
    endgameWinnerTranslateY,
    hasNavigatedToResults,
    room,
    showEndgameRevealModal,
    showVoteRevealModal,
    shownEndgameRevealKey,
  ]);

  useEffect(() => {
    if (!showEndgameRevealModal) return;
    if (!room || room.state !== "ended") return;
    if (hasNavigatedToResults) return;

    const timeoutId = setTimeout(() => {
      setShowEndgameRevealModal(false);
      setHasNavigatedToResults(true);
      router.replace({ pathname: "/imposter-results", params: { roomId, playerId } });
    }, 4400);

    return () => clearTimeout(timeoutId);
  }, [hasNavigatedToResults, playerId, room, roomId, showEndgameRevealModal]);

  if (loading || !room || !myPlayer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <View style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 30,
              overflow: "hidden",
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: "rgba(245,158,11,0.35)",
              marginBottom: 18,
            }}
          >
            <Image source={require("../assets/imposter.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 34, fontWeight: "900", textAlign: "center" }}>Loading Imposter</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 10 }}>
            Connecting the room and syncing the round state.
          </Text>
        </View>
      </View>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://picklo.app";
  const inviteUrl = `${baseUrl}/imposter?code=${room.code}`;
  const copyInviteLink = async () => {
    await Clipboard.setStringAsync(inviteUrl);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 1400);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <Modal visible={showRoundContinueModal} transparent animationType="fade" onRequestClose={() => setShowRoundContinueModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(2,6,23,0.56)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <AnimatedEntrance enterKey={`round-continue-${room.phase_number}`} distance={18}>
            <View
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: 24,
                padding: 20,
                backgroundColor: "#0F172A",
                borderWidth: 1,
                borderColor: "#334155",
                gap: 14,
              }}
            >
              <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900" }}>Round Continues</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 24, fontSize: 15 }}>
                The group voted out the wrong player. The game continues.
              </Text>
            </View>
          </AnimatedEntrance>
        </View>
      </Modal>
      <Modal visible={showVoteRevealModal} transparent animationType="fade" onRequestClose={() => setShowVoteRevealModal(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(2,6,23,0.7)",
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
              backgroundColor: revealedVotedOutRole === "imposter" ? "#1A1104" : "#140A0C",
              borderWidth: 1,
              borderColor: revealedVotedOutRole === "imposter" ? "rgba(251,191,36,0.38)" : "rgba(252,165,165,0.4)",
              shadowColor: revealedVotedOutRole === "imposter" ? "#F59E0B" : "#F87171",
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 16 },
              elevation: 18,
              alignItems: "center",
              opacity: voteRevealOpacity,
              transform: [{ scale: voteRevealScale }, { translateY: voteRevealTranslateY }],
            }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: revealedVotedOutRole === "imposter" ? "rgba(217,119,6,0.24)" : "rgba(127,29,29,0.32)",
                borderWidth: 1,
                borderColor: revealedVotedOutRole === "imposter" ? "rgba(251,191,36,0.35)" : "rgba(252,165,165,0.35)",
                marginBottom: 18,
              }}
            >
              <Text style={{ color: revealedVotedOutRole === "imposter" ? "#FCD34D" : "#FCA5A5", fontSize: 40, fontWeight: "900" }}>
                {revealedVotedOutRole === "imposter" ? "!" : "X"}
              </Text>
            </View>
            <Text
              style={{
                color: revealedVotedOutRole === "imposter" ? "#FCD34D" : "#FCA5A5",
                fontWeight: "900",
                fontSize: 13,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Vote result
            </Text>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 30, textAlign: "center", marginTop: 12 }}>
              {revealedVotedOutPlayer?.display_name ?? "A player"}
            </Text>
            <Text style={{ color: "#E2E8F0", fontWeight: "800", fontSize: 16, textAlign: "center", marginTop: 10 }}>
              {revealedVotedOutRole === "imposter" ? "was revealed as the imposter" : "was voted out by the group"}
            </Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22, textAlign: "center", marginTop: 12 }}>
              {revealedVotedOutRole === "imposter"
                ? "The crew made the right call. The round outcome is being revealed."
                : room.state === "ended"
                  ? "That vote ended the game. Final results are about to appear."
                  : "The group lost a crew member. The next discussion begins now."}
            </Text>
          </Animated.View>
        </View>
      </Modal>
      <Modal visible={showEndgameRevealModal} transparent animationType="fade" onRequestClose={() => undefined}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(3,7,18,0.82)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 430,
              borderRadius: 30,
              paddingHorizontal: 24,
              paddingVertical: 28,
              backgroundColor: room?.winner === "imposter" ? "#17090B" : "#1A1104",
              borderWidth: 1,
              borderColor: room?.winner === "imposter" ? "rgba(252,165,165,0.36)" : "rgba(251,191,36,0.34)",
              shadowColor: room?.winner === "imposter" ? "#FB7185" : "#F59E0B",
              shadowOpacity: 0.34,
              shadowRadius: 34,
              shadowOffset: { width: 0, height: 18 },
              elevation: 20,
              alignItems: "center",
              opacity: endgameRevealOpacity,
              transform: [{ scale: endgameRevealScale }, { translateY: endgameRevealTranslateY }],
              gap: 10,
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                width: 188,
                height: 188,
                borderRadius: 999,
                backgroundColor: room?.winner === "imposter" ? "rgba(251,113,133,0.24)" : "rgba(251,191,36,0.22)",
                opacity: endgamePulseOpacity,
                transform: [{ scale: endgamePulseScale }],
              }}
            />
            <View
              style={{
                width: 108,
                height: 108,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: room?.winner === "imposter" ? "rgba(127,29,29,0.34)" : "rgba(146,64,14,0.34)",
                borderWidth: 1,
                borderColor: room?.winner === "imposter" ? "rgba(252,165,165,0.3)" : "rgba(251,191,36,0.32)",
                marginBottom: 8,
              }}
            >
              <Text style={{ color: room?.winner === "imposter" ? "#FCA5A5" : "#FCD34D", fontSize: 46, fontWeight: "900" }}>
                {room?.winner === "imposter" ? "I" : "C"}
              </Text>
            </View>
            <Animated.Text
              style={{
                color: room?.winner === "imposter" ? "#FCA5A5" : "#FCD34D",
                fontWeight: "900",
                fontSize: 12,
                letterSpacing: 2.2,
                textTransform: "uppercase",
                opacity: endgameVerdictOpacity,
                transform: [{ translateY: endgameVerdictTranslateY }],
              }}
            >
              Final verdict
            </Animated.Text>
            <Animated.Text
              style={{
                color: "#F8FAFC",
                fontWeight: "900",
                fontSize: 32,
                textAlign: "center",
                opacity: endgameWinnerOpacity,
                transform: [{ translateY: endgameWinnerTranslateY }, { scale: endgameWinnerOpacity }],
              }}
            >
              {room?.winner === "imposter" ? "IMPOSTER WINS" : "CREW WINS"}
            </Animated.Text>
            <Animated.Text
              style={{
                color: "#CBD5E1",
                lineHeight: 22,
                textAlign: "center",
                maxWidth: 320,
                opacity: endgameSubtitleOpacity,
                transform: [{ translateY: endgameSubtitleTranslateY }],
              }}
            >
              {room?.winner === "imposter"
                ? "The imposter survived the accusations and took control of the round."
                : "The crew read the room correctly and exposed the imposter."}
            </Animated.Text>
            <View
              style={{
                marginTop: 10,
                alignSelf: "stretch",
                height: 8,
                borderRadius: 999,
                backgroundColor: "rgba(15,23,42,0.85)",
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: room?.winner === "imposter" ? "#FB7185" : "#F59E0B",
                  transform: [
                    {
                      scaleX: endgameRevealOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 1],
                      }),
                    },
                  ],
                }}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <AnimatedEntrance enterKey={`header-${room.state}`} delay={20}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Imposter</Text>
            <Text style={{ color: "#94A3B8" }}>Room {room.code} · {room.state.replace("_", " ")}</Text>
          </View>
        </AnimatedEntrance>

        {room.state !== "lobby" && myRole ? (
          <AnimatedEntrance enterKey={`card-${room.state}`} delay={50}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Your card</Text>
              <Text style={{ color: getRoleColor(myRole.role), fontWeight: "900", fontSize: 24 }}>
                {myRole.role === "imposter" ? "IMPOSTER" : myRole.prompt?.toUpperCase() ?? "UNKNOWN"}
              </Text>
              <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{getRoleDescription(myRole.role)}</Text>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "lobby" ? (
          <AnimatedEntrance enterKey="phase-lobby" delay={70}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>LOBBY</Text>
              <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
                Join the room, pick a category, and start once everyone is ready.
              </Text>

              <View style={{ gap: 8 }}>
                <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>Category</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {IMPOSTER_CATEGORIES.map((entry) => {
                    const active = room.category_id === entry.id;
                    return (
                      <Pressable
                        key={entry.id}
                        onPress={() => run(`category-${entry.id}`, () => updateImposterCategory(roomId, playerId, entry.id))}
                        disabled={!isHost}
                        style={({ pressed }) => ({
                          minWidth: 132,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          borderRadius: 18,
                          backgroundColor: active ? `${entry.accent}33` : "#111827",
                          borderWidth: 1,
                          borderColor: active ? `${entry.accent}AA` : "#243041",
                          shadowColor: entry.accent,
                          shadowOpacity: active ? 0.28 : 0,
                          shadowRadius: 14,
                          shadowOffset: { width: 0, height: 8 },
                          elevation: active ? 8 : 0,
                          opacity: !isHost ? 0.6 : pressed ? 0.92 : 1,
                          gap: 4,
                        })}
                      >
                        <Text style={{ color: active ? entry.accent : "#64748B", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }}>
                          CATEGORY
                        </Text>
                        <Text style={{ color: active ? "#F8FAFC" : "#E2E8F0", fontWeight: "900", fontSize: 13, letterSpacing: 0.8 }}>
                          {entry.title.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!isHost ? <Text style={{ color: "#64748B" }}>Only the host can change the category.</Text> : null}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>Players</Text>
                {players.map((player, index) => (
                  <AnimatedEntrance key={player.id} enterKey={`lobby-${players.length}-${player.id}`} delay={110 + index * 30} distance={10}>
                    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: "white", fontWeight: "800" }}>{player.display_name}</Text>
                      <Text style={{ color: player.id === room.host_player_id ? "#FCD34D" : "#64748B", fontWeight: "800" }}>
                        {player.id === room.host_player_id ? "HOST" : "PLAYER"}
                      </Text>
                    </View>
                  </AnimatedEntrance>
                ))}
              </View>

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
                  onPress={() => run("start", () => startImposterGame(roomId, playerId))}
                  disabled={busy === "start" || players.length < 3 || !room.category_id}
                  style={({ pressed }) => ({
                    height: 54,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#D97706",
                    opacity: busy === "start" || players.length < 3 || !room.category_id ? 0.5 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>START THE GAME</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to start the game.</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "role_reveal" ? (
          <AnimatedEntrance enterKey="phase-role-reveal" delay={70}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>PRIVATE REVEAL</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
                Read your card privately, then tap ready so the round can move to discussion.
              </Text>
              <Pressable
                onPress={() => run("reveal-ready", () => finishImposterReveal(roomId, playerId))}
                disabled={busy === "reveal-ready" || myPlayer.role_reveal_ready}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#000000",
                  opacity: myPlayer.role_reveal_ready ? 0.6 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>
                  {myPlayer.role_reveal_ready ? "READY" : "I SAW MY CARD"}
                </Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "discussion" ? (
          <AnimatedEntrance enterKey={`phase-discussion-${room.phase_number}`} delay={70}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>DISCUSSION</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
              <View style={{ backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937", gap: 6 }}>
                <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Time left</Text>
                <Text style={{ color: "#FDBA74", fontSize: 28, fontWeight: "900" }}>{phaseMinutesText}</Text>
                <Text style={{ color: "#94A3B8" }}>
                  {discussionReadyCount}/{alivePlayers.length} players are ready to vote.
                </Text>
              </View>
              <Pressable
                onPress={() => run("discussion-ready", () => submitImposterDiscussionReady(roomId, playerId))}
                disabled={busy === "discussion-ready" || myPlayer.discussion_ready || myPlayer.status !== "alive"}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#000000",
                  opacity: myPlayer.discussion_ready || myPlayer.status !== "alive" ? 0.6 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>
                  {myPlayer.status !== "alive" ? "YOU ARE OUT" : "READY TO VOTE"}
                </Text>
              </Pressable>
              {isHost ? (
                <Pressable
                  onPress={() => run("start-voting", () => startImposterVoting(roomId, playerId))}
                  disabled={busy === "start-voting"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#111827",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>OPEN VOTING NOW</Text>
                </Pressable>
              ) : null}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "voting" ? (
          <AnimatedEntrance enterKey={`phase-voting-${room.phase_number}`} delay={70}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Vote</Text>
              <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>Pick the player you think is the imposter.</Text>
              {alivePlayers
                .filter((player) => player.id !== myPlayer.id)
                .map((player, index) => (
                  <AnimatedEntrance key={player.id} enterKey={`vote-option-${room.phase_number}-${player.id}`} delay={100 + index * 28} distance={10}>
                    <Pressable
                      onPress={() => run(`vote-${player.id}`, () => submitImposterVote(roomId, playerId, player.id))}
                      style={({ pressed }) => ({
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 14,
                        backgroundColor: myVote?.target_player_id === player.id ? "#D97706" : "#020617",
                        borderWidth: 1,
                        borderColor: myVote?.target_player_id === player.id ? "#F59E0B" : "#1F2937",
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                    </Pressable>
                  </AnimatedEntrance>
                ))}

              {voteTallies.length > 0 ? (
                <View style={{ gap: 8, backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937" }}>
                  <Text style={{ color: "#F8FAFC", fontWeight: "900", textTransform: "uppercase" }}>VOTES SO FAR</Text>
                  {voteTallies.map((entry) => (
                    <Text key={entry.player?.id ?? `vote-${entry.count}`} style={{ color: "#CBD5E1", lineHeight: 20 }}>
                      {entry.player?.display_name ?? "Unknown"}: {entry.count}
                    </Text>
                  ))}
                </View>
              ) : null}

              {isHost ? (
                <Pressable
                  onPress={() => run("resolve-votes", () => resolveImposterVoting(roomId, playerId))}
                  disabled={busy === "resolve-votes"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#111827",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>RESOLVE VOTE</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to resolve the vote.</Text>
              )}
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state !== "lobby" ? (
          <AnimatedEntrance enterKey={`players-${room.state}-${room.phase_number}`} delay={120}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Players</Text>
              {players.map((player, index) => {
                const role = playerRoles.find((entry) => entry.player_id === player.id)?.role;
                return (
                  <AnimatedEntrance key={player.id} enterKey={`player-row-${room.phase_number}-${player.id}-${player.status}`} delay={150 + index * 24} distance={8}>
                    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text
                            style={{
                              color: player.status === "eliminated" ? "#FCA5A5" : "white",
                              fontWeight: "800",
                              textDecorationLine: player.status === "eliminated" ? "line-through" : "none",
                            }}
                          >
                            {player.display_name}
                          </Text>
                          {player.id === myPlayer.id ? <Text style={{ color: "#93C5FD", fontWeight: "900", fontSize: 12 }}>YOU</Text> : null}
                          {player.status === "eliminated" ? <Text style={{ color: "#FCA5A5", fontWeight: "900", fontSize: 11 }}>OUT</Text> : null}
                          {room.state === "role_reveal" && player.role_reveal_ready ? <Text style={{ color: "#86EFAC", fontWeight: "900", fontSize: 11 }}>READY</Text> : null}
                          {room.state === "discussion" && player.discussion_ready ? <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 11 }}>VOTE READY</Text> : null}
                        </View>
                        <Text style={{ color: "#64748B" }}>
                          {room.state === "ended" && role ? role.toUpperCase() : player.id === room.host_player_id ? "Host" : player.status === "alive" ? "Alive" : "Eliminated"}
                        </Text>
                      </View>
                    </View>
                  </AnimatedEntrance>
                );
              })}
            </View>
          </AnimatedEntrance>
        ) : null}

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
