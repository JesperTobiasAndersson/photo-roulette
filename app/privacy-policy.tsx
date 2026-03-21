import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";

export default function PrivacyPolicyScreen() {
  const { language, t } = useI18n();

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
                "Vi använder information för att driva spelrum, synka live-spel, lagra resultat, hantera uppladdat innehåll, stödja premiumfunktioner, svara på supportärenden, förbättra tillförlitlighet och hålla plattformen säker.",
                "På webben kan vi också använda cookies, lokal lagring eller liknande teknik för att komma ihåg inställningar, hålla sessioner igång och stödja webbplatsens funktioner.",
              ],
            ],
            [
              "Hur information delas",
              [
                "Vi kan dela information med tjänsteleverantörer som hjälper oss att hosta appen, lagra innehåll, hantera betalningar, leverera prenumerationer, tillhandahålla infrastruktur och visa annonser. Vi säljer inte personuppgifter för pengar.",
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
                "We use information to operate game rooms, sync live gameplay, store results, process uploaded content, support premium access, respond to support requests, improve reliability, and keep the platform safe.",
                "On the web, we may also use cookies, local storage, or similar technologies to remember preferences, maintain sessions, and support site functionality.",
              ],
            ],
            [
              "How information is shared",
              [
                "We may share information with service providers that help us host the app, store content, process payments, deliver subscriptions, provide infrastructure, and serve advertising. We do not sell personal information for money.",
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
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>{copy.title}</Text>
        <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.intro}</Text>

        {copy.sections.map(([title, paragraphs]) => (
          <View key={title} style={{ gap: 12, backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B" }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18 }}>{title}</Text>
            {paragraphs.map((paragraph) => (
              <Text key={paragraph} style={{ color: "#CBD5E1", lineHeight: 22 }}>
                {paragraph}
              </Text>
            ))}
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
