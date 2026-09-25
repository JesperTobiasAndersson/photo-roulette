import React from "react";
import { Text, View } from "react-native";
import { Link } from "expo-router";
import { useI18n } from "../src/lib/i18n";
import { WebSeo } from "../src/components/WebSeo";
import { Screen, TopBar } from "../src/ui/components";
import { colors, space, type } from "../src/ui/theme";

const PAGE_PATH = "/privacy-policy";

export default function PrivacyPolicyScreen() {
  const { language } = useI18n();

  const copy =
    language === "sv"
      ? {
          title: "Integritetspolicy",
          intro:
            "Gäller från 20 mars 2026. Den här integritetspolicyn förklarar hur Picklo samlar in, använder, lagrar och delar information när du använder appen, webbplatsen och våra multiplayer-spel.",
          sections: [
            [
              "Information vi samlar in",
              [
                "Vi kan samla in information som du lämnar direkt, inklusive visningsnamn, rumskoder, spelval, röster, uppladdade bilder, supportmeddelanden och annan information du delar när du kontaktar oss.",
                "Vi kan också samla in teknisk information och användningsdata, som enhetstyp, webbläsartyp, appversion, ungefärlig diagnostik, interaktionshändelser och identifierare som behövs för att hålla spelsessioner igång och skydda tjänsten mot missbruk.",
              ],
            ],
            [
              "Hur vi använder information",
              [
                "Vi använder information för att driva spelrum, synka live-spel, lagra resultat, hantera uppladdat innehåll, svara på supportärenden, förbättra tillförlitlighet och hålla plattformen säker.",
                "På webben kan vi också använda cookies, lokal lagring eller liknande teknik för att komma ihåg inställningar, hålla sessioner igång och stödja webbplatsens funktioner.",
                "Picklo visar ingen reklam och använder inga spårnings- eller annonscookies. Lokal lagring används bara för inställningar som språk och ditt senaste spelarnamn, samt för att hålla din anonyma spelsession igång.",
              ],
            ],
            [
              "Hur information delas",
              [
                "Vi kan dela information med tjänsteleverantörer som hjälper oss att hosta appen, lagra innehåll, och tillhandahålla infrastruktur. Vi säljer inte personuppgifter för pengar.",
                "Vi kan också lämna ut information när lagen kräver det, för att upprätthålla våra villkor eller för att skydda användare, appen eller allmänheten.",
              ],
            ],
            [
              "Lagring och dina val",
              [
                "Vi behåller information så länge det rimligen behövs för att driva tjänsten, lösa tvister, följa rättsliga skyldigheter och upprätthålla våra avtal. Lagringstiden kan variera beroende på typ av data.",
                "Du kan kontakta oss för att begära tillgång till, rättelse av eller radering av information kopplad till din användning av tjänsten, med förbehåll för juridiska och praktiska begränsningar.",
              ],
            ],
            [
              "Barn och uppladdat innehåll",
              [
                "Tjänsten är inte avsedd för barn som är för unga för att samtycka enligt tillämplig lag. Ladda inte upp bilder eller annat innehåll om du inte har rätt att dela det.",
                "Undvik att ladda upp känsliga personuppgifter, privata bilder eller innehåll som tillhör någon annan utan tillstånd.",
              ],
            ],
            [
              "Kontakt",
              [
                "För integritetsfrågor eller begäran om radering använder du kontaktuppgifterna på kontaktsidan. Vi kan uppdatera policyn då och då genom att publicera en reviderad version i appen eller på webbplatsen.",
              ],
            ],
          ] as [string, string[]][],
        }
      : {
          title: "Privacy Policy",
          intro:
            "Effective date: March 20, 2026. This Privacy Policy explains how Picklo collects, uses, stores, and shares information when you use the app, website, and multiplayer party games.",
          sections: [
            [
              "Information we collect",
              [
                "We may collect information you provide directly, including display names, room codes, gameplay choices, votes, uploaded images, support messages, and any information you include when contacting us.",
                "We may also collect technical and usage information such as device type, browser type, app version, approximate diagnostics, interaction events, and identifiers needed to keep game sessions working and protect the service from abuse.",
              ],
            ],
            [
              "How we use information",
              [
                "We use information to operate game rooms, sync live gameplay, store results, process uploaded content, respond to support requests, improve reliability, and keep the platform safe.",
                "On the web, we may also use cookies, local storage, or similar technologies to remember preferences, maintain sessions, and support site functionality.",
                "Picklo shows no ads and uses no tracking or advertising cookies. Local storage is only used for settings such as language and your last player name, and to keep your anonymous game session signed in.",
              ],
            ],
            [
              "How information is shared",
              [
                "We may share information with service providers that help us host the app, store content, and provide infrastructure. We do not sell personal information for money.",
                "We may also disclose information when required by law, to enforce our terms, or to protect users, the app, or the public.",
              ],
            ],
            [
              "Retention and your choices",
              [
                "We keep information for as long as reasonably necessary to run the service, resolve disputes, comply with legal obligations, and enforce our agreements. Retention can vary depending on the type of data.",
                "You can contact us to request access, correction, or deletion of information associated with your use of the service, subject to legal and operational limits.",
              ],
            ],
            [
              "Children and uploaded content",
              [
                "The service is not intended for children who are too young to consent under applicable law. Do not upload photos or other content unless you have the right to share them.",
                "Please avoid uploading sensitive personal information, private images, or content that belongs to someone else without permission.",
              ],
            ],
            [
              "Contact",
              [
                "For privacy questions or deletion requests, use the contact details on the Contact page. We may update this policy from time to time by posting the revised version in the app or on the website.",
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
