// app/join.tsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { StatusBar } from "expo-status-bar";

const isWeb = Platform.OS === "web";

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default function JoinScreen() {
  const params = useLocalSearchParams();
  const codeFromUrl = (asString(params.code) ?? "").trim().toUpperCase();

  const [name, setName] = useState("");
  const trimmedName = useMemo(() => name.trim(), [name]);

  const canJoin = trimmedName.length > 0 && codeFromUrl.length > 0;

  const joinRoom = async () => {
    const n = trimmedName;
    const c = codeFromUrl;

    if (!n) return Alert.alert("Enter your name");
    if (!c) return Alert.alert("Missing room code");

    const { data: room, error: roomErr } = await supabase.from("rooms").select("*").eq("code", c).single();
    if (roomErr) return Alert.alert("Room not found", roomErr.message);

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .insert({ room_id: room.id, name: n })
      .select()
      .single();

    if (playerErr) return Alert.alert("Error (players)", playerErr.message);

    router.replace({
      pathname: "/lobby",
      params: { roomId: room.id, playerId: player.id },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: "#0B0F19",
        padding: 20,
        justifyContent: "center",
        alignItems: isWeb ? "center" : undefined,
      }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={!isWeb}
    >
      <StatusBar style="light" />
      <View style={{ gap: 14, width: "100%", maxWidth: isWeb ? 420 : undefined }}>
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900" }}>Picklo</Text>

        {codeFromUrl ? (
          <Text style={{ color: "#94A3B8" }}>
            Join room: <Text style={{ color: "white", fontWeight: "900" }}>{codeFromUrl}</Text>
          </Text>
        ) : (
          <Text style={{ color: "#FCA5A5", fontWeight: "800" }}>
            Missing code. Open link from host (…/join?code=XXXX).
          </Text>
        )}

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor="#64748B"
          editable={!!codeFromUrl}
          autoCorrect={false}
          autoComplete="name"
          style={{
            height: 56,
            borderRadius: 16,
            paddingHorizontal: 18,
            backgroundColor: "#0B1222",
            borderWidth: 1,
            borderColor: "#1F2937",
            color: "white",
            fontWeight: "700",
            ...(isWeb
              ? ({
                  outlineStyle: "none",
                  boxSizing: "border-box",
                } as any)
              : null),
            opacity: codeFromUrl ? 1 : 0.6,
          }}
        />

        <Pressable
          onPress={joinRoom}
          disabled={!canJoin}
          style={({ pressed }) => ({
            height: 56,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000",
            opacity: !canJoin ? 0.5 : pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Join</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
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
          <Text style={{ color: "white", fontWeight: "900", fontSize: 14 }}>Back to home</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
