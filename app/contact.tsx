import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function ContactScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Contact</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
          Contact Picklo for support, privacy requests, moderation issues, or legal notices using the details below.
        </Text>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Support email</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>support@picklo.app</Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
            Use this for account issues, gameplay problems, billing questions, bug reports, and general support.
          </Text>
        </View>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Privacy or data requests</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>privacy@picklo.app</Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
            Use this for access, correction, deletion, and privacy-related questions. Include enough detail for us to
            identify the relevant session or request.
          </Text>
        </View>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Response expectations</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We aim to respond within a reasonable time. For legal or privacy matters, additional verification may be
            required before we process certain requests.
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
