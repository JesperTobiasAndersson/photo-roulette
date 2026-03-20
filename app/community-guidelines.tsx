import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function CommunityGuidelinesScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>Community Guidelines</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>
          Picklo is built for social, funny, and welcoming play. These guidelines explain the standards we expect from
          everyone using the platform.
        </Text>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Keep it respectful</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Treat other players with respect. Harassment, bullying, threats, hate speech, targeted abuse, and repeated
            attempts to humiliate or intimidate others are not allowed.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Share only content you have the right to use</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Do not upload private, sexual, exploitative, violent, illegal, or infringing content. Only share images
            and material you have permission to use, and avoid posting anything that exposes someone else's private
            information.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Do not disrupt the game</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Do not cheat, spam, impersonate others, exploit bugs, manipulate voting unfairly, or interfere with rooms
            in ways that ruin the experience for other players.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Protect minors and sensitive situations</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Content involving child exploitation, grooming, sexualization of minors, or encouragement of self-harm is
            strictly prohibited and may be reported to appropriate authorities where required.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Enforcement</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may remove content, limit features, suspend rooms, or restrict access if we believe these guidelines or
            our terms have been violated. Serious or repeated violations may result in permanent removal from the
            service.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Report issues</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            If you encounter abusive behavior, unsafe content, or another serious issue, contact us using the Contact
            page so we can review it.
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
