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
          Effective date: March 20, 2026. This Privacy Policy explains how Picklo collects, uses, stores, and shares
          information when you use the app, website, and multiplayer party games.
        </Text>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Information we collect</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may collect information you provide directly, including display names, room codes, gameplay choices,
            votes, uploaded images, support messages, and any information you include when contacting us.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may also collect technical and usage information such as device type, browser type, app version,
            approximate diagnostics, interaction events, and identifiers needed to keep game sessions working and
            protect the service from abuse.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>How we use information</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We use information to operate game rooms, sync live gameplay, store results, process uploaded content,
            support premium access, respond to support requests, improve reliability, and keep the platform safe.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            On the web, we may also use cookies, local storage, or similar technologies to remember preferences,
            maintain sessions, and support site functionality.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>How information is shared</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may share information with service providers that help us host the app, store content, process payments,
            deliver subscriptions, provide infrastructure, and serve advertising. We do not sell personal information
            for money.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We may also disclose information when required by law, to enforce our terms, or to protect users, the app,
            or the public.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Retention and your choices</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            We keep information for as long as reasonably necessary to run the service, resolve disputes, comply with
            legal obligations, and enforce our agreements. Retention can vary depending on the type of data.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            You can contact us to request access, correction, or deletion of information associated with your use of
            the service, subject to legal and operational limits.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Children and uploaded content</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            The service is not intended for children who are too young to consent under applicable law. Do not upload
            photos or other content unless you have the right to share them.
          </Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            Please avoid uploading sensitive personal information, private images, or content that belongs to someone
            else without permission.
          </Text>
        </View>

        <View style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>Contact</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>
            For privacy questions or deletion requests, use the contact details on the Contact page. We may update this
            policy from time to time by posting the revised version in the app or on the website.
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
