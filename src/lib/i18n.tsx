import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "sv";

type TranslationDict = Record<string, string>;

const LANGUAGE_STORAGE_KEY = "picklo_language";

const translations: Record<Language, TranslationDict> = {
  en: {
    "language.english": "English",
    "language.swedish": "Svenska",
    "home.subtitle": "Party games for your group. Everyone plays on their own phone.",
    "home.featured": "Pick a game",
    "home.coming_soon": "Coming Soon",
    "home.recommended": "{players}",
    "home.legal.title": "Legal & Support",
    "home.legal.body": "Policies, contact information, and app support for Picklo.",
    "home.legal.privacy": "Privacy Policy",
    "home.legal.terms": "Terms of Service",
    "home.legal.guidelines": "Community Guidelines",
    "home.legal.contact": "Contact",
    "common.back_to_home": "Back to home",
    "home.footer": "Picklo is a party game collection for web and mobile.",
    "home.opening": "Opening game room...",
    "game.memematch.tagline": "Pick images. Match the statement.",
    "game.memematch.description": "Everyone uploads a hand of photos, plays the best match for each statement, then votes for the funniest.",
    "game.memematch.cta": "Play MemeMatch",
    "game.mafia.tagline": "Hidden roles, bluffing, and social deduction.",
    "game.mafia.description": "Secret roles, night kills and day votes. No narrator needed: the app runs the game.",
    "game.mafia.cta": "Play Mafia",
    "game.imposter.tagline": "Blend in, improvise, and expose the fake.",
    "game.imposter.description": "Room-code bluffing game where one player is the imposter and everyone else shares the same secret word.",
    "game.imposter.cta": "Play Imposter",
    "game.chicago.tagline": "Poker scoring, bold calls, and one last trick that matters.",
    "game.chicago.description": "Turn-based multiplayer card game with draw phases, poker scoring, trick play, and race-to-52 scoring.",
    "game.chicago.cta": "Play Chicago",
    "game.music.tagline": "Spotify links, cover reveals, and fast host scoring.",
    "game.music.description": "Host-led music quiz where players answer in the app and tap the reveal cover to open the exact song on Spotify.",
    "game.music.cta": "Play Music Quiz",
    "game.trivia.tagline": "Categories, spoken answers, and host-controlled scoring.",
    "game.trivia.description": "Local party trivia for one device where players take turns, reveal the answer, and the host marks right or wrong.",
    "game.trivia.cta": "Play Trivia",
    "chicago.home.description": "Multiplayer card game with draw rounds, poker scoring, trick-taking, and Chicago calls.",
    "chicago.mode.create": "Create Room",
    "chicago.mode.join": "Join Room",
    "chicago.input.name": "Your name",
    "chicago.input.code": "Room code",
    "chicago.button.create": "Create Chicago Room",
    "chicago.button.join": "Join Chicago Room",
    "common.back_to_games": "Back to games",
    "common.back": "Back",
    "common.players": "{range} players",
    "common.name": "Your name",
    "common.name_placeholder": "e.g. Alex",
    "common.room_code": "Room code",
    "common.create_room": "Create room",
    "common.join_room": "Join room",
    "common.new_room": "New room",
    "common.have_code": "Have a code?",
    "common.enter_name": "Enter your name first",
    "common.enter_code": "Enter the room code",
    "common.share": "Share",
    "common.more_games": "More games",
    "common.invite": "Invite friends",
    "common.start_game": "Start game",
    "common.waiting_for_host": "Waiting for the host to start…",
    "common.leave": "Leave",
    "common.play_again": "Play again",
    "common.you": "You",
    "common.action_failed": "Action failed",
    "common.loading_chicago": "Loading Chicago",
    "common.copy_invite_link": "Copy invite link",
    "common.host": "Host",
    "common.unknown": "Unknown",
    "common.player": "Player",
    "common.waiting_next_move": "Waiting for the next move.",
    "common.loading": "Loading...",
    "common.invitation_link_copied": "Invitation link copied",
    "pwa.title": "Install Picklo",
    "pwa.ios": "Tap Share, then Add to Home Screen.",
    "pwa.body": "One tap to your games next time.",
    "pwa.install": "Install",
    "pwa.safari": "Use Safari Share",
    "pwa.not_now": "Not now",
    "alert.enter_name": "Enter your name",
    "alert.enter_name_code": "Enter your name and room code",
    "alert.create_failed": "Could not create Chicago room",
    "alert.join_failed": "Could not join Chicago room",
    "room.players": "Players",
    "room.wait_host_start": "Waiting for the host to start the round.",
    "room.deal_round": "Deal round",
    "room.your_hand": "Your hand",
    "room.current_read": "Current read:",
    "room.draw_cards": "Draw cards",
    "room.draw_help": "Select 0-5 cards to exchange, then submit your draw. Everyone draws at the same time.",
    "room.buy_stop_active": "Buy stop active",
    "room.buy_stop_body": "You are on {score}+ points, so you must keep your original five cards. Trying to exchange resets you to 0.",
    "room.decision_locked": "Decision locked in",
    "room.waiting_table": "Waiting for the rest of the table.",
    "room.exchange_waiting": "You chose to exchange {count} {cards}. Waiting for the rest of the table.",
    "room.no_cards_selected": "No cards selected means you will keep your current hand and continue.",
    "room.exchange_submitted": "Exchange submitted",
    "room.buy_stop_keep": "Buy stop: keep hand",
    "room.keep_current": "Keep current hand",
    "room.exchange_cards": "Exchange {count} {cards_upper}",
    "room.best_hand_scoring": "Best hand scoring",
    "room.best_hand_body": "The table is scoring automatically. A reveal will appear as soon as the best hand is confirmed.",
    "room.best_hand_wait": "Giving everyone a quick moment to settle before the winning hand is revealed.",
    "room.revealing_best_hand": "Revealing best hand...",
    "room.best_hand_hint": "Any open player screen can trigger this automatically, so the round should keep moving even if one client misses the timing.",
    "room.reveal_now": "Reveal best hand now",
    "room.trick_phase": "Trick phase",
    "room.trick_body": "Only the last trick matters for normal scoring. CHICAGO must be called before the first card is played. The caller must then win every trick or lose 15 points.",
    "room.your_turn": "Your turn",
    "room.waiting": "Waiting",
    "room.your_turn_body": "Play one of the cards in your bottom hand area now.",
    "room.waiting_body": "{name} is choosing a card. Your hand is below, but you cannot play until the turn marker comes to you.",
    "room.chicago_open": "Chicago is open",
    "room.chicago_open_body": "Call CHICAGO now if you want it. As soon as the first card is played, this option disappears.",
    "room.call_chicago": "Call Chicago",
    "room.chicago_claimed": "Chicago claimed",
    "room.chicago_claimed_body": "{name} has CHICAGO. They must win every trick in this round or lose 15 points.",
    "room.current_trick": "Current trick",
    "room.no_cards_played": "No cards played yet.",
    "room.use_these_cards": "Use these cards",
    "room.tap_card": "Tap a card below to play it",
    "room.use_cards_body": "The cards in this section are the ones that count right now. Choose exactly one card to throw into the trick.",
    "room.cards_standby": "Your cards are on standby",
    "room.cards_standby_title": "These are the cards you will use when your turn starts",
    "room.cards_standby_body": "Watch the trick above. When it becomes your turn, these same cards will light up and become clickable.",
    "room.round_result": "Round result",
    "room.deal_next_round": "Deal next round",
    "room.wait_host_next": "Waiting for the host to deal the next round.",
    "room.game_over": "Game over",
    "room.winner": "Winner:",
    "room.scoreboard": "Scoreboard",
    "room.buy_stop_row": "Buy stop active at {score}+",
    "room.seat": "Seat {seat}",
    "room.no_swaps": "No swaps",
    "modal.best_hand_revealed": "Best hand revealed",
    "modal.poker_scoring": "Poker scoring",
    "modal.poker_fallback": "The table is revealing the winning hand.",
    "modal.trick_winner": "Trick winner",
    "modal.won_this_trick": "Won this trick",
    "modal.buy_stop": "Buy stop",
    "modal.uh_oh": "Uh oh",
    "modal.buy_stop_activated": "Buy stop activated",
    "modal.no_swap_only_chaos": "No swap, only chaos",
    "modal.buy_stop_message": "{name} hit {score}. No more shopping, just vibes and five cards straight to play.",
    "modal.buy_stop_penalty": "{name} tried to exchange cards after buy stop and lost the whole stack. Score is back to 0.",
    "room.room_code": "Room {code} - Round {round}",
    "room.chicago_declared_message": "{name} declared CHICAGO and leads the first trick.",
    "room.poker.high_card": "High Card",
    "room.poker.pair": "Pair",
    "room.poker.two_pair": "Two Pair",
    "room.poker.three_of_a_kind": "Three of a Kind",
    "room.poker.straight": "Straight",
    "room.poker.flush": "Flush",
    "room.poker.full_house": "Full House",
    "room.poker.four_of_a_kind": "Four of a Kind",
    "room.poker.straight_flush": "Straight Flush",
    "room.poker.royal_straight_flush": "Royal Straight Flush",
  },
  sv: {
    "language.english": "English",
    "language.swedish": "Svenska",
    "home.subtitle": "Partyspel för gänget. Alla spelar på sin egen mobil.",
    "home.featured": "Välj ett spel",
    "home.coming_soon": "Kommer snart",
    "home.recommended": "{players}",
    "home.legal.title": "Juridik & support",
    "home.legal.body": "Policyer, kontaktuppgifter och apphjälp för Picklo.",
    "home.legal.privacy": "Integritetspolicy",
    "home.legal.terms": "Användarvillkor",
    "home.legal.guidelines": "Communityregler",
    "home.legal.contact": "Kontakt",
    "common.back_to_home": "Tillbaka till hem",
    "home.footer": "Picklo är en samling partyspel för webben och mobilen.",
    "home.opening": "Öppnar spelrum...",
    "game.memematch.tagline": "Välj bilder. Matcha påståendet.",
    "game.memematch.description": "Alla laddar upp en hand med bilder, spelar den som passar bäst till påståendet och röstar fram den roligaste.",
    "game.memematch.cta": "Spela MemeMatch",
    "game.mafia.tagline": "Dolda roller, bluff och jakten på den skyldige.",
    "game.mafia.description": "Hemliga roller, nattmord och dagröstningar. Ingen spelledare behövs: appen sköter spelet.",
    "game.mafia.cta": "Spela Mafia",
    "game.imposter.tagline": "Smält in, improvisera och avslöja bluffen.",
    "game.imposter.description": "Bluffspel med rumskod där en spelare är impostern och alla andra delar samma hemliga ord.",
    "game.imposter.cta": "Spela Imposter",
    "game.chicago.tagline": "Pokerpoäng, modiga utrop och ett sista stick som avgör.",
    "game.chicago.description": "Turordningsbaserat kortspel för flera spelare med byten, pokerpoäng, stickspel och kapplöpning till 52 poäng.",
    "game.chicago.cta": "Spela Chicago",
    "game.music.tagline": "Spotify-länkar, omslag som avslöjar svaret och snabb poängsättning.",
    "game.music.description": "Musikquiz som leds av värden där spelarna svarar i appen och trycker på omslaget för att öppna exakt rätt låt på Spotify.",
    "game.music.cta": "Spela Music Quiz",
    "game.trivia.tagline": "Kategorier, muntliga svar och rättning av värden.",
    "game.trivia.description": "Lokalt party-trivia på en enhet där spelarna tar turer, visar facit och låter värden markera rätt eller fel.",
    "game.trivia.cta": "Spela Trivia",
    "chicago.home.description": "Kortspel för flera spelare med bytesrundor, pokerpoäng, stickspel och Chicago-utrop.",
    "chicago.mode.create": "Skapa rum",
    "chicago.mode.join": "Gå med i rum",
    "chicago.input.name": "Ditt namn",
    "chicago.input.code": "Rumskod",
    "chicago.button.create": "Skapa Chicago-rum",
    "chicago.button.join": "Gå med i Chicago-rum",
    "common.back_to_games": "Tillbaka till spel",
    "common.back": "Tillbaka",
    "common.players": "{range} spelare",
    "common.name": "Ditt namn",
    "common.name_placeholder": "t.ex. Alex",
    "common.room_code": "Rumskod",
    "common.create_room": "Skapa rum",
    "common.join_room": "Gå med",
    "common.new_room": "Nytt rum",
    "common.have_code": "Har du en kod?",
    "common.enter_name": "Skriv ditt namn först",
    "common.enter_code": "Skriv rumskoden",
    "common.share": "Dela",
    "common.more_games": "Fler spel",
    "common.invite": "Bjud in vänner",
    "common.start_game": "Starta spelet",
    "common.waiting_for_host": "Väntar på att värden startar…",
    "common.leave": "Lämna",
    "common.play_again": "Spela igen",
    "common.you": "Du",
    "common.action_failed": "Åtgärden misslyckades",
    "common.loading_chicago": "Laddar Chicago",
    "common.copy_invite_link": "Kopiera inbjudningslänk",
    "common.host": "Värd",
    "common.unknown": "Okänd",
    "common.player": "Spelare",
    "common.waiting_next_move": "Väntar på nästa drag.",
    "common.loading": "Laddar...",
    "common.invitation_link_copied": "Inbjudningslänken kopierad",
    "pwa.title": "Installera Picklo",
    "pwa.ios": "Tryck på Dela och sedan Lägg till på hemskärmen.",
    "pwa.body": "Ett tryck till spelen nästa gång.",
    "pwa.install": "Installera",
    "pwa.safari": "Använd Safaris dela-knapp",
    "pwa.not_now": "Inte nu",
    "alert.enter_name": "Skriv ditt namn",
    "alert.enter_name_code": "Skriv ditt namn och rumskod",
    "alert.create_failed": "Kunde inte skapa Chicago-rum",
    "alert.join_failed": "Kunde inte gå med i Chicago-rum",
    "room.players": "Spelare",
    "room.wait_host_start": "Väntar på att värden ska starta rundan.",
    "room.deal_round": "Dela ut runda",
    "room.your_hand": "Din hand",
    "room.current_read": "Din hand just nu:",
    "room.draw_cards": "Byt kort",
    "room.draw_help": "Välj 0-5 kort att byta och skicka sedan in ditt drag. Alla byter samtidigt.",
    "room.buy_stop_active": "Köpstopp aktivt",
    "room.buy_stop_body": "Du är på {score}+ poäng, så du måste behålla dina ursprungliga fem kort. Försöker du byta nollställs du till 0.",
    "room.decision_locked": "Valet är låst",
    "room.waiting_table": "Väntar på resten av bordet.",
    "room.exchange_waiting": "Du valde att byta {count} {cards}. Väntar på resten av bordet.",
    "room.no_cards_selected": "Inga markerade kort betyder att du behåller din nuvarande hand och går vidare.",
    "room.exchange_submitted": "Bytet skickat",
    "room.buy_stop_keep": "Köpstopp: behåll hand",
    "room.keep_current": "Behåll nuvarande hand",
    "room.exchange_cards": "Byt {count} {cards_upper}",
    "room.best_hand_scoring": "Bästa hand poängsätts",
    "room.best_hand_body": "Bordet poängsätts automatiskt. Bästa handen visas så fort den är bekräftad.",
    "room.best_hand_wait": "Ger alla en kort stund att landa innan vinnande hand visas.",
    "room.revealing_best_hand": "Visar bästa hand...",
    "room.best_hand_hint": "Vilken öppen spelarskärm som helst kan starta detta automatiskt, så rundan fortsätter även om någon enhet missar tidpunkten.",
    "room.reveal_now": "Visa bästa hand nu",
    "room.trick_phase": "Stickfas",
    "room.trick_body": "Bara sista sticket räknas för vanlig poäng. CHICAGO måste ropas innan första kortet spelas. Den som ropar måste sedan vinna alla stick, annars blir det -15 poäng.",
    "room.your_turn": "Din tur",
    "room.waiting": "Väntar",
    "room.your_turn_body": "Spela ett av korten i kortområdet längst ner nu.",
    "room.waiting_body": "{name} väljer ett kort. Din hand finns nedan, men du kan inte spela förrän turmarkören kommer till dig.",
    "room.chicago_open": "Chicago är öppet",
    "room.chicago_open_body": "Ropa CHICAGO nu om du vill. Så fort första kortet spelas försvinner möjligheten.",
    "room.call_chicago": "Ropa Chicago",
    "room.chicago_claimed": "Chicago ropat",
    "room.chicago_claimed_body": "{name} har CHICAGO. Personen måste vinna alla stick i rundan, annars blir det -15 poäng.",
    "room.current_trick": "Nuvarande stick",
    "room.no_cards_played": "Inga kort spelade än.",
    "room.use_these_cards": "Använd dessa kort",
    "room.tap_card": "Tryck på ett kort nedan för att spela det",
    "room.use_cards_body": "Korten i den här sektionen är de som gäller just nu. Välj exakt ett kort att lägga i sticket.",
    "room.cards_standby": "Dina kort väntar",
    "room.cards_standby_title": "Det här är korten du använder när din tur börjar",
    "room.cards_standby_body": "Följ sticket ovan. När det blir din tur kommer samma kort att lysa upp och bli klickbara.",
    "room.round_result": "Rundresultat",
    "room.deal_next_round": "Dela nästa runda",
    "room.wait_host_next": "Väntar på att värden ska dela nästa runda.",
    "room.game_over": "Spelet är slut",
    "room.winner": "Vinnare:",
    "room.scoreboard": "Poängtavla",
    "room.buy_stop_row": "Köpstopp aktivt vid {score}+",
    "room.seat": "Plats {seat}",
    "room.no_swaps": "Inga byten",
    "modal.best_hand_revealed": "Bästa hand visad",
    "modal.poker_scoring": "Pokerpoäng",
    "modal.poker_fallback": "Bordet visar den vinnande handen.",
    "modal.trick_winner": "Stickvinnare",
    "modal.won_this_trick": "Vann det här sticket",
    "modal.buy_stop": "Köpstopp",
    "modal.uh_oh": "Oj nej",
    "modal.buy_stop_activated": "Köpstopp aktiverat",
    "modal.no_swap_only_chaos": "Inga byten, bara kaos",
    "modal.buy_stop_message": "{name} nådde {score}. Nu är det köpstopp: inga fler byten, bara fem kort rakt ut i spel.",
    "modal.buy_stop_penalty": "{name} försökte byta trots köpstopp och förlorade alla poäng. Poängen är tillbaka på 0.",
    "room.room_code": "Rum {code} - Runda {round}",
    "room.chicago_declared_message": "{name} ropade CHICAGO och leder första sticket.",
    "room.poker.high_card": "Högt kort",
    "room.poker.pair": "Par",
    "room.poker.two_pair": "Två par",
    "room.poker.three_of_a_kind": "Triss",
    "room.poker.straight": "Stege",
    "room.poker.flush": "Färg",
    "room.poker.full_house": "Kåk",
    "room.poker.four_of_a_kind": "Fyrtal",
    "room.poker.straight_flush": "Färgstege",
    "room.poker.royal_straight_flush": "Royal straight flush",
  },
};

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  translateChicagoPublicMessage: (message: string | null | undefined) => string | null;
  translatePokerName: (name: string | null | undefined) => string;
  /** Translates status messages the game backends store in English (Mafia, Music Quiz, Chicago). */
  translateServerMessage: (message: string | null | undefined) => string | null;
  /** Translates the English error messages thrown by the game APIs; unknown errors pass through. */
  translateError: (error: unknown) => string;
};

/** Name fallback the APIs write when a player can't be found. */
function svName(name: string) {
  return name === "A player" ? "En spelare" : name;
}

/**
 * Swedish versions of the fixed English strings the game APIs write to the database
 * (public_message) or throw as errors. Keys must match the API text exactly.
 */
const SERVER_MESSAGES_SV: Record<string, string> = {
  // Shared
  "Only the host can do that": "Bara värden kan göra det",
  "Enter a player name": "Skriv ett spelarnamn",

  // Chicago errors
  "Draw phase is not active": "Bytesfasen är inte aktiv",
  "Another draw is still being processed. Try again.": "Ett annat byte behandlas fortfarande. Försök igen.",
  "Chicago requires 2 to 6 active players": "Chicago kräver 2 till 6 aktiva spelare",
  "No active round": "Ingen aktiv runda",
  "Choose cards that are actually in your hand": "Välj kort som faktiskt finns i din hand",
  "Not enough cards left in the deck": "Det finns inte tillräckligt med kort kvar i leken",
  "No hands found": "Inga händer hittades",
  "Could not determine poker winner": "Kunde inte avgöra vem som vann pokerhanden",
  "Chicago can only be declared in the trick phase": "Chicago kan bara ropas i stickfasen",
  "You already declared Chicago this round": "Du har redan ropat Chicago den här rundan",
  "Chicago has already been claimed this round": "Chicago har redan ropats den här rundan",
  "Chicago must be declared before the first card is played": "Chicago måste ropas innan första kortet spelas",
  "Another player claimed CHICAGO first": "En annan spelare ropade CHICAGO först",
  "Trick phase is not active": "Stickfasen är inte aktiv",
  "It is not your turn": "Det är inte din tur",
  "That card is not in your hand": "Det kortet finns inte i din hand",
  "You must follow suit if possible": "Du måste följa färg om du kan",

  // Mafia status messages
  "Waiting for players.": "Väntar på spelare.",
  "Roles assigned. Reveal your role privately.": "Rollerna är utdelade. Titta på din roll i hemlighet.",
  "Night has started. Everyone has something to do.": "Natten har börjat. Alla har något att göra.",
  "Someone was eliminated during the night.": "Någon blev utslagen under natten.",
  "Nobody was eliminated during the night.": "Ingen blev utslagen under natten.",
  "Discuss what happened and decide who to accuse.": "Diskutera vad som hände och bestäm vem ni ska anklaga.",
  "Everyone is ready. Vote for the player you want to eliminate.": "Alla är redo. Rösta på spelaren ni vill rösta ut.",
  "Vote for the player you want to eliminate.": "Rösta på spelaren ni vill rösta ut.",
  "No votes were cast.": "Inga röster lades.",
  "The vote tied. Nobody was eliminated.": "Det blev lika i röstningen. Ingen röstades ut.",
  "The village eliminated a player.": "Byn röstade ut en spelare.",

  // Mafia errors
  "At least 4 players are required": "Minst 4 spelare behövs",
  "Night actions are closed": "Nattens handlingar är stängda",
  "Only living players can act": "Bara levande spelare kan agera",
  "Player is not in this room": "Spelaren finns inte i det här rummet",
  "Choose a target first": "Välj ett mål först",
  "Choose a living player": "Välj en levande spelare",
  "Night is not active": "Det är inte natt just nu",
  "Only living players can continue": "Bara levande spelare kan fortsätta",
  "Confirm your night action first": "Bekräfta din nattliga handling först",
  "You can only continue after the night result": "Du kan bara fortsätta efter nattens resultat",
  "Discussion is not active": "Diskussionen är inte igång",
  "Only living players can mark ready": "Bara levande spelare kan markera redo",
  "Discussion must finish before voting starts": "Diskussionen måste vara klar innan röstningen börjar",
  "Voting is closed": "Röstningen är stängd",
  "Only living players can vote": "Bara levande spelare kan rösta",
  "You cannot vote for yourself": "Du kan inte rösta på dig själv",
  "Voting is not active": "Röstningen är inte igång",
  "You can only continue after the vote result": "Du kan bara fortsätta efter röstresultatet",

  // Music Quiz status messages
  "Waiting for the host to choose a category.": "Väntar på att värden väljer kategori.",
  "Answer reveal is live. Tap the cover to open the exact Spotify track.":
    "Facit visas nu. Tryck på omslaget för att öppna exakt rätt låt på Spotify.",
  "Game complete. Final scoreboard is locked in.": "Matchen är klar. Slutställningen är låst.",

  // Music Quiz errors
  "Finish the current round first": "Avsluta den pågående rundan först",
  "No songs available in that playlist": "Det finns inga låtar i den spellistan",
  "There is no active question": "Det finns ingen aktiv fråga",
  "Enter an answer first": "Skriv ett svar först",
  "There is no active round": "Det finns ingen aktiv runda",
  "There is no round to score": "Det finns ingen runda att rätta",
  "Reveal the answer before awarding points": "Visa facit innan du delar ut poäng",
  "Enter a Spotify track link": "Klistra in en Spotify-länk till en låt",
  "Enter a valid Spotify track link": "Klistra in en giltig Spotify-länk till en låt",
  "Paste a Spotify track link": "Klistra in en Spotify-länk till en låt",
  "That link does not look like a Spotify track": "Länken ser inte ut som en låt på Spotify",
  "Could not load that Spotify track": "Kunde inte ladda låten från Spotify",
  "Could not read the song title from Spotify": "Kunde inte läsa låttiteln från Spotify",
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((value) => {
        if (value === "en" || value === "sv") {
          setLanguageState(value);
        } else if (detectDeviceLanguage() === "sv") {
          setLanguageState("sv");
        }
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const template = translations[language][key] ?? translations.en[key] ?? key;
    return format(template, vars);
  };

  const translatePokerName = (name: string | null | undefined) => {
    if (!name) return "";
    return t(`room.poker.${name}`);
  };

  const translateChicagoPublicMessage = (message: string | null | undefined) => {
    if (!message) return null;
    if (language === "en") return message;

    let match = message.match(/^Room (\w+) - Round (\d+)$/);
    if (match) return t("room.room_code", { code: match[1], round: match[2] });

    match = message.match(/^(.+) declared CHICAGO and leads the first trick\.$/);
    if (match) return t("room.chicago_declared_message", { name: match[1] });

    match = message.match(/^Trick (\d+) resolved\. (.+) leads next\.$/);
    if (match) return `Stick ${match[1]} avgjort. ${svName(match[2])} leder nästa.`;

    match = message.match(/^(.+) wins the first scoring with (.+) for (\d+) point(s?)\.$/);
    if (match) return `${svName(match[1])} vinner första poängsättningen med ${translatePokerName(normalizePokerKey(match[2]))} för ${match[3]} poäng.`;

    match = message.match(/^(.+) wins the second scoring with (.+) for (\d+) point(s?)\.$/);
    if (match) return `${svName(match[1])} vinner andra poängsättningen med ${translatePokerName(normalizePokerKey(match[2]))} för ${match[3]} poäng.`;

    match = message.match(/^(.+) had the best high card in the (first|second) scoring\. No points were awarded\.$/);
    if (match) {
      return `${svName(match[1])} hade högsta kortet i ${match[2] === "first" ? "första" : "andra"} poängsättningen. Inga poäng delades ut.`;
    }

    match = message.match(/^(.+) reached 52 points and wins Chicago\.$/);
    if (match) return `${svName(match[1])} nådde 52 poäng och vinner Chicago.`;

    const direct: Record<string, string> = {
      "Waiting for players to join Chicago.": "Väntar på att spelare ska gå med i Chicago.",
      "Round dealt. Choose cards to exchange.": "Rundan är utdelad. Välj kort att byta.",
      "All draws submitted. Score the first poker hand.": "Alla byten är inlämnade. Poängsätt den första pokerhanden.",
      "All draws submitted. Score the second poker hand.": "Alla byten är inlämnade. Poängsätt den andra pokerhanden.",
      "Final draw complete. Play tricks and fight for the last one.": "Sista bytet är klart. Spela sticken och slåss om det sista.",
      "The first poker scoring tied. No points were awarded.": "Första pokerpoängen blev lika. Inga poäng delades ut.",
      "The second poker scoring tied. No points were awarded.": "Andra pokerpoängen blev lika. Inga poäng delades ut.",
      "Round complete. Review the scores and deal the next hand.": "Rundan är klar. Titta på poängen och dela nästa hand.",
      "Chicago failed. The round ends immediately and the caller loses 15 points.": "Chicago misslyckades. Rundan slutar direkt och den som ropade förlorar 15 poäng.",
      "A player hit 52 points and wins Chicago.": "En spelare nådde 52 poäng och vinner Chicago.",
    };

    return direct[message] ?? SERVER_MESSAGES_SV[message] ?? message;
  };

  const translateServerMessage = (message: string | null | undefined) => {
    if (!message) return null;
    if (language === "en") return message;

    const direct = SERVER_MESSAGES_SV[message];
    if (direct) return direct;

    // Music Quiz: "Guess the song title. Round 3 is live."
    const match = message.match(/^Guess the (song title|artist)\. Round (\d+) is live\.$/);
    if (match) return `${match[1] === "artist" ? "Gissa artisten" : "Gissa låttiteln"}. Runda ${match[2]} är igång.`;

    return translateChicagoPublicMessage(message);
  };

  const translateError = (error: unknown) => {
    const raw = String((error as Error)?.message ?? error ?? "");
    if (language === "en" || !raw) return raw;
    if (SERVER_MESSAGES_SV[raw]) return SERVER_MESSAGES_SV[raw];
    if (/network|failed to fetch/i.test(raw)) return "Ingen anslutning. Kolla internet och försök igen.";
    return raw;
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      translateChicagoPublicMessage,
      translatePokerName,
      translateServerMessage,
      translateError,
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function detectDeviceLanguage(): Language {
  try {
    const locale =
      typeof navigator !== "undefined" && navigator.language
        ? navigator.language
        : Intl.DateTimeFormat().resolvedOptions().locale;
    return locale?.toLowerCase().startsWith("sv") ? "sv" : "en";
  } catch {
    return "en";
  }
}

function normalizePokerKey(label: string) {
  return label.trim().toLowerCase().replaceAll(" ", "_");
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return context;
}
