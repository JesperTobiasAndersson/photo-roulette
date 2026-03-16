import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function TermsOfServiceScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Terms of Service</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
          By using Picklo and its games, you agree to use the service responsibly and not upload unlawful, abusive, or
          infringing content.
        </Text>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Acceptable use</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            You are responsible for the content you upload and the names you enter into rooms. Do not use the app for
            harassment, hate speech, illegal content, or attempts to disrupt the service.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Game experience</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Multiplayer game sessions depend on network connectivity and third-party infrastructure. Availability and
            performance are provided on an as-is basis.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Third-party services</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            The app may integrate with Supabase, RevenueCat, and Google advertising services. Your use of those
            services may also be subject to their own terms and policies.
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
