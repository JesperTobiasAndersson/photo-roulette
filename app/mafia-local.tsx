import React, { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { Countdown, LocalTopBar, PassPhoneCard, PlayerNamesEditor, PlayerPicker, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, useLocalGame } from "../src/games/local/useLocalGame";
import { assignRoles, getWinner, resolveNightActions } from "../src/games/mafia/logic";
import type { MafiaAlignment, MafiaNightActionDto, MafiaRole, MafiaRoleDto } from "../src/games/mafia/types";
import { useI18n, type Language } from "../src/lib/i18n";
import { Button, Card, Chip, Screen, SectionLabel } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.mafia;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 20;
const DISCUSSION_MS = 5 * 60 * 1000;

const ROLE_COLORS: Record<MafiaRole, string> = { mafia: ACCENT, doctor: colors.success, police: colors.brand, villager: colors.warning };
const ROLE_ICONS: Record<MafiaRole, React.ComponentProps<typeof Ionicons>["name"]> = {
  mafia: "skull",
  doctor: "medkit",
  police: "search",
  villager: "home",
};

type Player = { id: string; name: string; role: MafiaRole; alive: boolean };
type NightAction = { actorId: string; targetId: string };

type MafiaLocalGame = {
  players: Player[];
  phase: "reveal" | "night_intro" | "night" | "night_result" | "day" | "voting" | "vote_result" | "ended";
  night: number;
  /** Position in the current pass-the-phone round (role reveal or night). */
  turnIndex: number;
  /** The current player has taken the phone and sees their private screen. */
  turnShown: boolean;
  /** Living players at the start of the night, in seat order. */
  nightOrder: string[];
  nightActions: NightAction[];
  /** Police result for the turn in progress, shown before the phone is passed on. */
  policeResult: MafiaAlignment | null;
  policeLog: { night: number; targetId: string; alignment: MafiaAlignment }[];
  lastKilledId: string | null;
  lastSavedId: string | null;
  lastVotedOutId: string | null;
  dayEndsAt: number;
  winner: MafiaAlignment | null;
};

const COPY = {
  en: {
    title: "Mafia · one phone",
    setupTitle: "One phone, passed around",
    setupBody: "Add everyone who is playing. The phone goes around the table for the secret roles and again every night, so nobody needs a narrator.",
    start: "Start the game",
    roles: { mafia: "Mafia", doctor: "Doctor", police: "Police", villager: "Villager" } as Record<MafiaRole, string>,
    roleDesc: {
      mafia: "Every night you choose someone to eliminate. During the day, blend in with the village.",
      doctor: "Every night you choose one player to protect from the mafia.",
      police: "Every night you investigate one player and find out if they are mafia.",
      villager: "You have no night action. Listen during the day and vote out the mafia.",
    } as Record<MafiaRole, string>,
    yourRole: "Your role",
    otherMafia: (names: string) => `The other mafia: ${names}`,
    hideAndPass: "Hide and pass on",
    hideAndStart: "Hide – everyone has seen their role",
    nightTitle: (n: number) => `Night ${n}`,
    nightIntro: "The phone goes around the table. Everyone does their secret night action – even villagers, so nobody can tell who has a role. Keep the screen hidden from the others.",
    startNight: "Start the night",
    mafiaPick: "Who do you eliminate tonight?",
    partnerChose: (partner: string, target: string) => `${partner} chose ${target}. Pick the same player, otherwise nobody dies.`,
    doctorPick: "Who do you protect tonight?",
    policePick: "Who do you investigate tonight?",
    villagerPick: "You have no action. Tap any player so nobody can tell from how long you took.",
    earlierChecks: "Your earlier checks",
    confirm: (name: string) => `Confirm ${name}`,
    pickPlayer: "Pick a player",
    isMafia: (name: string) => `${name} IS mafia`,
    notMafia: (name: string) => `${name} is NOT mafia`,
    morning: "Morning",
    killed: (name: string) => `${name} died during the night.`,
    saved: (name: string) => `${name} was attacked during the night, but the doctor saved them.`,
    nobodyDied: "No one died during the night.",
    toDay: "Start the day",
    day: "Day discussion",
    timeLeft: "Time left",
    dayBody: "Talk it through: who is acting suspicious? Vote whenever you're ready.",
    toVoting: "Time to vote",
    voting: "Vote",
    votingBody: "Count to three and everyone still alive points at who should leave the village. Tap the player who got the most votes.",
    voteOut: (name: string) => `Vote out ${name}`,
    tie: "It was a tie – nobody is out",
    votedOut: (name: string) => `${name} was eliminated.`,
    tieTitle: "The vote tied. Nobody was eliminated.",
    nextNight: "Continue to the next night",
    villageWins: "THE VILLAGE WINS",
    mafiaWins: "THE MAFIA WINS",
    villageWinsSub: "Every member of the mafia has been found.",
    mafiaWinsSub: "The mafia are now as many as the village.",
    allRoles: "Everyone's role",
    dead: "Out",
    playAgain: "Play again – new roles",
    changeSetup: "Change players",
    players: "Players",
  },
  sv: {
    title: "Mafia · en telefon",
    setupTitle: "En telefon som skickas runt",
    setupBody: "Lägg till alla som spelar. Telefonen går runt bordet för de hemliga rollerna och igen varje natt, så ingen behöver vara spelledare.",
    start: "Starta spelet",
    roles: { mafia: "Maffia", doctor: "Doktor", police: "Polis", villager: "Bybo" } as Record<MafiaRole, string>,
    roleDesc: {
      mafia: "Varje natt väljer du någon att eliminera. På dagen smälter du in bland byborna.",
      doctor: "Varje natt väljer du en spelare att skydda från maffian.",
      police: "Varje natt undersöker du en spelare och får veta om hen är maffia.",
      villager: "Du har ingen nattlig handling. Lyssna på dagen och rösta ut maffian.",
    } as Record<MafiaRole, string>,
    yourRole: "Din roll",
    otherMafia: (names: string) => `Övrig maffia: ${names}`,
    hideAndPass: "Dölj och skicka vidare",
    hideAndStart: "Dölj – alla har sett sin roll",
    nightTitle: (n: number) => `Natt ${n}`,
    nightIntro: "Telefonen går runt bordet. Alla gör sin hemliga nattliga handling – även byborna, så att ingen kan lista ut vem som har en roll. Visa inte skärmen för de andra.",
    startNight: "Starta natten",
    mafiaPick: "Vem eliminerar du i natt?",
    partnerChose: (partner: string, target: string) => `${partner} valde ${target}. Välj samma spelare, annars dör ingen.`,
    doctorPick: "Vem skyddar du i natt?",
    policePick: "Vem undersöker du i natt?",
    villagerPick: "Du har ingen handling. Tryck på valfri spelare så att ingen kan lista ut något av hur länge du höll på.",
    earlierChecks: "Dina tidigare undersökningar",
    confirm: (name: string) => `Bekräfta ${name}`,
    pickPlayer: "Välj en spelare",
    isMafia: (name: string) => `${name} ÄR maffia`,
    notMafia: (name: string) => `${name} är INTE maffia`,
    morning: "Morgon",
    killed: (name: string) => `${name} dog under natten.`,
    saved: (name: string) => `${name} attackerades under natten, men doktorn räddade hen.`,
    nobodyDied: "Ingen dog under natten.",
    toDay: "Starta dagen",
    day: "Diskussion",
    timeLeft: "Tid kvar",
    dayBody: "Prata igenom det: vem beter sig misstänkt? Rösta när ni är redo.",
    toVoting: "Dags att rösta",
    voting: "Rösta",
    votingBody: "Räkna till tre och alla som lever pekar på den som ska lämna byn. Tryck på spelaren som fick flest röster.",
    voteOut: (name: string) => `Rösta ut ${name}`,
    tie: "Det blev lika – ingen åker ut",
    votedOut: (name: string) => `${name} röstades ut.`,
    tieTitle: "Röstningen blev oavgjord. Ingen röstades ut.",
    nextNight: "Fortsätt till nästa natt",
    villageWins: "BYN VINNER",
    mafiaWins: "MAFFIAN VINNER",
    villageWinsSub: "All maffia har avslöjats.",
    mafiaWinsSub: "Maffian är nu lika många som byborna.",
    allRoles: "Allas roller",
    dead: "Ute",
    playAgain: "Spela igen – nya roller",
    changeSetup: "Byt spelare",
    players: "Spelare",
  },
} satisfies Record<Language, unknown>;

function newGame(names: string[]): MafiaLocalGame {
  const ids = names.map((_, index) => localPlayerId(index));
  const roles = assignRoles(ids);
  return {
    players: names.map((name, index) => ({ id: ids[index], name, role: roles[ids[index]], alive: true })),
    phase: "reveal",
    night: 0,
    turnIndex: 0,
    turnShown: false,
    nightOrder: [],
    nightActions: [],
    policeResult: null,
    policeLog: [],
    lastKilledId: null,
    lastSavedId: null,
    lastVotedOutId: null,
    dayEndsAt: 0,
    winner: null,
  };
}

const asRoleDtos = (players: Player[]): MafiaRoleDto[] =>
  players.map((p) => ({ player_id: p.id, room_id: "local", role: p.role, is_alive: p.alive, revealed_at: null }));

/** Runs the shared night rules on what was picked on this phone. */
function finishNight(game: MafiaLocalGame): MafiaLocalGame {
  const roleOf = (id: string) => game.players.find((p) => p.id === id)!.role;
  const actions: MafiaNightActionDto[] = game.nightActions.map((action) => ({
    actor_player_id: action.actorId,
    actor_role: roleOf(action.actorId),
    target_player_id: action.targetId,
    fake_ready: roleOf(action.actorId) === "villager",
    confirmed: true,
    locked_at: null,
  }));
  const result = resolveNightActions(actions, asRoleDtos(game.players));
  const players = game.players.map((p) => (p.id === result.eliminatedPlayerId ? { ...p, alive: false } : p));
  const winner = getWinner(asRoleDtos(players));
  return {
    ...game,
    players,
    lastKilledId: result.eliminatedPlayerId,
    lastSavedId: result.doctorSavedPlayerId,
    phase: winner ? "ended" : "night_result",
    winner,
  };
}

export default function MafiaLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<MafiaLocalGame>("mafia");
  const [names, setNames] = useRememberedPlayerNames();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const topBar = <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && game.phase !== "ended"} onQuit={() => setGame(null)} />;

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  if (!game) {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.start} icon="play" accent={ACCENT} disabled={names.length < MIN_PLAYERS} onPress={() => setGame(newGame(names))} />}
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>
        <PlayerNamesEditor names={names} onChange={setNames} min={MIN_PLAYERS} max={MAX_PLAYERS} accent={ACCENT} />
      </Screen>
    );
  }

  const byId = (id: string | null) => game.players.find((p) => p.id === id) ?? null;
  const nameOf = (id: string | null) => byId(id)?.name ?? "";
  const alive = game.players.filter((p) => p.alive);
  const roleCard = (role: MafiaRole) => (
    <View
      style={{
        borderRadius: radius.xl,
        padding: space.xl,
        alignItems: "center",
        gap: space.sm,
        backgroundColor: withAlpha(ROLE_COLORS[role], 0.12),
        borderWidth: 2,
        borderColor: withAlpha(ROLE_COLORS[role], 0.7),
      }}
    >
      <Text style={[type.caption, { color: ROLE_COLORS[role], textTransform: "uppercase" }]}>{copy.yourRole}</Text>
      <Ionicons name={ROLE_ICONS[role]} size={56} color={ROLE_COLORS[role]} />
      <Text style={{ color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: "900" }}>{copy.roles[role].toUpperCase()}</Text>
      <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>{copy.roleDesc[role]}</Text>
    </View>
  );
  const otherMafia = (playerId: string) =>
    game.players
      .filter((p) => p.role === "mafia" && p.id !== playerId)
      .map((p) => (p.alive ? p.name : `${p.name} (${copy.dead.toLowerCase()})`))
      .join(", ");

  // ---------------------------------------------------------------------------
  // Secret roles, one player at a time
  // ---------------------------------------------------------------------------
  if (game.phase === "reveal") {
    const player = game.players[game.turnIndex];
    const step = `${game.turnIndex + 1}/${game.players.length}`;
    const last = game.turnIndex === game.players.length - 1;
    if (!game.turnShown) {
      return (
        <Screen topBar={topBar}>
          <AnimatedEntrance enterKey={`pass-${game.turnIndex}`}>
            <PassPhoneCard name={player.name} accent={ACCENT} step={step} onReady={() => setGame((g) => ({ ...g, turnShown: true }))} />
          </AnimatedEntrance>
        </Screen>
      );
    }
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={last ? copy.hideAndStart : copy.hideAndPass}
            icon="eye-off-outline"
            accent={ACCENT}
            onPress={() =>
              setGame((g) => (last ? { ...g, phase: "night_intro", night: 1, turnShown: false } : { ...g, turnIndex: g.turnIndex + 1, turnShown: false }))
            }
          />
        }
      >
        <AnimatedEntrance enterKey={`role-${game.turnIndex}`} style={{ gap: space.md }}>
          <Chip label={`${player.name} · ${step}`} color={ACCENT} icon="person" />
          {roleCard(player.role)}
          {player.role === "mafia" && otherMafia(player.id) ? <Chip label={copy.otherMafia(otherMafia(player.id))} color={ACCENT} icon="skull" /> : null}
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Night
  // ---------------------------------------------------------------------------
  if (game.phase === "night_intro") {
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.startNight}
            icon="moon"
            accent={ACCENT}
            onPress={() =>
              setGame((g) => ({
                ...g,
                phase: "night",
                turnIndex: 0,
                turnShown: false,
                nightOrder: g.players.filter((p) => p.alive).map((p) => p.id),
                nightActions: [],
                policeResult: null,
              }))
            }
          />
        }
      >
        <AnimatedEntrance enterKey={`night-intro-${game.night}`}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="moon" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text }]}>{copy.nightTitle(game.night)}</Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{copy.nightIntro}</Text>
          </Card>
        </AnimatedEntrance>
        <PlayersList players={game.players} deadLabel={copy.dead} />
      </Screen>
    );
  }

  if (game.phase === "night") {
    const player = byId(game.nightOrder[game.turnIndex])!;
    const step = `${game.turnIndex + 1}/${game.nightOrder.length}`;
    const last = game.turnIndex === game.nightOrder.length - 1;
    const advance = (g: MafiaLocalGame): MafiaLocalGame => {
      const next = { ...g, policeResult: null, turnShown: false };
      return last ? finishNight(next) : { ...next, turnIndex: g.turnIndex + 1 };
    };

    if (!game.turnShown) {
      return (
        <Screen topBar={topBar}>
          <AnimatedEntrance enterKey={`night-pass-${game.night}-${game.turnIndex}`}>
            <PassPhoneCard name={player.name} accent={ACCENT} step={`${copy.nightTitle(game.night)} · ${step}`} onReady={() => setGame((g) => ({ ...g, turnShown: true }))} />
          </AnimatedEntrance>
        </Screen>
      );
    }

    // Police sees the result of the check before passing the phone on.
    if (game.policeResult) {
      const target = nameOf(game.nightActions[game.nightActions.length - 1]?.targetId ?? null);
      const isMafia = game.policeResult === "mafia";
      return (
        <Screen
          topBar={topBar}
          footer={<Button label={copy.hideAndPass} icon="eye-off-outline" accent={ACCENT} onPress={() => setGame((g) => advance(g))} />}
        >
          <Card accent={isMafia ? colors.danger : colors.success} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name={isMafia ? "skull" : "shield-checkmark"} size={56} color={isMafia ? colors.danger : colors.success} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{isMafia ? copy.isMafia(target) : copy.notMafia(target)}</Text>
          </Card>
        </Screen>
      );
    }

    const role = player.role;
    const targets = alive.filter((p) => {
      if (role === "mafia") return p.role !== "mafia";
      if (role === "doctor") return true;
      return p.id !== player.id;
    });
    const partnerAction =
      role === "mafia" ? game.nightActions.find((a) => a.actorId !== player.id && byId(a.actorId)?.role === "mafia") ?? null : null;
    const prompt = role === "mafia" ? copy.mafiaPick : role === "doctor" ? copy.doctorPick : role === "police" ? copy.policePick : copy.villagerPick;
    const selected = targets.find((p) => p.id === selectedId) ?? null;
    const confirm = () => {
      if (!selected) return;
      setSelectedId(null);
      setGame((g) => {
        const withAction = { ...g, nightActions: [...g.nightActions, { actorId: player.id, targetId: selected.id }] };
        if (role !== "police") return advance(withAction);
        const alignment: MafiaAlignment = selected.role === "mafia" ? "mafia" : "village";
        return { ...withAction, policeResult: alignment, policeLog: [...g.policeLog, { night: g.night, targetId: selected.id, alignment }] };
      });
    };

    return (
      <Screen
        topBar={topBar}
        footer={<Button label={selected ? copy.confirm(selected.name) : copy.pickPlayer} icon="checkmark" accent={ROLE_COLORS[role]} disabled={!selected} onPress={confirm} />}
      >
        <AnimatedEntrance enterKey={`night-${game.night}-${game.turnIndex}`} style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
            <Chip label={player.name} color={ACCENT} icon="person" />
            <Chip label={copy.roles[role]} color={ROLE_COLORS[role]} icon={ROLE_ICONS[role]} />
          </View>
          <Text style={[type.title, { color: colors.text }]}>{prompt}</Text>
          {role === "mafia" && otherMafia(player.id) ? <Text style={[type.small, { color: colors.textMuted }]}>{copy.otherMafia(otherMafia(player.id))}</Text> : null}
          {partnerAction ? (
            <Text style={[type.body, { color: ACCENT, fontWeight: "700" }]}>{copy.partnerChose(nameOf(partnerAction.actorId), nameOf(partnerAction.targetId))}</Text>
          ) : null}
          {role === "police" && game.policeLog.length > 0 ? (
            <Card style={{ gap: space.xs }}>
              <SectionLabel>{copy.earlierChecks}</SectionLabel>
              {game.policeLog.map((entry) => (
                <Text key={`${entry.night}-${entry.targetId}`} style={[type.small, { color: entry.alignment === "mafia" ? colors.danger : colors.textSecondary }]}>
                  {`${copy.nightTitle(entry.night)}: ${entry.alignment === "mafia" ? copy.isMafia(nameOf(entry.targetId)) : copy.notMafia(nameOf(entry.targetId))}`}
                </Text>
              ))}
            </Card>
          ) : null}
          <PlayerPicker players={targets} selectedId={selectedId} onSelect={setSelectedId} accent={ROLE_COLORS[role]} />
        </AnimatedEntrance>
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Morning
  // ---------------------------------------------------------------------------
  if (game.phase === "night_result") {
    const line = game.lastKilledId ? copy.killed(nameOf(game.lastKilledId)) : game.lastSavedId ? copy.saved(nameOf(game.lastSavedId)) : copy.nobodyDied;
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.toDay} icon="sunny" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "day", dayEndsAt: Date.now() + DISCUSSION_MS }))} />}
      >
        <AnimatedEntrance enterKey={`morning-${game.night}`}>
          <Card accent={game.lastKilledId ? colors.danger : colors.success} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name={game.lastKilledId ? "skull" : game.lastSavedId ? "medkit" : "sunny"} size={48} color={game.lastKilledId ? colors.danger : colors.success} />
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.morning}</Text>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{line}</Text>
          </Card>
        </AnimatedEntrance>
        <PlayersList players={game.players} deadLabel={copy.dead} />
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Day
  // ---------------------------------------------------------------------------
  if (game.phase === "day") {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.toVoting} icon="hand-right" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "voting" }))} />}
      >
        <Card accent={ACCENT} style={{ alignItems: "center" }}>
          <Text style={[type.heading, { color: colors.text }]}>{copy.day}</Text>
          <Countdown endsAt={game.dayEndsAt} accent={ACCENT} label={copy.timeLeft} />
          <Text style={[type.small, { color: colors.textSecondary, textAlign: "center" }]}>{copy.dayBody}</Text>
        </Card>
        <PlayersList players={game.players} deadLabel={copy.dead} />
      </Screen>
    );
  }

  if (game.phase === "voting") {
    const selected = alive.find((p) => p.id === selectedId) ?? null;
    const voteOut = (outId: string | null) => {
      setSelectedId(null);
      setGame((g) => {
        const players = g.players.map((p) => (p.id === outId ? { ...p, alive: false } : p));
        const winner = getWinner(asRoleDtos(players));
        return { ...g, players, lastVotedOutId: outId, winner, phase: winner ? "ended" : "vote_result" };
      });
    };
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button label={selected ? copy.voteOut(selected.name) : copy.pickPlayer} icon="flag" accent={ACCENT} disabled={!selected} onPress={() => selected && voteOut(selected.id)} />
            <Button label={copy.tie} variant="ghost" size="md" onPress={() => voteOut(null)} />
          </>
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.voting}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.votingBody}</Text>
        </View>
        <PlayerPicker players={alive} selectedId={selectedId} onSelect={setSelectedId} accent={ACCENT} />
      </Screen>
    );
  }

  if (game.phase === "vote_result") {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.nextNight} icon="moon" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "night_intro", night: g.night + 1 }))} />}
      >
        <AnimatedEntrance enterKey={`vote-result-${game.night}`}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name={game.lastVotedOutId ? "close-circle" : "remove-circle"} size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
              {game.lastVotedOutId ? copy.votedOut(nameOf(game.lastVotedOutId)) : copy.tieTitle}
            </Text>
          </Card>
        </AnimatedEntrance>
        <PlayersList players={game.players} deadLabel={copy.dead} />
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Game over: everyone's role is revealed
  // ---------------------------------------------------------------------------
  const villageWon = game.winner === "village";
  const tone = villageWon ? colors.success : ACCENT;
  return (
    <Screen
      topBar={topBar}
      footer={
        <>
          <Button label={copy.playAgain} icon="refresh" accent={ACCENT} onPress={() => setGame(newGame(game.players.map((p) => p.name)))} />
          <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
        </>
      }
    >
      <AnimatedEntrance enterKey="ended" style={{ gap: space.md }}>
        <Card accent={tone} style={{ alignItems: "center", paddingVertical: space.xl }}>
          <Ionicons name={villageWon ? "home" : "skull"} size={48} color={tone} />
          <Text style={{ color: tone, fontSize: 30, lineHeight: 36, fontWeight: "900", textAlign: "center" }}>{villageWon ? copy.villageWins : copy.mafiaWins}</Text>
          <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{villageWon ? copy.villageWinsSub : copy.mafiaWinsSub}</Text>
        </Card>
        <SectionLabel>{copy.allRoles}</SectionLabel>
        {game.players.map((p) => (
          <View
            key={p.id}
            style={{
              minHeight: 52,
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
            <Ionicons name={ROLE_ICONS[p.role]} size={20} color={ROLE_COLORS[p.role]} />
            <Text
              numberOfLines={1}
              style={[type.bodyStrong, { flex: 1, color: p.alive ? colors.text : colors.textMuted, textDecorationLine: p.alive ? "none" : "line-through" }]}
            >
              {p.name}
            </Text>
            <Chip label={copy.roles[p.role]} color={ROLE_COLORS[p.role]} />
          </View>
        ))}
      </AnimatedEntrance>
    </Screen>
  );
}

function PlayersList({ players, deadLabel }: { players: Player[]; deadLabel: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {players.map((p) => (
        <Chip key={p.id} label={p.alive ? p.name : `${p.name} · ${deadLabel}`} color={p.alive ? colors.textSecondary : colors.danger} icon={p.alive ? "person" : "close"} />
      ))}
    </View>
  );
}
