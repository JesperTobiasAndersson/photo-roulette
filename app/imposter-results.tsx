import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { getCategoryById } from "../src/games/imposter/logic";
import { useImposterRoom } from "../src/games/imposter/useImposterRoom";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getRoleBadge(role: string | undefined) {
  if (role === "imposter") return { label: "IMPOSTER", color: "#FCA5A5", backgroundColor: "rgba(252,165,165,0.12)", borderColor: "rgba(252,165,165,0.35)" };
  return { label: "CREW", color: "#FCD34D", backgroundColor: "rgba(252,211,77,0.12)", borderColor: "rgba(252,211,77,0.35)" };
}

export default function ImposterResults() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, playerRoles, currentVotes, loading } = useImposterRoom(roomId, playerId);

  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return counts;
  }, [currentVotes]);

  const category = getCategoryById(room?.category_id ?? null);

  if (loading || !room) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <View style={{ width: "100%", maxWidth: 420, alignItems: "center" }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: "rgba(245,158,11,0.35)",
              marginBottom: 18,
            }}
          >
            <Image source={require("../assets/imposter.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "900", textAlign: "center" }}>Loading Results</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <AnimatedEntrance enterKey={`results-${room.winner}`} delay={30}>
          <View style={{ gap: 6 }}>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Game Ended</Text>
            <Text style={{ color: room.winner === "crew" ? "#FCD34D" : "#FCA5A5", fontWeight: "900", fontSize: 20 }}>
              {room.winner === "crew" ? "Crew wins" : "Imposter wins"}
            </Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{room.public_message}</Text>
            <Text style={{ color: "#CBD5E1" }}>Category: {category?.title?.toUpperCase() ?? "UNKNOWN"}</Text>
            <Text style={{ color: "#CBD5E1" }}>Secret word: {room.secret_prompt?.toUpperCase() ?? "UNKNOWN"}</Text>
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance enterKey={`table-${players.length}`} delay={80}>
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>Final table</Text>
            {players.map((player, index) => {
              const role = playerRoles.find((entry) => entry.player_id === player.id)?.role;
              const badge = getRoleBadge(role);
              const votes = voteTallies.get(player.id) ?? 0;
              return (
                <AnimatedEntrance key={player.id} enterKey={`result-${player.id}-${votes}`} delay={120 + index * 32} distance={10}>
                  <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", gap: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: badge.backgroundColor,
                          borderWidth: 1,
                          borderColor: badge.borderColor,
                        }}
                      >
                        <Text style={{ color: badge.color, fontWeight: "900", fontSize: 12 }}>{badge.label}</Text>
                      </View>
                    </View>
                    <Text style={{ color: "#94A3B8" }}>{votes} vote{votes === 1 ? "" : "s"}</Text>
                  </View>
                </AnimatedEntrance>
              );
            })}
          </View>
        </AnimatedEntrance>

        <Pressable
          onPress={() => router.replace("/imposter")}
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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to Imposter home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
