import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";

const isWeb = Platform.OS === "web";
const GAME_ENTRY_DELAY_MS = 180;

export default function GameLibraryHome() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const isCompact = width < 560;
  const games = [
    {
      slug: "picklo",
      title: "MemeMatch",
      tagline: t("game.memematch.tagline"),
      recommendedPlayers: "3-12 players",
      accent: "#38BDF8",
      description: t("game.memematch.description"),
      icon: require("../assets/Memematch.png"),
      cta: t("game.memematch.cta"),
      comingSoon: false,
    },
    {
      slug: "mafia",
      title: "Mafia",
      tagline: t("game.mafia.tagline"),
      recommendedPlayers: "5-20 players",
      accent: "#F43F5E",
      description: t("game.mafia.description"),
      icon: require("../assets/mafia.png"),
      cta: t("game.mafia.cta"),
      comingSoon: false,
    },
    {
      slug: "imposter",
      title: "Imposter",
      tagline: t("game.imposter.tagline"),
      recommendedPlayers: "4-12 players",
      accent: "#F59E0B",
      description: t("game.imposter.description"),
      icon: require("../assets/imposter.png"),
      cta: t("game.imposter.cta"),
      comingSoon: false,
    },
    {
      slug: "chicago",
      title: "Chicago",
      tagline: t("game.chicago.tagline"),
      recommendedPlayers: "2-6 players",
      accent: "#38BDF8",
      description: t("game.chicago.description"),
      icon: require("../assets/chicago.png"),
      cta: t("game.chicago.cta"),
      comingSoon: false,
    },
    {
      slug: "music-quiz",
      title: "Music Quiz",
      tagline: t("game.music.tagline"),
      recommendedPlayers: "2-20 players",
      accent: "#22C55E",
      description: t("game.music.description"),
      icon: require("../assets/musicquiz.png"),
      cta: t("game.music.cta"),
      comingSoon: false,
    },
  ] as const;
  const footerLinks = [
    { label: t("home.legal.privacy"), href: "/privacy-policy" },
    { label: t("home.legal.terms"), href: "/terms-of-service" },
    { label: t("home.legal.guidelines"), href: "/community-guidelines" },
    { label: t("home.legal.contact"), href: "/contact" },
  ];
  const [transitioningGame, setTransitioningGame] = useState<(typeof games)[number] | null>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayScale = useRef(new Animated.Value(0.96)).current;

  const goToGame = (game: (typeof games)[number]) => {
    if (transitioningGame) {
      return;
    }

    setTransitioningGame(game);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0.12,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 0.972,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 14,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(overlayScale, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.back(1.1)),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setTimeout(() => {
          router.push(`/${game.slug}` as any);
        }, GAME_ENTRY_DELAY_MS);
      }
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />

      <Animated.View
        style={{
          flex: 1,
          opacity: contentOpacity,
          transform: [{ scale: contentScale }, { translateY: contentTranslateY }],
        }}
      >
        <ScrollView
          scrollEnabled={!transitioningGame}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: isCompact ? 16 : 20,
            paddingTop: isCompact ? 26 : 36,
            paddingBottom: isCompact ? 28 : 36,
            alignItems: "center",
          }}
        >
          <View style={{ width: "100%", maxWidth: isWeb ? 980 : 560, gap: isCompact ? 18 : 22 }}>
            <View style={{ gap: isCompact ? 14 : 16, alignItems: "center" }}>
              <View style={{ alignItems: "center", gap: 14 }}>
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

                <View style={{ gap: 4, alignItems: "center" }}>
                  <Text style={{ color: "#F8FAFC", fontSize: isCompact ? 32 : isWeb ? 28 : 24, fontWeight: "900" }}>Picklo</Text>
                </View>
              </View>

                <Text
                style={{
                  color: "#94A3B8",
                  fontSize: isCompact ? 15 : 16,
                  lineHeight: isCompact ? 22 : 24,
                  maxWidth: 700,
                  marginBottom: isCompact ? 4 : 8,
                  marginTop: isCompact ? -4 : -8,
                  textAlign: isCompact || isWeb ? "center" : "left",
                }}
                >
                {t("home.subtitle")}
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
              <Text style={{ color: "#E2E8F0", fontSize: 16, fontWeight: "800" }}>{t("home.featured")}</Text>

              {games.map((game) => (
                <Pressable
                  key={game.slug}
                  disabled={!!transitioningGame}
                  onPress={() => goToGame(game)}
                  style={({ pressed }) => ({
                    borderRadius: 24,
                    overflow: "hidden",
                    backgroundColor: "#020617",
                    borderWidth: 1,
                    borderColor: pressed ? game.accent : "#1F2937",
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                    opacity: game.comingSoon ? 0.92 : 1,
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
                            width: isCompact ? 70 : 72,
                            height: isCompact ? 70 : 72,
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

                      {game.comingSoon ? (
                        <View
                          style={{
                            alignSelf: isCompact ? "flex-start" : "center",
                            paddingVertical: 7,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: "rgba(34,197,94,0.16)",
                            borderWidth: 1,
                            borderColor: "rgba(134,239,172,0.32)",
                          }}
                        >
                          <Text style={{ color: "#BBF7D0", fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>
                            {t("home.coming_soon")}
                          </Text>
                        </View>
                      ) : null}

                    </View>

                    <View style={{ flexDirection: "column", gap: 12 }}>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          backgroundColor: "#131a29",
                          borderWidth: 1,
                          borderColor: "#5d7393",
                        }}
                      >
                        <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 12 }}>
                          {t("home.recommended", { players: game.recommendedPlayers })}
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
                          backgroundColor: game.comingSoon ? "#0F172A" : "#000000",
                          borderColor: game.comingSoon ? game.accent : "#f2f2f2",
                          borderWidth: 1,
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "900", textAlign: "center", fontSize: 14, textTransform: game.comingSoon ? "uppercase" : "none" }}>{game.cta}</Text>
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
                <Text style={{ color: "#E2E8F0", fontSize: 14, fontWeight: "900" }}>{t("home.legal.title")}</Text>
                <Text style={{ color: "#64748B", fontSize: 13, lineHeight: 20 }}>
                  {t("home.legal.body")}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {footerLinks.map((link) => (
                  <Pressable
                    key={link.href}
                    onPress={() => router.push(link.href as any)}
                    style={({ pressed }) => ({
                      width: isCompact ? "48.5%" : "48.8%",
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
                {t("home.footer")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {transitioningGame ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            opacity: overlayOpacity,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
            backgroundColor: "rgba(7,11,20,0.72)",
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: isCompact ? 280 : 360,
              borderRadius: 30,
              padding: isCompact ? 20 : 24,
              backgroundColor: "#08111F",
              borderWidth: 1,
              borderColor: `${transitioningGame.accent}66`,
              shadowColor: transitioningGame.accent,
              shadowOpacity: 0.32,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 18,
              transform: [{ scale: overlayScale }],
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: isCompact ? 78 : 92,
                height: isCompact ? 78 : 92,
                borderRadius: isCompact ? 22 : 26,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: transitioningGame.accent,
                backgroundColor: "#111827",
              }}
            >
              <Image source={transitioningGame.icon} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            </View>

            <Text
              style={{
                color: "#F8FAFC",
                textAlign: "center",
                fontSize: isCompact ? 26 : 30,
                fontWeight: "900",
                marginTop: 18,
              }}
            >
              {transitioningGame.title}
            </Text>

            <Text
              style={{
                color: "#94A3B8",
                textAlign: "center",
                fontSize: 14,
                lineHeight: 22,
                marginTop: 8,
              }}
            >
              {t("home.opening")}
            </Text>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}
