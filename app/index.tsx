import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../src/lib/i18n";
import { GAMES, GAME_ORDER, type GameId } from "../src/games/catalog";
import { ShareButton } from "../src/components/ShareButton";
import { TopicLinksSection } from "../src/components/TopicLinksSection";
import { WebSeo } from "../src/components/WebSeo";
import { Chip, GameIcon, LanguageSwitch, Screen, SectionLabel } from "../src/ui/components";
import { colors, radius, space, type } from "../src/ui/theme";
import { siteUrl } from "../src/lib/site";

export default function GameLibraryHome() {
  const { language, t } = useI18n();
  const sv = language === "sv";

  const faq = sv
    ? [
        {
          question: "Kostar Picklo något?",
          answer: "Nej. Alla spel är gratis och kräver inget konto. Öppna sidan, skapa ett rum och dela koden.",
        },
        {
          question: "Behöver alla ladda ner en app?",
          answer: "Nej. Alla spelar direkt i mobilens webbläsare. Vill du ha Picklo på hemskärmen kan du lägga till det därifrån.",
        },
        {
          question: "Hur många kan spela?",
          answer: "Det beror på spelet: Chicago passar 2–6 spelare, Mafia fungerar för upp till 20.",
        },
      ]
    : [
        {
          question: "Is Picklo free?",
          answer: "Yes. Every game is free and there's no account to create. Open the site, create a room and share the code.",
        },
        {
          question: "Does everyone need to download an app?",
          answer: "No. Everyone plays right in their phone's browser. You can add Picklo to your home screen if you want it one tap away.",
        },
        {
          question: "How many people can play?",
          answer: "It depends on the game: Chicago suits 2–6 players, while Mafia works for up to 20.",
        },
      ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Picklo", url: siteUrl("/") },
      { "@type": "Organization", name: "Picklo", url: siteUrl("/"), logo: siteUrl("/icon.png") },
      {
        "@type": "ItemList",
        name: "Picklo party games",
        itemListElement: GAME_ORDER.map((id, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: GAMES[id].title,
          url: siteUrl(GAMES[id].href),
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  const topicLinks = sv
    ? [
        { href: "/party-games", title: "Partyspel", description: "Alla spel för fest, häng och förfest.", accentColor: "#38BDF8" },
        { href: "/social-deduction-games", title: "Bluffspel", description: "Mafia, Imposter och andra spel med dolda roller.", accentColor: "#F43F5E" },
        { href: "/quiz-games", title: "Quizspel", description: "Trivia och musikquiz för spelkvällen.", accentColor: "#22C55E" },
      ]
    : [
        { href: "/party-games", title: "Party Games", description: "Every game for parties, pregames and hangouts.", accentColor: "#38BDF8" },
        { href: "/social-deduction-games", title: "Social Deduction Games", description: "Mafia, Imposter and other hidden-role games.", accentColor: "#F43F5E" },
        { href: "/quiz-games", title: "Quiz Games", description: "Trivia and music quiz for game night.", accentColor: "#22C55E" },
      ];

  const footerLinks = [
    { label: t("home.legal.privacy"), href: "/privacy-policy" },
    { label: t("home.legal.terms"), href: "/terms-of-service" },
    { label: t("home.legal.guidelines"), href: "/community-guidelines" },
    { label: t("home.legal.contact"), href: "/contact" },
  ];

  return (
    <Screen>
      <WebSeo
        title={sv ? "Picklo Partyspel | Gratis multiplayer-spel i mobilen" : "Picklo Party Games | Free Multiplayer Games on Your Phone"}
        description={
          sv
            ? "Gratis partyspel med rumskoder: MemeMatch, Mafia, Imposter, Chicago, Music Quiz och Trivia. Inget konto, ingen nedladdning."
            : "Free party games with room codes: MemeMatch, Mafia, Imposter, Chicago, Music Quiz and Trivia. No account, no download."
        }
        lang={language}
        keywords={["party games", "multiplayer party games", "social deduction games", "web party games", "icebreaker games", "party games for friends"]}
        structuredData={structuredData}
      />

      {/* Brand bar */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Image source={require("../assets/icon.png")} style={{ width: 40, height: 40, borderRadius: 12 }} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", flex: 1 }}>Picklo</Text>
        <LanguageSwitch />
      </View>

      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
          {sv ? "Vad ska vi spela?" : "What are we playing?"}
        </Text>
        <Text style={[type.body, { color: colors.textMuted, fontSize: 15 }]}>{t("home.subtitle")}</Text>
      </View>

      <View style={{ gap: space.sm }}>
        {GAME_ORDER.map((id) => (
          <GameRow key={id} gameId={id} />
        ))}
      </View>

      <ShareButton
        label={sv ? "Dela Picklo med gänget" : "Share Picklo with your group"}
        message={sv ? "Gratis partyspel i mobilen: Mafia, Imposter, MemeMatch, quiz och mer." : "Free party games on your phone: Mafia, Imposter, MemeMatch, quizzes and more."}
        url={siteUrl("/")}
      />

      {/* About + FAQ: useful for new players and the indexable body for search engines */}
      <View style={{ gap: space.md, marginTop: space.sm }}>
        <SectionLabel>{sv ? "Om Picklo" : "About Picklo"}</SectionLabel>
        <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>
          {sv
            ? "Picklo samlar partyspel som alla spelar på sin egen mobil. En person skapar ett rum, resten går med med en kod på fyra tecken, och spelet synkas live mellan alla. Inget konto och ingen nedladdning."
            : "Picklo is a collection of party games everyone plays on their own phone. One person creates a room, everyone else joins with a four-letter code, and the game syncs live for everyone. No account, no download."}
        </Text>
        {faq.map((item) => (
          <View key={item.question} style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{item.question}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>{item.answer}</Text>
          </View>
        ))}
      </View>

      <TopicLinksSection title={sv ? "Hitta rätt spel" : "Find the right game"} topics={topicLinks} />

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg, gap: space.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.lg, rowGap: space.sm }}>
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href as any} style={{ color: colors.textMuted, fontSize: 14, paddingVertical: 6 }}>
              {link.label}
            </Link>
          ))}
        </View>
        <Text style={{ color: colors.textSubtle, fontSize: 12 }}>{t("home.footer")}</Text>
      </View>
    </Screen>
  );
}

function GameRow({ gameId }: { gameId: GameId }) {
  const game = GAMES[gameId];
  const { language, t } = useI18n();
  return (
    <Link href={game.href as any} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${game.title}. ${game.tagline[language]}`}
        // Link asChild drops style callbacks, so the style is static here.
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.md,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <GameIcon source={game.icon} size={68} accent={game.accent} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{game.title}</Text>
          <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 19 }}>
            {game.tagline[language]}
          </Text>
          <Chip label={t("common.players", { range: game.players })} color={game.accent} icon="people" />
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textSubtle} />
      </Pressable>
    </Link>
  );
}
