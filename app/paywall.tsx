import React from "react";
import { View, Text, Pressable, SafeAreaView, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { setIsPremium } from "../src/lib/premium";

export default function Paywall() {
  const { roomId } = useLocalSearchParams<{ roomId?: string }>();

  const unlock = async () => {
    await setIsPremium(true); // mock unlock
    Alert.alert("Premium active!", "Mock premium is now on.");
    router.replace({ pathname: "/", params: roomId ? { roomId } : {} });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F19" }}>
      <View style={{ flex: 1, padding: 16, gap: 14, justifyContent: "center" }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", textAlign: "center" }}>
          Premium
        </Text>
        <Text style={{ color: "#94A3B8", fontSize: 16, lineHeight: 22, textAlign: "center" }}>
          Unlimited rounds + more features later (custom statements etc.)
        </Text>

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
          <Text style={{ color: "black", fontWeight: "900", fontSize: 16 }}>Unlock Premium (mock)</Text>
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
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
