import React from "react";
import { Text, View } from "react-native";
import { useI18n } from "../src/lib/i18n";
import { GAMES, GAME_ORDER, type GameId } from "../src/games/catalog";
import { CatalogGameRow, RelatedGamesSection } from "../src/components/RelatedGamesSection";
import { TopicLinksSection } from "../src/components/TopicLinksSection";
import { WebMarketingSection } from "../src/components/WebMarketingSection";
import { WebSeo } from "../src/components/WebSeo";
import { Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, gameAccents, space, type } from "../src/ui/theme";
import { siteUrl } from "../src/lib/site";

const PATH = "/quiz-games";
const ACCENT = gameAccents.musicQuiz;
const TOPIC_GAMES: GameId[] = ["trivia", "musicQuiz"];

export default function QuizGamesPage() {
  const { language } = useI18n();
  const copy =
    language === "sv"
      ? {
          seoTitle: "Quizspel för spelkvällar, kontoret och kompisgänget",
          description: "Spela quizspel med kategorier, musikfrågor, rumskoder och snabb poängsättning på Picklo. Gratis i mobilen, inget konto.",
          eyebrow: "Quizspel",
          heading: "Quizspel för spelkvällar, kontoret och kompisgänget",
          intro:
            "Två sätt att tävla: klassisk Trivia med kategorier och muntliga svar, eller Music Quiz där ni gissar låtar. Alla är med från sin egen mobil och värden håller koll på poängen.",
          gamesTitle: "Quizspel på Picklo",
          howEyebrow: "Så funkar det",
          howTitle: "Starta ett quiz",
          howParagraphs: ["Den som skapar rummet blir värd och delar ut poängen, så utse gärna någon som gillar att leda."],
          howSteps: [
            "Välj Trivia eller Music Quiz och tryck på Skapa rum.",
            "Dela rumskoden så att alla kan gå med från sin mobil.",
            "Trivia: svara högt på frågan. Music Quiz: värden spelar låten på Spotify och alla gissar.",
            "Värden delar ut poäng. Flest poäng vinner.",
          ],
          pickTitle: "Passar för",
          pickParagraphs: ["Quizen funkar lika bra i vardagsrummet som på jobbet eftersom ingen behöver tävla i att skriva snabbt."],
          pickBullets: [
            "Spelkvällar och förfester",
            "Fikapauser och afterwork på kontoret",
            "Familjekvällar och klassrum",
            "Bilresor, med Music Quiz på högtalaren",
          ],
          faqTitle: "Vanliga frågor",
          faq: [
            {
              question: "Vilket quizspel ska vi börja med?",
              answer: "Trivia passar bra för klassiska frågor och kategorier, medan Music Quiz passar grupper som hellre vill gissa låtar.",
            },
            {
              question: "Behöver alla ha Spotify för Music Quiz?",
              answer: "Nej. Det räcker att värden spelar låtarna på Spotify i en högtalare. Övriga spelare svarar i sina egna mobiler.",
            },
            {
              question: "Hur många kan vara med?",
              answer: "Trivia passar 2–12 spelare och Music Quiz 2–20, så båda funkar för allt från en liten middag till en större fest.",
            },
          ],
          moreTitle: "Fler spel",
          exploreTitle: "Hitta mer att spela",
          topics: [
            { href: "/party-games", title: "Partyspel", description: "Alla spel på Picklo samlade på ett ställe.", accentColor: colors.brand },
            { href: "/social-deduction-games", title: "Bluffspel", description: "Mafia och Imposter när ni hellre vill bluffa.", accentColor: gameAccents.mafia },
          ],
        }
      : {
          seoTitle: "Quiz Games for Game Nights, Offices and Friend Groups",
          description: "Play quiz games with categories, music rounds, room codes and fast scoring on Picklo. Free on your phone, no account.",
          eyebrow: "Quiz Games",
          heading: "Quiz games for game nights, offices and friend groups",
          intro:
            "Two ways to compete: classic Trivia with categories and spoken answers, or Music Quiz where you guess the song. Everyone plays on their own phone while the host keeps score.",
          gamesTitle: "Quiz games on Picklo",
          howEyebrow: "How it works",
          howTitle: "Start a quiz",
          howParagraphs: ["Whoever creates the room becomes the host and awards the points, so pick someone who likes running the show."],
          howSteps: [
            "Choose Trivia or Music Quiz and tap Create room.",
            "Share the room code so everyone can join on their phone.",
            "Trivia: answer the question out loud. Music Quiz: the host plays the track on Spotify and everyone guesses.",
            "The host awards points. Highest score wins.",
          ],
          pickTitle: "Great for",
          pickParagraphs: ["The quizzes work just as well in a living room as at the office, because nobody has to race to type on a tiny keyboard."],
          pickBullets: [
            "Game nights and pregames",
            "Office breaks and after-work",
            "Family nights and classrooms",
            "Road trips, with Music Quiz on the car speakers",
          ],
          faqTitle: "FAQ",
          faq: [
            {
              question: "Which quiz game should we start with?",
              answer: "Trivia is a great pick for classic categories and spoken questions, while Music Quiz suits groups that would rather guess songs.",
            },
            {
              question: "Does everyone need Spotify for Music Quiz?",
              answer: "No. Only the host needs to play the tracks on Spotify through a speaker. Everyone else answers on their own phone.",
            },
            {
              question: "How many people can play?",
              answer: "Trivia suits 2–12 players and Music Quiz 2–20, so both work for anything from a small dinner to a bigger party.",
            },
          ],
          moreTitle: "More games",
          exploreTitle: "Find more to play",
          topics: [
            { href: "/party-games", title: "Party Games", description: "Every game on Picklo in one place.", accentColor: colors.brand },
            { href: "/social-deduction-games", title: "Social Deduction Games", description: "Mafia and Imposter for when you'd rather bluff.", accentColor: gameAccents.mafia },
          ],
        };

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
      name: copy.gamesTitle,
      itemListElement: TOPIC_GAMES.map((id, index) => ({
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
        keywords={["quiz games", "trivia game", "music quiz", "multiplayer quiz", "quiz game for friends"]}
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
        {TOPIC_GAMES.map((id) => (
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

      <RelatedGamesSection title={copy.moreTitle} gameIds={GAME_ORDER.filter((id) => !TOPIC_GAMES.includes(id))} />
      <TopicLinksSection title={copy.exploreTitle} topics={copy.topics} />
    </Screen>
  );
}
