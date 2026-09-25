import React, { useEffect, useRef, useState } from "react";
import { getRandomStatement, type StatementCategory } from "../src/constants/statements";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { ShareButton } from "../src/components/ShareButton";
import { GAMES } from "../src/games/catalog";
import { Button, Card, Chip, RoomCodeBadge, Screen, SectionLabel, SegmentedControl, TopBar } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const GAME = GAMES.memematch;
const ACCENT = GAME.accent;

export default function Lobby() {
  const { language, t } = useI18n();
  const { roomId, playerId, handReady } = useLocalSearchParams<{
    roomId: string;
    playerId: string;
    handReady?: string;
  }>();

  const [roomCode, setRoomCode] = useState("");
  const [hostId, setHostId] = useState("");
  const [phase, setPhase] = useState<"lobby" | "picking" | "playing" | "finished">("lobby");
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [handCount, setHandCount] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<StatementCategory>("innocent");

  const baseUrl = SITE_URL;
  const inviteUrl = roomCode ? `${baseUrl}/picklo?code=${roomCode}` : "";

  const copy =
    language === "sv"
      ? {
          errorRoom: "Fel (rum)",
          errorPlayers: "Fel (spelare)",
          errorPhase: "Fel (fas)",
          errorPlayersCount: "Fel (antal spelare)",
          tooFewPlayersTitle: "För få spelare",
          tooFewPlayersBody: "Det behövs minst 2 spelare",
          errorRoomUpdate: "Fel (uppdatera rum)",
          errorRounds: "Fel (rundor)",
          errorRoundsLast: "Fel (senaste runda)",
          errorRoundsInsert: "Fel (skapa runda)",
          phaseLobby: "Väntar i lobbyn",
          phasePicking: "Väljer bilder",
          phasePlaying: "Redo att spela",
          phaseFinished: "Färdig",
          descLobby: "Vänta tills alla har gått med. Värden startar när ni är redo.",
          descPicking: `Alla väljer 5 bilder. Du har ${handCount}/5. När alla är klara trycker värden på “Fortsätt”.`,
          descPlaying: "Spelet är igång. Värden kan starta första rundan.",
          descFinished: "Matchen är slut!",
          lobby: "LOBBY",
          code: "Kod",
          player: "Spelare",
          playersCount: "spelare",
          continueToImages: "Fortsätt till bilder",
          startGame: "Starta spel",
          startNewRound: "Starta ny runda",
          back: "Tillbaka",
          leaveTitle: "Lämna spelet?",
          leaveBody: "Du lämnar rummet. Dina vänner kan fortsätta spela.",
          stay: "Stanna",
          you: "Du",
          photosReady: `${handCount}/5 bilder`,
          waitHostContinue: "Väntar på att värden väljer kategori och fortsätter…",
          waitHostStart: "Väntar på att värden startar spelet…",
          waitHostRound: "Väntar på att värden startar rundan…",
          hostHintLobby: "Bjud in alla först – sen fortsätter ni till bilderna.",
          hostHintPicking: "Starta när alla har valt sina 5 bilder.",
          categoryTitle: "Statement-kategori",
          categoryBody: "Värden väljer en kategori för hela matchen innan spelet startar.",
          categoryInnocent: "Oskyldiga",
          categoryAdult: "18+",
          categoryGross: "Grov",
          categorySavingError: "Fel (kategori)",
        }
      : {
          errorRoom: "Error (room)",
          errorPlayers: "Error (players)",
          errorPhase: "Error (phase)",
          errorPlayersCount: "Error (players count)",
          tooFewPlayersTitle: "Too few players",
          tooFewPlayersBody: "At least 2 players are needed",
          errorRoomUpdate: "Error (rooms update)",
          errorRounds: "Error (rounds)",
          errorRoundsLast: "Error (rounds last)",
          errorRoundsInsert: "Error (rounds insert)",
          phaseLobby: "Waiting in lobby",
          phasePicking: "Selecting images",
          phasePlaying: "Ready to play",
          phaseFinished: "Finished",
          descLobby: "Wait until everyone has joined. Host starts when you're ready.",
          descPicking: `Everyone selects 5 images. You have ${handCount}/5. When ready the host presses “Continue”.`,
          descPlaying: "Game is running. Host can start the first round.",
          descFinished: "Match is over!",
          lobby: "LOBBY",
          code: "Code",
          player: "Player",
          playersCount: "players",
          continueToImages: "Continue to images",
          startGame: "Start game",
          startNewRound: "Start new round",
          back: "Back",
          leaveTitle: "Leave the game?",
          leaveBody: "You'll leave this room. Your friends can keep playing.",
          stay: "Stay",
          you: "You",
          photosReady: `${handCount}/5 images`,
          waitHostContinue: "Waiting for the host to pick a category and continue…",
          waitHostStart: "Waiting for the host to start the game…",
          waitHostRound: "Waiting for the host to start the round…",
          hostHintLobby: "Invite everyone first, then continue to the images.",
          hostHintPicking: "Start once everyone has picked their 5 images.",
          categoryTitle: "Statement category",
          categoryBody: "The host chooses one category for the whole match before the game starts.",
          categoryInnocent: "Innocent",
          categoryAdult: "18+",
          categoryGross: "Gross",
          categorySavingError: "Error (category)",
        };

  const categoryOptions: { value: StatementCategory; label: string }[] = [
    { value: "innocent", label: copy.categoryInnocent },
    { value: "adult", label: copy.categoryAdult },
    { value: "gross", label: copy.categoryGross },
  ];

  const leave = async () => {
    const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, {
      confirmLabel: t("common.leave"),
      cancelLabel: copy.stay,
      destructive: true,
    });
    if (ok) router.replace(GAME.href as any);
  };

  const lastNavigatedRoundIdRef = useRef<string | null>(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const getHandCount = async (): Promise<number> => {
    if (!roomId || !playerId) return 0;
    const { count, error } = await supabase
      .from("player_images")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (error) return 0;
    return count ?? 0;
  };

  const load = async () => {
    if (!roomId) return;

    const { data: room, error: rErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (rErr) return showAlert(copy.errorRoom, rErr.message);

    setRoomCode(room.code);
    setHostId(room.host_player_id ?? "");
    setPhase((room.phase ?? "lobby") as any);
    setSelectedCategory((room.statement_category as StatementCategory | null) ?? "innocent");

    const { data: ps, error: pErr } = await supabase
      .from("players")
      .select("id,name")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (pErr) return showAlert(copy.errorPlayers, pErr.message);
    setPlayers(ps ?? []);

    const c = await getHandCount();
    setHandCount(c);
  };

  const startPicking = async () => {
    if (!roomId) return;
    const { error } = await supabase
      .from("rooms")
      .update({ phase: "picking", statement_category: selectedCategory })
      .eq("id", roomId);
    if (error) showAlert(copy.errorPhase, error.message);
  };

  const setCategory = async (category: StatementCategory) => {
    setSelectedCategory(category);
    if (!roomId || playerId !== hostId) return;

    const { error } = await supabase.from("rooms").update({ statement_category: category }).eq("id", roomId);

    if (error) {
      setSelectedCategory("innocent");
      showAlert(copy.categorySavingError, error.message);
    }
  };

  const startRound = async () => {
    if (!roomId) return;

    const { count, error: cErr } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    if (cErr) return showAlert(copy.errorPlayersCount, cErr.message);

    const expected = count ?? 0;
    if (expected < 2) return showAlert(copy.tooFewPlayersTitle, copy.tooFewPlayersBody);

    const { error: uErr } = await supabase
      .from("rooms")
      .update({ expected_players: expected, phase: "playing" })
      .eq("id", roomId);

    if (uErr) return showAlert(copy.errorRoomUpdate, uErr.message);

    const { data: usedRows, error: usedErr } = await supabase
      .from("rounds")
      .select("statement")
      .eq("room_id", roomId);

    if (usedErr) return showAlert(copy.errorRounds, usedErr.message);

    const usedStatements = (usedRows ?? [])
      .map((r) => r.statement)
      .filter((s): s is string => typeof s === "string" && s.length > 0);

    const { data: last, error: lastErr } = await supabase
      .from("rounds")
      .select("round_number")
      .eq("room_id", roomId)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) return showAlert(copy.errorRoundsLast, lastErr.message);

    const nextNumber = (last?.round_number ?? 0) + 1;
    if (nextNumber > 5) return router.replace({ pathname: "/results", params: { roomId } });

    const statement = getRandomStatement({ exclude: usedStatements, category: selectedCategory });
    const endsAt = new Date(Date.now() + 60_000).toISOString();

    const { error: insErr } = await supabase
      .from("rounds")
      .insert({
        room_id: roomId,
        statement,
        status: "collecting",
        ends_at: endsAt,
        round_number: nextNumber,
      });

    if (insErr) return showAlert(copy.errorRoundsInsert, insErr.message);
  };

  useEffect(() => {
    load();
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => load())
      .subscribe();

    const playersChannel = supabase
      .channel(`players-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => load())
      .subscribe();

    const roundsChannel = supabase
      .channel(`rounds-room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (!isActiveRef.current) return;

        const newRound = payload.new as any;
        const newRoundId = newRound.id as string;

        if (lastNavigatedRoundIdRef.current === newRoundId) return;
        lastNavigatedRoundIdRef.current = newRoundId;

        router.replace({ pathname: "/round", params: { roomId, playerId, roundId: newRoundId } });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(roundsChannel);
    };
  }, [roomId, playerId]);

  useEffect(() => {
    if (!roomId || !playerId) return;

    const run = async () => {
      if (phase === "picking") {
        if (handReady === "1") return;

        const c = await getHandCount();
        setHandCount(c);

        if (c < 5) {
          router.replace({ pathname: "/pick-hand", params: { roomId, playerId } });
        }
      }

      if (phase === "finished") {
        router.replace({ pathname: "/results", params: { roomId } });
      }
    };

    run();
  }, [phase, roomId, playerId, handReady]);

  const isHost = playerId === hostId;

  const phaseLabel =
    phase === "lobby"
      ? copy.phaseLobby
      : phase === "picking"
      ? copy.phasePicking
      : phase === "playing"
      ? copy.phasePlaying
      : copy.phaseFinished;

  const phaseDesc =
    phase === "lobby"
      ? copy.descLobby
      : phase === "picking"
      ? copy.descPicking
      : phase === "playing"
      ? copy.descPlaying
      : copy.descFinished;

  const inviteMessage =
    language === "sv"
      ? `Häng med och spela ${GAME.title} på Picklo! Rumskod: ${roomCode}`
      : `Join my ${GAME.title} game on Picklo! Room code: ${roomCode}`;

  const categoryLocked = !isHost || phase === "playing" || phase === "finished";

  const waitingText =
    phase === "lobby" ? copy.waitHostContinue : phase === "picking" ? copy.waitHostStart : copy.waitHostRound;

  const hostAction =
    phase === "lobby"
      ? { label: copy.continueToImages, onPress: startPicking, icon: "images" as const }
      : phase === "picking"
      ? { label: copy.startGame, onPress: startRound, icon: "play" as const }
      : phase === "playing"
      ? { label: copy.startNewRound, onPress: startRound, icon: "play" as const }
      : null;

  const footer =
    isHost && hostAction ? (
      <>
        {phase === "lobby" || phase === "picking" ? (
          <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>
            {players.length < 2 ? copy.tooFewPlayersBody : phase === "lobby" ? copy.hostHintLobby : copy.hostHintPicking}
          </Text>
        ) : null}
        <Button label={hostAction.label} icon={hostAction.icon} accent={ACCENT} onPress={hostAction.onPress} />
      </>
    ) : (
      <View
        style={{
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: withAlpha(ACCENT, 0.1),
          borderWidth: 1,
          borderColor: withAlpha(ACCENT, 0.3),
        }}
      >
        <ActivityIndicator color={ACCENT} />
        <Text style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]}>{waitingText}</Text>
      </View>
    );

  return (
    <Screen topBar={<TopBar title={GAME.title} onBack={leave} />} footer={footer}>
      {/* Room code + invite */}
      <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
        <RoomCodeBadge code={roomCode || "----"} label={copy.code} accent={ACCENT} inviteUrl={inviteUrl || undefined} />
        {roomCode ? (
          <View style={{ alignSelf: "stretch" }}>
            <ShareButton label={t("common.invite")} message={inviteMessage} url={inviteUrl} accentColor={ACCENT} />
          </View>
        ) : null}
      </Card>

      {/* Phase */}
      <View style={{ gap: space.xs }}>
        <Chip label={phaseLabel} color={ACCENT} icon="time-outline" />
        <Text style={[type.body, { color: colors.textSecondary }]}>{phaseDesc}</Text>
      </View>

      {/* Category */}
      <View style={{ gap: space.sm }}>
        <SectionLabel>{copy.categoryTitle}</SectionLabel>
        <SegmentedControl
          options={categoryOptions}
          value={selectedCategory}
          onChange={(value) => {
            if (!categoryLocked) setCategory(value);
          }}
          accent={ACCENT}
          disabled={categoryLocked}
        />
        <Text style={[type.small, { color: colors.textMuted }]}>{copy.categoryBody}</Text>
      </View>

      {/* Players */}
      <View style={{ gap: space.sm }}>
        <SectionLabel
          right={
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {players.length} {copy.playersCount}
            </Text>
          }
        >
          {copy.player}
        </SectionLabel>
        {players.map((p) => {
          const isMe = p.id === playerId;
          return (
            <View
              key={p.id}
              style={{
                minHeight: 56,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: isMe ? withAlpha(ACCENT, 0.5) : colors.border,
                backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
              }}
            >
              <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
                {p.name}
                {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{`  (${copy.you})`}</Text> : null}
              </Text>
              {isMe && phase === "picking" ? (
                <Chip
                  label={copy.photosReady}
                  color={handCount >= 5 ? colors.success : colors.warning}
                  icon={handCount >= 5 ? "checkmark-circle" : "images-outline"}
                />
              ) : null}
              {p.id === hostId ? <Chip label={t("common.host")} color={ACCENT} icon="star" /> : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
