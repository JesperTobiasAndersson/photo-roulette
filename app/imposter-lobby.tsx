import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { ShareButton } from "../src/components/ShareButton";
import { GAMES } from "../src/games/catalog";
import { IMPOSTER_CATEGORIES, imposterCategoryLabel, imposterWordLabel } from "../src/games/imposter/data";
import { WordPicture } from "../src/games/imposter/WordPicture";
import {
  finishImposterReveal,
  resolveImposterVoting,
  startImposterGame,
  startImposterVoting,
  submitImposterDiscussionReady,
  submitImposterVote,
  updateImposterCategory,
} from "../src/games/imposter/api";
import { getCategoryById } from "../src/games/imposter/logic";
import { useImposterRoom } from "../src/games/imposter/useImposterRoom";
import { useI18n, type Language } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { Button, Card, Chip, GameIcon, RoomCodeBadge, Screen, SectionLabel, TopBar, onAccent } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const GAME = GAMES.imposter;
const ACCENT = GAME.accent;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

const COPY = {
  en: {
    loading: "Loading Imposter",
    loadingSub: "Connecting the room and syncing the round state.",
    roomCode: "Room code",
    invite: "Invite friends",
    inviteMessage: "Join my Imposter game on Picklo! Room code:",
    category: "Category",
    onlyHostCategory: "Only the host can change the category.",
    players: "Players",
    you: "You",
    host: "Host",
    out: "Out",
    ready: "Ready",
    voteReady: "Ready to vote",
    alive: "Alive",
    startGame: "Start the game",
    needPlayers: (n: number) => `Need at least 3 players (${n}/3)`,
    needCategory: "Pick a category first",
    waitingHost: "Waiting for the host to start the game.",
    lobbyHint: "Pick a category, and start once everyone has joined.",
    // Secret card
    tapToReveal: "Tap to see your card",
    noPeeking: "Make sure nobody else can see your screen.",
    tapToHide: "Tap to hide",
    yourWord: "Your secret word",
    youAreImposter: "You are the imposter",
    imposterDesc: "Blend in, improvise, and try not to get caught.",
    crewDesc: "You know the secret word. Give careful clues and expose the imposter.",
    yourCard: "Your card",
    // Reveal
    privateReveal: "Private reveal",
    revealHint: "Look at your card in secret, then tap ready so the round can move on.",
    sawCard: "I saw my card",
    revealFirst: "Reveal your card first",
    readyWaiting: "Ready – waiting for the others",
    readyCount: (a: number, b: number) => `${a}/${b} ready`,
    // Discussion
    discussion: "Discussion",
    timeLeft: "Time left",
    readyToVoteCount: (a: number, b: number) => `${a}/${b} ready to vote`,
    readyToVote: "Ready to vote",
    youreReady: "You're ready to vote",
    youAreOut: "You are out",
    openVoting: "Open voting now",
    // Voting
    vote: "Vote",
    voteHint: "Who is the imposter? Tap a player, then confirm.",
    pickPlayer: "Pick a player",
    voteFor: (name: string) => `Vote for ${name}`,
    changeVote: (name: string) => `Change vote to ${name}`,
    voteLocked: (name: string) => `Voted for ${name}`,
    votesIn: (a: number, b: number) => `${a}/${b} votes in`,
    votesSoFar: "Votes so far",
    yourVote: "Your vote",
    resolveVote: "Resolve vote",
    waitingResolve: "Waiting for the host to resolve the vote.",
    outCantVote: "You're out – watch the others vote.",
    unknown: "Unknown",
    // Ended
    gameOver: "Game over",
    showResults: "Show final results",
    // Modals
    roundContinues: "Round continues",
    wrongPlayer: "The group voted out the wrong player. The game continues.",
    voteResult: "Vote result",
    aPlayer: "A player",
    wasImposter: "was revealed as the imposter",
    wasVotedOut: "was voted out by the group",
    rightCall: "The crew made the right call. The round outcome is being revealed.",
    endedByVote: "That vote ended the game. Final results are about to appear.",
    lostCrew: "The group lost a crew member. The next discussion begins now.",
    finalVerdict: "Final verdict",
    imposterWins: "IMPOSTER WINS",
    crewWins: "CREW WINS",
    imposterWinsSub: "The imposter survived the accusations and took control of the round.",
    crewWinsSub: "The crew read the room correctly and exposed the imposter.",
    // Leave
    leaveTitle: "Leave the game?",
    leaveMsg: "The round keeps going without you.",
    leave: "Leave",
    stay: "Stay",
    phase: { lobby: "Lobby", role_reveal: "Reveal", discussion: "Discussion", voting: "Voting", ended: "Game over" },
  },
  sv: {
    loading: "Laddar Imposter",
    loadingSub: "Ansluter till rummet och synkar rundan.",
    roomCode: "Rumskod",
    invite: "Bjud in vänner",
    inviteMessage: "Spela Imposter med mig på Picklo! Rumskod:",
    category: "Kategori",
    onlyHostCategory: "Bara värden kan byta kategori.",
    players: "Spelare",
    you: "Du",
    host: "Värd",
    out: "Ute",
    ready: "Redo",
    voteReady: "Redo att rösta",
    alive: "Kvar",
    startGame: "Starta spelet",
    needPlayers: (n: number) => `Minst 3 spelare behövs (${n}/3)`,
    needCategory: "Välj en kategori först",
    waitingHost: "Väntar på att värden startar spelet.",
    lobbyHint: "Välj en kategori och starta när alla har gått med.",
    tapToReveal: "Tryck för att se ditt kort",
    noPeeking: "Se till att ingen annan ser din skärm.",
    tapToHide: "Tryck för att dölja",
    yourWord: "Ditt hemliga ord",
    youAreImposter: "Du är impostern",
    imposterDesc: "Smält in, improvisera och försök att inte bli avslöjad.",
    crewDesc: "Du kan det hemliga ordet. Ge försiktiga ledtrådar och avslöja impostern.",
    yourCard: "Ditt kort",
    privateReveal: "Hemlig visning",
    revealHint: "Titta på ditt kort i hemlighet och tryck sedan redo så att rundan kan fortsätta.",
    sawCard: "Jag har sett mitt kort",
    revealFirst: "Visa ditt kort först",
    readyWaiting: "Redo – väntar på de andra",
    readyCount: (a: number, b: number) => `${a}/${b} redo`,
    discussion: "Diskussion",
    timeLeft: "Tid kvar",
    readyToVoteCount: (a: number, b: number) => `${a}/${b} redo att rösta`,
    readyToVote: "Redo att rösta",
    youreReady: "Du är redo att rösta",
    youAreOut: "Du är ute",
    openVoting: "Öppna röstningen nu",
    vote: "Rösta",
    voteHint: "Vem är impostern? Tryck på en spelare och bekräfta.",
    pickPlayer: "Välj en spelare",
    voteFor: (name: string) => `Rösta på ${name}`,
    changeVote: (name: string) => `Ändra röst till ${name}`,
    voteLocked: (name: string) => `Du röstade på ${name}`,
    votesIn: (a: number, b: number) => `${a}/${b} röster inne`,
    votesSoFar: "Röster hittills",
    yourVote: "Din röst",
    resolveVote: "Avgör röstningen",
    waitingResolve: "Väntar på att värden avgör röstningen.",
    outCantVote: "Du är ute – titta på när de andra röstar.",
    unknown: "Okänd",
    gameOver: "Spelet är slut",
    showResults: "Visa slutresultat",
    roundContinues: "Rundan fortsätter",
    wrongPlayer: "Gruppen röstade ut fel spelare. Spelet fortsätter.",
    voteResult: "Röstresultat",
    aPlayer: "En spelare",
    wasImposter: "avslöjades som impostern",
    wasVotedOut: "röstades ut av gruppen",
    rightCall: "Crewet gjorde rätt val. Rundans utfall visas nu.",
    endedByVote: "Den rösten avslutade spelet. Slutresultatet visas strax.",
    lostCrew: "Gruppen förlorade en crewmedlem. Nästa diskussion börjar nu.",
    finalVerdict: "Slutgiltigt utslag",
    imposterWins: "IMPOSTERN VINNER",
    crewWins: "CREW VINNER",
    imposterWinsSub: "Impostern klarade anklagelserna och tog kontroll över rundan.",
    crewWinsSub: "Crewet läste av rummet rätt och avslöjade impostern.",
    leaveTitle: "Lämna spelet?",
    leaveMsg: "Rundan fortsätter utan dig.",
    leave: "Lämna",
    stay: "Stanna",
    phase: { lobby: "Lobby", role_reveal: "Visning", discussion: "Diskussion", voting: "Röstning", ended: "Spelet är slut" },
  },
};

/** Server messages are stored in English; translate the known ones for Swedish players. */
const PUBLIC_MESSAGES_SV: Record<string, string> = {
  "Waiting for players to join.": "Väntar på att spelare går med.",
  "Roles assigned. Reveal your card privately.": "Rollerna är utdelade. Titta på ditt kort i hemlighet.",
  "Discuss the word and figure out who the imposter is.": "Diskutera ordet och lista ut vem impostern är.",
  "Vote for the player you think is the imposter.": "Rösta på den du tror är impostern.",
  "The group voted out the wrong player. The game continues.": "Gruppen röstade ut fel spelare. Spelet fortsätter.",
  "Nobody was eliminated. Keep discussing.": "Ingen röstades ut. Fortsätt diskutera.",
  "The group found the imposter.": "Gruppen hittade impostern.",
  "Only two players remain. The imposter takes the win.": "Bara två spelare är kvar. Impostern vinner.",
  "Nobody voted. The imposter slipped through.": "Ingen röstade. Impostern slank igenom.",
  "The vote tied. The imposter survives the round.": "Röstningen blev oavgjord. Impostern överlever rundan.",
  "The group voted out the wrong player. The imposter wins.": "Gruppen röstade ut fel spelare. Impostern vinner.",
  "The round ended without an assigned imposter.": "Rundan slutade utan någon imposter.",
};

function localizeMessage(message: string | null, language: Language) {
  if (!message) return "";
  return language === "sv" ? PUBLIC_MESSAGES_SV[message] ?? message : message;
}

/** Private word card: hidden until the player deliberately taps it, tap again to hide. */
function SecretCard({
  isImposter,
  prompt,
  revealed,
  onToggle,
  copy,
  compact,
  language,
}: {
  isImposter: boolean;
  prompt: string | null;
  revealed: boolean;
  onToggle: () => void;
  copy: (typeof COPY)["en"];
  compact?: boolean;
  language: "en" | "sv";
}) {
  const tone = isImposter ? colors.danger : ACCENT;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={revealed ? copy.tapToHide : copy.tapToReveal}
      style={({ pressed }) => ({
        minHeight: compact ? 120 : 220,
        borderRadius: radius.xl,
        padding: space.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        backgroundColor: revealed ? withAlpha(tone, 0.12) : colors.surface,
        borderWidth: 2,
        borderStyle: revealed ? "solid" : "dashed",
        borderColor: revealed ? withAlpha(tone, 0.7) : withAlpha(ACCENT, 0.45),
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {revealed ? (
        <>
          <Text style={[type.caption, { color: tone, textTransform: "uppercase" }]}>
            {isImposter ? copy.yourCard : copy.yourWord}
          </Text>
          {isImposter ? (
            <Text style={{ fontSize: compact ? 44 : 72, lineHeight: compact ? 52 : 84 }}>🕵️</Text>
          ) : (
            <WordPicture word={prompt} size={compact ? 96 : 168} language={language} />
          )}
          <Text
            adjustsFontSizeToFit
            numberOfLines={2}
            style={{
              color: isImposter ? colors.danger : colors.text,
              fontSize: compact ? 30 : 40,
              lineHeight: compact ? 36 : 46,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            {isImposter ? copy.youAreImposter.toUpperCase() : (imposterWordLabel(prompt, language) || copy.unknown).toUpperCase()}
          </Text>
          {!compact ? (
            <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>
              {isImposter ? copy.imposterDesc : copy.crewDesc}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.xs }}>
            <Ionicons name="eye-off-outline" size={16} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "700" }}>{copy.tapToHide}</Text>
          </View>
        </>
      ) : (
        <>
          <View
            style={{
              width: compact ? 48 : 64,
              height: compact ? 48 : 64,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(ACCENT, 0.16),
            }}
          >
            <Ionicons name="eye-outline" size={compact ? 24 : 32} color={ACCENT} />
          </View>
          <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>{copy.tapToReveal}</Text>
          {!compact ? (
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.noPeeking}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function PlayerRow({
  name,
  eliminated,
  children,
}: {
  name: string;
  eliminated?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        minHeight: touch.min + 8,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: colors.sunken,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: eliminated ? withAlpha(colors.danger, 0.14) : withAlpha(ACCENT, 0.16),
        }}
      >
        <Text style={{ color: eliminated ? colors.danger : ACCENT, fontWeight: "900", fontSize: 16 }}>
          {name.trim().charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[
          type.bodyStrong,
          {
            flex: 1,
            color: eliminated ? colors.textMuted : colors.text,
            textDecorationLine: eliminated ? "line-through" : "none",
          },
        ]}
      >
        {name}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, flexShrink: 1 }}>{children}</View>
    </View>
  );
}

export default function ImposterLobbyScreen() {
  const { language, t } = useI18n();
  const copy = COPY[language];
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cardRevealed, setCardRevealed] = useState(false);
  const [hasSeenCard, setHasSeenCard] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [showRoundContinueModal, setShowRoundContinueModal] = useState(false);
  const [shownRoundContinueKey, setShownRoundContinueKey] = useState<string | null>(null);
  const [showVoteRevealModal, setShowVoteRevealModal] = useState(false);
  const [shownVoteRevealKey, setShownVoteRevealKey] = useState<string | null>(null);
  const [showEndgameRevealModal, setShowEndgameRevealModal] = useState(false);
  const [shownEndgameRevealKey, setShownEndgameRevealKey] = useState<string | null>(null);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);
  const { room, players, myPlayer, myRole, playerRoles, myVote, currentVotes, loading, refresh } = useImposterRoom(roomId, playerId);
  const previousStatusesRef = useRef<Record<string, "alive" | "eliminated">>({});
  const voteRevealOpacity = useRef(new Animated.Value(0)).current;
  const voteRevealScale = useRef(new Animated.Value(0.9)).current;
  const voteRevealTranslateY = useRef(new Animated.Value(28)).current;
  const endgameRevealOpacity = useRef(new Animated.Value(0)).current;
  const endgameRevealScale = useRef(new Animated.Value(0.92)).current;
  const endgameRevealTranslateY = useRef(new Animated.Value(32)).current;
  const endgamePulseScale = useRef(new Animated.Value(0.72)).current;
  const endgamePulseOpacity = useRef(new Animated.Value(0)).current;
  const endgameVerdictOpacity = useRef(new Animated.Value(0)).current;
  const endgameVerdictTranslateY = useRef(new Animated.Value(14)).current;
  const endgameWinnerOpacity = useRef(new Animated.Value(0)).current;
  const endgameWinnerTranslateY = useRef(new Animated.Value(24)).current;
  const endgameSubtitleOpacity = useRef(new Animated.Value(0)).current;
  const endgameSubtitleTranslateY = useRef(new Animated.Value(18)).current;
  const navigationScheduledRef = useRef(false);

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const alivePlayers = useMemo(() => players.filter((player) => player.status === "alive"), [players]);
  const category = getCategoryById(room?.category_id ?? null);
  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([targetPlayerId, count]) => ({
        player: players.find((player) => player.id === targetPlayerId) ?? null,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentVotes, players]);
  const discussionReadyCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const phaseSecondsLeft = room?.phase_ends_at ? Math.max(0, Math.ceil((new Date(room.phase_ends_at).getTime() - now) / 1000)) : 0;
  const phaseMinutesText = `${Math.floor(phaseSecondsLeft / 60)}:${String(phaseSecondsLeft % 60).padStart(2, "0")}`;
  const revealedVotedOutPlayer =
    room && shownVoteRevealKey?.startsWith(`${room.phase_number}-`)
      ? players.find((player) => shownVoteRevealKey.includes(player.id)) ?? null
      : null;
  const revealedVotedOutRole = revealedVotedOutPlayer
    ? playerRoles.find((role) => role.player_id === revealedVotedOutPlayer.id)?.role ?? null
    : null;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (error) {
      showAlert(t("common.action_failed"), String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  };

  const navigateToResults = () => {
    if (navigationScheduledRef.current) return;
    navigationScheduledRef.current = true;
    setShowEndgameRevealModal(false);
    setHasNavigatedToResults(true);

    const go = () => {
      router.replace({ pathname: "/imposter-results", params: { roomId, playerId } });
    };

    if (Platform.OS === "web") {
      go();
      return;
    }

    setTimeout(go, 120);
  };

  // UI-only: hide the secret card whenever the phase changes, and clear the local vote pick each round.
  useEffect(() => {
    setCardRevealed(false);
  }, [room?.state]);

  useEffect(() => {
    setSelectedTargetId(null);
  }, [room?.phase_number]);

  useEffect(() => {
    if (!room?.phase_ends_at || room.state === "lobby" || room.state === "role_reveal" || room.state === "ended") return;
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [room?.phase_ends_at, room?.state]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "voting") return;
    if (busy) return;

    const uniqueVoters = new Set(currentVotes.map((vote) => vote.voter_player_id));
    if (alivePlayers.length > 0 && uniqueVoters.size === alivePlayers.length) {
      run("auto-resolve-voting", () => resolveImposterVoting(roomId, playerId));
    }
  }, [alivePlayers.length, busy, currentVotes, isHost, playerId, room, roomId]);

  useEffect(() => {
    if (!room) return;

    const shouldShowMessage =
      room.state === "discussion" &&
      room.public_message === "The group voted out the wrong player. The game continues.";
    const modalKey = shouldShowMessage ? `${room.state}-${room.phase_number}-${room.public_message}` : null;

    if (!shouldShowMessage || !modalKey) return;
    if (shownRoundContinueKey === modalKey) return;

    setShowRoundContinueModal(true);
    setShownRoundContinueKey(modalKey);
  }, [room, shownRoundContinueKey]);

  useEffect(() => {
    if (!showRoundContinueModal) return;

    const timeoutId = setTimeout(() => {
      setShowRoundContinueModal(false);
    }, 1800);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [showRoundContinueModal]);

  useEffect(() => {
    if (!room || players.length === 0) return;

    const previousStatuses = previousStatusesRef.current;
    const newlyEliminatedPlayer =
      room.state !== "voting"
        ? players.find((player) => previousStatuses[player.id] === "alive" && player.status === "eliminated") ?? null
        : null;

    const nextStatuses = Object.fromEntries(players.map((player) => [player.id, player.status])) as Record<string, "alive" | "eliminated">;
    previousStatusesRef.current = nextStatuses;

    if (!newlyEliminatedPlayer) return;

    const revealKey = `${room.phase_number}-${newlyEliminatedPlayer.id}-${room.state}`;
    if (shownVoteRevealKey === revealKey) return;

    setShownVoteRevealKey(revealKey);
    setShowVoteRevealModal(true);
    voteRevealOpacity.setValue(0);
    voteRevealScale.setValue(0.9);
    voteRevealTranslateY.setValue(28);

    Animated.parallel([
      Animated.timing(voteRevealOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(voteRevealScale, {
        toValue: 1,
        tension: 72,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(voteRevealTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [players, room, shownVoteRevealKey, voteRevealOpacity, voteRevealScale, voteRevealTranslateY]);

  useEffect(() => {
    if (!showVoteRevealModal) return;

    const timeoutId = setTimeout(() => {
      setShowVoteRevealModal(false);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [showVoteRevealModal]);

  useEffect(() => {
    if (!room) return;
    if (room.state !== "ended") {
      navigationScheduledRef.current = false;
      setHasNavigatedToResults(false);
      return;
    }
    if (showVoteRevealModal || showEndgameRevealModal || hasNavigatedToResults) return;

    const revealKey = `${room.id}-${room.phase_number}-${room.winner ?? "unknown"}`;
    if (shownEndgameRevealKey === revealKey) return;

    setShownEndgameRevealKey(revealKey);
    setShowEndgameRevealModal(true);
    endgameRevealOpacity.setValue(0);
    endgameRevealScale.setValue(0.92);
    endgameRevealTranslateY.setValue(32);
    endgamePulseScale.setValue(0.72);
    endgamePulseOpacity.setValue(0);
    endgameVerdictOpacity.setValue(0);
    endgameVerdictTranslateY.setValue(14);
    endgameWinnerOpacity.setValue(0);
    endgameWinnerTranslateY.setValue(24);
    endgameSubtitleOpacity.setValue(0);
    endgameSubtitleTranslateY.setValue(18);

    Animated.parallel([
      Animated.timing(endgameRevealOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(endgameRevealScale, {
        toValue: 1,
        tension: 74,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(endgameRevealTranslateY, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(endgamePulseScale, {
            toValue: 1.24,
            duration: 920,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(endgamePulseOpacity, {
            toValue: 0.32,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(endgamePulseScale, {
            toValue: 1.42,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(endgamePulseOpacity, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(endgamePulseScale, {
          toValue: 0.72,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    ).start();

    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.timing(endgameVerdictOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameVerdictTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(180),
      Animated.parallel([
        Animated.timing(endgameWinnerOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameWinnerTranslateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(140),
      Animated.parallel([
        Animated.timing(endgameSubtitleOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(endgameSubtitleTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    endgamePulseOpacity,
    endgamePulseScale,
    endgameRevealOpacity,
    endgameRevealScale,
    endgameRevealTranslateY,
    endgameSubtitleOpacity,
    endgameSubtitleTranslateY,
    endgameVerdictOpacity,
    endgameVerdictTranslateY,
    endgameWinnerOpacity,
    endgameWinnerTranslateY,
    hasNavigatedToResults,
    room,
    showEndgameRevealModal,
    showVoteRevealModal,
    shownEndgameRevealKey,
  ]);

  useEffect(() => {
    if (!showEndgameRevealModal) return;
    if (!room || room.state !== "ended") return;
    if (hasNavigatedToResults) return;

    const timeoutId = setTimeout(() => {
      navigateToResults();
    }, 4400);

    return () => clearTimeout(timeoutId);
  }, [hasNavigatedToResults, room, showEndgameRevealModal]);

  const leaveGame = async () => {
    if (room && room.state !== "lobby" && room.state !== "ended") {
      const ok = await confirmAction(copy.leaveTitle, copy.leaveMsg, {
        confirmLabel: copy.leave,
        cancelLabel: copy.stay,
        destructive: true,
      });
      if (!ok) return;
    }
    router.replace(GAME.href as any);
  };

  if (loading || !room || !myPlayer) {
    return (
      <Screen centered topBar={<TopBar title={GAME.title} onBack={() => router.replace(GAME.href as any)} />}>
        <View style={{ alignItems: "center", gap: space.md }}>
          <GameIcon source={GAME.icon} size={96} accent={ACCENT} />
          <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.loading}</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{copy.loadingSub}</Text>
        </View>
      </Screen>
    );
  }

  const baseUrl = SITE_URL;
  const inviteUrl = `${baseUrl}/imposter?code=${room.code}`;

  const isAlive = myPlayer.status === "alive";
  const isImposter = myRole?.role === "imposter";
  const revealReadyCount = players.filter((player) => player.role_reveal_ready).length;
  const votersCount = new Set(currentVotes.map((vote) => vote.voter_player_id)).size;
  const voteOptions = alivePlayers.filter((player) => player.id !== myPlayer.id);
  const selectedId = selectedTargetId ?? myVote?.target_player_id ?? null;
  const selectedPlayer = selectedId ? players.find((player) => player.id === selectedId) ?? null : null;
  const voteAlreadyCast = !!myVote && myVote.target_player_id === selectedId;
  const startBlocker = players.length < 3 ? copy.needPlayers(players.length) : !room.category_id ? copy.needCategory : null;

  const toggleCard = () => {
    setCardRevealed((value) => !value);
    setHasSeenCard(true);
  };

  const hintText = (text: string) => (
    <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{text}</Text>
  );

  // ---------------------------------------------------------------------------
  // Sticky footer: the one main action for the current phase.
  // ---------------------------------------------------------------------------
  let footer: React.ReactNode = null;
  if (room.state === "lobby") {
    footer = isHost ? (
      <>
        {startBlocker ? hintText(startBlocker) : null}
        <Button
          label={copy.startGame}
          icon="play"
          accent={ACCENT}
          loading={busy === "start"}
          disabled={busy === "start" || !!startBlocker}
          onPress={() => run("start", () => startImposterGame(roomId, playerId))}
        />
      </>
    ) : (
      <View style={{ minHeight: touch.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }}>
        <Ionicons name="hourglass-outline" size={20} color={ACCENT} />
        <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{copy.waitingHost}</Text>
      </View>
    );
  } else if (room.state === "role_reveal") {
    footer = (
      <>
        {hintText(copy.readyCount(revealReadyCount, players.length))}
        <Button
          label={myPlayer.role_reveal_ready ? copy.readyWaiting : hasSeenCard ? copy.sawCard : copy.revealFirst}
          icon={myPlayer.role_reveal_ready ? "checkmark-circle" : "checkmark"}
          accent={ACCENT}
          loading={busy === "reveal-ready"}
          disabled={busy === "reveal-ready" || myPlayer.role_reveal_ready || !hasSeenCard}
          onPress={() => run("reveal-ready", () => finishImposterReveal(roomId, playerId))}
        />
      </>
    );
  } else if (room.state === "discussion") {
    footer = (
      <Button
        label={!isAlive ? copy.youAreOut : myPlayer.discussion_ready ? copy.youreReady : copy.readyToVote}
        icon={!isAlive ? "close-circle" : myPlayer.discussion_ready ? "checkmark-circle" : "hand-right"}
        accent={ACCENT}
        loading={busy === "discussion-ready"}
        disabled={busy === "discussion-ready" || myPlayer.discussion_ready || !isAlive}
        onPress={() => run("discussion-ready", () => submitImposterDiscussionReady(roomId, playerId))}
      />
    );
  } else if (room.state === "voting") {
    footer = !isAlive ? (
      hintText(copy.outCantVote)
    ) : (
      <Button
        label={
          !selectedPlayer
            ? copy.pickPlayer
            : voteAlreadyCast
              ? copy.voteLocked(selectedPlayer.display_name)
              : myVote
                ? copy.changeVote(selectedPlayer.display_name)
                : copy.voteFor(selectedPlayer.display_name)
        }
        icon={voteAlreadyCast ? "checkmark-circle" : "hand-left"}
        accent={ACCENT}
        loading={!!busy && busy.startsWith("vote-")}
        disabled={!selectedPlayer || voteAlreadyCast || (!!busy && busy.startsWith("vote-"))}
        onPress={() => {
          if (!selectedPlayer) return;
          run(`vote-${selectedPlayer.id}`, () => submitImposterVote(roomId, playerId, selectedPlayer.id));
        }}
      />
    );
  } else if (room.state === "ended") {
    footer = <Button label={copy.showResults} icon="trophy" accent={ACCENT} onPress={navigateToResults} />;
  }

  const winnerTone = room.winner === "imposter" ? colors.danger : ACCENT;
  const votedOutTone = revealedVotedOutRole === "imposter" ? ACCENT : colors.danger;

  return (
    <Screen
      topBar={
        <TopBar
          title={room.state === "lobby" ? GAME.title : `${GAME.title} · ${copy.phase[room.state]}`}
          onBack={leaveGame}
          right={room.state !== "lobby" ? <Chip label={room.code} color={ACCENT} icon="key" /> : undefined}
        />
      }
      footer={footer}
    >
      {/* Wrong-player interstitial */}
      <Modal visible={showRoundContinueModal} transparent animationType="fade" onRequestClose={() => setShowRoundContinueModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: space.lg }}>
          <AnimatedEntrance enterKey={`round-continue-${room.phase_number}`} distance={18} style={{ width: "100%", maxWidth: 420 }}>
            <Card style={{ borderRadius: radius.xl, padding: space.xl }}>
              <Text style={[type.title, { color: colors.text }]}>{copy.roundContinues}</Text>
              <Text style={[type.body, { color: colors.textSecondary }]}>{copy.wrongPlayer}</Text>
            </Card>
          </AnimatedEntrance>
        </View>
      </Modal>

      {/* Vote result overlay */}
      <Modal visible={showVoteRevealModal} transparent animationType="fade" onRequestClose={() => setShowVoteRevealModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: space.lg }}>
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: radius.xl,
              padding: space.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(votedOutTone, 0.45),
              shadowColor: votedOutTone,
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 16 },
              elevation: 18,
              alignItems: "center",
              gap: space.sm,
              opacity: voteRevealOpacity,
              transform: [{ scale: voteRevealScale }, { translateY: voteRevealTranslateY }],
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(votedOutTone, 0.18),
                borderWidth: 1,
                borderColor: withAlpha(votedOutTone, 0.4),
                marginBottom: space.sm,
              }}
            >
              <Ionicons name={revealedVotedOutRole === "imposter" ? "finger-print" : "skull"} size={42} color={votedOutTone} />
            </View>
            <Text style={[type.caption, { color: votedOutTone, textTransform: "uppercase" }]}>{copy.voteResult}</Text>
            <Text style={[type.display, { color: colors.text, textAlign: "center" }]}>
              {revealedVotedOutPlayer?.display_name ?? copy.aPlayer}
            </Text>
            <Text style={[type.bodyStrong, { color: colors.textSecondary, textAlign: "center" }]}>
              {revealedVotedOutRole === "imposter" ? copy.wasImposter : copy.wasVotedOut}
            </Text>
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>
              {revealedVotedOutRole === "imposter" ? copy.rightCall : room.state === "ended" ? copy.endedByVote : copy.lostCrew}
            </Text>
          </Animated.View>
        </View>
      </Modal>

      {/* Endgame overlay */}
      <Modal visible={showEndgameRevealModal} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: space.lg }}>
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 430,
              borderRadius: radius.xl,
              paddingHorizontal: space.xl,
              paddingVertical: space.xxl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(winnerTone, 0.45),
              shadowColor: winnerTone,
              shadowOpacity: 0.34,
              shadowRadius: 34,
              shadowOffset: { width: 0, height: 18 },
              elevation: 20,
              alignItems: "center",
              opacity: endgameRevealOpacity,
              transform: [{ scale: endgameRevealScale }, { translateY: endgameRevealTranslateY }],
              gap: space.sm,
            }}
          >
            <Animated.View
              style={{
                position: "absolute",
                top: space.xl,
                width: 188,
                height: 188,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(winnerTone, 0.22),
                opacity: endgamePulseOpacity,
                transform: [{ scale: endgamePulseScale }],
              }}
            />
            <View
              style={{
                width: 104,
                height: 104,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(winnerTone, 0.18),
                borderWidth: 1,
                borderColor: withAlpha(winnerTone, 0.4),
                marginBottom: space.sm,
              }}
            >
              <Ionicons name={room.winner === "imposter" ? "skull" : "trophy"} size={48} color={winnerTone} />
            </View>
            <Animated.Text
              style={[
                type.caption,
                {
                  color: winnerTone,
                  textTransform: "uppercase",
                  opacity: endgameVerdictOpacity,
                  transform: [{ translateY: endgameVerdictTranslateY }],
                },
              ]}
            >
              {copy.finalVerdict}
            </Animated.Text>
            <Animated.Text
              style={[
                type.display,
                {
                  color: colors.text,
                  textAlign: "center",
                  opacity: endgameWinnerOpacity,
                  transform: [{ translateY: endgameWinnerTranslateY }, { scale: endgameWinnerOpacity }],
                },
              ]}
            >
              {room.winner === "imposter" ? copy.imposterWins : copy.crewWins}
            </Animated.Text>
            <Animated.Text
              style={[
                type.body,
                {
                  color: colors.textSecondary,
                  textAlign: "center",
                  maxWidth: 320,
                  opacity: endgameSubtitleOpacity,
                  transform: [{ translateY: endgameSubtitleTranslateY }],
                },
              ]}
            >
              {room.winner === "imposter" ? copy.imposterWinsSub : copy.crewWinsSub}
            </Animated.Text>
            <Button
              label={copy.showResults}
              icon="trophy"
              accent={winnerTone}
              onPress={navigateToResults}
              style={{ alignSelf: "stretch", marginTop: space.md }}
            />
            <View
              style={{
                marginTop: space.sm,
                alignSelf: "stretch",
                height: 6,
                borderRadius: radius.pill,
                backgroundColor: colors.sunken,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: winnerTone,
                  transform: [{ scaleX: endgameRevealOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
                }}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* LOBBY                                                              */}
      {/* ------------------------------------------------------------------ */}
      {room.state === "lobby" ? (
        <AnimatedEntrance enterKey="phase-lobby" delay={20} style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <RoomCodeBadge code={room.code} label={copy.roomCode} accent={ACCENT} inviteUrl={inviteUrl || undefined} />
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.lobbyHint}</Text>
            <View style={{ alignSelf: "stretch" }}>
              <ShareButton
                label={copy.invite}
                message={`${copy.inviteMessage} ${room.code}`}
                url={inviteUrl}
                accentColor={ACCENT}
                variant="secondary"
                size="md"
              />
            </View>
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionLabel>{copy.category}</SectionLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {IMPOSTER_CATEGORIES.map((entry) => {
                const active = room.category_id === entry.id;
                const pending = busy === `category-${entry.id}`;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => run(`category-${entry.id}`, () => updateImposterCategory(roomId, playerId, entry.id))}
                    disabled={!isHost}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: !isHost }}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: "45%",
                      minHeight: touch.primary,
                      paddingHorizontal: space.md,
                      borderRadius: radius.md,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space.sm,
                      backgroundColor: active ? withAlpha(entry.accent, 0.18) : colors.surface,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? entry.accent : colors.border,
                      opacity: !isHost && !active ? 0.55 : pressed || pending ? 0.85 : 1,
                    })}
                  >
                    <Text style={{ fontSize: 24 }}>{entry.emoji}</Text>
                    <Text numberOfLines={2} style={{ flex: 1, color: active ? colors.text : colors.textSecondary, fontSize: 15, fontWeight: "800" }}>
                      {imposterCategoryLabel(entry, language)}
                    </Text>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={entry.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
            {!isHost ? <Text style={[type.small, { color: colors.textSubtle }]}>{copy.onlyHostCategory}</Text> : null}
          </View>

          <View style={{ gap: space.sm }}>
            <SectionLabel right={<Chip label={`${players.length}`} color={ACCENT} icon="people" />}>{copy.players}</SectionLabel>
            {players.map((player, index) => (
              <AnimatedEntrance key={player.id} enterKey={`lobby-${players.length}-${player.id}`} delay={60 + index * 30} distance={10}>
                <PlayerRow name={player.display_name}>
                  {player.id === myPlayer.id ? <Chip label={copy.you} color={colors.brand} /> : null}
                  {player.id === room.host_player_id ? <Chip label={copy.host} color={ACCENT} icon="star" /> : null}
                </PlayerRow>
              </AnimatedEntrance>
            ))}
          </View>
        </AnimatedEntrance>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* ROLE REVEAL                                                        */}
      {/* ------------------------------------------------------------------ */}
      {room.state === "role_reveal" ? (
        <AnimatedEntrance enterKey="phase-role-reveal" delay={20} style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={[type.title, { color: colors.text }]}>{copy.privateReveal}</Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{copy.revealHint}</Text>
          </View>
          {myRole ? (
            <SecretCard isImposter={isImposter} prompt={myRole.prompt} revealed={cardRevealed} onToggle={toggleCard} copy={copy} language={language} />
          ) : null}
          {category ? <Chip label={`${copy.category}: ${category.emoji} ${imposterCategoryLabel(category, language)}`} color={category.accent} icon="pricetag" /> : null}
        </AnimatedEntrance>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* DISCUSSION                                                         */}
      {/* ------------------------------------------------------------------ */}
      {room.state === "discussion" ? (
        <AnimatedEntrance enterKey={`phase-discussion-${room.phase_number}`} delay={20} style={{ gap: space.md }}>
          <Card accent={ACCENT} style={{ alignItems: "center" }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.timeLeft}</Text>
            <Text style={{ color: ACCENT, fontSize: 48, lineHeight: 54, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
              {phaseMinutesText}
            </Text>
            <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>
              {localizeMessage(room.public_message, language)}
            </Text>
            <Chip label={copy.readyToVoteCount(discussionReadyCount, alivePlayers.length)} color={colors.brand} icon="hand-right" />
          </Card>
          {myRole ? (
            <SecretCard compact isImposter={isImposter} prompt={myRole.prompt} revealed={cardRevealed} onToggle={toggleCard} copy={copy} language={language} />
          ) : null}
          {isHost ? (
            <Button
              label={copy.openVoting}
              icon="megaphone-outline"
              variant="secondary"
              size="md"
              loading={busy === "start-voting"}
              disabled={busy === "start-voting"}
              onPress={() => run("start-voting", () => startImposterVoting(roomId, playerId))}
            />
          ) : null}
        </AnimatedEntrance>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* VOTING                                                             */}
      {/* ------------------------------------------------------------------ */}
      {room.state === "voting" ? (
        <AnimatedEntrance enterKey={`phase-voting-${room.phase_number}`} delay={20} style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
              <Text style={[type.title, { color: colors.text }]}>{copy.vote}</Text>
              <Chip label={copy.votesIn(votersCount, alivePlayers.length)} color={ACCENT} icon="checkbox" />
            </View>
            <Text style={[type.body, { color: colors.textSecondary }]}>{isAlive ? copy.voteHint : copy.outCantVote}</Text>
          </View>

          {isAlive ? (
            <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
              {voteOptions.map((player, index) => {
                const selected = selectedId === player.id;
                const locked = myVote?.target_player_id === player.id;
                return (
                  <AnimatedEntrance key={player.id} enterKey={`vote-option-${room.phase_number}-${player.id}`} delay={40 + index * 28} distance={10}>
                    <Pressable
                      onPress={() => setSelectedTargetId(player.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => ({
                        minHeight: 64,
                        paddingHorizontal: space.lg,
                        borderRadius: radius.lg,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.md,
                        backgroundColor: selected ? withAlpha(ACCENT, 0.18) : colors.surface,
                        borderWidth: 2,
                        borderColor: selected ? ACCENT : colors.border,
                        opacity: pressed ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.99 : 1 }],
                      })}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? ACCENT : withAlpha(ACCENT, 0.14),
                        }}
                      >
                        <Text style={{ color: selected ? onAccent(ACCENT) : ACCENT, fontWeight: "900", fontSize: 17 }}>
                          {player.display_name.trim().charAt(0).toUpperCase() || "?"}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }}>
                        {player.display_name}
                      </Text>
                      {locked ? <Chip label={copy.yourVote} color={ACCENT} icon="checkmark" /> : null}
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={28}
                        color={selected ? ACCENT : colors.textSubtle}
                      />
                    </Pressable>
                  </AnimatedEntrance>
                );
              })}
            </View>
          ) : null}

          {voteTallies.length > 0 ? (
            <Card style={{ gap: space.sm }}>
              <SectionLabel>{copy.votesSoFar}</SectionLabel>
              {voteTallies.map((entry) => (
                <View key={entry.player?.id ?? `vote-${entry.count}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <Text numberOfLines={1} style={[type.body, { color: colors.textSecondary, flex: 1 }]}>
                    {entry.player?.display_name ?? copy.unknown}
                  </Text>
                  <Text style={[type.bodyStrong, { color: ACCENT }]}>{entry.count}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          {isHost ? (
            <Button
              label={copy.resolveVote}
              icon="flag-outline"
              variant="secondary"
              size="md"
              loading={busy === "resolve-votes"}
              disabled={busy === "resolve-votes"}
              onPress={() => run("resolve-votes", () => resolveImposterVoting(roomId, playerId))}
            />
          ) : (
            hintText(copy.waitingResolve)
          )}
        </AnimatedEntrance>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* ENDED (brief moment before the results screen)                     */}
      {/* ------------------------------------------------------------------ */}
      {room.state === "ended" ? (
        <AnimatedEntrance enterKey="phase-ended" delay={20} style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.gameOver}</Text>
          <Text style={[type.heading, { color: winnerTone }]}>
            {room.winner === "imposter" ? copy.imposterWins : copy.crewWins}
          </Text>
        </AnimatedEntrance>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* PLAYERS (in-game)                                                  */}
      {/* ------------------------------------------------------------------ */}
      {room.state !== "lobby" ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.players}</SectionLabel>
          {players.map((player, index) => {
            const role = playerRoles.find((entry) => entry.player_id === player.id)?.role;
            const eliminated = player.status === "eliminated";
            return (
              <AnimatedEntrance key={player.id} enterKey={`player-row-${room.phase_number}-${player.id}-${player.status}`} delay={60 + index * 24} distance={8}>
                <PlayerRow name={player.display_name} eliminated={eliminated}>
                  {player.id === myPlayer.id ? <Chip label={copy.you} color={colors.brand} /> : null}
                  {player.id === room.host_player_id ? <Chip label={copy.host} color={ACCENT} icon="star" /> : null}
                  {eliminated ? <Chip label={copy.out} color={colors.danger} icon="close" /> : null}
                  {room.state === "role_reveal" && player.role_reveal_ready ? <Chip label={copy.ready} color={colors.success} icon="checkmark" /> : null}
                  {room.state === "discussion" && player.discussion_ready ? <Chip label={copy.voteReady} color={colors.brand} icon="hand-right" /> : null}
                  {room.state === "ended" && role ? (
                    <Chip label={role.toUpperCase()} color={role === "imposter" ? colors.danger : ACCENT} />
                  ) : null}
                </PlayerRow>
              </AnimatedEntrance>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}
