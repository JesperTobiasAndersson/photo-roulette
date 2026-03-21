import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { useMafiaRoom } from "../src/games/mafia/useMafiaRoom";
import { useI18n } from "../src/lib/i18n";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getRoleBadge(role: string | undefined, language: "en" | "sv") {
  if (role === "mafia") return { label: "MAFIA", color: "#FDA4AF", backgroundColor: "rgba(244,63,94,0.12)", borderColor: "rgba(244,63,94,0.3)" };
  if (role === "doctor") return { label: language === "sv" ? "DOKTOR" : "DOCTOR", color: "#86EFAC", backgroundColor: "rgba(134,239,172,0.12)", borderColor: "rgba(134,239,172,0.3)" };
  if (role === "police") return { label: language === "sv" ? "POLIS" : "POLICE", color: "#93C5FD", backgroundColor: "rgba(147,197,253,0.12)", borderColor: "rgba(147,197,253,0.3)" };
  return { label: language === "sv" ? "BYBO" : "VILLAGER", color: "#E2E8F0", backgroundColor: "rgba(148,163,184,0.12)", borderColor: "rgba(148,163,184,0.3)" };
}

export default function MafiaResults() {
  const { language } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, myRole, playerRoles, loading } = useMafiaRoom(roomId, playerId);

  const copy =
    language === "sv"
      ? {
          loading: "Laddar resultat",
          loadingBody: "Hämtar slutresultatet och bordets status.",
          ended: "Spelet är slut",
          mafiaWins: "Mafian vinner",
          villageWins: "Byn vinner",
          yourRole: "Din roll",
          unknown: "OKÄND",
          table: "SLUTTABELL",
          survived: "Överlevde",
          eliminated: "Utslagen",
          back: "Tillbaka till Mafia",
        }
      : {
          loading: "Loading Results",
          loadingBody: "Pulling in the final outcome and table status.",
          ended: "Game Ended",
          mafiaWins: "Mafia wins",
          villageWins: "Village wins",
          yourRole: "Your role",
          unknown: "UNKNOWN",
          table: "FINAL TABLE",
          survived: "Survived",
          eliminated: "Eliminated",
          back: "Back to Mafia home",
        };

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
              borderColor: "rgba(244,63,94,0.35)",
              marginBottom: 18,
            }}
          >
            <Image source={require("../assets/mafia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 32, fontWeight: "900", textAlign: "center" }}>{copy.loading}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 10 }}>{copy.loadingBody}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>{copy.ended}</Text>
        <Text style={{ color: room.winner === "mafia" ? "#FDA4AF" : "#BAE6FD", fontWeight: "900", fontSize: 20 }}>
          {room.winner === "mafia" ? copy.mafiaWins : copy.villageWins}
        </Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{room.public_message}</Text>
        <Text style={{ color: "#CBD5E1" }}>
          {copy.yourRole}: {myRole?.role?.toUpperCase() ?? copy.unknown}
        </Text>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{copy.table}</Text>
          {players.map((player) => {
            const playerRole = playerRoles.find((role) => role.player_id === player.id)?.role;
            const roleBadge = getRoleBadge(playerRole, language);

            return (
              <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: roleBadge.backgroundColor,
                      borderWidth: 1,
                      borderColor: roleBadge.borderColor,
                    }}
                  >
                    <Text style={{ color: roleBadge.color, fontWeight: "900", fontSize: 12 }}>{roleBadge.label}</Text>
                  </View>
                </View>
                <Text style={{ color: player.status === "alive" ? "#86EFAC" : "#FCA5A5" }}>
                  {player.status === "alive" ? copy.survived : copy.eliminated}
                </Text>
              </View>
            );
          })}
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
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.back}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
