import type { Language } from "../lib/i18n";
import { gameAccents } from "../ui/theme";

export type GameId = "memematch" | "mafia" | "imposter" | "chicago" | "musicQuiz" | "trivia";

type Localized<T> = Record<Language, T>;

export type GameInfo = {
  id: GameId;
  /** Route of the entry (create / join) screen. */
  href: string;
  title: string;
  accent: string;
  icon: number;
  players: string;
  tagline: Localized<string>;
  /** Three short steps shown on the entry screen. */
  howTo: Localized<[string, string, string]>;
  /** Longer, player-facing description used for the web page body and search engines. */
  about: Localized<string[]>;
  seoTitle: Localized<string>;
  seoDescription: Localized<string>;
  keywords: string[];
  related: GameId[];
};

export const GAMES: Record<GameId, GameInfo> = {
  memematch: {
    id: "memematch",
    href: "/picklo",
    title: "MemeMatch",
    accent: gameAccents.memematch,
    icon: require("../../assets/Memematch.png"),
    players: "3–12",
    tagline: {
      en: "Match the funniest photo to the statement.",
      sv: "Matcha den roligaste bilden med påståendet.",
    },
    howTo: {
      en: [
        "Everyone picks a hand of photos from their camera roll.",
        "A statement appears: play the photo that fits best.",
        "Vote for the funniest match. Most wins after 5 rounds takes it.",
      ],
      sv: [
        "Alla väljer en hand med bilder från kamerarullen.",
        "Ett påstående visas: spela bilden som passar bäst.",
        "Rösta på den roligaste. Flest vinster efter 5 rundor vinner.",
      ],
    },
    about: {
      en: [
        "MemeMatch is a photo party game for friend groups. Each player brings their own screenshots, memes and camera-roll gems, and every round a new statement decides which picture wins.",
        "Rounds are short, voting is anonymous until the reveal, and the best matches tend to become the group's inside jokes. Pick innocent, 18+ or gross statements to fit the crowd.",
      ],
      sv: [
        "MemeMatch är ett bildbaserat partyspel för kompisgäng. Varje spelare tar med sina egna skärmdumpar, memes och pärlor från kamerarullen, och varje runda avgör ett nytt påstående vilken bild som vinner.",
        "Rundorna är korta, röstningen är anonym fram till avslöjandet och de bästa matchningarna brukar bli gängets interna skämt. Välj oskyldiga, 18+ eller grova påståenden efter publiken.",
      ],
    },
    seoTitle: {
      en: "MemeMatch | Photo Party Game With Voting and Room Codes",
      sv: "MemeMatch | Partyspel med bilder, röstning och rumskoder",
    },
    seoDescription: {
      en: "Play MemeMatch on Picklo: pick photos, match the statement, vote with friends and turn any group chat into a party game.",
      sv: "Spela MemeMatch på Picklo: välj bilder, matcha påståendet, rösta med vänner och gör gruppchatten till ett partyspel.",
    },
    keywords: ["meme game", "photo party game", "funny game for friends", "room code party game"],
    related: ["imposter", "mafia"],
  },
  mafia: {
    id: "mafia",
    href: "/mafia",
    title: "Mafia",
    accent: gameAccents.mafia,
    icon: require("../../assets/mafia.png"),
    players: "5–20",
    tagline: {
      en: "Secret roles, night kills and day votes. No narrator needed.",
      sv: "Hemliga roller, nattmord och dagröstning. Ingen spelledare behövs.",
    },
    howTo: {
      en: [
        "Everyone secretly gets a role on their phone.",
        "At night the mafia picks a target; special roles act in secret.",
        "By day, discuss and vote someone out. Find the mafia before they outnumber you.",
      ],
      sv: [
        "Alla får en hemlig roll i mobilen.",
        "På natten väljer maffian ett offer; specialroller agerar i hemlighet.",
        "På dagen diskuterar ni och röstar ut någon. Hitta maffian innan de blir för många.",
      ],
    },
    about: {
      en: [
        "Mafia is the classic social deduction game, run entirely by the app so everyone gets to play. Roles are dealt privately, night actions happen on each phone, and the day vote resolves automatically.",
        "It works best with a bigger group in the same room or on a call. Expect accusations, alibis and at least one friendship tested.",
      ],
      sv: [
        "Mafia är det klassiska social deduction-spelet, helt styrt av appen så att alla får spela. Rollerna delas ut privat, nattens handlingar sker i varje mobil och dagröstningen avgörs automatiskt.",
        "Passar bäst för ett större gäng i samma rum eller i ett samtal. Räkna med anklagelser, alibin och minst en prövad vänskap.",
      ],
    },
    seoTitle: {
      en: "Mafia | Online Social Deduction Party Game",
      sv: "Mafia | Social deduction-spel online",
    },
    seoDescription: {
      en: "Play Mafia on Picklo with hidden roles, day and night rounds, room codes and fast mobile-friendly setup for groups.",
      sv: "Spela Mafia på Picklo med dolda roller, dag- och nattfaser, rumskoder och snabb mobilanpassad setup för grupper.",
    },
    keywords: ["mafia game online", "social deduction game", "party game with hidden roles", "group bluffing game"],
    related: ["imposter", "trivia"],
  },
  imposter: {
    id: "imposter",
    href: "/imposter",
    title: "Imposter",
    accent: gameAccents.imposter,
    icon: require("../../assets/imposter.png"),
    players: "4–12",
    tagline: {
      en: "Everyone shares a secret word, except the imposter.",
      sv: "Alla delar ett hemligt ord, utom impostern.",
    },
    howTo: {
      en: [
        "Everyone sees the same secret word, except one imposter.",
        "Take turns saying one clue word. The imposter has to bluff.",
        "Vote on who the imposter is. If they survive, they win.",
      ],
      sv: [
        "Alla ser samma hemliga ord, utom en imposter.",
        "Säg ett ledtrådsord i tur och ordning. Impostern måste bluffa.",
        "Rösta på vem som är impostern. Klarar den sig vinner den.",
      ],
    },
    about: {
      en: [
        "Imposter is a quick bluffing game you can explain in one sentence. Everyone gets the same word except one player, who has to blend in without knowing what it is.",
        "Rounds take a couple of minutes, so it's perfect as an icebreaker or between longer games.",
      ],
      sv: [
        "Imposter är ett snabbt bluffspel som går att förklara på en mening. Alla får samma ord utom en spelare, som måste smälta in utan att veta vad det är.",
        "En runda tar ett par minuter, så det passar perfekt som icebreaker eller mellan längre spel.",
      ],
    },
    seoTitle: {
      en: "Imposter | Hidden Word Party Game for Friends",
      sv: "Imposter | Partyspel med hemligt ord för vänner",
    },
    seoDescription: {
      en: "Play Imposter on Picklo: one hidden fake, one shared word, fast room-code setup and great energy for groups, parties and hangouts.",
      sv: "Spela Imposter på Picklo: en dold bluffare, ett delat ord, snabb rumskods-setup och perfekt energi för grupper, fester och häng.",
    },
    keywords: ["imposter game", "hidden word game", "bluffing party game", "social deduction game"],
    related: ["mafia", "memematch"],
  },
  chicago: {
    id: "chicago",
    href: "/chicago",
    title: "Chicago",
    accent: gameAccents.chicago,
    icon: require("../../assets/chicago.png"),
    players: "2–6",
    tagline: {
      en: "The Swedish card classic: poker hands, tricks and a bold final call.",
      sv: "Svenska kortklassikern: pokerhänder, stick och ett modigt slututrop.",
    },
    howTo: {
      en: [
        "Swap cards to build the best poker hand and score points.",
        "Play tricks. Winning the last trick is worth 5 points.",
        "Call CHICAGO to go for every trick. First to 52 wins.",
      ],
      sv: [
        "Byt kort för att bygga bästa pokerhanden och ta poäng.",
        "Spela stick. Sista sticket är värt 5 poäng.",
        "Ropa CHICAGO för att ta alla stick. Först till 52 vinner.",
      ],
    },
    about: {
      en: [
        "Chicago mixes poker scoring with trick-taking. Each round you exchange cards, score your poker hand, then fight for the final trick.",
        "The app deals, keeps score and handles the rules, so you can focus on the bluffs and the risky CHICAGO calls.",
      ],
      sv: [
        "Chicago blandar pokerpoäng med stickspel. Varje runda byter du kort, tar poäng på pokerhanden och slåss sedan om sista sticket.",
        "Appen delar ut, räknar poäng och håller koll på reglerna, så ni kan fokusera på bluffarna och de riskabla CHICAGO-utropen.",
      ],
    },
    seoTitle: {
      en: "Chicago | Multiplayer Card Game With Poker Scoring and Trick-Taking",
      sv: "Chicago | Multiplayer-kortspel med pokerpoäng och stickspel",
    },
    seoDescription: {
      en: "Play Chicago on Picklo with draw phases, poker scoring, trick-taking, room codes and high-risk CHICAGO calls for groups that want more strategy.",
      sv: "Spela Chicago på Picklo med byten, pokerpoäng, stickspel, rumskoder och smart risk-reward för grupper som vill ha mer strategi.",
    },
    keywords: ["chicago card game", "multiplayer card game", "trick-taking game", "poker scoring game", "strategy card game"],
    related: ["trivia", "mafia"],
  },
  musicQuiz: {
    id: "musicQuiz",
    href: "/music-quiz",
    title: "Music Quiz",
    accent: gameAccents.musicQuiz,
    icon: require("../../assets/musicquiz.png"),
    players: "2–20",
    tagline: {
      en: "Guess the song. The host plays it on Spotify.",
      sv: "Gissa låten. Värden spelar den på Spotify.",
    },
    howTo: {
      en: [
        "The host plays a track; everyone answers on their own phone.",
        "Reveal the cover to see the answer and open it on Spotify.",
        "The host awards points. Highest score wins.",
      ],
      sv: [
        "Värden spelar en låt; alla svarar i sin egen mobil.",
        "Visa omslaget för att se svaret och öppna låten på Spotify.",
        "Värden delar ut poäng. Högst poäng vinner.",
      ],
    },
    about: {
      en: [
        "Music Quiz turns any speaker into a game show. The host controls the music, players answer on their phones, and the cover reveal settles every argument.",
        "Great for pregames, road trips and anyone who claims they know every song from 2010.",
      ],
      sv: [
        "Music Quiz gör vilken högtalare som helst till en tävling. Värden styr musiken, spelarna svarar i mobilen och omslaget avgör varje diskussion.",
        "Perfekt för förfester, bilresor och alla som påstår att de kan varenda låt från 2010.",
      ],
    },
    seoTitle: {
      en: "Music Quiz | Spotify Party Game With Room Codes",
      sv: "Music Quiz | Spotify-partyspel med rumskoder",
    },
    seoDescription: {
      en: "Play Music Quiz on Picklo with Spotify links, cover reveals, host scoring and room-code multiplayer for parties and hangouts.",
      sv: "Spela Music Quiz på Picklo med Spotify-länkar, omslagsreveal, värdstyrd poängsättning och multiplayer med rumskoder.",
    },
    keywords: ["music quiz", "spotify quiz", "song guessing game", "party music game"],
    related: ["trivia", "memematch"],
  },
  trivia: {
    id: "trivia",
    href: "/trivia",
    title: "Trivia",
    accent: gameAccents.trivia,
    icon: require("../../assets/trivia.png"),
    players: "2–12",
    tagline: {
      en: "Pick a category, answer out loud, let the host judge.",
      sv: "Välj kategori, svara högt och låt värden döma.",
    },
    howTo: {
      en: [
        "Take turns picking a category and reading the question.",
        "Answer out loud, then reveal the correct answer.",
        "The host marks right or wrong. Most points wins.",
      ],
      sv: [
        "Turas om att välja kategori och läsa frågan.",
        "Svara högt och visa sedan rätt svar.",
        "Värden markerar rätt eller fel. Flest poäng vinner.",
      ],
    },
    about: {
      en: [
        "Trivia is a relaxed quiz for game nights: categories, spoken answers and a host who keeps score, so there's no typing race on tiny keyboards.",
        "It works for friends, families, classrooms and office breaks alike.",
      ],
      sv: [
        "Trivia är ett avslappnat quiz för spelkvällar: kategorier, muntliga svar och en värd som håller poängen, så ingen behöver tävla i att skriva snabbt på små tangentbord.",
        "Passar lika bra för kompisar, familjen, klassrummet och fikapausen.",
      ],
    },
    seoTitle: {
      en: "Trivia | Multiplayer Quiz Game With Room Codes",
      sv: "Trivia | Multiplayer-quiz med rumskoder",
    },
    seoDescription: {
      en: "Play Trivia on Picklo with categories, room codes, host-controlled scoring and a mobile-friendly flow for fast group sessions.",
      sv: "Spela Trivia på Picklo med kategorier, rumskoder, värdstyrd poängsättning och ett mobilvänligt flöde för snabba gruppsessioner.",
    },
    keywords: ["trivia game", "multiplayer trivia", "quiz game for friends", "room code quiz"],
    related: ["musicQuiz", "mafia"],
  },
};

export const GAME_ORDER: GameId[] = ["imposter", "memematch", "mafia", "chicago", "musicQuiz", "trivia"];
