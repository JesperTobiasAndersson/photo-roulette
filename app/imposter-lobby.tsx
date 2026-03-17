import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Image } from "react-native";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
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
  const [showRoundContinueModal, setShowRoundContinueModal] = useState(false);
  const [shownRoundContinueKey, setShownRoundContinueKey] = useState<string | null>(null);
  const { room, players, myPlayer, myRole, playerRoles, myVote, currentVotes, loading, refresh } = useImposterRoom(roomId, playerId);

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

  if (room.state === "ended") {
    router.replace({ pathname: "/imposter-results", params: { roomId, playerId } });
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://picklo.app";
  const inviteUrl = `${baseUrl}/imposter?code=${room.code}`;

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
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Lobby</Text>
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Start the game</Text>
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
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Private reveal</Text>
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
                <Text style={{ color: "white", fontWeight: "900" }}>{myPlayer.role_reveal_ready ? "Ready" : "I saw my card"}</Text>
              </Pressable>
            </View>
          </AnimatedEntrance>
        ) : null}

        {room.state === "discussion" ? (
          <AnimatedEntrance enterKey={`phase-discussion-${room.phase_number}`} delay={70}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Discussion</Text>
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
                  {myPlayer.status !== "alive" ? "You are out" : myPlayer.discussion_ready ? "Ready to vote" : "I'm ready to vote"}
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Open voting now</Text>
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
                  <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Votes so far</Text>
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
                  <Text style={{ color: "white", fontWeight: "900" }}>Resolve vote</Text>
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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to games</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
