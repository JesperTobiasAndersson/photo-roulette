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
          Effective date: March 20, 2026. By accessing or using Picklo, you agree to these Terms of Service. If you do
          not agree, do not use the service.
        </Text>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Use of the service</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            You may use the service only in compliance with applicable law and these terms. You are responsible for
            your activity, your display name, room participation, and any content you upload or share through the app.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Acceptable conduct</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            You may not use the service to harass others, upload unlawful or infringing material, distribute harmful
            content, interfere with gameplay, scrape the service, reverse engineer protected functionality, or attempt
            to disrupt the platform.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>User content</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            You keep ownership of content you upload, but you grant us a limited license to host, store, process,
            display, and transmit that content as needed to operate the service. You confirm that you have the rights
            needed to upload and share your content.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Premium features and payments</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Some features may require payment or an active subscription. Pricing, billing, renewal, cancellation, and
            refund handling may depend on the platform or payment channel you use.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Availability and disclaimers</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Multiplayer sessions depend on internet access, device compatibility, and outside infrastructure. The
            service is provided on an as-is and as-available basis, and we do not guarantee uninterrupted availability
            or error-free operation.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Suspension and termination</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may suspend or terminate access if we believe you violated these terms, created risk for the service or
            other users, or used the platform unlawfully.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Liability and changes</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential,
            or punitive damages arising from your use of the service.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may update these terms from time to time. Continued use of the service after changes take effect means
            you accept the updated terms.
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
