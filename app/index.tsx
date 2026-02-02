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
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";

const isWeb = Platform.OS === "web";

function makeCode(len = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function Home() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [loading, setLoading] = useState(false);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const canCreate = trimmedName.length > 0 && !loading;
  const canJoin = trimmedName.length > 0 && trimmedCode.length > 0 && !loading;

  const createRoom = async () => {
    const n = trimmedName;
    if (!n) return Alert.alert("Skriv ditt namn");

    setLoading(true);
    try {
      const roomCode = makeCode(4);

      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ code: roomCode, status: "lobby" })
        .select()
        .single();

      if (roomErr) return Alert.alert("Fel (rooms)", roomErr.message);

      const { data: player, error: playerErr } = await supabase
        .from("players")
        .insert({ room_id: room.id, name: n })
        .select()
        .single();

      if (playerErr) return Alert.alert("Fel (players)", playerErr.message);

      await supabase.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);

      router.push({
        pathname: "/lobby",
        params: { roomId: room.id, playerId: player.id },
      });
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const n = trimmedName;
    const c = trimmedCode;
    if (!n) return Alert.alert("Skriv ditt namn");
    if (!c) return Alert.alert("Skriv rumskod");

    setLoading(true);
    try {
      const { data: room, error: roomErr } = await supabase.from("rooms").select("*").eq("code", c).single();
      if (roomErr) return Alert.alert("Hittar inte rummet", roomErr.message);

      const { data: player, error: playerErr } = await supabase
        .from("players")
        .insert({ room_id: room.id, name: n })
        .select()
        .single();

      if (playerErr) return Alert.alert("Fel (players)", playerErr.message);

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
      <Text style={{ color: "white", fontWeight: "900", fontSize: 18, letterSpacing: 0.3 }}>{title}</Text>
    </Pressable>
  );

  const Tab = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: active ? "#000000" : "#95979d",
        borderWidth: 1,
        borderColor: active ? "#374151" : "#1F2937",
        opacity: loading ? 0.6 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <Text style={{ color: "white", textAlign: "center", fontWeight: "900", fontSize: 16 }}>{label}</Text>
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
        {/* Header */}
         <StatusBar style="light" />
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          {/* App icon */}
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
            <Image source={require("../assets/icon.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>

          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", letterSpacing: 0.5 }}>Picklo</Text>

          <Text style={{ color: "#9CA3AF", marginTop: 10, textAlign: "center", lineHeight: 24, fontSize: 15 }}>
            Välj bilder. Matcha påståendet. Rösta. Skratta.
          </Text>
        </View>

        {/* Card */}
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
          {/* Tabs */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Tab label="Skapa" active={mode === "create"} onPress={() => setMode("create")} />
            <Tab label="Gå med" active={mode === "join"} onPress={() => setMode("join")} />
          </View>

          {/* Name */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>Ditt namn</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="t.ex. Alex"
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

          {/* Join code */}
          {mode === "join" && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#CBD5E1", fontWeight: "800", fontSize: 14 }}>Rumskod</Text>
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
              <Text style={{ color: "#94A3B8", fontSize: 12 }}>Tips: Koden är 4 tecken (A–Z, 2–9)</Text>
            </View>
          )}

          {/* Button */}
          {mode === "create" ? (
            <PrimaryButton title={loading ? "Skapar..." : "Skapa rum 🚀"} onPress={createRoom} disabled={!canCreate} variant="primary" />
          ) : (
            <PrimaryButton title={loading ? "Går med..." : "Gå med 🎮"} onPress={joinRoom} disabled={!canJoin} variant="secondary" />
          )}
        </View>

        {/* Footer */}
        <Text style={{ color: "#64748B", textAlign: "center", marginTop: 14, fontSize: 12 }}>
          Genom att fortsätta godkänner du att spelet använder dina valda bilder i rummet.
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
