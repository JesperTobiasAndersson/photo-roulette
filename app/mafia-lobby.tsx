import React, { Fragment, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  checkWinCondition,
  finishRoleReveal,
  resolveDayVote,
  resolveNight,
  startDayDiscussion,
  startDayVoting,
  startMafiaGame,
  startNextNight,
  submitDayVote,
  submitDiscussionReady,
  submitNightContinue,
  submitNightAction,
} from "../src/games/mafia/api";
import { getPhaseTitle, getRoleDescription } from "../src/games/mafia/logic";
import { useMafiaRoom } from "../src/games/mafia/useMafiaRoom";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

const PRIVATE_READ_TAGS = [
  { id: "safe", label: "Safe", color: "#86EFAC", backgroundColor: "rgba(134,239,172,0.12)", borderColor: "rgba(134,239,172,0.32)" },
  { id: "suspicious", label: "Suspicious", color: "#FCA5A5", backgroundColor: "rgba(252,165,165,0.12)", borderColor: "rgba(252,165,165,0.32)" },
  { id: "loud", label: "Loud yesterday", color: "#93C5FD", backgroundColor: "rgba(147,197,253,0.12)", borderColor: "rgba(147,197,253,0.32)" },
] as const;

type PrivateReadTagId = (typeof PRIVATE_READ_TAGS)[number]["id"];
type PrivateReads = Record<string, PrivateReadTagId>;

export default function MafiaRoomScreen() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [privateReads, setPrivateReads] = useState<PrivateReads>({});
  const [selectedReadPlayerId, setSelectedReadPlayerId] = useState<string | null>(null);
  const { room, players, myPlayer, myRole, myNightAction, currentNightActions, mafiaNightActions, myPoliceReports, myDayVote, currentDayVotes, events, loading, refresh } =
    useMafiaRoom(roomId, playerId);

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const alivePlayers = useMemo(() => players.filter((player) => player.status === "alive"), [players]);
  const latestReport = myPoliceReports[0] ?? null;
  const latestEvent = events[events.length - 1] ?? null;
  const discussionReadyCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const phaseSecondsLeft = room?.phase_ends_at ? Math.max(0, Math.ceil((new Date(room.phase_ends_at).getTime() - now) / 1000)) : 0;
  const phaseMinutesText = `${Math.floor(phaseSecondsLeft / 60)}:${String(phaseSecondsLeft % 60).padStart(2, "0")}`;
  const latestEliminatedPlayerId = typeof latestEvent?.payload?.eliminatedPlayerId === "string" ? latestEvent.payload.eliminatedPlayerId : null;
  const latestEliminatedPlayer = latestEliminatedPlayerId ? players.find((player) => player.id === latestEliminatedPlayerId) ?? null : null;
  const selectedTargetId = myNightAction?.target_player_id ?? null;
  const voteTargetId = myDayVote?.target_player_id ?? null;
  const role = myRole?.role ?? "villager";
  const privateReadsKey = `mafia-private-reads:${roomId}:${playerId}`;
  const aliveNightActions = useMemo(
    () => currentNightActions.filter((action) => alivePlayers.some((player) => player.id === action.actor_player_id)),
    [alivePlayers, currentNightActions]
  );
  const allAlivePlayersLockedNightAction =
    alivePlayers.length > 0 &&
    alivePlayers.every((player) => aliveNightActions.some((action) => action.actor_player_id === player.id && action.confirmed));
  const nightContinueCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const hasPressedNightContinue = !!myPlayer?.discussion_ready;
  const villagerReadTargets = useMemo(() => alivePlayers.filter((player) => player.id !== myPlayer?.id), [alivePlayers, myPlayer?.id]);
  const villagerPrivateReads = useMemo(
    () =>
      Object.entries(privateReads)
        .map(([targetPlayerId, tagId]) => ({
          player: players.find((player) => player.id === targetPlayerId) ?? null,
          tag: PRIVATE_READ_TAGS.find((tag) => tag.id === tagId) ?? null,
        }))
        .filter((entry) => entry.player && entry.tag),
    [players, privateReads]
  );
  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentDayVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([targetPlayerId, count]) => ({
        player: players.find((player) => player.id === targetPlayerId) ?? null,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentDayVotes, players]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (err) {
      Alert.alert("Action failed", String((err as Error)?.message ?? err));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!room?.phase_ends_at || room.state === "lobby" || room.state === "ended") return;

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [room?.phase_ends_at, room?.state]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "day_discussion") return;
    if (!room.phase_ends_at) return;
    if (phaseSecondsLeft > 0) return;
    if (busy) return;

    run("auto-start-voting", () => startDayVoting(roomId, playerId));
  }, [busy, isHost, phaseSecondsLeft, playerId, room, roomId]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "day_voting") return;
    if (busy) return;

    const aliveVoterCount = alivePlayers.length;
    const uniqueVoters = new Set(currentDayVotes.map((vote) => vote.voter_player_id).filter(Boolean));
    if (aliveVoterCount > 0 && uniqueVoters.size === aliveVoterCount) {
      run("auto-resolve-vote", () => resolveDayVote(roomId, playerId));
    }
  }, [alivePlayers.length, busy, currentDayVotes, isHost, playerId, room, roomId]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "night") return;
    if (busy) return;
    if (!allAlivePlayersLockedNightAction) return;
    if (nightContinueCount !== alivePlayers.length) return;

    run("auto-resolve-night", () => resolveNight(roomId, playerId));
  }, [alivePlayers.length, allAlivePlayersLockedNightAction, busy, isHost, nightContinueCount, playerId, room, roomId]);

  useEffect(() => {
    let cancelled = false;

    const loadPrivateReads = async () => {
      if (!roomId || !playerId) return;
      try {
        const stored = await AsyncStorage.getItem(privateReadsKey);
        if (cancelled) return;
        if (!stored) {
          setPrivateReads({});
          return;
        }
        const parsed = JSON.parse(stored) as PrivateReads;
        setPrivateReads(parsed ?? {});
      } catch (error) {
        console.error("Could not load private mafia reads", error);
        if (!cancelled) setPrivateReads({});
      }
    };

    loadPrivateReads();

    return () => {
      cancelled = true;
    };
  }, [playerId, privateReadsKey, roomId]);

  useEffect(() => {
    if (!selectedReadPlayerId) return;
    if (villagerReadTargets.some((player) => player.id === selectedReadPlayerId)) return;
    setSelectedReadPlayerId(null);
  }, [selectedReadPlayerId, villagerReadTargets]);

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
              borderColor: "rgba(244,63,94,0.35)",
              marginBottom: 18,
            }}
          >
            <Image source={require("../assets/mafia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 34, fontWeight: "900", textAlign: "center" }}>Loading Mafia</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 10 }}>
            Setting up the room, syncing players, and getting everything ready for the next move.
          </Text>
          <View
            style={{
              marginTop: 22,
              width: "100%",
              backgroundColor: "#0F172A",
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: "#1E293B",
              gap: 10,
            }}
          >
            <View style={{ height: 12, borderRadius: 999, backgroundColor: "#1F2937", overflow: "hidden" }}>
              <View style={{ width: "62%", height: "100%", backgroundColor: "#7F1D1D", borderRadius: 999 }} />
            </View>
            <Text style={{ color: "#CBD5E1", textAlign: "center", fontWeight: "700" }}>Joining the table...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (room.state === "ended") {
    router.replace({ pathname: "/mafia-results", params: { roomId, playerId } });
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://picklo.app";
  const inviteUrl = `${baseUrl}/mafia?code=${room.code}`;
  const showIdentityCard = room.state !== "lobby" && !!myRole;
  const nightTargets =
    role === "mafia"
      ? alivePlayers.filter((player) => player.id !== myPlayer.id)
      : role === "doctor"
        ? alivePlayers
        : role === "police"
          ? alivePlayers.filter((player) => player.id !== myPlayer.id)
          : [];

  const savePrivateRead = async (targetPlayerId: string, tagId: PrivateReadTagId) => {
    const nextReads = { ...privateReads, [targetPlayerId]: tagId };
    setPrivateReads(nextReads);
    try {
      await AsyncStorage.setItem(privateReadsKey, JSON.stringify(nextReads));
    } catch (error) {
      console.error("Could not save private mafia reads", error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Mafia</Text>
          <Text style={{ color: "#94A3B8" }}>
            {getPhaseTitle(room.state)} · Room {room.code}
          </Text>
        </View>

        {showIdentityCard ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Your identity</Text>
            <Text style={{ color: role === "mafia" ? "#FDA4AF" : "#E2E8F0", fontWeight: "900", fontSize: 22 }}>{role.toUpperCase()}</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{getRoleDescription(role)}</Text>
            {myPlayer.status === "eliminated" ? <Text style={{ color: "#FCA5A5", fontWeight: "900" }}>You are eliminated but can still follow the game.</Text> : null}
            {latestReport ? (
              <View style={{ backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937" }}>
                <Text style={{ color: "#BAE6FD", fontWeight: "900" }}>Latest police report</Text>
                <Text style={{ color: "#E2E8F0", marginTop: 6 }}>
                  {latestReport.result_alignment === "mafia" ? "You picked a mafia player." : "You picked a village player."}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {room.state === "lobby" ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Players</Text>
              {players.map((player) => (
                <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between" }}>
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
                    {player.status === "eliminated" ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(252,165,165,0.12)", borderWidth: 1, borderColor: "rgba(252,165,165,0.35)" }}>
                        <Text style={{ color: "#FCA5A5", fontWeight: "900", fontSize: 11 }}>DEAD</Text>
                      </View>
                    ) : room.state === "role_reveal" && player.role_reveal_ready ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(134,239,172,0.12)", borderWidth: 1, borderColor: "rgba(134,239,172,0.35)" }}>
                        <Text style={{ color: "#86EFAC", fontWeight: "900", fontSize: 11 }}>READY</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ color: player.id === room.host_player_id ? "#FDA4AF" : "#64748B", fontWeight: "800" }}>
                    {player.id === room.host_player_id ? "HOST" : "PLAYER"}
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
                  onPress={() => run("start", () => startMafiaGame(roomId, playerId))}
                  disabled={busy === "start" || players.length < 4}
                  style={({ pressed }) => ({
                    height: 54,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#7F1D1D",
                    opacity: busy === "start" || players.length < 4 ? 0.5 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Start the game</Text>
                </Pressable>
              ) : (
                <Text style={{ color: "#94A3B8" }}>Waiting for the host to start the game.</Text>
              )}
            </View>
          </View>
        ) : null}

        {room.state === "role_reveal" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Private role reveal</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>Read your role privately, then tap ready. The game advances once everyone is ready.</Text>
            <Pressable
              onPress={() => run("reveal", () => finishRoleReveal(roomId, playerId))}
              disabled={busy === "reveal" || myPlayer.role_reveal_ready}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#000000",
                opacity: myPlayer.role_reveal_ready ? 0.6 : pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{myPlayer.role_reveal_ready ? "Ready" : "I saw my role"}</Text>
            </Pressable>
          </View>
        ) : null}

        {room.state === "night" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Night actions</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
              Everyone has an active-looking night screen so roles do not stand out from how the phone is used.
            </Text>

            {role === "villager" ? (
              <View style={{ gap: 12 }}>
                <View style={{ backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937", gap: 10 }}>
                  <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Private reads</Text>
                  <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
                    These badges stay only on your device. Use them to keep track of who feels safe, suspicious, or loud.
                  </Text>

                  <View style={{ gap: 8 }}>
                    {villagerReadTargets.map((player) => {
                      const activeTag = privateReads[player.id] ? PRIVATE_READ_TAGS.find((tag) => tag.id === privateReads[player.id]) : null;
                      const isSelected = selectedReadPlayerId === player.id;
                      return (
                        <Pressable
                          key={player.id}
                          onPress={() => setSelectedReadPlayerId(player.id)}
                          style={({ pressed }) => ({
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 14,
                            backgroundColor: isSelected ? "#111827" : "#020617",
                            borderWidth: 1,
                            borderColor: isSelected ? "#475569" : "#1F2937",
                            opacity: pressed ? 0.92 : 1,
                            gap: 6,
                          })}
                        >
                          <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                          <Text style={{ color: activeTag ? activeTag.color : "#64748B", fontSize: 12, fontWeight: "800" }}>
                            {activeTag ? `Current tag: ${activeTag.label}` : "No tag set yet"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedReadPlayerId ? (
                    <View style={{ gap: 8 }}>
                      <Text style={{ color: "#CBD5E1", fontWeight: "800" }}>
                        Tag {players.find((player) => player.id === selectedReadPlayerId)?.display_name ?? "player"}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {PRIVATE_READ_TAGS.map((tag) => {
                          const active = privateReads[selectedReadPlayerId] === tag.id;
                          return (
                            <Pressable
                              key={tag.id}
                              onPress={() => savePrivateRead(selectedReadPlayerId, tag.id)}
                              style={({ pressed }) => ({
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 999,
                                backgroundColor: active ? tag.backgroundColor : "#111827",
                                borderWidth: 1,
                                borderColor: active ? tag.borderColor : "#1F2937",
                                opacity: pressed ? 0.92 : 1,
                              })}
                            >
                              <Text style={{ color: active ? tag.color : "#E5E7EB", fontWeight: "900", fontSize: 12 }}>{tag.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => run("villager-ready", () => submitNightAction(roomId, playerId, null, true))}
                  disabled={busy === "villager-ready" || myNightAction?.confirmed}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#111827",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    opacity: myNightAction?.confirmed ? 0.6 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>{myNightAction?.confirmed ? "Ready" : "Finish night notes"}</Text>
                </Pressable>
              </View>
            ) : null}

            {role !== "villager" ? (
              <View style={{ gap: 10 }}>
                {nightTargets.map((player) => (
                  <Pressable
                    key={player.id}
                    onPress={() => run(`night-${player.id}`, () => submitNightAction(roomId, playerId, player.id, false))}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: selectedTargetId === player.id ? "#7F1D1D" : "#020617",
                      borderWidth: 1,
                      borderColor: selectedTargetId === player.id ? "#991B1B" : "#1F2937",
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => run("confirm-night", () => submitNightAction(roomId, playerId, selectedTargetId, true))}
                  disabled={!selectedTargetId || busy === "confirm-night"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#000000",
                    opacity: !selectedTargetId ? 0.5 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>{myNightAction?.confirmed ? "Confirmed" : "Confirm choice"}</Text>
                </Pressable>
              </View>
            ) : null}

            {role === "mafia" && mafiaNightActions.length > 0 ? (
              <View style={{ gap: 8, backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937" }}>
                <Text style={{ color: "#FDA4AF", fontWeight: "900" }}>Mafia coordination</Text>
                {mafiaNightActions.map((action) => {
                  const teammate = players.find((player) => player.id === action.actor_player_id);
                  const target = players.find((player) => player.id === action.target_player_id);
                  return (
                    <Text key={action.actor_player_id} style={{ color: "#E5E7EB", lineHeight: 20 }}>
                      {teammate?.display_name ?? "Teammate"}: {target?.display_name ?? "No target"} {action.confirmed ? "· confirmed" : "· choosing"}
                    </Text>
                  );
                })}
              </View>
            ) : null}

            {allAlivePlayersLockedNightAction ? (
              <View style={{ gap: 10, backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937" }}>
                <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Night choices locked</Text>
                <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
                  Everyone has finished their night action. Tap continue to move on once all living players are ready.
                </Text>
                <Text style={{ color: "#CBD5E1", fontWeight: "800" }}>
                  Continue ready: {nightContinueCount}/{alivePlayers.length}
                </Text>
                {myPlayer.status === "alive" ? (
                  <Pressable
                    onPress={() => run("night-continue", () => submitNightContinue(roomId, playerId))}
                    disabled={busy === "night-continue" || hasPressedNightContinue}
                    style={({ pressed }) => ({
                      height: 52,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#000000",
                      opacity: hasPressedNightContinue ? 0.6 : pressed ? 0.92 : 1,
                    })}
                  >
                    <Text style={{ color: "white", fontWeight: "900" }}>{hasPressedNightContinue ? "Continue pressed" : "Continue"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={{ color: "#94A3B8" }}>
                The continue button appears after every living player has confirmed a night action.
              </Text>
            )}

            {isHost ? (
              <Pressable
                onPress={() => run("resolve-night", () => resolveNight(roomId, playerId))}
                disabled={busy === "resolve-night" || !allAlivePlayersLockedNightAction || nightContinueCount !== alivePlayers.length}
                style={({ pressed }) => ({
                  height: 50,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#111827",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  opacity: !allAlivePlayersLockedNightAction || nightContinueCount !== alivePlayers.length ? 0.5 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Resolve night</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94A3B8" }}>Waiting for everyone to press continue.</Text>
            )}
          </View>
        ) : null}

        {room.state === "night_result" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Night result</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
            {latestEvent?.event_type === "night_result" ? <Text style={{ color: "#94A3B8", lineHeight: 21 }}>Night actions have been resolved.</Text> : null}
            {latestEliminatedPlayer ? <Text style={{ color: "#FCA5A5", fontWeight: "800" }}>{latestEliminatedPlayer.display_name} was eliminated.</Text> : null}
            {isHost ? (
              <Pressable
                onPress={() => run("discussion", () => startDayDiscussion(roomId, playerId))}
                disabled={busy === "discussion"}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#000000",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Continue to discussion</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94A3B8" }}>Waiting for the host to move into discussion.</Text>
            )}
          </View>
        ) : null}

        {room.state === "day_discussion" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Discuss</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
            <View style={{ backgroundColor: "#020617", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#1F2937", gap: 6 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Time left</Text>
              <Text style={{ color: "#FDBA74", fontSize: 28, fontWeight: "900" }}>{phaseMinutesText}</Text>
              <Text style={{ color: "#94A3B8" }}>
                {discussionReadyCount}/{alivePlayers.length} living players are ready to vote.
              </Text>
            </View>
            {myPlayer.status === "alive" ? (
              <Pressable
                onPress={() => run("discussion-ready", () => submitDiscussionReady(roomId, playerId))}
                disabled={busy === "discussion-ready" || myPlayer.discussion_ready}
                style={({ pressed }) => ({
                  height: 52,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#000000",
                  opacity: myPlayer.discussion_ready ? 0.6 : pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>{myPlayer.discussion_ready ? "Ready to vote" : "I'm ready to vote"}</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94A3B8" }}>Eliminated players can watch the discussion, but only living players can mark ready.</Text>
            )}
            {isHost ? (
              <Pressable
                onPress={() => run("start-voting", () => startDayVoting(roomId, playerId))}
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
        ) : null}

        {room.state === "day_voting" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Vote</Text>
            {alivePlayers
              .filter((player) => player.id !== myPlayer.id)
              .map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => run(`vote-${player.id}`, () => submitDayVote(roomId, playerId, player.id))}
                  disabled={myPlayer.status !== "alive"}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: voteTargetId === player.id ? "#7F1D1D" : "#020617",
                    borderWidth: 1,
                    borderColor: voteTargetId === player.id ? "#991B1B" : "#1F2937",
                    opacity: myPlayer.status !== "alive" ? 0.5 : pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>{player.display_name}</Text>
                </Pressable>
              ))}
            {isHost ? (
              <Pressable
                onPress={() => run("resolve-vote", () => resolveDayVote(roomId, playerId))}
                disabled={busy === "resolve-vote"}
                style={({ pressed }) => ({
                  height: 50,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#111827",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>Resolve vote if timer ended</Text>
              </Pressable>
            ) : (
              <Text style={{ color: "#94A3B8" }}>Waiting for the host to resolve the vote.</Text>
            )}
          </View>
        ) : null}

        {room.state === "vote_result" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Vote result</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message}</Text>
            {latestEliminatedPlayer ? <Text style={{ color: "#FCA5A5", fontWeight: "800" }}>{latestEliminatedPlayer.display_name} was eliminated.</Text> : null}
            {voteTallies.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>Vote breakdown</Text>
                {voteTallies.map((entry) => (
                  <View key={entry.player?.id ?? `unknown-${entry.count}`} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: "#E2E8F0", fontWeight: "800" }}>{entry.player?.display_name ?? "Unknown player"}</Text>
                    <Text style={{ color: "#FDBA74", fontWeight: "900" }}>{entry.count} vote{entry.count === 1 ? "" : "s"}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {isHost ? (
              <Fragment>
                <Pressable
                  onPress={() => run("check-win", () => checkWinCondition(roomId))}
                  disabled={busy === "check-win"}
                  style={({ pressed }) => ({
                    height: 48,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#111827",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Check winner</Text>
                </Pressable>
                <Pressable
                  onPress={() => run("next-night", () => startNextNight(roomId, playerId))}
                  disabled={busy === "next-night"}
                  style={({ pressed }) => ({
                    height: 52,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#000000",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>Continue to next night</Text>
                </Pressable>
              </Fragment>
            ) : (
              <Text style={{ color: "#94A3B8" }}>Waiting for the host to continue the game.</Text>
            )}
          </View>
        ) : null}

        {room.state !== "lobby" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Players</Text>
            {players.map((player) => (
              <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
                    {player.status === "eliminated" ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(252,165,165,0.12)", borderWidth: 1, borderColor: "rgba(252,165,165,0.35)" }}>
                        <Text style={{ color: "#FCA5A5", fontWeight: "900", fontSize: 11 }}>DEAD</Text>
                      </View>
                    ) : room.state === "role_reveal" && player.role_reveal_ready ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(134,239,172,0.12)", borderWidth: 1, borderColor: "rgba(134,239,172,0.35)" }}>
                        <Text style={{ color: "#86EFAC", fontWeight: "900", fontSize: 11 }}>READY</Text>
                      </View>
                    ) : null}
                    {room.state === "day_discussion" && player.discussion_ready ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(125,211,252,0.12)", borderWidth: 1, borderColor: "rgba(125,211,252,0.35)" }}>
                        <Text style={{ color: "#7DD3FC", fontWeight: "900", fontSize: 11 }}>VOTE READY</Text>
                      </View>
                    ) : null}
                    {player.status === "eliminated" ? <Text style={{ color: "#FCA5A5", fontSize: 16 }}>☠</Text> : null}
                  </View>
                  <Text style={{ color: player.status === "alive" ? "#94A3B8" : "#FCA5A5" }}>{player.status === "alive" ? "Alive" : "Eliminated"}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  {player.id === myPlayer.id ? <Text style={{ color: "#BAE6FD", fontWeight: "900" }}>YOU</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {role === "villager" && villagerPrivateReads.length > 0 ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Your private reads</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 21 }}>Only visible on this device. Use them to remember your gut feeling across rounds.</Text>
            {villagerPrivateReads.map((entry) => (
              <View
                key={entry.player?.id}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>{entry.player?.display_name}</Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: entry.tag?.backgroundColor ?? "#111827",
                    borderWidth: 1,
                    borderColor: entry.tag?.borderColor ?? "#1F2937",
                  }}
                >
                  <Text style={{ color: entry.tag?.color ?? "#E5E7EB", fontWeight: "900", fontSize: 12 }}>{entry.tag?.label}</Text>
                </View>
              </View>
            ))}
          </View>
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
