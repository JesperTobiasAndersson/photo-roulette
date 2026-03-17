import React from "react";
import { View, Text, Pressable, Platform, ScrollView, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AdConsentBanner } from "../src/lib/ads";

const isWeb = Platform.OS === "web";

const games = [
  {
    slug: "picklo",
    title: "MemeMatch",
    tagline: "Pick images. Match the statement. Vote. Laugh.",
    status: "Available now",
    recommendedPlayers: "3-12 players",
    accent: "#38BDF8",
    description: "Multiplayer party game with room codes, realtime rounds, image uploads, voting, and results.",
    icon: require("../assets/Memematch.png"),
    cta: "Open MemeMatch",
  },
  {
    slug: "mafia",
    title: "Mafia",
    tagline: "Hidden roles, bluffing, and social deduction.",
    status: "Available now",
    recommendedPlayers: "5-20 players",
    accent: "#F43F5E",
    description: "Separate game module for role assignment, day and night phases, voting, and eliminations.",
    icon: require("../assets/mafia.png"),
    cta: "Open Mafia",
  },
  {
    slug: "imposter",
    title: "Imposter",
    tagline: "Blend in, improvise, and expose the fake.",
    status: "Available now",
    recommendedPlayers: "4-12 players",
    accent: "#F59E0B",
    description: "Room-code bluffing game where one player is the imposter and everyone else shares the same secret word.",
    icon: require("../assets/imposter.png"),
    cta: "Open Imposter",
  },
  {
    slug: "chicago",
    title: "Chicago",
    tagline: "Poker scoring, bold calls, and one last trick that matters.",
    status: "Available now",
    recommendedPlayers: "2-6 players",
    accent: "#38BDF8",
    description: "Turn-based multiplayer card game with draw phases, poker scoring, trick play, and race-to-52 scoring.",
    icon: require("../assets/chicago.png"),
    cta: "Open Chicago",
  },
];

const footerLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Contact", href: "/contact" },
];

export default function GameLibraryHome() {
  const { width } = useWindowDimensions();
  const isCompact = width < 560;

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: isCompact ? 16 : 20,
          paddingTop: isCompact ? 26 : 36,
          paddingBottom: isCompact ? 28 : 36,
          alignItems: "center",
        }}
      >
        <View style={{ width: "100%", maxWidth: isWeb ? 980 : 560, gap: isCompact ? 18 : 22 }}>
          <View style={{ gap: isCompact ? 14 : 16, alignItems: isCompact ? "flex-start" : isWeb ? "center" : "flex-start" }}>
            <View style={{ alignItems: isCompact ? "flex-start" : isWeb ? "center" : "flex-start", gap: 14 }}>
              <View
                style={{
                  width: isCompact ? 92 : isWeb ? 132 : 104,
                  height: isCompact ? 92 : isWeb ? 132 : 104,
                  borderRadius: isCompact ? 24 : 32,
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

              <View style={{ gap: 4, alignItems: isCompact ? "flex-start" : isWeb ? "center" : "flex-start" }}>
                <Text style={{ color: "#F8FAFC", fontSize: isCompact ? 22 : isWeb ? 28 : 24, fontWeight: "900" }}>Picklo</Text>
                <Text style={{ color: "#94A3B8", fontSize: 13 }}>Party game collection</Text>
              </View>
            </View>

            <Text style={{ color: "#F8FAFC", fontSize: isCompact ? 24 : isWeb ? 34 : 28, fontWeight: "800" }}>Game Library</Text>
            <Text
              style={{
                color: "#94A3B8",
                fontSize: isCompact ? 15 : 16,
                lineHeight: isCompact ? 22 : 24,
                maxWidth: 700,
                textAlign: isCompact ? "left" : isWeb ? "center" : "left",
              }}
            >
              Choose a game to launch. MemeMatch is available now, and this home screen is ready for more games over
              time.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: "#0F172A",
              borderRadius: isCompact ? 22 : 28,
              padding: isCompact ? 14 : 20,
              borderWidth: 1,
              borderColor: "#1E293B",
              gap: isCompact ? 12 : 16,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontSize: 16, fontWeight: "800" }}>Featured Games</Text>

            {games.map((game) => (
              <Pressable
                key={game.slug}
                onPress={() => {
                  if (game.status === "Coming soon") return;
                  router.push(`/${game.slug}` as any);
                }}
                style={({ pressed }) => ({
                  borderRadius: 24,
                  overflow: "hidden",
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: pressed ? game.accent : "#1F2937",
                  transform: [{ scale: game.status === "Coming soon" ? 1 : pressed ? 0.99 : 1 }],
                  opacity: game.status === "Coming soon" ? 0.88 : 1,
                })}
              >
                <View
                  style={{
                    padding: isCompact ? 14 : 20,
                    gap: isCompact ? 12 : 16,
                    backgroundColor: "rgba(15,23,42,0.92)",
                  }}
                >
                  <View
                    style={{
                      flexDirection: isCompact ? "column" : "row",
                      alignItems: isCompact ? "flex-start" : "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: isCompact ? 58 : 72,
                          height: isCompact ? 58 : 72,
                          borderRadius: isCompact ? 16 : 20,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: game.accent,
                          backgroundColor: "#111827",
                        }}
                      >
                        <Image source={game.icon} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ color: "#F8FAFC", fontSize: isCompact ? 22 : 28, fontWeight: "900" }}>{game.title}</Text>
                        <Text style={{ color: "#94A3B8", fontSize: isCompact ? 14 : 15, lineHeight: isCompact ? 20 : 22 }}>
                          {game.tagline}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        alignSelf: isCompact ? "flex-start" : "auto",
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

                  <View style={{ flexDirection: "column", gap: 12 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: "#111827",
                        borderWidth: 1,
                        borderColor: "#1F2937",
                      }}
                    >
                      <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 12 }}>
                        Recommended: {game.recommendedPlayers}
                      </Text>
                    </View>

                    <Text style={{ color: "#CBD5E1", fontSize: isCompact ? 13 : 14, lineHeight: isCompact ? 20 : 22, flex: 1 }}>
                      {game.description}
                    </Text>

                    <View
                      style={{
                        alignSelf: "stretch",
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

          <View
            style={{
              marginTop: isCompact ? 4 : 8,
              paddingTop: isCompact ? 18 : 22,
              paddingBottom: isCompact ? 6 : 10,
              borderTopWidth: 1,
              borderTopColor: "#182235",
              gap: 14,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ color: "#E2E8F0", fontSize: 14, fontWeight: "900" }}>Legal & Support</Text>
              <Text style={{ color: "#64748B", fontSize: 13, lineHeight: 20 }}>
                Policies, contact information, and app support for Picklo.
              </Text>
            </View>

            <View
              style={{
                flexDirection: isCompact ? "column" : "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {footerLinks.map((link) => (
                <Pressable
                  key={link.href}
                  onPress={() => router.push(link.href as any)}
                  style={({ pressed }) => ({
                    minHeight: 46,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    backgroundColor: "#0B1222",
                    borderWidth: 1,
                    borderColor: "#1E293B",
                    justifyContent: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 13 }}>{link.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: "#475569", fontSize: 12, lineHeight: 18 }}>
              Picklo is a party game collection for web and mobile.
            </Text>
          </View>

          <AdConsentBanner />
        </View>
      </ScrollView>
    </View>
  );
}
