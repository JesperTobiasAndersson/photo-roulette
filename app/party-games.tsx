import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";
import { RelatedGamesSection } from "../src/components/RelatedGamesSection";
import { TopicLinksSection } from "../src/components/TopicLinksSection";
import { WebMarketingSection } from "../src/components/WebMarketingSection";
import { WebSeo } from "../src/components/WebSeo";

const isWeb = Platform.OS === "web";

export default function PartyGamesPage() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Partyspel för vänner, förfester och spontana kvällar",
          description:
            "Hitta partyspel med rumskod för grupper som vill komma igång snabbt på mobil eller webb. Picklo samlar flera olika typer av partyspel i samma app.",
          eyebrow: "Partyspel",
          bodyTitle: "En bättre landningssida för bred partyspelstrafik",
          paragraphs: [
            "När någon söker efter partyspel vill de oftast ha något som går snabbt att förklara, snabbt att starta och funkar för hela gruppen. Det är precis den typen av upplevelse Picklo är byggt för.",
            "Här kan gruppen välja mellan bildspel, social deduction, quiz och kortspel utan att lämna sajten. Det gör sidan stark både för bred SEO och för delning i gruppchattar.",
          ],
          bullets: [
            "Flera speltyper för olika gruppstorlekar och stämningar",
            "Rumskoder gör det lätt att bjuda in utan konto",
            "Fungerar för både mobil och webben",
          ],
          faq: [
            {
              question: "Vilket partyspel passar bäst för nya spelare?",
              answer: "MemeMatch, Imposter och Trivia är bra första val eftersom de är lätta att förstå och starta snabbt.",
            },
            {
              question: "Kan vi byta spel utan att lämna Picklo?",
              answer: "Ja, Picklo är byggt som en samling spel så grupper kan fortsätta vidare till nästa spel direkt från sajten.",
            },
          ],
          relatedTitle: "Spel att börja med",
          exploreTitle: "Fler sätt att hitta Picklo",
        }
      : {
          title: "Party Games for Friends, Pregames and Last-Minute Hangouts",
          description:
            "Find room-code party games for groups that want to start fast on mobile or web. Picklo brings multiple party game formats together in one app.",
          eyebrow: "Party Games",
          bodyTitle: "A stronger landing page for broad party game traffic",
          paragraphs: [
            "When someone searches for party games, they usually want something easy to explain, fast to start and flexible enough for the whole group. That is exactly the experience Picklo is built for.",
            "Groups can switch between photo games, social deduction, quiz formats and card play without leaving the site. That makes this page useful for both broad SEO and social sharing.",
          ],
          bullets: [
            "Multiple game formats for different group sizes and moods",
            "Room codes make invites easy without accounts",
            "Works across both mobile and web",
          ],
          faq: [
            {
              question: "Which party game is best for new players?",
              answer: "MemeMatch, Imposter and Trivia are great starting points because they are quick to understand and easy to start.",
            },
            {
              question: "Can we switch games without leaving Picklo?",
              answer: "Yes. Picklo is designed as a game collection so groups can keep exploring from one game to the next.",
            },
          ],
          relatedTitle: "Games To Start With",
          exploreTitle: "More Ways To Discover Picklo",
        };

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.title,
      description: copy.description,
      url: "https://picklo.se/party-games",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Picklo", item: "https://picklo.se/" },
        { "@type": "ListItem", position: 2, name: copy.eyebrow, item: "https://picklo.se/party-games" },
      ],
    },
  ];

  const relatedGames =
    language === "sv"
      ? [
          { href: "/picklo", title: "MemeMatch", description: "Bildbaserat partyspel med röstning och mycket delbart innehåll.", accentColor: "#38BDF8" },
          { href: "/imposter", title: "Imposter", description: "Snabbt bluffspel med hemligt ord och stark gruppenergi.", accentColor: "#F59E0B" },
          { href: "/trivia", title: "Trivia", description: "Quizläge för grupper som vill hålla tempot uppe.", accentColor: "#F97316" },
        ]
      : [
          { href: "/picklo", title: "MemeMatch", description: "A photo-based party game with voting and highly shareable moments.", accentColor: "#38BDF8" },
          { href: "/imposter", title: "Imposter", description: "A fast bluffing game built around one hidden fake and one shared word.", accentColor: "#F59E0B" },
          { href: "/trivia", title: "Trivia", description: "A quiz option for groups that want to keep the energy moving.", accentColor: "#F97316" },
        ];

  const topicLinks =
    language === "sv"
      ? [
          { href: "/social-deduction-games", title: "Social deduction-spel", description: "För grupper som vill ha bluff, roller och misstankar.", accentColor: "#F43F5E" },
          { href: "/quiz-games", title: "Quizspel", description: "För grupper som vill ha trivia, musik och poängjakt.", accentColor: "#22C55E" },
        ]
      : [
          { href: "/social-deduction-games", title: "Social Deduction Games", description: "For groups that want bluffing, hidden roles and suspicion.", accentColor: "#F43F5E" },
          { href: "/quiz-games", title: "Quiz Games", description: "For groups that want trivia, music and fast scoring.", accentColor: "#22C55E" },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <WebSeo
        title={copy.title}
        description={copy.description}
        lang={language}
        path="/party-games"
        keywords={["party games", "party games for friends", "web party games", "group games", "mobile party games"]}
        structuredData={structuredData}
      />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingTop: isWeb ? 32 : 20,
          paddingBottom: 32,
          alignItems: "center",
        }}
      >
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text style={{ color: "#7DD3FC", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
            {copy.eyebrow}
          </Text>
          <Text style={{ color: "#F8FAFC", fontSize: 36, fontWeight: "900", marginTop: 10 }}>{copy.title}</Text>
          <Text style={{ color: "#94A3B8", fontSize: 16, lineHeight: 26, marginTop: 12 }}>{copy.description}</Text>

          <Pressable
            onPress={() => router.replace("/")}
            style={({ pressed }) => ({
              marginTop: 18,
              alignSelf: "flex-start",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 16,
              backgroundColor: "#111827",
              borderWidth: 1,
              borderColor: "#1F2937",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>{t("common.back_to_home")}</Text>
          </Pressable>

          <WebMarketingSection
            eyebrow={copy.eyebrow}
            title={copy.bodyTitle}
            paragraphs={copy.paragraphs}
            bullets={copy.bullets}
            faq={copy.faq}
          />
          <RelatedGamesSection title={copy.relatedTitle} games={relatedGames} />
          <TopicLinksSection title={copy.exploreTitle} topics={topicLinks} />
        </View>
      </ScrollView>
    </View>
  );
}
