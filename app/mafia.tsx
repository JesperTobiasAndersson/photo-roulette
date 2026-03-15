import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";

const isWeb = Platform.OS === "web";

function makeCode(len = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i = 0; i < len; i++) value += chars[Math.floor(Math.random() * chars.length)];
  return value;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MafiaHome() {
  const params = useLocalSearchParams();
  const codeFromUrl = asString(params.code).trim().toUpperCase();

  const [name, setName] = useState("");
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"create" | "join">(codeFromUrl ? "join" : "create");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (codeFromUrl) {
      setCode(codeFromUrl);
      setMode("join");
    }
  }, [codeFromUrl]);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const createRoom = async () => {
    if (!trimmedName) return Alert.alert("Enter your name");

    setLoading(true);
    try {
      const roomCode = makeCode(4);

      const { data: room, error: roomErr } = await supabase
        .from("mafia_rooms")
        .insert({ code: roomCode, phase: "lobby", day_number: 0 })
        .select()
        .single();

      if (roomErr) return Alert.alert("Error creating room", roomErr.message);

      const { data: player, error: playerErr } = await supabase
        .from("mafia_players")
        .insert({ room_id: room.id, name: trimmedName })
        .select()
        .single();

      if (playerErr) return Alert.alert("Error creating player", playerErr.message);

      const { error: hostErr } = await supabase
        .from("mafia_rooms")
        .update({ host_player_id: player.id })
        .eq("id", room.id);

      if (hostErr) return Alert.alert("Error setting host", hostErr.message);

      router.push({ pathname: "/mafia-lobby", params: { roomId: room.id, playerId: player.id } });
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!trimmedName) return Alert.alert("Enter your name");
    if (!trimmedCode) return Alert.alert("Enter room code");

    setLoading(true);
    try {
      const { data: room, error: roomErr } = await supabase
        .from("mafia_rooms")
        .select("*")
        .eq("code", trimmedCode)
        .single();

      if (roomErr) return Alert.alert("Room not found", roomErr.message);
      if (room.phase !== "lobby") return Alert.alert("Game already started", "This Mafia room is already in progress.");

      const { data: player, error: playerErr } = await supabase
        .from("mafia_players")
        .insert({ room_id: room.id, name: trimmedName })
        .select()
        .single();

      if (playerErr) return Alert.alert("Error joining room", playerErr.message);

      router.push({ pathname: "/mafia-lobby", params: { roomId: room.id, playerId: player.id } });
    } finally {
      setLoading(false);
    }
  };

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
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 58,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: variant === "primary" ? "#7F1D1D" : "#111827",
        borderWidth: 1,
        borderColor: variant === "primary" ? "#991B1B" : "#1F2937",
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        flexDirection: "row",
        gap: 10,
      })}
    >
      {loading ? <ActivityIndicator color="white" /> : null}
      <Text style={{ color: "white", fontWeight: "900", fontSize: 17 }}>{title}</Text>
    </Pressable>
  );

  const content = (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
      <View style={{ width: "100%", maxWidth: 430 }}>
        <StatusBar style="light" />

        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(244,63,94,0.35)",
              backgroundColor: "#111827",
              shadowColor: "#F43F5E",
              shadowOpacity: 0.25,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 12,
            }}
          >
            <Image source={require("../assets/mafia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>

          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Mafia</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>
            Build a private room, assign roles, survive the night, and uncover the mafia.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 22,
            padding: 20,
            borderWidth: 1,
            borderColor: "#1E293B",
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", fontSize: 14 }}>
                Create Room
              </Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", fontSize: 14 }}>
                Join Room
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sofia"
              placeholderTextColor="#64748B"
              editable={!loading}
              autoCorrect={false}
              autoComplete="name"
              style={{
                height: 56,
                borderRadius: 16,
                paddingHorizontal: 18,
                fontSize: 16,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#1F2937",
                color: "white",
                fontWeight: "700",
                ...(isWeb ? ({ outlineStyle: "none", boxSizing: "border-box" } as any) : null),
              }}
            />
          </View>

          {mode === "join" && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>Room code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="AB12"
                placeholderTextColor="#64748B"
                editable={!loading}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{
                  height: 56,
                  borderRadius: 16,
                  paddingHorizontal: 18,
                  fontSize: 18,
                  backgroundColor: "#020617",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  color: "white",
                  fontWeight: "900",
                  letterSpacing: 3,
                  textAlign: "center",
                  ...(isWeb ? ({ outlineStyle: "none", boxSizing: "border-box" } as any) : null),
                }}
              />
            </View>
          )}

          {mode === "create" ? (
            <Button title={loading ? "Creating..." : "Create Mafia room"} onPress={createRoom} disabled={!trimmedName || loading} />
          ) : (
            <Button
              title={loading ? "Joining..." : "Join Mafia room"}
              onPress={joinRoom}
              disabled={!trimmedName || !trimmedCode || loading}
              variant="secondary"
            />
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900" }}>Back to games</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#070B14" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
