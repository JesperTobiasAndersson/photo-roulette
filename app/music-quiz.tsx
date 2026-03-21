import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { useI18n } from "../src/lib/i18n";

export default function MusicQuizComingSoon() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Music Quiz",
          body: "Det här spelet är markerat som kommande och är inte öppet ännu.",
          sub: "Vi gömmer det från appen tills flödet är helt klart.",
          back: "Tillbaka till spel",
        }
      : {
          title: "Music Quiz",
          body: "This game is marked as coming soon and is not open yet.",
          sub: "We are keeping it hidden from the app until the flow is fully ready.",
          back: "Back to games",
        };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", padding: 24 }}>
      <StatusBar style="light" />
      <View style={{ alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: 28,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "rgba(34,197,94,0.35)",
            backgroundColor: "#111827",
          }}
        >
          <Image source={require("../assets/musicquiz.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        </View>

        <Text style={{ color: "white", fontSize: 36, fontWeight: "900", textAlign: "center" }}>{copy.title}</Text>
        <Text style={{ color: "#E2E8F0", fontSize: 18, fontWeight: "800", textTransform: "uppercase", textAlign: "center" }}>Coming Soon</Text>
        <Text style={{ color: "#94A3B8", fontSize: 16, lineHeight: 24, textAlign: "center", maxWidth: 420 }}>{copy.body}</Text>
        <Text style={{ color: "#64748B", fontSize: 14, lineHeight: 22, textAlign: "center", maxWidth: 420 }}>{copy.sub}</Text>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            marginTop: 10,
            height: 52,
            minWidth: 220,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.back || t("common.back_to_games")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
