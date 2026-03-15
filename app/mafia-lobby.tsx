import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Alert, Platform, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";
import { assignRoles, getRoleSummaryText } from "../src/games/mafia/logic";
import type { MafiaPhase, MafiaPlayer, MafiaRoom } from "../src/games/mafia/types";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MafiaLobby() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);

  const [room, setRoom] = useState<MafiaRoom | null>(null);
  const [players, setPlayers] = useState<MafiaPlayer[]>([]);
  const [starting, setStarting] = useState(false);

  const isHost = room?.host_player_id === playerId;
  const roleSummary = useMemo(() => getRoleSummaryText(players.length), [players.length]);
  const baseUrl = Platform.OS === "web" ? window.location.origin : "https://picklo.app";
  const inviteUrl = room?.code ? `${baseUrl}/mafia?code=${room.code}` : "";

  const load = async () => {
    if (!roomId) return;

    const [{ data: roomData, error: roomErr }, { data: playerData, error: playerErr }] = await Promise.all([
      supabase.from("mafia_rooms").select("*").eq("id", roomId).single(),
      supabase.from("mafia_players").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
    ]);

    if (roomErr) return Alert.alert("Error loading room", roomErr.message);
    if (playerErr) return Alert.alert("Error loading players", playerErr.message);

    setRoom(roomData as MafiaRoom);
    setPlayers((playerData ?? []) as MafiaPlayer[]);
  };

  useEffect(() => {
    load();
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const roomChannel = supabase
      .channel(`mafia-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_rooms", filter: `id=eq.${roomId}` }, () => load())
      .subscribe();

    const playersChannel = supabase
      .channel(`mafia-players-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mafia_players", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
    };
  }, [roomId, playerId]);

  useEffect(() => {
    const phase = room?.phase as MafiaPhase | undefined;
    if (!phase) return;
    if (phase === "night" || phase === "day") {
      router.replace({ pathname: "/mafia-game", params: { roomId, playerId } });
    }
    if (phase === "finished") {
      router.replace({ pathname: "/mafia-results", params: { roomId, playerId } });
    }
  }, [room?.phase, roomId, playerId]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    Alert.alert("Copied", inviteUrl);
  };

  const startGame = async () => {
    if (!roomId || !isHost) return;
    if (players.length < 4) return Alert.alert("Need more players", "At least 4 players are needed for Mafia.");

    setStarting(true);
    try {
      const assignments = assignRoles(players.map((player) => player.id));
      await Promise.all(
        players.map((player) =>
          supabase
            .from("mafia_players")
            .update({
              role: assignments[player.id],
              is_alive: true,
              private_message: null,
            })
            .eq("id", player.id)
        )
      );

      const { error } = await supabase
        .from("mafia_rooms")
        .update({
          phase: "night",
          day_number: 1,
          winner: null,
          night_result: "Roles assigned. Night 1 begins.",
          last_eliminated_player_id: null,
        })
        .eq("id", roomId);

      if (error) return Alert.alert("Error starting game", error.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Mafia Lobby</Text>
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: "#0F172A",
              borderWidth: 1,
              borderColor: "#1E293B",
              gap: 8,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Room code: {room?.code ?? "----"}</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 21 }}>
              Share the invite link or room code with your group. {roleSummary}
            </Text>
            <Pressable
              onPress={copyInvite}
              disabled={!room?.code}
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
              <Text style={{ color: "white", fontWeight: "900" }}>Copy invitation link</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 14,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>Players</Text>
            <Text style={{ color: "#94A3B8", fontWeight: "800" }}>{players.length} joined</Text>
          </View>

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
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>{player.name}</Text>
              <Text style={{ color: room?.host_player_id === player.id ? "#FDA4AF" : "#64748B", fontWeight: "800" }}>
                {room?.host_player_id === player.id ? "HOST" : "PLAYER"}
              </Text>
            </View>
          ))}

          {isHost ? (
            <Pressable
              onPress={startGame}
              disabled={starting || players.length < 4}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#7F1D1D",
                borderWidth: 1,
                borderColor: "#991B1B",
                opacity: starting || players.length < 4 ? 0.5 : pressed ? 0.92 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
                {starting ? "Starting..." : "Start Mafia game"}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: "#94A3B8", lineHeight: 21 }}>Waiting for the host to assign roles and start the game.</Text>
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/mafia")}
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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to Mafia home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
