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

export default function QuizGamesPage() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Quizspel för game nights, kontor och vänskapsgrupper",
          description:
            "Hitta quizspel med kategorier, musikfrågor, rumskoder och snabb poängsättning på Picklo.",
          eyebrow: "Quizspel",
          bodyTitle: "En tydligare destination för quiz- och triviaintention",
          paragraphs: [
            "Quiztrafik konverterar ofta bra när sidan tydligt visar vad gruppen får: enkla regler, snabb start och ett format som fungerar för många deltagare.",
            "Picklo kombinerar vanlig trivia och musikquiz, vilket gör den här sidan mer användbar än en enskild spelsida för personer som fortfarande väljer format.",
          ],
          bullets: [
            "Fungerar för både klassisk trivia och musikfrågor",
            "Passar klassrum, kontor, förfester och hemmakvällar",
            "Rumskoder gör det lätt att få in hela gruppen snabbt",
          ],
          faq: [
            {
              question: "Vilket quizspel ska vi börja med?",
              answer: "Trivia passar bra för klassiska frågor och kategorier, medan Music Quiz passar grupper som vill ha ett mer musikdrivet upplägg.",
            },
          ],
          relatedTitle: "Quizspel på Picklo",
          exploreTitle: "Fler sätt att hitta rätt spel",
        }
      : {
          title: "Quiz Games for Game Nights, Offices and Friend Groups",
          description:
            "Find quiz games with categories, music rounds, room codes and fast scoring on Picklo.",
          eyebrow: "Quiz Games",
          bodyTitle: "A clearer destination for quiz and trivia intent",
          paragraphs: [
            "Quiz traffic often converts well when the page makes the value clear: easy rules, quick setup and a format that works for multiple players.",
            "Picklo combines classic trivia with music quiz formats, which makes this page more useful than a single game page for visitors who are still choosing the style they want.",
          ],
          bullets: [
            "Works for both classic trivia and music rounds",
            "Fits classrooms, offices, pregames and house nights",
            "Room codes make it easy to bring the whole group in fast",
          ],
          faq: [
            {
              question: "Which quiz game should we start with?",
              answer: "Trivia is a strong option for classic categories and spoken questions, while Music Quiz is better for groups that want a more song-focused setup.",
            },
          ],
          relatedTitle: "Quiz Games on Picklo",
          exploreTitle: "More Ways To Find The Right Game",
        };

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.title,
      description: copy.description,
      url: "https://picklo.se/quiz-games",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Picklo", item: "https://picklo.se/" },
        { "@type": "ListItem", position: 2, name: copy.eyebrow, item: "https://picklo.se/quiz-games" },
      ],
    },
  ];

  const relatedGames =
    language === "sv"
      ? [
          { href: "/trivia", title: "Trivia", description: "Kategorier, muntliga svar och enkel hoststyrd rättning.", accentColor: "#F97316" },
          { href: "/music-quiz", title: "Music Quiz", description: "Spotify-länkar, omslagsreveal och snabb poängsättning.", accentColor: "#22C55E" },
        ]
      : [
          { href: "/trivia", title: "Trivia", description: "Categories, spoken answers and simple host scoring.", accentColor: "#F97316" },
          { href: "/music-quiz", title: "Music Quiz", description: "Spotify links, cover reveals and fast scoring.", accentColor: "#22C55E" },
        ];

  const topicLinks =
    language === "sv"
      ? [
          { href: "/party-games", title: "Partyspel", description: "En bredare guide till gruppspel på Picklo.", accentColor: "#38BDF8" },
          { href: "/social-deduction-games", title: "Social deduction-spel", description: "För grupper som vill ha bluff och roller i stället.", accentColor: "#F43F5E" },
        ]
      : [
          { href: "/party-games", title: "Party Games", description: "A broader guide to multiplayer group games on Picklo.", accentColor: "#38BDF8" },
          { href: "/social-deduction-games", title: "Social Deduction Games", description: "For groups that want bluffing and hidden roles instead.", accentColor: "#F43F5E" },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <WebSeo
        title={copy.title}
        description={copy.description}
        lang={language}
        path="/quiz-games"
        keywords={["quiz games", "trivia game", "music quiz", "multiplayer quiz", "quiz game for friends"]}
        structuredData={structuredData}
      />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: isWeb ? 32 : 20, paddingBottom: 32, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text style={{ color: "#86EFAC", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>{copy.eyebrow}</Text>
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
          <WebMarketingSection eyebrow={copy.eyebrow} title={copy.bodyTitle} paragraphs={copy.paragraphs} bullets={copy.bullets} faq={copy.faq} />
          <RelatedGamesSection title={copy.relatedTitle} games={relatedGames} />
          <TopicLinksSection title={copy.exploreTitle} topics={topicLinks} />
        </View>
      </ScrollView>
    </View>
  );
}
