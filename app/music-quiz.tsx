import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { createMusicQuizRoom, joinMusicQuizRoom } from "../src/games/music-quiz/api";
import { useI18n } from "../src/lib/i18n";

const isWeb = Platform.OS === "web";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MusicQuizHome() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const codeFromUrl = asString(params.code).trim().toUpperCase();
  const [name, setName] = useState("");
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"create" | "join">(codeFromUrl ? "join" : "create");
  const [loading, setLoading] = useState(false);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const copy =
    language === "sv"
      ? {
          description: "Musikquiz med Spotify-länkar, omslagsreveal och hoststyrd poängsättning i realtid.",
          create: "Skapa rum",
          join: "Gå med i rum",
          name: "Ditt namn",
          code: "Rumskod",
          createRoom: "Skapa Music Quiz-rum",
          joinRoom: "Gå med i Music Quiz-rum",
          enterName: "Skriv ditt namn",
          enterNameCode: "Skriv ditt namn och rumskod",
          createFailed: "Kunde inte skapa Music Quiz-rum",
          joinFailed: "Kunde inte gå med i Music Quiz-rum",
        }
      : {
          description: "Music quiz with Spotify links, cover reveals, and host-controlled scoring in realtime.",
          create: "Create Room",
          join: "Join Room",
          name: "Your name",
          code: "Room code",
          createRoom: "Create Music Quiz Room",
          joinRoom: "Join Music Quiz Room",
          enterName: "Enter your name",
          enterNameCode: "Enter your name and room code",
          createFailed: "Could not create Music Quiz room",
          joinFailed: "Could not join Music Quiz room",
        };

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(copy.enterName);
    setLoading(true);
    try {
      const data = await createMusicQuizRoom(trimmedName);
      router.push({ pathname: "/music-quiz-room", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(copy.createFailed, String((error as Error)?.message ?? error));
    } finally {
      setLoading(false);
    }
  };

  const goJoin = async () => {
    if (!trimmedName || !trimmedCode) return Alert.alert(copy.enterNameCode);
    setLoading(true);
    try {
      const data = await joinMusicQuizRoom(trimmedCode, trimmedName);
      router.push({ pathname: "/music-quiz-room", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(copy.joinFailed, String((error as Error)?.message ?? error));
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
              borderColor: "rgba(34,197,94,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/musicquiz.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Music Quiz</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>{copy.description}</Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#4ADE80" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.create}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#4ADE80" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.join}</Text>
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={copy.name}
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
              placeholder={copy.code}
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
              backgroundColor: "#15803D",
              opacity: loading ? 0.6 : pressed ? 0.92 : 1,
              flexDirection: "row",
              gap: 10,
            })}
          >
            {loading ? <ActivityIndicator color="white" /> : null}
            <Text style={{ color: "white", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>
              {mode === "create" ? copy.createRoom : copy.joinRoom}
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
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("common.back_to_games")}</Text>
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
