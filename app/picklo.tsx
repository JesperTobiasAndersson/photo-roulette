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
import { supabase } from "../src/lib/supabase";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useI18n } from "../src/lib/i18n";

const isWeb = Platform.OS === "web";

function makeCode(len = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MemeMatchHome() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const codeFromUrl = asString(params.code).trim().toUpperCase();
  const [name, setName] = useState("");
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"create" | "join">(codeFromUrl ? "join" : "create");
  const [loading, setLoading] = useState(false);
  const copy =
    language === "sv"
      ? {
          enterName: "Skriv ditt namn",
          unknownError: "Okänt fel",
          createError: "Fel när rummet skapades",
          playerError: "Fel (spelare)",
          failedCreate: "Det gick inte att skapa rum",
          enterRoomCode: "Skriv rumskod",
          roomNotFound: "Rummet hittades inte",
          tagline: "Välj bilder. Matcha påståendet. Rösta. Skratta.",
          addHomeScreen: "Lägg till på hemskärmen för en mer appliktig upplevelse.",
          inviteDetected: "INBJUDNINGSKOD HITTADE:",
          create: "Skapa rum",
          join: "Gå med i rum",
          yourName: "Ditt namn",
          exampleName: "t.ex. Alex",
          roomCode: "Rumskod",
          codeTip: "Tips: Koden är 4 tecken (A-Z, 2-9)",
          creating: "Skapar...",
          createRoom: "Skapa MemeMatch-rum",
          joining: "Går med...",
          joinRoom: "Gå med i MemeMatch-rum",
          consent: "Genom att fortsätta godkänner du att spelet får använda bilderna du väljer i rummet.",
        }
      : {
          enterName: "Enter your name",
          unknownError: "Unknown error",
          createError: "Error creating room",
          playerError: "Error (players)",
          failedCreate: "Failed to create room",
          enterRoomCode: "Enter room code",
          roomNotFound: "Room not found",
          tagline: "Pick images. Match the statement. Vote. Laugh.",
          addHomeScreen: "Add to Home Screen for an app-like experience.",
          inviteDetected: "INVITE CODE DETECTED:",
          create: "Create Room",
          join: "Join Room",
          yourName: "Your name",
          exampleName: "e.g. Alex",
          roomCode: "Room code",
          codeTip: "Tip: Code is 4 characters (A-Z, 2-9)",
          creating: "Creating...",
          createRoom: "Create MemeMatch Room",
          joining: "Joining...",
          joinRoom: "Join MemeMatch Room",
          consent: "By continuing you agree that the game may use the images you select in the room.",
        };

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const canCreate = trimmedName.length > 0 && !loading;
  const canJoin = trimmedName.length > 0 && trimmedCode.length > 0 && !loading;

  const createRoom = async () => {
    const n = trimmedName;
    if (!n) return Alert.alert(copy.enterName);

    setLoading(true);
    try {
      const roomCode = makeCode(4);

      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ code: roomCode, status: "lobby" })
        .select()
        .single();

      if (roomErr) {
        const msg = roomErr.message || copy.unknownError;
        Alert.alert(copy.createError, msg);
        console.error("createRoom - rooms error", JSON.stringify(roomErr, null, 2));
        return;
      }

      const { data: player, error: playerErr } = await supabase
        .from("players")
        .insert({ room_id: room.id, name: n })
        .select()
        .single();

      if (playerErr) {
        Alert.alert(copy.playerError, playerErr.message);
        console.error("createRoom - players error", playerErr);
        return;
      }

      await supabase.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);

      router.push({
        pathname: "/lobby",
        params: { roomId: room.id, playerId: player.id },
      });
    } catch (error) {
      console.error("createRoom failed", error);
      Alert.alert(copy.failedCreate, String(error));
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const n = trimmedName;
    const c = trimmedCode;
    if (!n) return Alert.alert(copy.enterName);
    if (!c) return Alert.alert(copy.enterRoomCode);

    setLoading(true);
    try {
      const { data: room, error: roomErr } = await supabase.from("rooms").select("*").eq("code", c).single();
      if (roomErr) return Alert.alert(copy.roomNotFound, roomErr.message);

      const { data: player, error: playerErr } = await supabase
        .from("players")
        .insert({ room_id: room.id, name: n })
        .select()
        .single();

      if (playerErr) return Alert.alert(copy.playerError, playerErr.message);

      router.push({
        pathname: "/lobby",
        params: { roomId: room.id, playerId: player.id },
      });
    } finally {
      setLoading(false);
    }
  };

  const PrimaryButton = ({
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
        height: 60,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: variant === "primary" ? "#000000" : "#374151",
        opacity: disabled ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        flexDirection: "row",
        gap: 10,
      })}
    >
      {loading ? <ActivityIndicator color="white" /> : null}
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: 0.3, textTransform: "uppercase" }}>{title}</Text>
    </Pressable>
  );

  const Content = (
    <View
      style={{
        flex: 1,
        padding: 20,
        justifyContent: "center",
        alignItems: isWeb ? "center" : undefined,
      }}
    >
      <View style={{ width: "100%", maxWidth: isWeb ? 420 : undefined }}>
        <StatusBar style="light" />
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "rgba(56,189,248,0.35)",
              shadowColor: "#38BDF8",
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
              backgroundColor: "#0F172A",
            }}
          >
            <Image source={require("../assets/Memematch.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>

          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", letterSpacing: 0.5 }}>MemeMatch</Text>
          <Text style={{ color: "#9CA3AF", marginTop: 10, textAlign: "center", lineHeight: 24, fontSize: 15 }}>
            {copy.tagline}
          </Text>

          {isWeb && (
            <Text style={{ color: "#94A3B8", marginTop: 10, textAlign: "center", lineHeight: 20, fontSize: 13 }}>
              {copy.addHomeScreen}
            </Text>
          )}

          {codeFromUrl ? (
            <Text style={{ color: "#BAE6FD", marginTop: 10, textAlign: "center", lineHeight: 20, fontSize: 13, fontWeight: "800" }}>
              {copy.inviteDetected} {codeFromUrl}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: "#1F2937",
            gap: 16,
          }}
        >
          {isWeb && (
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
              <Pressable onPress={() => setMode("create")}>
                <Text style={{ color: mode === "create" ? "#38BDF8" : "#94A3B8", fontWeight: "800", textTransform: "uppercase", fontSize: 14 }}>
                  {copy.create}
                </Text>
              </Pressable>
              <Text style={{ color: "#94A3B8" }}>|</Text>
              <Pressable onPress={() => setMode("join")}>
                <Text style={{ color: mode === "join" ? "#38BDF8" : "#94A3B8", fontWeight: "800", textTransform: "uppercase", fontSize: 14 }}>
                  {copy.join}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={{ gap: 8 }}>
            <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>{copy.yourName}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={copy.exampleName}
              placeholderTextColor="#64748B"
              editable={!loading}
              autoCorrect={false}
              autoComplete="name"
              style={{
                height: 56,
                borderRadius: 16,
                paddingHorizontal: 18,
                fontSize: 16,
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
              }}
            />
          </View>

          {mode === "join" && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>{copy.roomCode}</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="AB12"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                editable={!loading}
                autoCorrect={false}
                autoComplete="off"
                style={{
                  height: 56,
                  borderRadius: 16,
                  paddingHorizontal: 18,
                  fontSize: 18,
                  backgroundColor: "#000000",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                  color: "white",
                  fontWeight: "900",
                  letterSpacing: 3,
                  textAlign: "center",
                  ...(isWeb
                    ? ({
                        outlineStyle: "none",
                        boxSizing: "border-box",
                      } as any)
                    : null),
                }}
              />
              <Text style={{ color: "#94A3B8", fontSize: 12 }}>{copy.codeTip}</Text>
            </View>
          )}

          {mode === "create" ? (
            <PrimaryButton
              title={loading ? copy.creating : copy.createRoom}
              onPress={createRoom}
              disabled={!canCreate}
              variant="primary"
            />
          ) : (
            <PrimaryButton
              title={loading ? copy.joining : copy.joinRoom}
              onPress={joinRoom}
              disabled={!canJoin}
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
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("common.back_to_games")}</Text>
        </Pressable>

        <Text style={{ color: "#64748B", textAlign: "center", marginTop: 14, fontSize: 12 }}>
          {copy.consent}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0B0F19" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      enabled={Platform.OS !== "web"}
    >
      {isWeb ? (
        Content
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {Content}
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  );
}
