import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";

export default function CommunityGuidelinesScreen() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Communityregler",
          intro:
            "Picklo är byggt för socialt, roligt och välkomnande spel. De här riktlinjerna beskriver standarden vi förväntar oss av alla som använder plattformen.",
          sections: [
            ["Visa respekt", "Behandla andra spelare med respekt. Trakasserier, mobbning, hot, hatretorik, riktade personangrepp och upprepade försök att förödmjuka eller skrämma andra är inte tillåtet."],
            ["Dela bara innehåll du har rätt att använda", "Ladda inte upp privat, sexuellt, exploaterande, våldsamt, olagligt eller intrångsgörande innehåll. Dela bara bilder och material du har tillstånd att använda, och undvik att publicera något som avslöjar någon annans privata information."],
            ["Stör inte spelet", "Fuska inte, spamma inte, utge dig inte för att vara någon annan, utnyttja inte buggar, manipulera inte röstning på ett orättvist sätt och stör inte rum på sätt som förstör upplevelsen för andra spelare."],
            ["Skydda minderåriga och känsliga situationer", "Innehåll som rör exploatering av barn, grooming, sexualisering av minderåriga eller uppmuntran till självskada är strikt förbjudet och kan rapporteras till relevanta myndigheter där det krävs."],
            ["Åtgärder", "Vi kan ta bort innehåll, begränsa funktioner, stänga av rum eller begränsa åtkomst om vi anser att dessa riktlinjer eller våra villkor har brutits. Allvarliga eller upprepade överträdelser kan leda till permanent borttagning från tjänsten."],
            ["Rapportera problem", "Om du stöter på kränkande beteende, osäkert innehåll eller något annat allvarligt problem, kontakta oss via kontaktsidan så att vi kan granska det."],
          ] as [string, string][],
        }
      : {
          title: "Community Guidelines",
          intro:
            "Picklo is built for social, funny, and welcoming play. These guidelines explain the standards we expect from everyone using the platform.",
          sections: [
            ["Keep it respectful", "Treat other players with respect. Harassment, bullying, threats, hate speech, targeted abuse, and repeated attempts to humiliate or intimidate others are not allowed."],
            ["Share only content you have the right to use", "Do not upload private, sexual, exploitative, violent, illegal, or infringing content. Only share images and material you have permission to use, and avoid posting anything that exposes someone else's private information."],
            ["Do not disrupt the game", "Do not cheat, spam, impersonate others, exploit bugs, manipulate voting unfairly, or interfere with rooms in ways that ruin the experience for other players."],
            ["Protect minors and sensitive situations", "Content involving child exploitation, grooming, sexualization of minors, or encouragement of self-harm is strictly prohibited and may be reported to appropriate authorities where required."],
            ["Enforcement", "We may remove content, limit features, suspend rooms, or restrict access if we believe these guidelines or our terms have been violated. Serious or repeated violations may result in permanent removal from the service."],
            ["Report issues", "If you encounter abusive behavior, unsafe content, or another serious issue, contact us using the Contact page so we can review it."],
          ] as [string, string][],
        };
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>{copy.title}</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.intro}</Text>

        {copy.sections.map(([title, body]) => (
          <View key={title} style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>{title}</Text>
            <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{body}</Text>
          </View>
        ))}

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
