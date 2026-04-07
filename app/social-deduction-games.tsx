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

export default function SocialDeductionGamesPage() {
  const { language, t } = useI18n();
  const copy =
    language === "sv"
      ? {
          title: "Social deduction-spel online för vänner och grupper",
          description:
            "Utforska social deduction-spel med dolda roller, hemliga ord, rumskoder och snabba mobilvänliga flöden på Picklo.",
          eyebrow: "Social Deduction",
          bodyTitle: "En starkare sida för bluff, roller och grupppsykologi",
          paragraphs: [
            "Social deduction-sökningar har ofta hög intention eftersom användaren redan vet att gruppen vill spela något med bluff, roller och diskussion. Därför är det här en viktig trafikyta att äga.",
            "Picklo täcker både snabba och djupare format genom Imposter och Mafia, vilket gör sidan relevant för både nybörjare och grupper som vill ha längre rundor.",
          ],
          bullets: [
            "Snabb start med rumskoder",
            "Både lättare och djupare deduction-spel i samma app",
            "Starkt innehåll för delning i kompisgrupper och Discord",
          ],
          faq: [
            {
              question: "Vad är skillnaden mellan Mafia och Imposter?",
              answer: "Imposter är snabbare och enklare att komma igång med, medan Mafia har fler roller och mer långsiktig social deduction.",
            },
          ],
          relatedTitle: "Deduction-spel på Picklo",
          exploreTitle: "Fler ingångar",
        }
      : {
          title: "Online Social Deduction Games for Friends and Groups",
          description:
            "Explore social deduction games with hidden roles, secret words, room codes and fast mobile-friendly flows on Picklo.",
          eyebrow: "Social Deduction",
          bodyTitle: "A stronger page for bluffing, hidden roles and group psychology",
          paragraphs: [
            "Social deduction searches usually come with strong intent because the group already knows they want bluffing, hidden information and discussion. That makes this a valuable traffic surface to own.",
            "Picklo covers both quick and deeper formats through Imposter and Mafia, which makes the page useful for new players as well as groups that want longer rounds.",
          ],
          bullets: [
            "Fast start with room codes",
            "Both lighter and deeper deduction formats in one app",
            "Strong sharing angle for friend groups and Discord servers",
          ],
          faq: [
            {
              question: "What is the difference between Mafia and Imposter?",
              answer: "Imposter is faster and easier to start, while Mafia adds more roles and deeper social deduction over longer rounds.",
            },
          ],
          relatedTitle: "Deduction Games on Picklo",
          exploreTitle: "More Entry Points",
        };

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.title,
      description: copy.description,
      url: "https://picklo.se/social-deduction-games",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Picklo", item: "https://picklo.se/" },
        { "@type": "ListItem", position: 2, name: copy.eyebrow, item: "https://picklo.se/social-deduction-games" },
      ],
    },
  ];

  const relatedGames =
    language === "sv"
      ? [
          { href: "/mafia", title: "Mafia", description: "Dolda roller, nattfaser och mer strategisk social deduction.", accentColor: "#F43F5E" },
          { href: "/imposter", title: "Imposter", description: "Snabbare bluffrundor med hemligt ord.", accentColor: "#F59E0B" },
        ]
      : [
          { href: "/mafia", title: "Mafia", description: "Hidden roles, night phases and deeper strategic deduction.", accentColor: "#F43F5E" },
          { href: "/imposter", title: "Imposter", description: "Faster bluff rounds built around a hidden word.", accentColor: "#F59E0B" },
        ];

  const topicLinks =
    language === "sv"
      ? [
          { href: "/party-games", title: "Partyspel", description: "En bredare startsida för olika gruppspel.", accentColor: "#38BDF8" },
          { href: "/quiz-games", title: "Quizspel", description: "När gruppen vill byta från bluff till frågor och poäng.", accentColor: "#22C55E" },
        ]
      : [
          { href: "/party-games", title: "Party Games", description: "A broader page for multiplayer group games.", accentColor: "#38BDF8" },
          { href: "/quiz-games", title: "Quiz Games", description: "For groups that want to switch from bluffing to scoring.", accentColor: "#22C55E" },
        ];

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <WebSeo
        title={copy.title}
        description={copy.description}
        lang={language}
        path="/social-deduction-games"
        keywords={["social deduction games", "hidden role games", "mafia game online", "imposter game", "bluffing games"]}
        structuredData={structuredData}
      />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingTop: isWeb ? 32 : 20, paddingBottom: 32, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text style={{ color: "#FCA5A5", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>{copy.eyebrow}</Text>
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
