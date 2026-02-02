// app/join.tsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";

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

    if (!n) return Alert.alert("Skriv ditt namn");
    if (!c) return Alert.alert("Saknar rumskod");

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("code", c)
      .single();

    if (roomErr) return Alert.alert("Hittar inte rummet", roomErr.message);

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .insert({ room_id: room.id, name: n })
      .select()
      .single();

    if (playerErr) return Alert.alert("Fel (players)", playerErr.message);

    router.replace({
      pathname: "/lobby",
      params: { roomId: room.id, playerId: player.id },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0B0F19", padding: 20, justifyContent: "center" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ gap: 14 }}>
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900" }}>Picklo</Text>
        <Text style={{ color: "#94A3B8" }}>Gå med i rum: <Text style={{ color: "white", fontWeight: "900" }}>{codeFromUrl}</Text></Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Ditt namn"
          placeholderTextColor="#64748B"
          style={{
            height: 56,
            borderRadius: 16,
            paddingHorizontal: 18,
            backgroundColor: "#0B1222",
            borderWidth: 1,
            borderColor: "#1F2937",
            color: "white",
            fontWeight: "700",
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
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Gå med</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
