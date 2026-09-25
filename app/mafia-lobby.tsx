import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  finishRoleReveal,
  resolveDayVote,
  resolveNight,
  startDayDiscussion,
  startDayVoting,
  startMafiaGame,
  startNextNight,
  submitDayVote,
  submitDiscussionReady,
  submitNightContinue,
  submitNightAction,
} from "../src/games/mafia/api";
import { getRoleDescription } from "../src/games/mafia/logic";
import type { MafiaPhase, MafiaRole } from "../src/games/mafia/types";
import { useMafiaRoom } from "../src/games/mafia/useMafiaRoom";
import { GAMES } from "../src/games/catalog";
import { ShareButton } from "../src/components/ShareButton";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { Button, Card, Chip, GameIcon, RoomCodeBadge, Screen, SectionLabel, TopBar, onAccent } from "../src/ui/components";
import { colors, gameAccents, radius, space, touch, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const ACCENT = gameAccents.mafia;
const MIN_PLAYERS = 4;
/** How long the role stays on screen after tapping reveal, so it isn't left open for the table to see. */
const ROLE_AUTO_HIDE_MS = 10000;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

type Lang = "en" | "sv";

const PRIVATE_READ_TAGS = [
  { id: "safe", color: colors.success },
  { id: "suspicious", color: colors.danger },
  { id: "loud", color: colors.brand },
] as const;

const ROLE_COLORS: Record<MafiaRole, string> = {
  mafia: ACCENT,
  doctor: colors.success,
  police: colors.brand,
  villager: colors.warning,
};

const ROLE_ICONS: Record<MafiaRole, React.ComponentProps<typeof Ionicons>["name"]> = {
  mafia: "skull",
  doctor: "medkit",
  police: "search",
  villager: "home",
};

function getRoleInstructionTheme(role: MafiaRole, language: Lang) {
  const sv = language === "sv";
  if (role === "mafia") return { label: sv ? "DITT UPPDRAG" : "YOUR MISSION", color: ROLE_COLORS.mafia };
  if (role === "doctor" || role === "police") {
    return { label: sv ? "DIN HANDLING I NATT" : "YOUR ACTION TONIGHT", color: ROLE_COLORS[role] };
  }
  return { label: sv ? "SÅ SPELAR DU ROLLEN" : "HOW TO PLAY THIS ROLE", color: ROLE_COLORS.villager };
}

const ROLE_DESCRIPTIONS_SV: Record<MafiaRole, string> = {
  mafia: "Samordna i hemlighet med resten av maffian, välj ett offer och bekräfta tillsammans.",
  doctor: "Välj en spelare att skydda i natt.",
  police: "Undersök en spelare i natt. Bara du ser resultatet.",
  villager:
    "Var aktiv på natten så att ingen kan gissa din roll. Anteckna i hemlighet vem som känns säker eller misstänkt, och smält in.",
};

function roleDescription(role: MafiaRole, language: Lang) {
  return language === "sv" ? ROLE_DESCRIPTIONS_SV[role] : getRoleDescription(role);
}

const COPY = {
  en: {
    phase: {
      lobby: "Lobby",
      role_reveal: "Role reveal",
      night: "Night",
      night_result: "Night result",
      day_discussion: "Day discussion",
      day_voting: "Day voting",
      vote_result: "Vote result",
      ended: "Game ended",
    } as Record<MafiaPhase, string>,
    roles: { mafia: "Mafia", doctor: "Doctor", police: "Police", villager: "Villager" } as Record<MafiaRole, string>,
    tags: { safe: "SAFE", suspicious: "SUSPICIOUS", loud: "LOUD YESTERDAY" } as Record<string, string>,
    loadingTitle: "Loading Mafia",
    loadingBody: "Setting up the room, syncing players, and getting everything ready for the next move.",
    joining: "Joining the table...",
    room: "Room",
    roomCode: "Room code",
    inviteMessage: (code: string) => `Join my Mafia game on Picklo! Room code: ${code}`,
    players: "Players",
    minPlayers: (n: number) => `Need at least ${MIN_PLAYERS} players to start (${n}/${MIN_PLAYERS}).`,
    hostReady: "Everyone in? Start when the table is ready.",
    waitingHostStart: "Waiting for the host to start the game.",
    startGame: "Start the game",
    leaveTitle: "Leave the game?",
    leaveBody: "The game keeps going without you and you can't rejoin this round.",
    leave: "Leave",
    stay: "Stay",
    yourRole: "Your role",
    tapReveal: "Tap to reveal. Keep your screen hidden.",
    tapHide: "Tap to hide",
    latestReport: "Latest police report",
    reportMafia: "You picked a mafia player.",
    reportVillage: "You picked a village player.",
    eliminatedNote: "You are eliminated but can still follow the game.",
    revealTitle: "Private role reveal",
    revealBody: "Read your role privately, then tap ready. The game advances once everyone is ready.",
    readyCount: (a: number, b: number) => `${a}/${b} ready`,
    sawRole: "I saw my role",
    ready: "Ready",
    nightTitle: "Night actions",
    pickMafia: "Pick tonight's target",
    pickDoctor: "Pick someone to protect",
    pickPolice: "Pick someone to investigate",
    lockedIn: "Locked in",
    confirmChoice: "Confirm choice",
    confirmed: "Confirmed",
    privateReads: "Private reads",
    privateReadsBody: "These badges stay only on your device. Use them to keep track of who feels safe, suspicious, or loud.",
    noTag: "No tag set yet",
    finishNotes: "Finish night notes",
    coordination: "Mafia coordination",
    teammate: "Teammate",
    noPlayerYet: "no player yet",
    selectedAs: "selected",
    asKillTarget: "as the kill target",
    lockedShort: "locked in",
    notConfirmed: "not confirmed yet",
    nightLocked: "Night choices locked",
    nightLockedBody: "Everyone has finished their night action. Tap continue to move on once all living players are ready.",
    continueReady: (a: number, b: number) => `Continue ready: ${a}/${b}`,
    continueBtn: "Continue",
    continuePressed: "Continue pressed",
    continueHint: "The continue button appears after every living player has confirmed a night action.",
    resolveNight: "Resolve night",
    waitingContinue: "Waiting for everyone to press continue.",
    afterNight: "After the night",
    aPlayer: "A player",
    savedSentence: (n: string) => `${n} was attacked during the night, but the doctor saved them.`,
    diedSentence: (n: string) => `${n} died during the night.`,
    nobodyDied: "No one died during the night.",
    autoDiscussion: (s: number) => `Discussion starts automatically in ${s}s if the host does not continue manually.`,
    continueDiscussion: "Continue to discussion",
    waitingDiscussion: "Waiting for the host to move into discussion.",
    discuss: "Discuss",
    timeLeft: "Time left",
    readyToVoteCount: (a: number, b: number) => `${a}/${b} living players are ready to vote.`,
    readyToVote: "Ready to vote",
    readyToVoteDone: "Ready to vote ✓",
    eliminatedDiscussion: "Eliminated players can watch the discussion, but only living players can mark ready.",
    openVoting: "Open voting now",
    vote: "Vote",
    votePrompt: "Who should leave the village? Pick a player, then confirm.",
    votesCast: (a: number, b: number) => `${a}/${b} votes in`,
    yourVote: "Your vote",
    pickPlayer: "Pick a player",
    voteFor: (n: string) => `Vote for ${n}`,
    votedFor: (n: string) => `Voted for ${n}`,
    resolveVote: "Resolve vote if timer ended",
    waitingResolveVote: "Waiting for the host to resolve the vote.",
    eliminatedVote: "Only living players can vote.",
    voteResult: "Vote result",
    wasEliminated: (n: string) => `${n} was eliminated.`,
    breakdown: "Vote breakdown",
    unknownPlayer: "Unknown player",
    votes: (c: number) => `${c} vote${c === 1 ? "" : "s"}`,
    nextNight: "Continue to next night",
    waitingHostContinue: "Waiting for the host to continue the game.",
    ended: "The game is over. Showing results…",
    seeResults: "See results",
    alive: "Alive",
    eliminated: "Eliminated",
    dead: "DEAD",
    voteReady: "VOTE READY",
    you: "You",
    host: "Host",
    yourPrivateReads: "Your private reads",
    yourPrivateReadsBody: "Only visible on this device. Use them to remember your gut feeling across rounds.",
    doctorSave: "DOCTOR SAVE",
    nightResult: "NIGHT RESULT",
    noOne: "No one",
    savedLine: "was attacked during the night but was saved",
    diedLine: "died during the night",
    survivedLine: "made it through the night",
    savedSub: "The doctor prevented the elimination. Day discussion is about to begin.",
    dawnSub: "The room is moving into daylight. Get ready for discussion.",
    finalVerdict: "Final verdict",
    mafiaWins: "MAFIA WINS",
    villageWins: "VILLAGE WINS",
    mafiaWinsSub: "The table lost control. The mafia outnumbered the village.",
    villageWinsSub: "The village held together and eliminated every mafia player.",
  },
  sv: {
    phase: {
      lobby: "Lobby",
      role_reveal: "Rollutdelning",
      night: "Natt",
      night_result: "Nattens resultat",
      day_discussion: "Dagdiskussion",
      day_voting: "Dagröstning",
      vote_result: "Röstresultat",
      ended: "Spelet är slut",
    } as Record<MafiaPhase, string>,
    roles: { mafia: "Mafia", doctor: "Doktor", police: "Polis", villager: "Bybo" } as Record<MafiaRole, string>,
    tags: { safe: "SÄKER", suspicious: "MISSTÄNKT", loud: "HÖGLJUDD IGÅR" } as Record<string, string>,
    loadingTitle: "Laddar Mafia",
    loadingBody: "Förbereder rummet, synkar spelare och gör allt redo för nästa drag.",
    joining: "Sätter dig vid bordet...",
    room: "Rum",
    roomCode: "Rumskod",
    inviteMessage: (code: string) => `Spela Mafia med mig på Picklo! Rumskod: ${code}`,
    players: "Spelare",
    minPlayers: (n: number) => `Minst ${MIN_PLAYERS} spelare behövs för att starta (${n}/${MIN_PLAYERS}).`,
    hostReady: "Alla med? Starta när bordet är redo.",
    waitingHostStart: "Väntar på att värden startar spelet.",
    startGame: "Starta spelet",
    leaveTitle: "Lämna spelet?",
    leaveBody: "Spelet fortsätter utan dig och du kan inte gå med igen den här omgången.",
    leave: "Lämna",
    stay: "Stanna",
    yourRole: "Din roll",
    tapReveal: "Tryck för att visa. Dölj skärmen för de andra.",
    tapHide: "Tryck för att dölja",
    latestReport: "Senaste polisrapporten",
    reportMafia: "Du valde en maffiaspelare.",
    reportVillage: "Du valde en bybo.",
    eliminatedNote: "Du är utslagen men kan fortfarande följa spelet.",
    revealTitle: "Hemlig rollutdelning",
    revealBody: "Läs din roll i hemlighet och tryck sedan på redo. Spelet fortsätter när alla är redo.",
    readyCount: (a: number, b: number) => `${a}/${b} redo`,
    sawRole: "Jag har sett min roll",
    ready: "Redo",
    nightTitle: "Nattens handlingar",
    pickMafia: "Välj nattens offer",
    pickDoctor: "Välj någon att skydda",
    pickPolice: "Välj någon att undersöka",
    lockedIn: "Låst",
    confirmChoice: "Bekräfta val",
    confirmed: "Bekräftat",
    privateReads: "Privata anteckningar",
    privateReadsBody: "Märkena sparas bara på din enhet. Håll koll på vem som känns säker, misstänkt eller högljudd.",
    noTag: "Inget märke ännu",
    finishNotes: "Klar med nattens anteckningar",
    coordination: "Maffians samordning",
    teammate: "Lagkamrat",
    noPlayerYet: "ingen spelare ännu",
    selectedAs: "valde",
    asKillTarget: "som offer",
    lockedShort: "låst",
    notConfirmed: "inte bekräftat ännu",
    nightLocked: "Nattens val är låsta",
    nightLockedBody: "Alla har gjort sin nattliga handling. Tryck fortsätt när alla levande spelare är redo.",
    continueReady: (a: number, b: number) => `Redo att fortsätta: ${a}/${b}`,
    continueBtn: "Fortsätt",
    continuePressed: "Fortsätt tryckt",
    continueHint: "Fortsätt-knappen visas när alla levande spelare har bekräftat sin nattliga handling.",
    resolveNight: "Avsluta natten",
    waitingContinue: "Väntar på att alla trycker fortsätt.",
    afterNight: "Efter natten",
    aPlayer: "En spelare",
    savedSentence: (n: string) => `${n} attackerades under natten, men doktorn räddade hen.`,
    diedSentence: (n: string) => `${n} dog under natten.`,
    nobodyDied: "Ingen dog under natten.",
    autoDiscussion: (s: number) => `Diskussionen börjar automatiskt om ${s} s om värden inte fortsätter manuellt.`,
    continueDiscussion: "Fortsätt till diskussion",
    waitingDiscussion: "Väntar på att värden startar diskussionen.",
    discuss: "Diskutera",
    timeLeft: "Tid kvar",
    readyToVoteCount: (a: number, b: number) => `${a}/${b} levande spelare är redo att rösta.`,
    readyToVote: "Redo att rösta",
    readyToVoteDone: "Redo att rösta ✓",
    eliminatedDiscussion: "Utslagna spelare kan följa diskussionen, men bara levande spelare kan markera redo.",
    openVoting: "Öppna röstningen nu",
    vote: "Rösta",
    votePrompt: "Vem ska lämna byn? Välj en spelare och bekräfta.",
    votesCast: (a: number, b: number) => `${a}/${b} röster inne`,
    yourVote: "Din röst",
    pickPlayer: "Välj en spelare",
    voteFor: (n: string) => `Rösta på ${n}`,
    votedFor: (n: string) => `Röstade på ${n}`,
    resolveVote: "Avgör röstningen om tiden är ute",
    waitingResolveVote: "Väntar på att värden avgör röstningen.",
    eliminatedVote: "Bara levande spelare kan rösta.",
    voteResult: "Röstresultat",
    wasEliminated: (n: string) => `${n} röstades ut.`,
    breakdown: "Rösterna",
    unknownPlayer: "Okänd spelare",
    votes: (c: number) => `${c} ${c === 1 ? "röst" : "röster"}`,
    nextNight: "Fortsätt till nästa natt",
    waitingHostContinue: "Väntar på att värden fortsätter spelet.",
    ended: "Spelet är slut. Visar resultatet…",
    seeResults: "Se resultatet",
    alive: "Lever",
    eliminated: "Utslagen",
    dead: "DÖD",
    voteReady: "REDO ATT RÖSTA",
    you: "Du",
    host: "Värd",
    yourPrivateReads: "Dina privata anteckningar",
    yourPrivateReadsBody: "Syns bara på den här enheten. Kom ihåg din magkänsla mellan rundorna.",
    doctorSave: "DOKTORN RÄDDADE",
    nightResult: "NATTENS RESULTAT",
    noOne: "Ingen",
    savedLine: "attackerades under natten men räddades",
    diedLine: "dog under natten",
    survivedLine: "klarade sig genom natten",
    savedSub: "Doktorn förhindrade mordet. Dagdiskussionen börjar snart.",
    dawnSub: "Det gryr i byn. Gör er redo att diskutera.",
    finalVerdict: "Slutgiltig dom",
    mafiaWins: "MAFIAN VINNER",
    villageWins: "BYN VINNER",
    mafiaWinsSub: "Bordet tappade kontrollen. Maffian blev fler än byborna.",
    villageWinsSub: "Byn höll ihop och röstade ut varenda maffiaspelare.",
  },
};

type PrivateReadTagId = (typeof PRIVATE_READ_TAGS)[number]["id"];
type PrivateReads = Record<string, PrivateReadTagId>;

// ---------------------------------------------------------------------------
// Small local building blocks
// ---------------------------------------------------------------------------

function WaitingNote({ text }: { text: string }) {
  return (
    <View style={{ minHeight: touch.min, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm }}>
      <ActivityIndicator size="small" color={colors.textMuted} />
      <Text style={[type.small, { color: colors.textMuted, flexShrink: 1, textAlign: "center" }]}>{text}</Text>
    </View>
  );
}

function Hint({ text, color = colors.textMuted }: { text: string; color?: string }) {
  return <Text style={[type.small, { color }]}>{text}</Text>;
}

/** Big tappable row for picking a player (night targets, votes, private reads). */
function PickRow({
  label,
  selected,
  onPress,
  disabled,
  loading,
  accent = ACCENT,
  meta,
  metaColor,
  right,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accent?: string;
  meta?: string;
  metaColor?: string;
  right?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => ({
        minHeight: touch.primary,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radius.md,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: selected ? withAlpha(accent, 0.16) : pressed ? colors.surfaceRaised : colors.sunken,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? accent : colors.border,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: selected ? accent : colors.borderStrong,
          backgroundColor: selected ? accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={onAccent(accent)} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>
          {label}
        </Text>
        {meta ? <Text style={{ color: metaColor ?? colors.textSubtle, fontSize: 13, fontWeight: "700" }}>{meta}</Text> : null}
      </View>
      {loading ? <ActivityIndicator size="small" color={accent} /> : right}
    </Pressable>
  );
}

export default function MafiaRoomScreen() {
  const { language: lang, t, translateServerMessage, translateError } = useI18n();
  const language: Lang = lang === "sv" ? "sv" : "en";
  const L = COPY[language];
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const [roleVisible, setRoleVisible] = useState(false);
  const [pendingVoteId, setPendingVoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [privateReads, setPrivateReads] = useState<PrivateReads>({});
  const [selectedReadPlayerId, setSelectedReadPlayerId] = useState<string | null>(null);
  const [showNightResultModal, setShowNightResultModal] = useState(false);
  const [shownNightResultKey, setShownNightResultKey] = useState<string | null>(null);
  const [showEndgameRevealModal, setShowEndgameRevealModal] = useState(false);
  const [hasNavigatedToResults, setHasNavigatedToResults] = useState(false);
  const [shownEndgameRevealKey, setShownEndgameRevealKey] = useState<string | null>(null);
  const { room, players, myPlayer, myRole, myNightAction, currentNightActions, mafiaNightActions, myPoliceReports, myDayVote, currentDayVotes, events, loading, refresh } =
    useMafiaRoom(roomId, playerId);
  const nightResultOpacity = useRef(new Animated.Value(0)).current;
  const nightResultScale = useRef(new Animated.Value(0.9)).current;
  const nightResultTranslateY = useRef(new Animated.Value(28)).current;
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

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const alivePlayers = useMemo(() => players.filter((player) => player.status === "alive"), [players]);
  const latestReport = myPoliceReports[0] ?? null;
  const latestEvent = events[events.length - 1] ?? null;
  const discussionReadyCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const phaseSecondsLeft = room?.phase_ends_at ? Math.max(0, Math.ceil((new Date(room.phase_ends_at).getTime() - now) / 1000)) : 0;
  const phaseMinutesText = `${Math.floor(phaseSecondsLeft / 60)}:${String(phaseSecondsLeft % 60).padStart(2, "0")}`;
  const latestEliminatedPlayerId = typeof latestEvent?.payload?.eliminatedPlayerId === "string" ? latestEvent.payload.eliminatedPlayerId : null;
  const latestEliminatedPlayer = latestEliminatedPlayerId ? players.find((player) => player.id === latestEliminatedPlayerId) ?? null : null;
  const doctorSaved = latestEvent?.payload?.doctorSaved === true;
  const savedPlayerId = typeof latestEvent?.payload?.doctorSavedPlayerId === "string" ? latestEvent.payload.doctorSavedPlayerId : null;
  const savedPlayer = savedPlayerId ? players.find((player) => player.id === savedPlayerId) ?? null : null;
  const selectedTargetId = myNightAction?.target_player_id ?? null;
  const voteTargetId = myDayVote?.target_player_id ?? null;
  const role = myRole?.role ?? "villager";
  const roleInstructionTheme = getRoleInstructionTheme(role, language);
  const privateReadsKey = `mafia-private-reads:${roomId}:${playerId}`;
  const aliveNightActions = useMemo(
    () => currentNightActions.filter((action) => alivePlayers.some((player) => player.id === action.actor_player_id)),
    [alivePlayers, currentNightActions]
  );
  const allAlivePlayersLockedNightAction =
    alivePlayers.length > 0 &&
    alivePlayers.every((player) => aliveNightActions.some((action) => action.actor_player_id === player.id && action.confirmed));
  const nightContinueCount = useMemo(() => alivePlayers.filter((player) => player.discussion_ready).length, [alivePlayers]);
  const hasPressedNightContinue = !!myPlayer?.discussion_ready;
  const villagerReadTargets = useMemo(() => alivePlayers.filter((player) => player.id !== myPlayer?.id), [alivePlayers, myPlayer?.id]);
  const villagerPrivateReads = useMemo(
    () =>
      Object.entries(privateReads)
        .map(([targetPlayerId, tagId]) => ({
          player: players.find((player) => player.id === targetPlayerId) ?? null,
          tag: PRIVATE_READ_TAGS.find((tag) => tag.id === tagId) ?? null,
        }))
        .filter((entry) => entry.player && entry.tag),
    [players, privateReads]
  );
  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentDayVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([targetPlayerId, count]) => ({
        player: players.find((player) => player.id === targetPlayerId) ?? null,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentDayVotes, players]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (err) {
      showAlert(t("common.action_failed"), translateError(err));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!room?.phase_ends_at || room.state === "lobby" || room.state === "ended") return;

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [room?.phase_ends_at, room?.state]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "day_discussion") return;
    if (!room.phase_ends_at) return;
    if (phaseSecondsLeft > 0) return;
    if (busy) return;

    run("auto-start-voting", () => startDayVoting(roomId, playerId));
  }, [busy, isHost, phaseSecondsLeft, playerId, room, roomId]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "night_result") return;
    if (!room.phase_ends_at) return;
    if (phaseSecondsLeft > 0) return;
    if (busy) return;

    run("auto-start-discussion", () => startDayDiscussion(roomId, playerId));
  }, [busy, isHost, phaseSecondsLeft, playerId, room, roomId]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "day_voting") return;
    if (busy) return;

    const aliveVoterCount = alivePlayers.length;
    const uniqueVoters = new Set(currentDayVotes.map((vote) => vote.voter_player_id).filter(Boolean));
    if (aliveVoterCount > 0 && uniqueVoters.size === aliveVoterCount) {
      run("auto-resolve-vote", () => resolveDayVote(roomId, playerId));
    }
  }, [alivePlayers.length, busy, currentDayVotes, isHost, playerId, room, roomId]);

  useEffect(() => {
    if (!room || !isHost) return;
    if (room.state !== "night") return;
    if (busy) return;
    if (!allAlivePlayersLockedNightAction) return;
    if (nightContinueCount !== alivePlayers.length) return;

    run("auto-resolve-night", () => resolveNight(roomId, playerId));
  }, [alivePlayers.length, allAlivePlayersLockedNightAction, busy, isHost, nightContinueCount, playerId, room, roomId]);

  useEffect(() => {
    let cancelled = false;

    const loadPrivateReads = async () => {
      if (!roomId || !playerId) return;
      try {
        const stored = await AsyncStorage.getItem(privateReadsKey);
        if (cancelled) return;
        if (!stored) {
          setPrivateReads({});
          return;
        }
        const parsed = JSON.parse(stored) as PrivateReads;
        setPrivateReads(parsed ?? {});
      } catch (error) {
        console.error("Could not load private mafia reads", error);
        if (!cancelled) setPrivateReads({});
      }
    };

    loadPrivateReads();

    return () => {
      cancelled = true;
    };
  }, [playerId, privateReadsKey, roomId]);

  useEffect(() => {
    if (!selectedReadPlayerId) return;
    if (villagerReadTargets.some((player) => player.id === selectedReadPlayerId)) return;
    setSelectedReadPlayerId(null);
  }, [selectedReadPlayerId, villagerReadTargets]);

  useEffect(() => {
    if (!room) return;
    if (room.state !== "night_result") return;

    const modalKey =
      latestEvent?.event_type === "night_result"
        ? `${room.phase_number}-${latestEliminatedPlayerId ?? "none"}-${savedPlayerId ?? "none"}-${doctorSaved ? "saved" : "lost"}`
        : null;
    if (!modalKey || shownNightResultKey === modalKey) return;

    setShownNightResultKey(modalKey);
    setShowNightResultModal(true);
    nightResultOpacity.setValue(0);
    nightResultScale.setValue(0.9);
    nightResultTranslateY.setValue(28);

    Animated.parallel([
      Animated.timing(nightResultOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(nightResultScale, {
        toValue: 1,
        tension: 72,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(nightResultTranslateY, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    latestEliminatedPlayerId,
    latestEvent?.event_type,
    nightResultOpacity,
    nightResultScale,
    nightResultTranslateY,
    room,
    shownNightResultKey,
  ]);

  useEffect(() => {
    if (!room) return;
    if (room.state !== "ended") {
      setHasNavigatedToResults(false);
      return;
    }

    const revealKey = `${room.id}-${room.phase_number}-${room.winner ?? "unknown"}`;
    if (shownEndgameRevealKey === revealKey || hasNavigatedToResults) return;

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
    endgameRevealOpacity,
    endgamePulseOpacity,
    endgamePulseScale,
    endgameRevealScale,
    endgameSubtitleOpacity,
    endgameSubtitleTranslateY,
    endgameRevealTranslateY,
    endgameVerdictOpacity,
    endgameVerdictTranslateY,
    endgameWinnerOpacity,
    endgameWinnerTranslateY,
    hasNavigatedToResults,
    playerId,
    room,
    roomId,
    shownEndgameRevealKey,
  ]);

  useEffect(() => {
    if (!showEndgameRevealModal) return;
    if (!room || room.state !== "ended") return;
    if (hasNavigatedToResults) return;

    const timeoutId = setTimeout(() => {
      setShowEndgameRevealModal(false);
      setHasNavigatedToResults(true);
      router.replace({ pathname: "/mafia-results", params: { roomId, playerId } });
    }, 4400);

    return () => clearTimeout(timeoutId);
  }, [hasNavigatedToResults, playerId, room, roomId, showEndgameRevealModal]);

  useEffect(() => {
    if (!showNightResultModal) return;

    const timeoutId = setTimeout(() => {
      setShowNightResultModal(false);
    }, 3200);

    return () => clearTimeout(timeoutId);
  }, [showNightResultModal]);

  // Role secrecy: the role hides itself again after a few seconds and whenever the phase changes.
  useEffect(() => {
    if (!roleVisible) return;
    const timeoutId = setTimeout(() => setRoleVisible(false), ROLE_AUTO_HIDE_MS);
    return () => clearTimeout(timeoutId);
  }, [roleVisible]);

  useEffect(() => {
    setRoleVisible(false);
    setPendingVoteId(null);
  }, [room?.state, room?.phase_number]);

  const leaveGame = async () => {
    const inProgress = !!room && room.state !== "lobby" && room.state !== "ended";
    if (inProgress) {
      const ok = await confirmAction(L.leaveTitle, L.leaveBody, { confirmLabel: L.leave, cancelLabel: L.stay, destructive: true });
      if (!ok) return;
    }
    router.replace(GAMES.mafia.href as any);
  };

  const topBar = <TopBar title="Mafia" onBack={leaveGame} />;

  if (loading || !room || !myPlayer) {
    return (
      <Screen topBar={topBar} centered>
        <View style={{ alignItems: "center", gap: space.md }}>
          <GameIcon source={GAMES.mafia.icon} size={96} accent={ACCENT} />
          <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{L.loadingTitle}</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{L.loadingBody}</Text>
          <WaitingNote text={L.joining} />
        </View>
      </Screen>
    );
  }

  const baseUrl = SITE_URL;
  const inviteUrl = `${baseUrl}/mafia?code=${room.code}`;
  const showIdentityCard = room.state !== "lobby" && !!myRole;
  const isAlive = myPlayer.status === "alive";
  const nightTargets =
    role === "mafia"
      ? alivePlayers.filter((player) => player.id !== myPlayer.id)
      : role === "doctor"
        ? alivePlayers
        : role === "police"
          ? alivePlayers.filter((player) => player.id !== myPlayer.id)
          : [];

  const savePrivateRead = async (targetPlayerId: string, tagId: PrivateReadTagId) => {
    const nextReads = { ...privateReads, [targetPlayerId]: tagId };
    setPrivateReads(nextReads);
    try {
      await AsyncStorage.setItem(privateReadsKey, JSON.stringify(nextReads));
    } catch (error) {
      console.error("Could not save private mafia reads", error);
    }
  };

  const playerName = (id: string | null | undefined) => players.find((player) => player.id === id)?.display_name ?? "";
  const roleColor = ROLE_COLORS[role];
  const showTimer = !!room.phase_ends_at && room.state !== "lobby" && room.state !== "ended";
  const roleRevealReadyCount = players.filter((player) => player.role_reveal_ready).length;
  const uniqueVoterCount = new Set(currentDayVotes.map((vote) => vote.voter_player_id).filter(Boolean)).size;
  const selectedVoteId = pendingVoteId ?? voteTargetId;
  const nightPrompt = role === "mafia" ? L.pickMafia : role === "doctor" ? L.pickDoctor : L.pickPolice;

  // -------------------------------------------------------------------------
  // Sticky footer: the one main action for the current phase.
  // -------------------------------------------------------------------------
  const renderFooter = (): React.ReactNode => {
    switch (room.state) {
      case "lobby":
        return isHost ? (
          <Button
            label={L.startGame}
            icon="play"
            accent={ACCENT}
            loading={busy === "start"}
            disabled={players.length < MIN_PLAYERS}
            onPress={() => run("start", () => startMafiaGame(roomId, playerId))}
          />
        ) : (
          <WaitingNote text={L.waitingHostStart} />
        );
      case "role_reveal":
        return (
          <Button
            label={myPlayer.role_reveal_ready ? L.ready : L.sawRole}
            icon={myPlayer.role_reveal_ready ? "checkmark-circle" : "eye-off"}
            accent={ACCENT}
            loading={busy === "reveal"}
            disabled={myPlayer.role_reveal_ready}
            onPress={() => run("reveal", () => finishRoleReveal(roomId, playerId))}
          />
        );
      case "night": {
        const nightReadyToResolve = allAlivePlayersLockedNightAction && nightContinueCount === alivePlayers.length;
        if (allAlivePlayersLockedNightAction) {
          return (
            <>
              {isAlive ? (
                <Button
                  label={hasPressedNightContinue ? L.continuePressed : L.continueBtn}
                  icon={hasPressedNightContinue ? "checkmark-circle" : "arrow-forward"}
                  accent={ACCENT}
                  loading={busy === "night-continue"}
                  disabled={hasPressedNightContinue}
                  onPress={() => run("night-continue", () => submitNightContinue(roomId, playerId))}
                />
              ) : null}
              {isHost ? (
                <Button
                  label={L.resolveNight}
                  variant="secondary"
                  size="md"
                  loading={busy === "resolve-night"}
                  disabled={!nightReadyToResolve}
                  onPress={() => run("resolve-night", () => resolveNight(roomId, playerId))}
                />
              ) : hasPressedNightContinue || !isAlive ? (
                <WaitingNote text={L.waitingContinue} />
              ) : null}
            </>
          );
        }
        if (!isAlive) return <WaitingNote text={L.continueHint} />;
        if (role === "villager") {
          return (
            <Button
              label={myNightAction?.confirmed ? L.ready : L.finishNotes}
              icon={myNightAction?.confirmed ? "checkmark-circle" : "moon"}
              accent={ACCENT}
              loading={busy === "villager-ready"}
              disabled={!!myNightAction?.confirmed}
              onPress={() => run("villager-ready", () => submitNightAction(roomId, playerId, null, true))}
            />
          );
        }
        return (
          <Button
            label={
              myNightAction?.confirmed
                ? `${L.confirmed}: ${playerName(selectedTargetId)}`
                : selectedTargetId
                  ? `${L.confirmChoice}: ${playerName(selectedTargetId)}`
                  : nightPrompt
            }
            icon={myNightAction?.confirmed ? "lock-closed" : "checkmark"}
            accent={ACCENT}
            loading={busy === "confirm-night"}
            disabled={!selectedTargetId || !!myNightAction?.confirmed}
            onPress={() => run("confirm-night", () => submitNightAction(roomId, playerId, selectedTargetId, true))}
          />
        );
      }
      case "night_result":
        return isHost ? (
          <Button
            label={L.continueDiscussion}
            icon="sunny"
            accent={ACCENT}
            loading={busy === "discussion"}
            onPress={() => run("discussion", () => startDayDiscussion(roomId, playerId))}
          />
        ) : (
          <WaitingNote text={L.waitingDiscussion} />
        );
      case "day_discussion":
        return (
          <>
            {isAlive ? (
              <Button
                label={myPlayer.discussion_ready ? L.readyToVoteDone : L.readyToVote}
                icon={myPlayer.discussion_ready ? "checkmark-circle" : "hand-left"}
                accent={ACCENT}
                loading={busy === "discussion-ready"}
                disabled={myPlayer.discussion_ready}
                onPress={() => run("discussion-ready", () => submitDiscussionReady(roomId, playerId))}
              />
            ) : null}
            {isHost ? (
              <Button
                label={L.openVoting}
                variant="secondary"
                size="md"
                loading={busy === "start-voting"}
                onPress={() => run("start-voting", () => startDayVoting(roomId, playerId))}
              />
            ) : null}
          </>
        );
      case "day_voting": {
        const hasChange = !!pendingVoteId && pendingVoteId !== voteTargetId;
        return (
          <>
            {isAlive ? (
              <Button
                label={
                  hasChange
                    ? L.voteFor(playerName(pendingVoteId))
                    : voteTargetId
                      ? L.votedFor(playerName(voteTargetId))
                      : L.pickPlayer
                }
                icon={!hasChange && voteTargetId ? "checkmark-circle" : "hand-right"}
                accent={ACCENT}
                loading={!!busy && busy.startsWith("vote-")}
                disabled={!hasChange}
                onPress={() => {
                  const target = pendingVoteId;
                  if (!target) return;
                  run(`vote-${target}`, () => submitDayVote(roomId, playerId, target));
                }}
              />
            ) : null}
            {isHost ? (
              <Button
                label={L.resolveVote}
                variant="secondary"
                size="md"
                loading={busy === "resolve-vote"}
                onPress={() => run("resolve-vote", () => resolveDayVote(roomId, playerId))}
              />
            ) : !isAlive ? (
              <WaitingNote text={L.waitingResolveVote} />
            ) : null}
          </>
        );
      }
      case "vote_result":
        return isHost ? (
          <Button
            label={L.nextNight}
            icon="moon"
            accent={ACCENT}
            loading={busy === "next-night"}
            onPress={() => run("next-night", () => startNextNight(roomId, playerId))}
          />
        ) : (
          <WaitingNote text={L.waitingHostContinue} />
        );
      case "ended":
        return (
          <Button
            label={L.seeResults}
            icon="trophy"
            accent={ACCENT}
            onPress={() => {
              setShowEndgameRevealModal(false);
              setHasNavigatedToResults(true);
              router.replace({ pathname: "/mafia-results", params: { roomId, playerId } });
            }}
          />
        );
      default:
        return null;
    }
  };

  const mafiaWon = room.winner === "mafia";
  const verdictColor = mafiaWon ? ACCENT : colors.brand;
  const nightColor = doctorSaved ? colors.success : colors.danger;

  return (
    <Screen topBar={topBar} footer={renderFooter()}>
      {/* Night result overlay */}
      <Modal visible={showNightResultModal} transparent animationType="fade" onRequestClose={() => setShowNightResultModal(false)}>
        <Pressable
          onPress={() => setShowNightResultModal(false)}
          style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: space.lg }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: radius.xl,
              padding: space.xl,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: withAlpha(nightColor, 0.45),
              shadowColor: nightColor,
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 16 },
              elevation: 18,
              alignItems: "center",
              gap: space.sm,
              opacity: nightResultOpacity,
              transform: [{ scale: nightResultScale }, { translateY: nightResultTranslateY }],
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(nightColor, 0.18),
                borderWidth: 1,
                borderColor: withAlpha(nightColor, 0.4),
                marginBottom: space.sm,
              }}
            >
              <Ionicons name={doctorSaved ? "medkit" : "skull"} size={42} color={nightColor} />
            </View>
            <Text style={[type.caption, { color: nightColor, letterSpacing: 2 }]}>{doctorSaved ? L.doctorSave : L.nightResult}</Text>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
              {doctorSaved ? savedPlayer?.display_name ?? L.aPlayer : latestEliminatedPlayer ? latestEliminatedPlayer.display_name : L.noOne}
            </Text>
            <Text style={[type.bodyStrong, { color: colors.textSecondary, textAlign: "center" }]}>
              {doctorSaved ? L.savedLine : latestEliminatedPlayer ? L.diedLine : L.survivedLine}
            </Text>
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{doctorSaved ? L.savedSub : L.dawnSub}</Text>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Endgame reveal overlay */}
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
              borderColor: withAlpha(verdictColor, 0.4),
              shadowColor: verdictColor,
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
                width: 188,
                height: 188,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(verdictColor, 0.24),
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
                backgroundColor: withAlpha(verdictColor, 0.18),
                borderWidth: 1,
                borderColor: withAlpha(verdictColor, 0.4),
                marginBottom: space.sm,
              }}
            >
              <Ionicons name={mafiaWon ? "skull" : "home"} size={48} color={verdictColor} />
            </View>
            <Animated.Text
              style={[
                type.caption,
                {
                  color: verdictColor,
                  letterSpacing: 2.2,
                  textTransform: "uppercase",
                  opacity: endgameVerdictOpacity,
                  transform: [{ translateY: endgameVerdictTranslateY }],
                },
              ]}
            >
              {L.finalVerdict}
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
              {mafiaWon ? L.mafiaWins : L.villageWins}
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
              {mafiaWon ? L.mafiaWinsSub : L.villageWinsSub}
            </Animated.Text>
            <View
              style={{
                marginTop: space.sm,
                alignSelf: "stretch",
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: colors.sunken,
                overflow: "hidden",
              }}
            >
              <Animated.View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: verdictColor,
                  transform: [
                    {
                      scaleX: endgameRevealOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 1],
                      }),
                    },
                  ],
                }}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Phase header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>
            {L.room} {room.code}
          </Text>
          <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
            {L.phase[room.state]}
          </Text>
        </View>
        {showTimer ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: space.md,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(colors.warning, 0.14),
              borderWidth: 1,
              borderColor: withAlpha(colors.warning, 0.4),
            }}
          >
            <Ionicons name="timer-outline" size={18} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{phaseMinutesText}</Text>
          </View>
        ) : null}
      </View>

      {!isAlive && room.state !== "lobby" ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            backgroundColor: withAlpha(colors.danger, 0.12),
            borderWidth: 1,
            borderColor: withAlpha(colors.danger, 0.35),
          }}
        >
          <Ionicons name="skull" size={20} color={colors.danger} />
          <Text style={[type.small, { color: colors.danger, flex: 1, fontWeight: "700" }]}>{L.eliminatedNote}</Text>
        </View>
      ) : null}

      {/* Secret identity: hidden until the player deliberately taps to reveal it. */}
      {showIdentityCard ? (
        <Pressable
          onPress={() => setRoleVisible((visible) => !visible)}
          accessibilityRole="button"
          accessibilityState={{ expanded: roleVisible }}
          accessibilityLabel={roleVisible ? L.tapHide : L.tapReveal}
          style={({ pressed }) => ({
            borderRadius: radius.lg,
            padding: space.lg,
            gap: space.md,
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderWidth: room.state === "role_reveal" ? 2 : 1,
            borderColor: roleVisible ? withAlpha(roleColor, 0.55) : room.state === "role_reveal" ? withAlpha(ACCENT, 0.6) : colors.border,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: roleVisible ? withAlpha(roleColor, 0.18) : colors.sunken,
              }}
            >
              <Ionicons name={roleVisible ? ROLE_ICONS[role] : "eye-off"} size={24} color={roleVisible ? roleColor : colors.textMuted} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{L.yourRole}</Text>
              {roleVisible ? (
                <Text style={[type.title, { color: roleColor }]}>{L.roles[role]}</Text>
              ) : (
                <Text style={[type.bodyStrong, { color: colors.text }]}>{L.tapReveal}</Text>
              )}
            </View>
            <Ionicons name={roleVisible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textMuted} />
          </View>

          {roleVisible ? (
            <>
              <View
                style={{
                  borderRadius: radius.md,
                  padding: space.md,
                  backgroundColor: withAlpha(roleInstructionTheme.color, 0.1),
                  borderWidth: 1,
                  borderColor: withAlpha(roleInstructionTheme.color, 0.3),
                  gap: 6,
                }}
              >
                <Text style={[type.caption, { color: roleInstructionTheme.color }]}>{roleInstructionTheme.label}</Text>
                <Text style={[type.body, { color: colors.text, fontWeight: "700" }]}>{roleDescription(role, language)}</Text>
              </View>
              {latestReport ? (
                <View style={{ borderRadius: radius.md, padding: space.md, backgroundColor: colors.sunken, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                  <Text style={[type.caption, { color: colors.brand, textTransform: "uppercase" }]}>{L.latestReport}</Text>
                  <Text style={[type.body, { color: colors.text }]}>
                    {latestReport.result_alignment === "mafia" ? L.reportMafia : L.reportVillage}
                  </Text>
                </View>
              ) : null}
              <Text style={[type.small, { color: colors.textSubtle, textAlign: "center" }]}>{L.tapHide}</Text>
            </>
          ) : null}
        </Pressable>
      ) : null}

      {/* ---------------- Lobby ---------------- */}
      {room.state === "lobby" ? (
        <>
          <Card accent={ACCENT} style={{ alignItems: "stretch", gap: space.lg }}>
            <RoomCodeBadge code={room.code} label={L.roomCode} accent={ACCENT} inviteUrl={inviteUrl || undefined} />
            <ShareButton label={t("common.invite")} message={L.inviteMessage(room.code)} url={inviteUrl} accentColor={ACCENT} />
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionLabel right={<Chip label={`${players.length}/${MIN_PLAYERS}+`} color={players.length >= MIN_PLAYERS ? colors.success : colors.textMuted} icon="people" />}>
              {L.players}
            </SectionLabel>
            {players.map((player) => {
              const isMe = player.id === myPlayer.id;
              const isRoomHost = player.id === room.host_player_id;
              return (
                <View
                  key={player.id}
                  style={{
                    minHeight: touch.primary,
                    paddingHorizontal: space.lg,
                    paddingVertical: space.md,
                    borderRadius: radius.md,
                    backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
                    borderWidth: 1,
                    borderColor: isMe ? withAlpha(ACCENT, 0.4) : colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                  }}
                >
                  <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
                    {player.display_name}
                    {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{`  (${L.you})`}</Text> : null}
                  </Text>
                  {isRoomHost ? <Chip label={L.host} color={ACCENT} icon="star" /> : null}
                </View>
              );
            })}
            <Hint
              text={isHost ? (players.length < MIN_PLAYERS ? L.minPlayers(players.length) : L.hostReady) : L.waitingHostStart}
              color={isHost && players.length < MIN_PLAYERS ? colors.warning : colors.textMuted}
            />
          </View>
        </>
      ) : null}

      {/* ---------------- Role reveal ---------------- */}
      {room.state === "role_reveal" ? (
        <Card>
          <Text style={[type.heading, { color: colors.text }]}>{L.revealTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{L.revealBody}</Text>
          <Chip label={L.readyCount(roleRevealReadyCount, players.length)} color={colors.success} icon="checkmark-circle" />
        </Card>
      ) : null}

      {/* ---------------- Night ---------------- */}
      {room.state === "night" ? (
        <>
          {role === "villager" ? (
            <View style={{ gap: space.sm }}>
              <SectionLabel>{L.privateReads}</SectionLabel>
              <Hint text={L.privateReadsBody} />
              {villagerReadTargets.map((player) => {
                const activeTag = privateReads[player.id] ? PRIVATE_READ_TAGS.find((tag) => tag.id === privateReads[player.id]) : null;
                const isSelected = selectedReadPlayerId === player.id;
                return (
                  <View key={player.id} style={{ gap: space.sm }}>
                    <PickRow
                      label={player.display_name}
                      selected={isSelected}
                      accent={colors.textSecondary}
                      onPress={() => setSelectedReadPlayerId(isSelected ? null : player.id)}
                      meta={activeTag ? L.tags[activeTag.id] : L.noTag}
                      metaColor={activeTag ? activeTag.color : colors.textSubtle}
                    />
                    {isSelected ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, paddingLeft: space.sm }}>
                        {PRIVATE_READ_TAGS.map((tag) => {
                          const active = privateReads[player.id] === tag.id;
                          return (
                            <Pressable
                              key={tag.id}
                              onPress={() => savePrivateRead(player.id, tag.id)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              style={({ pressed }) => ({
                                minHeight: 44,
                                justifyContent: "center",
                                paddingHorizontal: space.md,
                                borderRadius: radius.pill,
                                backgroundColor: active ? withAlpha(tag.color, 0.16) : colors.surface,
                                borderWidth: 1,
                                borderColor: active ? withAlpha(tag.color, 0.6) : colors.border,
                                opacity: pressed ? 0.85 : 1,
                              })}
                            >
                              <Text style={{ color: active ? tag.color : colors.textSecondary, fontWeight: "900", fontSize: 13 }}>{L.tags[tag.id]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <SectionLabel right={myNightAction?.confirmed ? <Chip label={L.lockedIn} color={colors.success} icon="lock-closed" /> : undefined}>
                {nightPrompt}
              </SectionLabel>
              {nightTargets.map((player) => (
                <PickRow
                  key={player.id}
                  label={player.id === myPlayer.id ? `${player.display_name} (${L.you})` : player.display_name}
                  selected={selectedTargetId === player.id}
                  accent={roleColor}
                  disabled={!isAlive}
                  loading={busy === `night-${player.id}`}
                  onPress={() => run(`night-${player.id}`, () => submitNightAction(roomId, playerId, player.id, false))}
                />
              ))}
            </View>
          )}

          {role === "mafia" && mafiaNightActions.length > 0 ? (
            <Card accent={ACCENT}>
              <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{L.coordination}</Text>
              {mafiaNightActions.map((action) => {
                const teammate = players.find((player) => player.id === action.actor_player_id);
                const target = players.find((player) => player.id === action.target_player_id);
                return (
                  <Text key={action.actor_player_id} style={[type.small, { color: colors.textSecondary }]}>
                    {teammate?.display_name ?? L.teammate} {L.selectedAs}{" "}
                    <Text style={{ color: colors.text, fontWeight: "900" }}>{target?.display_name ?? L.noPlayerYet}</Text> {L.asKillTarget}{" "}
                    <Text style={{ color: action.confirmed ? colors.success : colors.textMuted, fontWeight: "700" }}>
                      · {action.confirmed ? L.lockedShort : L.notConfirmed}
                    </Text>
                  </Text>
                );
              })}
            </Card>
          ) : null}

          {allAlivePlayersLockedNightAction ? (
            <Card accent={colors.success}>
              <Text style={[type.heading, { color: colors.text }]}>{L.nightLocked}</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>{L.nightLockedBody}</Text>
              <Chip label={L.continueReady(nightContinueCount, alivePlayers.length)} color={colors.success} icon="checkmark-circle" />
            </Card>
          ) : (
            <Hint text={L.continueHint} />
          )}
        </>
      ) : null}

      {/* ---------------- Night result ---------------- */}
      {room.state === "night_result" ? (
        <Card accent={nightColor}>
          <Text style={[type.caption, { color: nightColor, textTransform: "uppercase" }]}>{L.afterNight}</Text>
          <Text style={[type.heading, { color: colors.text }]}>
            {doctorSaved
              ? L.savedSentence(savedPlayer?.display_name ?? L.aPlayer)
              : latestEliminatedPlayer
                ? L.diedSentence(latestEliminatedPlayer.display_name)
                : L.nobodyDied}
          </Text>
          <Text style={[type.small, { color: colors.textMuted }]}>{L.autoDiscussion(phaseSecondsLeft)}</Text>
        </Card>
      ) : null}

      {/* ---------------- Day discussion ---------------- */}
      {room.state === "day_discussion" ? (
        <Card>
          <Text style={[type.heading, { color: colors.text }]}>{L.discuss}</Text>
          {room.public_message ? <Text style={[type.body, { color: colors.textSecondary }]}>{translateServerMessage(room.public_message)}</Text> : null}
          <View style={{ alignItems: "center", paddingVertical: space.sm, gap: 2 }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{L.timeLeft}</Text>
            <Text style={{ color: colors.warning, fontSize: 44, lineHeight: 50, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{phaseMinutesText}</Text>
          </View>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.sunken, overflow: "hidden" }}>
            <View
              style={{
                width: `${alivePlayers.length ? Math.round((discussionReadyCount / alivePlayers.length) * 100) : 0}%`,
                height: "100%",
                backgroundColor: ACCENT,
              }}
            />
          </View>
          <Text style={[type.small, { color: colors.textMuted }]}>{L.readyToVoteCount(discussionReadyCount, alivePlayers.length)}</Text>
          {!isAlive ? <Hint text={L.eliminatedDiscussion} /> : null}
        </Card>
      ) : null}

      {/* ---------------- Day voting ---------------- */}
      {room.state === "day_voting" ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel right={<Chip label={L.votesCast(uniqueVoterCount, alivePlayers.length)} color={ACCENT} icon="hand-right" />}>
            {L.vote}
          </SectionLabel>
          <Hint text={isAlive ? L.votePrompt : L.eliminatedVote} />
          {alivePlayers
            .filter((player) => player.id !== myPlayer.id)
            .map((player) => (
              <PickRow
                key={player.id}
                label={player.display_name}
                selected={selectedVoteId === player.id}
                disabled={!isAlive}
                onPress={() => setPendingVoteId(player.id)}
                right={voteTargetId === player.id ? <Chip label={L.yourVote} color={ACCENT} /> : undefined}
              />
            ))}
          {!isHost && isAlive ? <Hint text={L.waitingResolveVote} /> : null}
        </View>
      ) : null}

      {/* ---------------- Vote result ---------------- */}
      {room.state === "vote_result" ? (
        <Card accent={latestEliminatedPlayer ? colors.danger : undefined}>
          {room.public_message ? <Text style={[type.body, { color: colors.textSecondary }]}>{translateServerMessage(room.public_message)}</Text> : null}
          {latestEliminatedPlayer ? (
            <Text style={[type.heading, { color: colors.danger }]}>{L.wasEliminated(latestEliminatedPlayer.display_name)}</Text>
          ) : null}
          {voteTallies.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <SectionLabel>{L.breakdown}</SectionLabel>
              {voteTallies.map((entry) => (
                <View
                  key={entry.player?.id ?? `unknown-${entry.count}`}
                  style={{
                    minHeight: touch.min,
                    paddingHorizontal: space.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.sunken,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{entry.player?.display_name ?? L.unknownPlayer}</Text>
                  <Text style={{ color: colors.warning, fontWeight: "900", fontSize: 15 }}>{L.votes(entry.count)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {room.state === "ended" ? <Hint text={L.ended} /> : null}

      {/* ---------------- Players (in game) ---------------- */}
      {room.state !== "lobby" ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel right={<Text style={[type.small, { color: colors.textMuted }]}>{`${alivePlayers.length}/${players.length} ${L.alive.toLowerCase()}`}</Text>}>
            {L.players}
          </SectionLabel>
          {players.map((player) => {
            const dead = player.status === "eliminated";
            const isMe = player.id === myPlayer.id;
            return (
              <View
                key={player.id}
                style={{
                  minHeight: touch.min,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  borderRadius: radius.md,
                  backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
                  borderWidth: 1,
                  borderColor: isMe ? withAlpha(ACCENT, 0.35) : colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.sm,
                  opacity: dead ? 0.7 : 1,
                }}
              >
                <Ionicons name={dead ? "skull" : "person"} size={18} color={dead ? colors.danger : colors.textMuted} />
                <Text
                  numberOfLines={1}
                  style={[
                    type.bodyStrong,
                    { flex: 1, color: dead ? colors.danger : colors.text, textDecorationLine: dead ? "line-through" : "none" },
                  ]}
                >
                  {player.display_name}
                  {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600", textDecorationLine: "none" }}>{`  (${L.you})`}</Text> : null}
                </Text>
                {dead ? (
                  <Chip label={L.dead} color={colors.danger} />
                ) : room.state === "role_reveal" && player.role_reveal_ready ? (
                  <Chip label={L.ready.toUpperCase()} color={colors.success} icon="checkmark" />
                ) : null}
                {room.state === "day_discussion" && player.discussion_ready ? <Chip label={L.voteReady} color={colors.brand} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {role === "villager" && villagerPrivateReads.length > 0 && room.state !== "night" ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel>{L.yourPrivateReads}</SectionLabel>
          <Hint text={L.yourPrivateReadsBody} />
          {villagerPrivateReads.map((entry) => (
            <View
              key={entry.player?.id}
              style={{
                minHeight: touch.min,
                paddingHorizontal: space.md,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={[type.bodyStrong, { color: colors.text }]}>{entry.player?.display_name}</Text>
              {entry.tag ? <Chip label={L.tags[entry.tag.id]} color={entry.tag.color} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
