import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";
import {
  getAlivePlayers,
  getRequiredNightActors,
  getRoleDescription,
  getWinner,
  hasNightAction,
  resolveDayVote,
  resolveNightState,
} from "../src/games/mafia/logic";
import type { MafiaAction, MafiaActionType, MafiaPhase, MafiaPlayer, MafiaRoom } from "../src/games/mafia/types";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MafiaGame() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);

  const [room, setRoom] = useState<MafiaRoom | null>(null);
  const [players, setPlayers] = useState<MafiaPlayer[]>([]);
  const [actions, setActions] = useState<MafiaAction[]>([]);
  const [busy, setBusy] = useState(false);

  const myPlayer = useMemo(() => players.find((player) => player.id === playerId) ?? null, [players, playerId]);
  const alivePlayers = useMemo(() => getAlivePlayers(players), [players]);
  const currentPhase = (room?.phase ?? "lobby") as MafiaPhase;
  const currentDay = room?.day_number ?? 0;
  const isHost = room?.host_player_id === playerId;
  const currentActions = useMemo(
    () => actions.filter((action) => action.day_number === currentDay && action.phase === currentPhase),
    [actions, currentDay, currentPhase]
  );

  const load = async () => {
    if (!roomId) return;

    const [{ data: roomData, error: roomErr }, { data: playerData, error: playerErr }, { data: actionData, error: actionErr }] =
      await Promise.all([
        supabase.from("mafia_rooms").select("*").eq("id", roomId).single(),
        supabase.from("mafia_players").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
        supabase.from("mafia_actions").select("*").eq("room_id", roomId),
      ]);

    if (roomErr) return Alert.alert("Error loading room", roomErr.message);
    if (playerErr) return Alert.alert("Error loading players", playerErr.message);
    if (actionErr) return Alert.alert("Error loading actions", actionErr.message);

    setRoom(roomData as MafiaRoom);
    setPlayers((playerData ?? []) as MafiaPlayer[]);
    setActions((actionData ?? []) as MafiaAction[]);
  };

  useEffect(() => {
    load();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`mafia-room-live-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_rooms", filter: `id=eq.${roomId}` }, () => load())
      .subscribe();

    const playersChannel = supabase
      .channel(`mafia-players-live-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_players", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();

    const actionsChannel = supabase
      .channel(`mafia-actions-live-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_actions", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(actionsChannel);
    };
  }, [roomId]);

  useEffect(() => {
    if (room?.phase === "finished") {
      router.replace({ pathname: "/mafia-results", params: { roomId, playerId } });
    }
    if (room?.phase === "lobby") {
      router.replace({ pathname: "/mafia-lobby", params: { roomId, playerId } });
    }
  }, [room?.phase, roomId, playerId]);

  const submitAction = async (actionType: MafiaActionType, targetPlayerId: string) => {
    if (!roomId || !playerId || !room || !myPlayer?.is_alive) return;

    const { error } = await supabase.from("mafia_actions").upsert(
      {
        room_id: roomId,
        day_number: room.day_number,
        phase: room.phase,
        action_type: actionType,
        actor_player_id: playerId,
        target_player_id: targetPlayerId,
      },
      { onConflict: "room_id,day_number,phase,actor_player_id,action_type" }
    );

    if (error) Alert.alert("Action failed", error.message);
  };

  const resolveNight = async () => {
    if (!roomId || !room || currentPhase !== "night") return;
    const requiredActors = getRequiredNightActors(players);
    const allSubmitted = requiredActors.every((id) => hasNightAction(id, currentActions, players));
    if (!allSubmitted) return Alert.alert("Not ready yet", "Waiting for all active night roles to submit.");

    setBusy(true);
    try {
      const outcome = resolveNightState(players, currentActions);
      const updatedPlayers = players.map((player) => {
        if (outcome.eliminatedPlayerId && player.id === outcome.eliminatedPlayerId) {
          return { ...player, is_alive: false };
        }
        if (outcome.detectiveMessages[player.id]) {
          return { ...player, private_message: outcome.detectiveMessages[player.id] };
        }
        return player;
      });

      if (outcome.eliminatedPlayerId) {
        await supabase.from("mafia_players").update({ is_alive: false }).eq("id", outcome.eliminatedPlayerId);
      }

      await Promise.all(
        Object.entries(outcome.detectiveMessages).map(([actorId, message]) =>
          supabase.from("mafia_players").update({ private_message: message }).eq("id", actorId)
        )
      );

      const winner = getWinner(updatedPlayers);
      const roomPatch = winner
        ? { phase: "finished", winner, night_result: outcome.summary, last_eliminated_player_id: outcome.eliminatedPlayerId }
        : { phase: "day", night_result: outcome.summary, last_eliminated_player_id: outcome.eliminatedPlayerId };

      const { error } = await supabase.from("mafia_rooms").update(roomPatch).eq("id", roomId);
      if (error) Alert.alert("Resolve failed", error.message);
    } finally {
      setBusy(false);
    }
  };

  const resolveDay = async () => {
    if (!roomId || !room || currentPhase !== "day") return;
    const aliveIds = alivePlayers.map((player) => player.id);
    const voteActions = currentActions.filter((action) => action.action_type === "day_vote");
    const allSubmitted = aliveIds.every((id) => voteActions.some((action) => action.actor_player_id === id));
    if (!allSubmitted) return Alert.alert("Not ready yet", "Waiting for all alive players to vote.");

    setBusy(true);
    try {
      const outcome = resolveDayVote(players, voteActions);
      const updatedPlayers = players.map((player) =>
        outcome.eliminatedPlayerId && player.id === outcome.eliminatedPlayerId ? { ...player, is_alive: false } : player
      );

      if (outcome.eliminatedPlayerId) {
        await supabase.from("mafia_players").update({ is_alive: false }).eq("id", outcome.eliminatedPlayerId);
      }

      const winner = getWinner(updatedPlayers);
      const roomPatch = winner
        ? {
            phase: "finished",
            winner,
            night_result: outcome.summary,
            last_eliminated_player_id: outcome.eliminatedPlayerId,
          }
        : {
            phase: "night",
            day_number: room.day_number + 1,
            night_result: outcome.summary,
            last_eliminated_player_id: outcome.eliminatedPlayerId,
          };

      const { error } = await supabase.from("mafia_rooms").update(roomPatch).eq("id", roomId);
      if (error) Alert.alert("Resolve failed", error.message);
    } finally {
      setBusy(false);
    }
  };

  const mySelectedTargetId = useMemo(() => {
    if (!myPlayer) return null;
    return currentActions.find((action) => action.actor_player_id === myPlayer.id)?.target_player_id ?? null;
  }, [currentActions, myPlayer]);

  const availableTargets = useMemo(() => {
    if (!myPlayer || !myPlayer.is_alive) return [];
    if (currentPhase === "night") {
      if (myPlayer.role === "mafia") return players.filter((player) => player.is_alive && player.role !== "mafia");
      if (myPlayer.role === "detective") return players.filter((player) => player.is_alive && player.id !== myPlayer.id);
      if (myPlayer.role === "doctor") return players.filter((player) => player.is_alive);
      return [];
    }
    if (currentPhase === "day") return players.filter((player) => player.is_alive && player.id !== myPlayer.id);
    return [];
  }, [currentPhase, myPlayer, players]);

  const requiredNightActors = useMemo(() => getRequiredNightActors(players), [players]);
  const allNightSubmitted = requiredNightActors.every((id) => hasNightAction(id, currentActions, players));
  const dayVotes = currentActions.filter((action) => action.action_type === "day_vote");
  const allDaySubmitted = alivePlayers.every((player) => dayVotes.some((action) => action.actor_player_id === player.id));

  if (!room || !myPlayer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", padding: 20 }}>
        <Text style={{ color: "white" }}>Loading Mafia game...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Mafia</Text>
          <Text style={{ color: "#94A3B8" }}>
            Day {room.day_number} · {room.phase === "night" ? "Night phase" : "Day phase"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 10,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Your role</Text>
          <Text style={{ color: myPlayer.role === "mafia" ? "#FDA4AF" : "#E2E8F0", fontSize: 20, fontWeight: "900" }}>
            {(myPlayer.role ?? "villager").toUpperCase()}
          </Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{getRoleDescription(myPlayer.role ?? "villager")}</Text>
          {!myPlayer.is_alive ? <Text style={{ color: "#FCA5A5", fontWeight: "900" }}>You have been eliminated.</Text> : null}
          {myPlayer.private_message ? (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937" }}>
              <Text style={{ color: "#BAE6FD", fontWeight: "900" }}>Private clue</Text>
              <Text style={{ color: "#E2E8F0", marginTop: 6, lineHeight: 21 }}>{myPlayer.private_message}</Text>
            </View>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 10,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>
            {currentPhase === "night" ? "Night briefing" : "Town square"}
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.night_result || "No events yet."}</Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
            {currentPhase === "night"
              ? "Night roles submit their actions. The host resolves the night when all required roles have acted."
              : "All alive players vote to eliminate someone. The host resolves the vote once everyone has voted."}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 10,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>
            {currentPhase === "night" ? "Choose your action" : "Vote to eliminate"}
          </Text>

          {availableTargets.length > 0 ? (
            availableTargets.map((target) => (
              <Pressable
                key={target.id}
                onPress={() => {
                  const actionType: MafiaActionType =
                    currentPhase === "day"
                      ? "day_vote"
                      : myPlayer.role === "mafia"
                      ? "mafia_target"
                      : myPlayer.role === "doctor"
                      ? "doctor_save"
                      : "detective_check";
                  submitAction(actionType, target.id);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: mySelectedTargetId === target.id ? "#7F1D1D" : "#020617",
                  borderWidth: 1,
                  borderColor: mySelectedTargetId === target.id ? "#991B1B" : "#1F2937",
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>{target.name}</Text>
                <Text style={{ color: "#94A3B8", marginTop: 4 }}>{target.is_alive ? "Alive" : "Eliminated"}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
              {myPlayer.is_alive
                ? currentPhase === "night"
                  ? "You do not have a night action this round."
                  : "Choose from the alive players once voting begins."
                : "You are eliminated, so you are now observing the game."}
            </Text>
          )}

          {isHost && currentPhase === "night" ? (
            <Pressable
              onPress={resolveNight}
              disabled={!allNightSubmitted || busy}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#7F1D1D",
                opacity: !allNightSubmitted || busy ? 0.5 : pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{busy ? "Resolving..." : "Resolve night"}</Text>
            </Pressable>
          ) : null}

          {isHost && currentPhase === "day" ? (
            <Pressable
              onPress={resolveDay}
              disabled={!allDaySubmitted || busy}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#7F1D1D",
                opacity: !allDaySubmitted || busy ? 0.5 : pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{busy ? "Resolving..." : "Resolve vote"}</Text>
            </Pressable>
          ) : null}

          {currentPhase === "night" ? (
            <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
              Required night actions ready: {requiredNightActors.filter((id) => hasNightAction(id, currentActions, players)).length}/
              {requiredNightActors.length}
            </Text>
          ) : (
            <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
              Votes submitted: {dayVotes.length}/{alivePlayers.length}
            </Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 10,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Players</Text>
          {players.map((player) => (
            <View
              key={player.id}
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
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "800" }}>{player.name}</Text>
                <Text style={{ color: player.is_alive ? "#94A3B8" : "#FCA5A5", marginTop: 4 }}>
                  {player.is_alive ? "Alive" : "Eliminated"}
                </Text>
              </View>
              {player.id === playerId ? <Text style={{ color: "#BAE6FD", fontWeight: "900" }}>YOU</Text> : null}
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.replace({ pathname: "/mafia-lobby", params: { roomId, playerId } })}
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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to lobby</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
