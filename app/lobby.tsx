import React, { useEffect, useRef, useState } from "react";
import { getRandomStatement } from "../src/constants/statements";
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




export default function Lobby() {
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

const baseUrl = Platform.OS === "web" ? window.location.origin : "https://picklo.app";
const inviteUrl = roomCode ? `${baseUrl}/join?code=${roomCode}` : "";



const copyInvite = async () => {
  if (!inviteUrl) return Alert.alert("Wait", "Room code is loading...");
  await Clipboard.setStringAsync(inviteUrl);
  Alert.alert("Copied!", inviteUrl);
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
      .select("code, host_player_id, phase")
      .eq("id", roomId)
      .single();

    if (rErr) return Alert.alert("Error (room)", rErr.message);

    setRoomCode(room.code);
    setHostId(room.host_player_id ?? "");
    setPhase((room.phase ?? "lobby") as any);

    const { data: ps, error: pErr } = await supabase
      .from("players")
      .select("id,name")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });

    if (pErr) return Alert.alert("Error (players)", pErr.message);
    setPlayers(ps ?? []);

    const c = await getHandCount();
    setHandCount(c);
  };

  const startPicking = async () => {
    if (!roomId) return;
    const { error } = await supabase.from("rooms").update({ phase: "picking" }).eq("id", roomId);
    if (error) Alert.alert("Error (phase)", error.message);
  };

  const setPlaying = async () => {
    if (!roomId) return;
    const { error } = await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
    if (error) Alert.alert("Error (phase)", error.message);
  };

const startRound = async () => {
  if (!roomId) return;

  // ✅ 0) Räkna spelare just nu (frys antalet för hela matchen)
  const { count, error: cErr } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (cErr) return Alert.alert("Error (players count)", cErr.message);

  const expected = count ?? 0;
  if (expected < 2) return Alert.alert("För få spelare", "Minst 2 spelare behövs.");

  // ✅ 1) Sätt expected_players + phase=playing (ATOMISKT före första rundan)
  const { error: uErr } = await supabase
    .from("rooms")
    .update({ expected_players: expected, phase: "playing" })
    .eq("id", roomId);

  if (uErr) return Alert.alert("Error (rooms update)", uErr.message);

  // ✅ 2) Hämta statements som använts
  const { data: usedRows, error: usedErr } = await supabase
    .from("rounds")
    .select("statement")
    .eq("room_id", roomId);

  if (usedErr) return Alert.alert("Error (rounds)", usedErr.message);

  const usedStatements = (usedRows ?? [])
    .map((r) => r.statement)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  // ✅ 3) Nästa round_number
  const { data: last, error: lastErr } = await supabase
    .from("rounds")
    .select("round_number")
    .eq("room_id", roomId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) return Alert.alert("Error (rounds last)", lastErr.message);

  const nextNumber = (last?.round_number ?? 0) + 1;
  if (nextNumber > 5) return router.replace({ pathname: "/results", params: { roomId } });

  // ✅ 4) Skapa första rundan
  const statement = getRandomStatement(usedStatements);
  const endsAt = new Date(Date.now() + 60_000).toISOString();

  const { data: newRound, error: insErr } = await supabase
    .from("rounds")
    .insert({
      room_id: roomId,
      statement,
      status: "collecting",
      ends_at: endsAt,
      round_number: nextNumber,
    })
    .select("id")
    .single();

  if (insErr) return Alert.alert("Error (rounds insert)", insErr.message);

  // (valfritt) du behöver inte navigera här – din roundsChannel INSERT tar alla till round.
  // router.replace({ pathname: "/round", params: { roomId, playerId, roundId: newRound.id } });
};



  useEffect(() => {
    load();
    if (!roomId) return;

    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        () => load()
      )
      .subscribe();

    const playersChannel = supabase
      .channel(`players-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => load()
      )
      .subscribe();

    const roundsChannel = supabase
      .channel(`rounds-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (!isActiveRef.current) return;

          const newRound = payload.new as any;
          const newRoundId = newRound.id as string;

          if (lastNavigatedRoundIdRef.current === newRoundId) return;
          lastNavigatedRoundIdRef.current = newRoundId;

          router.replace({ pathname: "/round", params: { roomId, playerId, roundId: newRoundId } });
        }
      )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roomId, playerId, handReady]);

  const isHost = playerId === hostId;

  const phaseLabel =
    phase === "lobby"
      ? "Waiting in lobby"
      : phase === "picking"
      ? "Selecting images"
      : phase === "playing"
      ? "Ready to play"
      : "Finished";

  const phaseDesc =
    phase === "lobby"
      ? "Wait until everyone has joined. Host starts when you're ready."
      : phase === "picking"
      ? `Everyone selects 5 images. You have ${handCount}/5. When ready host presses “Continue”.`
      : phase === "playing"
      ? "Game is running. Host can start the first round."
      : "Match is over!";

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
          <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>HOST</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0B0F19" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>Lobby</Text>

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
                <Text style={{ color: "#9CA3AF", fontWeight: "800" }}>Kod</Text>
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
  <Text style={{ color: "white", fontWeight: "900", textAlign: "center" }}>
    Kopiera inbjudningslänk 🔗
  </Text>
</Pressable>

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
              <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>Spelare</Text>
              <Text style={{ color: "#9CA3AF", fontWeight: "900" }}>{players.length} st</Text>
            </View>

            <FlatList
              data={players}
              keyExtractor={(p) => p.id}
              contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
              renderItem={({ item }) => <PlayerRow name={item.name} isHostRow={item.id === hostId} />}
            />

           {isHost && phase === "lobby" && <Button title="Start – pick 5 images 🖼️" onPress={startPicking} />}
           {isHost && phase === "picking" && <Button title="Starta spelet 🚀" onPress={startRound} />}  
            {isHost && phase === "playing" && <Button title="Start new round 🚀" onPress={startRound} />}

          </View>

          <Button title="Back" onPress={() => router.replace("/")} variant="secondary" />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
