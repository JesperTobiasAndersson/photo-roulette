import React, { useEffect, useRef, useState } from "react";
import { getRandomStatement, type StatementCategory } from "../src/constants/statements";
import {
  View,
  Text,
  Pressable,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import * as Clipboard from "expo-clipboard";
import { CopyToast } from "../src/components/CopyToast";
import { useI18n } from "../src/lib/i18n";

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
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<StatementCategory>("innocent");

  const baseUrl = Platform.OS === "web" ? window.location.origin : "https://picklo.app";
  const inviteUrl = roomCode ? `${baseUrl}/picklo?code=${roomCode}` : "";

  const copy =
    language === "sv"
      ? {
          waitTitle: "Vänta",
          waitBody: "Rumskoden laddas fortfarande...",
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
          copyInvite: "Kopiera inbjudningslänk",
          player: "Spelare",
          playersCount: "spelare",
          continueToImages: "FORTSÄTT TILL BILDER",
          startGame: "STARTA SPEL 🚀",
          startNewRound: "STARTA NY RUNDA 🚀",
          back: "Tillbaka",
          categoryTitle: "Statement-kategori",
          categoryBody: "Värden väljer en kategori för hela matchen innan spelet startar.",
          categoryInnocent: "Oskyldiga",
          categoryAdult: "18+",
          categoryGross: "Grov",
          categorySavingError: "Fel (kategori)",
        }
      : {
          waitTitle: "Wait",
          waitBody: "Room code is loading...",
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
          copyInvite: "Copy invitation link",
          player: "Player",
          playersCount: "players",
          continueToImages: "CONTINUE TO IMAGES",
          startGame: "START GAME 🚀",
          startNewRound: "START NEW ROUND 🚀",
          back: "Back",
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

  const copyInvite = async () => {
    if (!inviteUrl) return Alert.alert(copy.waitTitle, copy.waitBody);
    await Clipboard.setStringAsync(inviteUrl);
    setShowCopiedToast(true);
    setTimeout(() => setShowCopiedToast(false), 1400);
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

    if (rErr) return Alert.alert(copy.errorRoom, rErr.message);

    setRoomCode(room.code);
    setHostId(room.host_player_id ?? "");
    setPhase((room.phase ?? "lobby") as any);
    setSelectedCategory((room.statement_category as StatementCategory | null) ?? "innocent");

    const { data: ps, error: pErr } = await supabase
      .from("players")
      .select("id,name")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (pErr) return Alert.alert(copy.errorPlayers, pErr.message);
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
    if (error) Alert.alert(copy.errorPhase, error.message);
  };

  const setCategory = async (category: StatementCategory) => {
    setSelectedCategory(category);
    if (!roomId || playerId !== hostId) return;

    const { error } = await supabase.from("rooms").update({ statement_category: category }).eq("id", roomId);

    if (error) {
      setSelectedCategory("innocent");
      Alert.alert(copy.categorySavingError, error.message);
    }
  };

  const startRound = async () => {
    if (!roomId) return;

    const { count, error: cErr } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    if (cErr) return Alert.alert(copy.errorPlayersCount, cErr.message);

    const expected = count ?? 0;
    if (expected < 2) return Alert.alert(copy.tooFewPlayersTitle, copy.tooFewPlayersBody);

    const { error: uErr } = await supabase
      .from("rooms")
      .update({ expected_players: expected, phase: "playing" })
      .eq("id", roomId);

    if (uErr) return Alert.alert(copy.errorRoomUpdate, uErr.message);

    const { data: usedRows, error: usedErr } = await supabase
      .from("rounds")
      .select("statement")
      .eq("room_id", roomId);

    if (usedErr) return Alert.alert(copy.errorRounds, usedErr.message);

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

    if (lastErr) return Alert.alert(copy.errorRoundsLast, lastErr.message);

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

    if (insErr) return Alert.alert(copy.errorRoundsInsert, insErr.message);
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

  const Button = ({
    title,
    onPress,
    disabled,
    variant = "primary",
  }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary";
  }) => {
    const bg = variant === "primary" ? "#000000" : "#374151";
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{title}</Text>
      </Pressable>
    );
  };

  const PlayerRow = ({ name, isHostRow }: { name: string; isHostRow: boolean }) => (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#1F2937",
        backgroundColor: "#0B1222",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>{name}</Text>
      {isHostRow ? (
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#374151",
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>{t("common.host").toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#0B0F19" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>{copy.lobby}</Text>

              <View
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: "#0F172A",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: "#9CA3AF", fontWeight: "800" }}>{copy.code}</Text>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 16, letterSpacing: 3 }}>
                  {roomCode || "----"}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={copyInvite}
              disabled={!roomCode}
              style={({ pressed }) => ({
                marginTop: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: "#111827",
                borderWidth: 1,
                borderColor: "#1F2937",
                opacity: !roomCode ? 0.5 : pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", textAlign: "center" }}>
                {copy.copyInvite}
              </Text>
            </Pressable>
            {showCopiedToast ? <CopyToast visible={showCopiedToast} /> : null}

            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: "#0F172A",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "white", fontWeight: "900" }}>{phaseLabel}</Text>
              <Text style={{ color: "#9CA3AF", marginTop: 6, lineHeight: 20 }}>{phaseDesc}</Text>
            </View>

            <View
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: "#0F172A",
                borderWidth: 1,
                borderColor: "#1F2937",
                gap: 10,
              }}
            >
              <View>
                <Text style={{ color: "white", fontWeight: "900" }}>{copy.categoryTitle}</Text>
                <Text style={{ color: "#9CA3AF", marginTop: 4, lineHeight: 20 }}>{copy.categoryBody}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                {categoryOptions.map((option) => {
                  const active = option.value === selectedCategory;
                  const disabled = !isHost || phase === "playing" || phase === "finished";

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setCategory(option.value)}
                      disabled={disabled}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: active ? "#38BDF8" : "#1F2937",
                        backgroundColor: active ? "#0B1222" : "#111827",
                        opacity: disabled ? 0.7 : pressed ? 0.92 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontWeight: "900",
                          textAlign: "center",
                          textTransform: "uppercase",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#0F172A",
              borderRadius: 20,
              padding: 14,
              borderWidth: 1,
              borderColor: "#1F2937",
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{copy.player}</Text>
              <Text style={{ color: "#9CA3AF", fontWeight: "900" }}>{players.length} {copy.playersCount}</Text>
            </View>

            <FlatList
              data={players}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              renderItem={({ item }) => <PlayerRow name={item.name} isHostRow={item.id === hostId} />}
            />

            {isHost && phase === "lobby" && <Button title={copy.continueToImages} onPress={startPicking} />}
            {isHost && phase === "picking" && <Button title={copy.startGame} onPress={startRound} />}
            {isHost && phase === "playing" && <Button title={copy.startNewRound} onPress={startRound} />}
          </View>

          <Button title={copy.back} onPress={() => router.replace("/picklo")} variant="secondary" />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
