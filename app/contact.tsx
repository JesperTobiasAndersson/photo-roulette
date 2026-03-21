import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";

export default function ContactScreen() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Kontakt",
          intro: "Kontakta Picklo för support, integritetsärenden, modereringsfrågor eller juridiska meddelanden med uppgifterna nedan.",
          supportTitle: "Supportmejl",
          supportBody: "Använd detta för kontoproblem, spelproblem, betalningsfrågor, buggrapporter och allmän support.",
          privacyTitle: "Integritets- eller dataärenden",
          privacyBody: "Använd detta för åtkomst, rättelse, radering och integritetsfrågor. Inkludera tillräckligt med detaljer för att vi ska kunna identifiera relevant session eller begäran.",
          responseTitle: "Svarstider",
          responseBody: "Vi siktar på att svara inom rimlig tid. För juridiska eller integritetsrelaterade ärenden kan ytterligare verifiering krävas innan vi behandlar vissa förfrågningar.",
        }
      : {
          title: "Contact",
          intro: "Contact Picklo for support, privacy requests, moderation issues, or legal notices using the details below.",
          supportTitle: "Support email",
          supportBody: "Use this for account issues, gameplay problems, billing questions, bug reports, and general support.",
          privacyTitle: "Privacy or data requests",
          privacyBody: "Use this for access, correction, deletion, and privacy-related questions. Include enough detail for us to identify the relevant session or request.",
          responseTitle: "Response expectations",
          responseBody: "We aim to respond within a reasonable time. For legal or privacy matters, additional verification may be required before we process certain requests.",
        };
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>{copy.title}</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.intro}</Text>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>{copy.supportTitle}</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>support@picklo.app</Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.supportBody}</Text>
        </View>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>{copy.privacyTitle}</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>privacy@picklo.app</Text>
          <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.privacyBody}</Text>
        </View>

        <View style={{ gap: 10, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>{copy.responseTitle}</Text>
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{copy.responseBody}</Text>
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
          <Text style={{ color: "white", fontWeight: "900" }}>{t("common.back_to_home")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
