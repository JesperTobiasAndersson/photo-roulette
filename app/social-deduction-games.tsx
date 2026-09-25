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

const PATH = "/social-deduction-games";
const ACCENT = gameAccents.mafia;
const TOPIC_GAMES: GameId[] = ["mafia", "imposter"];

export default function SocialDeductionGamesPage() {
  const { language } = useI18n();
  const copy =
    language === "sv"
      ? {
          seoTitle: "Bluffspel med dolda roller online för vänner och grupper",
          description:
            "Spela bluffspel med dolda roller och hemliga ord på Picklo. Gratis i mobilen med rumskoder, inget konto och ingen spelledare.",
          eyebrow: "Bluffspel",
          heading: "Bluffspel för vänner och grupper",
          intro:
            "I bluffspel (på engelska social deduction) har någon i gruppen en hemlighet, och resten måste lista ut vem. Det handlar om att bluffa, läsa av varandra och övertyga gruppen. Picklo sköter roller och röstning i mobilen, så alla får spela och ingen behöver vara spelledare.",
          gamesTitle: "Bluffspel på Picklo",
          howEyebrow: "Så funkar det",
          howTitle: "Starta en runda",
          howParagraphs: ["Ni behöver bara en mobil per person. Rollerna visas privat på varje skärm, så håll mobilen för dig själv."],
          howSteps: [
            "Välj Mafia eller Imposter och tryck på Skapa rum.",
            "Dela rumskoden så att alla kan gå med från sin mobil.",
            "Alla får en hemlig roll eller ett hemligt ord. Sedan börjar diskussionen.",
            "Rösta ut den ni misstänker. Avslöja bluffarna innan de lurar resten av gruppen.",
          ],
          pickTitle: "Mafia eller Imposter?",
          pickParagraphs: ["Båda spelen bygger på bluff, men de passar olika tillfällen:"],
          pickBullets: [
            "Imposter: några minuter per runda, förklaras på en mening. Perfekt som icebreaker eller mellan andra spel. 4–12 spelare.",
            "Mafia: längre spel med dag- och nattfaser och specialroller. Bäst för större grupper på 5–20 spelare.",
          ],
          faqTitle: "Vanliga frågor",
          faq: [
            {
              question: "Vad är skillnaden mellan Mafia och Imposter?",
              answer: "Imposter är snabbare och enklare att komma igång med, medan Mafia har fler roller och längre, mer strategiska omgångar.",
            },
            {
              question: "Behöver vi en spelledare?",
              answer: "Nej. Appen delar ut rollerna, sköter nattens handlingar och räknar rösterna, så alla kan vara med och spela.",
            },
            {
              question: "Kan vi spela på distans?",
              answer: "Ja. Eftersom alla har sin egen mobil funkar spelen över ett video- eller röstsamtal, till exempel på Discord.",
            },
          ],
          moreTitle: "Fler spel",
          exploreTitle: "Hitta mer att spela",
          topics: [
            { href: "/party-games", title: "Partyspel", description: "Alla spel på Picklo samlade på ett ställe.", accentColor: colors.brand },
            { href: "/quiz-games", title: "Quizspel", description: "Trivia och Music Quiz när ni vill tävla om poäng.", accentColor: gameAccents.musicQuiz },
          ],
        }
      : {
          seoTitle: "Online Social Deduction Games for Friends and Groups",
          description:
            "Play social deduction games with hidden roles and secret words on Picklo. Free on your phone with room codes, no account and no narrator needed.",
          eyebrow: "Social Deduction",
          heading: "Social deduction games for friends and groups",
          intro:
            "In a social deduction game someone in the group has a secret, and everyone else has to work out who. It's all about bluffing, reading each other and winning the argument. Picklo handles the roles and voting on your phones, so everyone gets to play and nobody has to narrate.",
          gamesTitle: "Social deduction games on Picklo",
          howEyebrow: "How it works",
          howTitle: "Start a round",
          howParagraphs: ["All you need is one phone per person. Roles show up privately on each screen, so keep yours to yourself."],
          howSteps: [
            "Choose Mafia or Imposter and tap Create room.",
            "Share the room code so everyone can join on their phone.",
            "Everyone gets a secret role or word. Then the discussion begins.",
            "Vote out whoever you suspect. Catch the bluffers before they fool the rest of the group.",
          ],
          pickTitle: "Mafia or Imposter?",
          pickParagraphs: ["Both games are built on bluffing, but they suit different moments:"],
          pickBullets: [
            "Imposter: a few minutes per round and explained in one sentence. Perfect as an icebreaker or between other games. 4–12 players.",
            "Mafia: a longer game with day and night phases and special roles. Best for bigger groups of 5–20 players.",
          ],
          faqTitle: "FAQ",
          faq: [
            {
              question: "What is the difference between Mafia and Imposter?",
              answer: "Imposter is faster and easier to start, while Mafia adds more roles and longer, more strategic rounds.",
            },
            {
              question: "Do we need a narrator?",
              answer: "No. The app deals the roles, runs the night actions and counts the votes, so everyone gets to play.",
            },
            {
              question: "Can we play remotely?",
              answer: "Yes. Since everyone has their own phone, the games work over a video or voice call, for example on Discord.",
            },
          ],
          moreTitle: "More games",
          exploreTitle: "Find more to play",
          topics: [
            { href: "/party-games", title: "Party Games", description: "Every game on Picklo in one place.", accentColor: colors.brand },
            { href: "/quiz-games", title: "Quiz Games", description: "Trivia and Music Quiz for when you want to compete for points.", accentColor: gameAccents.musicQuiz },
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
        keywords={["social deduction games", "hidden role games", "mafia game online", "imposter game", "bluffing games"]}
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
