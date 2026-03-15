import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";
import type { MafiaPlayer, MafiaRoom } from "../src/games/mafia/types";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MafiaResults() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);

  const [room, setRoom] = useState<MafiaRoom | null>(null);
  const [players, setPlayers] = useState<MafiaPlayer[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!roomId) return;
      const [{ data: roomData }, { data: playersData }] = await Promise.all([
        supabase.from("mafia_rooms").select("*").eq("id", roomId).single(),
        supabase.from("mafia_players").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
      ]);
      setRoom((roomData as MafiaRoom) ?? null);
      setPlayers((playersData as MafiaPlayer[]) ?? []);
    };

    load();
  }, [roomId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Mafia Results</Text>
          <Text style={{ color: room?.winner === "mafia" ? "#FDA4AF" : "#BAE6FD", fontSize: 18, fontWeight: "900" }}>
            {room?.winner === "mafia" ? "Mafia wins" : room?.winner === "town" ? "Town wins" : "Game finished"}
          </Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{room?.night_result ?? "Final outcome ready."}</Text>
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
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Final roles</Text>
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
                gap: 4,
              }}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{player.name}</Text>
              <Text style={{ color: "#CBD5E1" }}>Role: {(player.role ?? "villager").toUpperCase()}</Text>
              <Text style={{ color: player.is_alive ? "#86EFAC" : "#FCA5A5" }}>
                {player.is_alive ? "Survived" : "Eliminated"}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.replace("/mafia")}
          style={({ pressed }) => ({
            height: 52,
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

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            height: 52,
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
