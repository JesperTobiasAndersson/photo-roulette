import React, { useMemo, useState } from "react";
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
import { createMafiaRoom, joinMafiaRoom } from "../src/games/mafia/api";

const isWeb = Platform.OS === "web";

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

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert("Enter your name");
    setLoading(true);
    try {
      const data = await createMafiaRoom(trimmedName);
      if (!data) throw new Error("No room response received");
      router.push({ pathname: "/mafia-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (err) {
      Alert.alert("Could not create room", String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const goJoin = async () => {
    if (!trimmedName || !trimmedCode) return Alert.alert("Enter your name and room code");
    setLoading(true);
    try {
      const data = await joinMafiaRoom(trimmedCode, trimmedName);
      if (!data) throw new Error("No room response received");
      router.push({ pathname: "/mafia-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (err) {
      Alert.alert("Could not join room", String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

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
            }}
          >
            <Image source={require("../assets/mafia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Mafia</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>
            Narratorless party game with live phase updates and private-feeling mafia coordination.
          </Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", fontSize: 14 }}>Create Room</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", fontSize: 14 }}>Join Room</Text>
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#64748B"
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

          {mode === "join" ? (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Room code"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
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
          ) : null}

          <Pressable
            onPress={mode === "create" ? goCreate : goJoin}
            disabled={loading || !trimmedName || (mode === "join" && !trimmedCode)}
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#7F1D1D",
              opacity: loading ? 0.6 : pressed ? 0.92 : 1,
              flexDirection: "row",
              gap: 10,
            })}
          >
            {loading ? <ActivityIndicator color="white" /> : null}
            <Text style={{ color: "white", fontWeight: "900", fontSize: 17 }}>
              {mode === "create" ? "Create Mafia room" : "Join Mafia room"}
            </Text>
          </Pressable>
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
