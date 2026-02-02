import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  Image,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../src/lib/supabase";

type HandRow = {
  id: string;
  image_path: string;
  used_in_round_id: string | null;
};

async function uriToArrayBuffer(uri: string) {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
) {
  let i = 0;
  const workers = new Array(limit).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export default function PickHandScreen() {
  const router = useRouter();
  const { roomId, playerId } = useLocalSearchParams<{ roomId: string; playerId: string }>();

  const [hand, setHand] = useState<HandRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);

  const publicUrlFor = (path: string) => {
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const loadHand = async () => {
    if (!roomId || !playerId) return;
    const { data, error } = await supabase
      .from("player_images")
      .select("id,image_path,used_in_round_id")
      .eq("room_id", roomId)
      .eq("player_id", playerId)
      .order("created_at", { ascending: true });

    if (error) return Alert.alert("Fel (hand)", error.message);
    setHand(data ?? []);
  };

  useEffect(() => {
    loadHand();
  }, [roomId, playerId]);

  const remainingToPick = Math.max(0, 10 - hand.length);
  const canContinue = hand.length === 10;

  const pickAndUploadMany = async () => {
    if (!roomId || !playerId) return;
    if (hand.length >= 10) return Alert.alert("Du har redan valt 10 ✅");
    if (busy) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Behöver tillgång till bilder");

    const mediaTypes =
      // @ts-ignore
      (ImagePicker.MediaType?.Image ? [ImagePicker.MediaType.Image] : undefined) ??
      // @ts-ignore
      (ImagePicker.MediaTypeOptions?.Images ?? ImagePicker.MediaTypeOptions.All);

    const res = await ImagePicker.launchImageLibraryAsync({
      // @ts-ignore
      mediaTypes,
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: remainingToPick,
    });

    if (res.canceled) return;

    const assets = res.assets ?? [];
    if (assets.length === 0) return;

    const slots = Math.max(0, 10 - hand.length);
    const picked = assets.slice(0, slots);

    setUploadTotal(picked.length);
    setUploadDone(0);

    setBusy(true);
    try {
      await mapWithConcurrency(picked, 3, async (asset, i) => {
        const uri = (asset as any)?.uri as string | undefined;
        if (!uri) return;

        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        const buf = await uriToArrayBuffer(manipulated.uri);
        const filePath = `${roomId}/hand/${playerId}-${Date.now()}-${i}.jpg`;

        const { error: upErr } = await supabase.storage
          .from("game-images")
          .upload(filePath, buf, { contentType: "image/jpeg", upsert: false });

        if (upErr) {
          Alert.alert("Upload-fel", upErr.message);
          return;
        }

        const { error: insErr } = await supabase.from("player_images").insert({
          room_id: roomId,
          player_id: playerId,
          image_path: filePath,
          used_in_round_id: null,
        });

        if (insErr) {
          Alert.alert("DB-fel", insErr.message);
          return;
        }

        setUploadDone((d) => d + 1);
      });

      await loadHand();
    } finally {
      setBusy(false);
      setUploadTotal(0);
      setUploadDone(0);
    }
  };

  const goNext = async () => {
    if (!roomId || !playerId) return;

    const { count, error } = await supabase
      .from("player_images")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("player_id", playerId);

    if (error) return Alert.alert("Fel (hand)", error.message);

    if ((count ?? 0) < 10) {
      return Alert.alert("Vänta lite…", `Uppladdning klarar inte än (${count ?? 0}/10).`);
    }

    router.replace({ pathname: "/lobby", params: { roomId, playerId, handReady: "1" } });
  };

  const selectedUris = useMemo(() => hand.map((h) => publicUrlFor(h.image_path)), [hand]);

  const progress = uploadTotal > 0 ? uploadDone / uploadTotal : 0;

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
    const bg =
      variant === "primary"
        ? hand.length >= 10
          ? "#0F766E"
          : "#111827"
        : "#374151";

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => ({
          height: 54,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          flexDirection: "row",
          gap: 10,
        })}
      >
        {busy && variant === "primary" ? <ActivityIndicator color="white" /> : null}
        <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{title}</Text>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0B0F19" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
          {/* Header */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>Välj dina 10 bilder</Text>

            <View
              style={{
                backgroundColor: "#0F172A",
                borderRadius: 18,
                padding: 12,
                borderWidth: 1,
                borderColor: "#1F2937",
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "#CBD5E1", fontWeight: "800" }}>Progress</Text>

                <View
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: "#0B1222",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>
                    {hand.length}/10{remainingToPick > 0 ? `  (+${remainingToPick})` : " ✅"}
                  </Text>
                </View>
              </View>

              <Text style={{ color: "#9CA3AF", lineHeight: 20 }}>
                Välj bilder från din kamerarulle. De används bara i detta rum.
              </Text>

              {/* Upload progress */}
              {busy && (
                <View style={{ gap: 10, marginTop: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ color: "white", fontWeight: "900" }}>
                      Laddar upp {uploadDone}/{uploadTotal}
                    </Text>
                    <Text style={{ color: "#9CA3AF", fontWeight: "900" }}>
                      {Math.round(progress * 100)}%
                    </Text>
                  </View>

                  <View
                    style={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: "#0B1222",
                      borderWidth: 1,
                      borderColor: "#1F2937",
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${Math.max(2, Math.round(progress * 100))}%`,
                        backgroundColor: "#22C55E",
                      }}
                    />
                  </View>

                  <Text style={{ color: "#94A3B8", fontSize: 12 }}>
                    Tips: välj gärna screenshots/memes – det blir roligare 😄
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Buttons */}
          <View style={{ gap: 10 }}>
            <Button
              title={
                hand.length >= 10
                  ? "Klar"
                  : remainingToPick === 10
                  ? "Välj 10 bilder"
                  : "Välj fler bilder"
              }
              onPress={pickAndUploadMany}
              disabled={busy}
              variant="primary"
            />

            <Button
              title="Fortsätt"
              onPress={goNext}
              disabled={busy || !canContinue}
              variant="secondary"
            />
          </View>

          {/* Grid */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#0F172A",
              borderRadius: 20,
              padding: 12,
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>Din hand</Text>
              <Text style={{ color: "#9CA3AF", fontWeight: "900" }}>{selectedUris.length} bilder</Text>
            </View>

            <FlatList
              data={selectedUris}
              keyExtractor={(x, i) => `${x}-${i}`}
              numColumns={3}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              renderItem={({ item }) => (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "#1F2937",
                    backgroundColor: "#0B1222",
                  }}
                >
                  <Image source={{ uri: item }} style={{ width: "100%", height: 110 }} />
                </View>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 18 }}>
                  <Text style={{ color: "#9CA3AF", textAlign: "center", lineHeight: 20 }}>
                    Inga bilder än. Tryck på “Välj 10 bilder” för att börja.
                  </Text>
                </View>
              }
            />
          </View>

          {/* Back */}
          <Pressable
            onPress={() => router.replace("/lobby")}
            disabled={busy}
            style={({ pressed }) => ({
              height: 50,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111827",
              opacity: busy ? 0.5 : pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Tillbaka</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
