import React from "react";
import { Text, View } from "react-native";
import { useI18n } from "../src/lib/i18n";
import { GAMES, GAME_ORDER } from "../src/games/catalog";
import { CatalogGameRow } from "../src/components/RelatedGamesSection";
import { TopicLinksSection } from "../src/components/TopicLinksSection";
import { WebMarketingSection } from "../src/components/WebMarketingSection";
import { WebSeo } from "../src/components/WebSeo";
import { Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, gameAccents, space, type } from "../src/ui/theme";
import { siteUrl } from "../src/lib/site";

const PATH = "/party-games";
const ACCENT = colors.brand;

export default function PartyGamesPage() {
  const { language } = useI18n();
  const copy =
    language === "sv"
      ? {
          seoTitle: "Partyspel för vänner, förfester och spontana kvällar",
          description:
            "Gratis partyspel med rumskod som alla spelar i sin egen mobil: bildspel, dolda roller, quiz och kort. Inget konto, ingen nedladdning.",
          eyebrow: "Partyspel",
          heading: "Partyspel för vänner, förfester och spontana kvällar",
          intro:
            "Picklo är en samling gratis partyspel som alla spelar i sin egen mobil. En person skapar ett rum, resten går med med rumskoden och ni är igång på en minut. Inget konto och ingen nedladdning.",
          gamesTitle: "Alla spel",
          howTitle: "Så kommer ni igång",
          howEyebrow: "Så funkar det",
          howParagraphs: ["Allt sker i mobilens webbläsare, så ingen behöver installera något innan ni börjar."],
          howSteps: [
            "Välj ett spel och tryck på Skapa rum.",
            "Dela rumskoden eller inbjudningslänken med gänget.",
            "Alla går med från sin egen mobil och värden startar spelet.",
          ],
          pickTitle: "Vilket spel passar er?",
          pickParagraphs: ["Olika spel passar olika stämningar och gruppstorlekar. En snabb tumregel:"],
          pickBullets: [
            "Nytt gäng eller blandat sällskap: MemeMatch eller Imposter.",
            "Stor grupp på 8 eller fler: Mafia.",
            "Tävlingsinriktade: Trivia eller Music Quiz.",
            "2–6 personer som gillar kort: Chicago.",
          ],
          faqTitle: "Vanliga frågor",
          faq: [
            {
              question: "Vilket partyspel passar bäst för nya spelare?",
              answer: "MemeMatch, Imposter och Trivia är bra första val eftersom de är lätta att förstå och går snabbt att starta.",
            },
            {
              question: "Kostar det något?",
              answer: "Nej. Alla spel är gratis och reklamfria. Ingen behöver skapa konto.",
            },
            {
              question: "Kan vi byta spel under kvällen?",
              answer: "Ja. När ni är klara går ni tillbaka till spellistan, skapar ett nytt rum i nästa spel och delar den nya koden.",
            },
            {
              question: "Måste vi vara på samma ställe?",
              answer: "Spelen är gjorda för att spelas tillsammans i samma rum, men eftersom alla använder sin egen mobil funkar de också över ett videosamtal.",
            },
          ],
          exploreTitle: "Hitta mer att spela",
          topics: [
            { href: "/social-deduction-games", title: "Bluffspel", description: "Mafia och Imposter: dolda roller, bluff och misstankar.", accentColor: gameAccents.mafia },
            { href: "/quiz-games", title: "Quizspel", description: "Trivia och Music Quiz: frågor, låtar och poängjakt.", accentColor: gameAccents.musicQuiz },
          ],
        }
      : {
          seoTitle: "Party Games for Friends, Pregames and Last-Minute Hangouts",
          description:
            "Free room-code party games everyone plays on their own phone: photo games, hidden roles, quizzes and cards. No account, no download.",
          eyebrow: "Party Games",
          heading: "Party games for friends, pregames and last-minute hangouts",
          intro:
            "Picklo is a collection of free party games everyone plays on their own phone. One person creates a room, everyone else joins with the room code, and you're playing within a minute. No account, no download.",
          gamesTitle: "All games",
          howTitle: "Getting started",
          howEyebrow: "How it works",
          howParagraphs: ["Everything runs in your phone's browser, so nobody has to install anything before you start."],
          howSteps: [
            "Pick a game and tap Create room.",
            "Share the room code or invite link with your group.",
            "Everyone joins on their own phone and the host starts the game.",
          ],
          pickTitle: "Which game fits your group?",
          pickParagraphs: ["Different games suit different moods and group sizes. A quick rule of thumb:"],
          pickBullets: [
            "New group or mixed crowd: MemeMatch or Imposter.",
            "Big group of 8 or more: Mafia.",
            "Competitive bunch: Trivia or Music Quiz.",
            "2–6 people who like cards: Chicago.",
          ],
          faqTitle: "FAQ",
          faq: [
            {
              question: "Which party game is best for new players?",
              answer: "MemeMatch, Imposter and Trivia are great starting points because they are quick to understand and easy to start.",
            },
            {
              question: "Does it cost anything?",
              answer: "No. Every game is free and ad-free. Nobody needs to create an account.",
            },
            {
              question: "Can we switch games during the night?",
              answer: "Yes. When you're done, head back to the game list, create a room in the next game and share the new code.",
            },
            {
              question: "Do we need to be in the same place?",
              answer: "The games are made for playing together in the same room, but since everyone uses their own phone they also work over a video call.",
            },
          ],
          exploreTitle: "Find more to play",
          topics: [
            { href: "/social-deduction-games", title: "Social Deduction Games", description: "Mafia and Imposter: hidden roles, bluffing and suspicion.", accentColor: gameAccents.mafia },
            { href: "/quiz-games", title: "Quiz Games", description: "Trivia and Music Quiz: questions, songs and points.", accentColor: gameAccents.musicQuiz },
          ],
        };

  const games = GAME_ORDER;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.seoTitle,
      description: copy.description,
      url: siteUrl(PATH),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Picklo", item: siteUrl("/") },
        { "@type": "ListItem", position: 2, name: copy.eyebrow, item: siteUrl(PATH) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: copy.seoTitle,
      itemListElement: games.map((id, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: GAMES[id].title,
        url: siteUrl(GAMES[id].href),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <Screen topBar={<TopBar backHref="/" />}>
      <WebSeo
        title={copy.seoTitle}
        description={copy.description}
        lang={language}
        path={PATH}
        keywords={["party games", "party games for friends", "web party games", "group games", "mobile party games"]}
        structuredData={structuredData}
      />

      <View style={{ gap: space.sm }}>
        <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.eyebrow}</Text>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
          {copy.heading}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>{copy.intro}</Text>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionLabel>{copy.gamesTitle}</SectionLabel>
        {games.map((id) => (
          <CatalogGameRow key={id} gameId={id} />
        ))}
      </View>

      <WebMarketingSection
        eyebrow={copy.howEyebrow}
        title={copy.howTitle}
        paragraphs={copy.howParagraphs}
        bullets={copy.howSteps}
        accentColor={ACCENT}
      />
      <WebMarketingSection
        title={copy.pickTitle}
        paragraphs={copy.pickParagraphs}
        bullets={copy.pickBullets}
        faq={copy.faq}
        faqTitle={copy.faqTitle}
        accentColor={ACCENT}
      />

      <TopicLinksSection title={copy.exploreTitle} topics={copy.topics} />
    </Screen>
  );
}
