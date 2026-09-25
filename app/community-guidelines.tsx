import React from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useI18n } from "../src/lib/i18n";
import { WebSeo } from "../src/components/WebSeo";
import { Screen, TopBar } from "../src/ui/components";
import { colors, space, type } from "../src/ui/theme";

const PAGE_PATH = "/community-guidelines";

export default function CommunityGuidelinesScreen() {
  const { language } = useI18n();
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
    <Screen topBar={<TopBar backHref="/" />}>
      <WebSeo title={`${copy.title} | Picklo`} description={copy.intro} lang={language} path={PAGE_PATH} />

      <View style={{ gap: space.sm }}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
          {copy.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>{copy.intro}</Text>
      </View>

      {copy.sections.map(([title, body]) => (
        <View key={title} style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg }}>
          <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>{body}</Text>
        </View>
      ))}

      <Link href="/contact" style={{ color: colors.brand, fontSize: 15, fontWeight: "700", paddingVertical: space.sm }}>
        {language === "sv" ? "Rapportera ett problem" : "Report an issue"}
      </Link>
    </Screen>
  );
}
