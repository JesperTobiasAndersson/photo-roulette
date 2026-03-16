import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function PrivacyPolicyScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Privacy Policy</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
          Picklo provides party games including MemeMatch and Mafia. This policy explains what information the app may
          process when you use the games.
        </Text>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Information we process</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may process player names, room codes, gameplay state, votes, and images selected for MemeMatch. Mafia
            stores room, player, role, and action data needed to run the game.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            If advertising is enabled, third-party providers such as Google may collect device and usage data according
            to their own policies.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>How we use information</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Data is used to run multiplayer sessions, synchronize players in real time, show game results, and improve
            the app experience.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Storage and sharing</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            App data is stored using Supabase services configured by the developer. We do not sell personal data. We
            may rely on service providers for hosting, analytics, payments, and advertising.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Contact</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            For privacy questions or deletion requests, use the contact details listed on the Contact page in the app
            footer.
          </Text>
        </View>

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
          <Text style={{ color: "white", fontWeight: "900" }}>Back to home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
