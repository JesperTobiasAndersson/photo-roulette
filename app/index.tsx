import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";

const isWeb = Platform.OS === "web";

const games = [
  {
    slug: "picklo",
    title: "MemeMatch",
    tagline: "Pick images. Match the statement. Vote. Laugh.",
    status: "Available now",
    accent: "#38BDF8",
    description: "Multiplayer party game with room codes, realtime rounds, image uploads, voting, and results.",
    icon: require("../assets/Memematch.png"),
    cta: "Open MemeMatch",
  },
  {
    slug: "mafia",
    title: "Mafia",
    tagline: "Hidden roles, bluffing, and social deduction.",
    status: "Starter ready",
    accent: "#F43F5E",
    description: "Separate game module for role assignment, day and night phases, voting, and eliminations.",
    icon: require("../assets/mafia.png"),
    cta: "Open Mafia",
  },
];

export default function GameLibraryHome() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14", padding: 20 }}>
      <StatusBar style="light" />

      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: isWeb ? 980 : 520, gap: 22 }}>
          <View style={{ gap: 16, alignItems: isWeb ? "center" : "flex-start" }}>
            <View style={{ alignItems: isWeb ? "center" : "flex-start", gap: 14 }}>
              <View
                style={{
                  width: isWeb ? 132 : 104,
                  height: isWeb ? 132 : 104,
                  borderRadius: 32,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(56,189,248,0.35)",
                  backgroundColor: "#111827",
                  shadowColor: "#38BDF8",
                  shadowOpacity: 0.28,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 12,
                }}
              >
                <Image source={require("../assets/icon.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </View>

              <View style={{ gap: 4, alignItems: isWeb ? "center" : "flex-start" }}>
                <Text style={{ color: "#F8FAFC", fontSize: isWeb ? 28 : 24, fontWeight: "900" }}>Picklo</Text>
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>Party game collection</Text>
              </View>
            </View>

            <Text style={{ color: "#F8FAFC", fontSize: isWeb ? 34 : 28, fontWeight: "800" }}>Game Library</Text>
            <Text
              style={{
                color: "#94A3B8",
                fontSize: 16,
                lineHeight: 24,
                maxWidth: 700,
                textAlign: isWeb ? "center" : "left",
              }}
            >
              Choose a game to launch. MemeMatch is available now, and this home screen is ready for more games over
              time.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: "#0F172A",
              borderRadius: 28,
              padding: 20,
              borderWidth: 1,
              borderColor: "#1E293B",
              gap: 16,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontSize: 16, fontWeight: "800" }}>Featured Games</Text>

            {games.map((game) => (
              <Pressable
                key={game.slug}
                onPress={() => router.push(`/${game.slug}` as any)}
                style={({ pressed }) => ({
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: pressed ? game.accent : "#1F2937",
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <View
                  style={{
                    padding: 20,
                    gap: 16,
                    backgroundColor: "rgba(15,23,42,0.92)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 20,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: game.accent,
                          backgroundColor: "#111827",
                        }}
                      >
                        <Image source={game.icon} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: "#F8FAFC", fontSize: 28, fontWeight: "900" }}>{game.title}</Text>
                        <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 22 }}>{game.tagline}</Text>
                      </View>
                    </View>

                    <View
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: `${game.accent}22`,
                        borderWidth: 1,
                        borderColor: `${game.accent}55`,
                      }}
                    >
                      <Text style={{ color: "#E2E8F0", fontWeight: "900", fontSize: 12 }}>{game.status}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: isWeb ? "row" : "column", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 22, flex: 1 }}>{game.description}</Text>

                    <View
                      style={{
                        alignSelf: isWeb ? "center" : "flex-start",
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 16,
                        backgroundColor: "#000000",
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }}>{game.cta}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
