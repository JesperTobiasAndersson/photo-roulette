import React from "react";
import { View, Text, Pressable, SafeAreaView, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { setIsPremium } from "../src/lib/premium";
import { useI18n } from "../src/lib/i18n";

export default function Paywall() {
  const { language } = useI18n();
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();
  const copy =
    language === "sv"
      ? {
          title: "Premium",
          body: "Obegränsade rundor och fler funktioner längre fram, som egna påståenden.",
          activeTitle: "Premium aktivt!",
          activeBody: "Mock-premium är nu påslaget.",
          unlock: "Lås upp Premium (mock)",
          later: "Inte nu",
        }
      : {
          title: "Premium",
          body: "Unlimited rounds plus more features later, like custom statements.",
          activeTitle: "Premium active!",
          activeBody: "Mock premium is now on.",
          unlock: "Unlock Premium (mock)",
          later: "Not now",
        };

  const unlock = async () => {
    await setIsPremium(true);
    Alert.alert(copy.activeTitle, copy.activeBody);
    router.replace({ pathname: "/", params: roomId ? { roomId } : {} });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F19" }}>
      <View style={{ flex: 1, padding: 16, gap: 14, justifyContent: "center" }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", textAlign: "center" }}>{copy.title}</Text>
        <Text style={{ color: "#94A3B8", fontSize: 16, lineHeight: 22, textAlign: "center" }}>{copy.body}</Text>

        <Pressable
          onPress={unlock}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "black", fontWeight: "900", fontSize: 16 }}>{copy.unlock}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
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
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{copy.later}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
