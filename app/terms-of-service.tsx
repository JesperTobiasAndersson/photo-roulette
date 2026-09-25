import React from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useI18n } from "../src/lib/i18n";
import { WebSeo } from "../src/components/WebSeo";
import { Screen, TopBar } from "../src/ui/components";
import { colors, space, type } from "../src/ui/theme";

const PAGE_PATH = "/terms-of-service";

export default function TermsOfServiceScreen() {
  const { language } = useI18n();

  const copy =
    language === "sv"
      ? {
          title: "Användarvillkor",
          intro:
            "Gäller från 20 mars 2026. Genom att använda Picklo godkänner du dessa användarvillkor. Om du inte accepterar dem ska du inte använda tjänsten.",
          sections: [
            [
              "Användning av tjänsten",
              [
                "Du får bara använda tjänsten i enlighet med tillämplig lag och dessa villkor. Du ansvarar för din aktivitet, ditt visningsnamn, ditt deltagande i rum och allt innehåll du laddar upp eller delar via appen.",
              ],
            ],
            [
              "Tillåtet beteende",
              [
                "Du får inte använda tjänsten för att trakassera andra, ladda upp olagligt eller intrångsgörande material, sprida skadligt innehåll, störa spel, skrapa tjänsten, bakåtutveckla skyddad funktionalitet eller försöka störa plattformen.",
              ],
            ],
            [
              "Användarinnehåll",
              [
                "Du behåller äganderätten till innehåll du laddar upp, men du ger oss en begränsad licens att hosta, lagra, behandla, visa och överföra innehållet i den utsträckning som behövs för att driva tjänsten. Du bekräftar att du har rättigheterna som krävs för att ladda upp och dela ditt innehåll.",
              ],
            ],
            [
              "Gratis tjänst",
              [
                "Picklo är gratis att använda och visar ingen reklam. Frivilliga bidrag är alltid valfria och ger inga extra funktioner.",
              ],
            ],
            [
              "Tillgänglighet och friskrivningar",
              [
                "Multiplayer-sessioner är beroende av internetanslutning, enhetskompatibilitet och extern infrastruktur. Tjänsten tillhandahålls i befintligt skick och i mån av tillgänglighet, och vi garanterar inte oavbruten tillgång eller felfri drift.",
              ],
            ],
            [
              "Avstängning och uppsägning",
              [
                "Vi kan stänga av eller avsluta åtkomst om vi anser att du brutit mot dessa villkor, skapat risk för tjänsten eller andra användare, eller använt plattformen på ett olagligt sätt.",
              ],
            ],
            [
              "Ansvar och ändringar",
              [
                "I den utsträckning lagen tillåter ansvarar vi inte för indirekta, tillfälliga, särskilda eller följdskador som uppstår genom din användning av tjänsten.",
                "Vi kan uppdatera dessa villkor då och då. Fortsatt användning av tjänsten efter att ändringar trätt i kraft innebär att du accepterar de uppdaterade villkoren.",
              ],
            ],
          ] as [string, string[]][],
        }
      : {
          title: "Terms of Service",
          intro:
            "Effective date: March 20, 2026. By accessing or using Picklo, you agree to these Terms of Service. If you do not agree, do not use the service.",
          sections: [
            [
              "Use of the service",
              [
                "You may use the service only in compliance with applicable law and these terms. You are responsible for your activity, your display name, room participation, and any content you upload or share through the app.",
              ],
            ],
            [
              "Acceptable conduct",
              [
                "You may not use the service to harass others, upload unlawful or infringing material, distribute harmful content, interfere with gameplay, scrape the service, reverse engineer protected functionality, or attempt to disrupt the platform.",
              ],
            ],
            [
              "User content",
              [
                "You keep ownership of content you upload, but you grant us a limited license to host, store, process, display, and transmit that content as needed to operate the service. You confirm that you have the rights needed to upload and share your content.",
              ],
            ],
            [
              "Free service",
              [
                "Picklo is free to use and shows no ads. Voluntary tips are always optional and unlock nothing extra.",
              ],
            ],
            [
              "Availability and disclaimers",
              [
                "Multiplayer sessions depend on internet access, device compatibility, and outside infrastructure. The service is provided on an as-is and as-available basis, and we do not guarantee uninterrupted availability or error-free operation.",
              ],
            ],
            [
              "Suspension and termination",
              [
                "We may suspend or terminate access if we believe you violated these terms, created risk for the service or other users, or used the platform unlawfully.",
              ],
            ],
            [
              "Liability and changes",
              [
                "To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the service.",
                "We may update these terms from time to time. Continued use of the service after changes take effect means you accept the updated terms.",
              ],
            ],
          ] as [string, string[]][],
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

      {copy.sections.map(([title, paragraphs]) => (
        <View key={title} style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg }}>
          <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>
            {title}
          </Text>
          {paragraphs.map((paragraph) => (
            <Text key={paragraph} style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}

      <Link href="/contact" style={{ color: colors.brand, fontSize: 15, fontWeight: "700", paddingVertical: space.sm }}>
        {language === "sv" ? "Frågor? Kontakta oss" : "Questions? Contact us"}
      </Link>
    </Screen>
  );
}
