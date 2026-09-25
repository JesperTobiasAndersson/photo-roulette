import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../src/lib/supabase";
import { compressImage, uriToArrayBuffer } from "../src/lib/imageUpload";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { GAMES } from "../src/games/catalog";
import { Button, Card, Chip, Screen, TopBar } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.memematch;
const ACCENT = GAME.accent;

type HandRow = {
  id: string;
  image_path: string;
  used_in_round_id: string | null;
};

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>) {
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
  const { language, t } = useI18n();
  const { roomId, playerId } = useLocalSearchParams<{ roomId: string; playerId: string }>();

  const [hand, setHand] = useState<HandRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadDone, setUploadDone] = useState(0);

  const MAX_IMAGES = 5;

  const copy =
    language === "sv"
      ? {
          errorHand: "Fel (bilder)",
          maxReachedTitle: "Max uppnått",
          maxReachedBody: "Du har valt 5 bilder. Tryck på en bild nedan för att ta bort den och välja en ny.",
          needAccess: "Behöver åtkomst till bilder",
          uploadError: "Uppladdningsfel",
          dbError: "Databasfel",
          holdOn: "Vänta lite",
          uploadNotFinished: "Uppladdningen är inte klar än",
          chooseImages: "Välj dina bilder",
          progress: "Framsteg",
          pickHint: "Välj bilder från ditt bibliotek. De används bara i det här rummet.",
          uploading: "Laddar upp",
          uploadTip: "Tips: välj screenshots eller memes, det blir roligare så.",
          continue: "Fortsätt",
          pickImages: `Välj ${MAX_IMAGES} bilder`,
          pickMoreImages: "Välj fler bilder",
          yourHand: "Din hand",
          images: "bilder",
          removeHint: "Tryck på en bild för att ta bort den och välja en ny.",
          removeImageTitle: "Ta bort bild?",
          removeImageBody: "Det här tar bort bilden från din hand.",
          cancel: "Avbryt",
          delete: "Ta bort",
          emptyState: "Inga bilder än. Tryck på “Välj 5 bilder” för att börja.",
          back: "Tillbaka",
          done: "Klart",
          leaveTitle: "Lämna spelet?",
          leaveBody: "Du lämnar rummet. Dina vänner kan fortsätta spela.",
          stay: "Stanna",
        }
      : {
          errorHand: "Error (hand)",
          maxReachedTitle: "Max reached",
          maxReachedBody: "You've picked 5 images. Tap an image below to remove it, then pick again.",
          needAccess: "Need access to photos",
          uploadError: "Upload error",
          dbError: "DB error",
          holdOn: "Hold on",
          uploadNotFinished: "Upload not finished yet",
          chooseImages: "Choose your images",
          progress: "Progress",
          pickHint: "Pick photos from your library. They're only used in this room.",
          uploading: "Uploading",
          uploadTip: "Tip: choose screenshots or memes. It's more fun that way.",
          continue: "Continue",
          pickImages: `Pick ${MAX_IMAGES} images`,
          pickMoreImages: "Pick more images",
          yourHand: "Your hand",
          images: "images",
          removeHint: "Tap an image to remove it and pick a new one.",
          removeImageTitle: "Remove image?",
          removeImageBody: "This will delete the picture from your hand.",
          cancel: "Cancel",
          delete: "Delete",
          emptyState: "No pictures yet. Tap “Pick 5 images” to start.",
          back: "Back",
          done: "Done",
          leaveTitle: "Leave the game?",
          leaveBody: "You'll leave this room. Your friends can keep playing.",
          stay: "Stay",
        };

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

    if (error) return showAlert(copy.errorHand, error.message);
    setHand(data ?? []);
  };

  useEffect(() => {
    loadHand();
  }, [roomId, playerId]);

  const remainingToPick = Math.max(0, MAX_IMAGES - hand.length);
  const canContinue = hand.length === MAX_IMAGES;

  const pickAndUploadMany = async () => {
    if (!roomId || !playerId) return;
    if (busy) return;

    if (hand.length >= MAX_IMAGES) {
      return showAlert(copy.maxReachedTitle, copy.maxReachedBody);
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return showAlert(copy.needAccess);

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

    const picked = assets.slice(0, remainingToPick);
    if (picked.length === 0) {
      return showAlert(copy.maxReachedTitle, copy.maxReachedBody);
    }

    setUploadTotal(picked.length);
    setUploadDone(0);

    setBusy(true);
    try {
      await mapWithConcurrency(picked, 3, async (asset, i) => {
        const currentHandCount = hand.length + i;
        if (currentHandCount >= MAX_IMAGES) return;

        const uri = (asset as any)?.uri as string | undefined;
        if (!uri) return;

        const compressedUri = await compressImage(uri);
        const buf = await uriToArrayBuffer(compressedUri);
        const filePath = `${roomId}/hand/${playerId}-${Date.now()}-${i}.jpg`;

        const { error: upErr } = await supabase.storage
          .from("game-images")
          .upload(filePath, buf, { contentType: "image/jpeg", upsert: false });

        if (upErr) {
          showAlert(copy.uploadError, upErr.message);
          return; // don't create a hand row pointing at a file that never uploaded
        }

        const { error: insErr } = await supabase.from("player_images").insert({
          room_id: roomId,
          player_id: playerId,
          image_path: filePath,
          used_in_round_id: null,
        });

        if (insErr) {
          showAlert(copy.dbError, insErr.message);
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

    if (error) return showAlert(copy.errorHand, error.message);

    if ((count ?? 0) < MAX_IMAGES) {
      return showAlert(copy.holdOn, `${copy.uploadNotFinished} (${count ?? 0}/${MAX_IMAGES}).`);
    }

    router.replace({ pathname: "/lobby", params: { roomId, playerId, handReady: "1" } });
  };

  const selectedUris = useMemo(() => hand.map((h) => publicUrlFor(h.image_path)), [hand]);
  const progress = uploadTotal > 0 ? uploadDone / uploadTotal : 0;

  const removeImage = async (image: HandRow) => {
    if (busy) return;
    const ok = await confirmAction(copy.removeImageTitle, copy.removeImageBody, {
      confirmLabel: copy.delete,
      cancelLabel: copy.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await supabase.storage.from("game-images").remove([image.image_path]);
    } catch (error) {
      console.warn("storage remove error", error);
    }
    const { error: dbErr } = await supabase.from("player_images").delete().eq("id", image.id);
    if (dbErr) {
      showAlert(copy.dbError, dbErr.message);
    }
    loadHand();
  };

  const leave = async () => {
    if (busy) return;
    const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, {
      confirmLabel: t("common.leave"),
      cancelLabel: copy.stay,
      destructive: true,
    });
    if (ok) router.replace(GAME.href as any);
  };

  const handProgress = hand.length / MAX_IMAGES;
  const emptySlots = Array.from({ length: remainingToPick }, (_, i) => i);

  const footer = canContinue ? (
    <Button label={copy.continue} icon="checkmark-circle" accent={ACCENT} onPress={goNext} disabled={busy} />
  ) : (
    <Button
      label={
        busy
          ? `${copy.uploading} ${uploadDone}/${uploadTotal}`
          : remainingToPick === MAX_IMAGES
          ? copy.pickImages
          : `${copy.pickMoreImages} (+${remainingToPick})`
      }
      icon="images"
      accent={ACCENT}
      loading={busy}
      onPress={pickAndUploadMany}
      disabled={busy}
    />
  );

  return (
    <Screen topBar={<TopBar title={copy.chooseImages} onBack={leave} />} footer={footer}>
      {/* Progress */}
      <Card accent={canContinue ? colors.success : ACCENT}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.yourHand}</Text>
            <Text style={[type.title, { color: colors.text }]}>
              {hand.length} / {MAX_IMAGES} <Text style={[type.body, { color: colors.textMuted }]}>{copy.images}</Text>
            </Text>
          </View>
          {canContinue ? (
            <Chip label={copy.done} color={colors.success} icon="checkmark-circle" />
          ) : (
            <Chip label={`+${remainingToPick}`} color={ACCENT} icon="add" />
          )}
        </View>

        <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.sunken, overflow: "hidden" }}>
          <View
            style={{
              height: "100%",
              width: `${Math.round(handProgress * 100)}%`,
              backgroundColor: canContinue ? colors.success : ACCENT,
              borderRadius: radius.pill,
            }}
          />
        </View>

        {busy ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <ActivityIndicator color={ACCENT} size="small" />
                <Text style={[type.bodyStrong, { color: colors.text }]}>
                  {copy.uploading} {uploadDone}/{uploadTotal}
                </Text>
              </View>
              <Text style={[type.bodyStrong, { color: colors.textMuted }]}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.sunken, overflow: "hidden" }}>
              <View
                style={{
                  height: "100%",
                  width: `${Math.max(2, Math.round(progress * 100))}%`,
                  backgroundColor: colors.success,
                }}
              />
            </View>
            <Text style={[type.small, { color: colors.textMuted }]}>{copy.uploadTip}</Text>
          </View>
        ) : (
          <Text style={[type.small, { color: colors.textMuted }]}>{copy.pickHint}</Text>
        )}
      </Card>

      {/* Hand grid: photos + empty "add" slots, 3 per row */}
      <View style={{ gap: space.sm }}>
        {hand.length > 0 ? <Text style={[type.small, { color: colors.textMuted }]}>{copy.removeHint}</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs }}>
          {hand.map((image, index) => (
            <View key={image.id} style={{ width: "33.333%", padding: space.xs }}>
              <Pressable
                onPress={() => removeImage(image)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${copy.removeImageTitle} ${index + 1}`}
                style={({ pressed }) => ({
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: radius.md,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.sunken,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Image source={{ uri: selectedUris[index] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <View
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 30,
                    height: 30,
                    borderRadius: radius.pill,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.overlay,
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                  }}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </View>
              </Pressable>
            </View>
          ))}

          {emptySlots.map((slot) => (
            <View key={`empty-${slot}`} style={{ width: "33.333%", padding: space.xs }}>
              <Pressable
                onPress={pickAndUploadMany}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={copy.pickMoreImages}
                style={({ pressed }) => ({
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: withAlpha(ACCENT, slot === 0 ? 0.7 : 0.3),
                  backgroundColor: pressed ? withAlpha(ACCENT, 0.14) : withAlpha(ACCENT, slot === 0 ? 0.08 : 0.03),
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                {busy && slot < uploadTotal - uploadDone ? (
                  <ActivityIndicator color={ACCENT} />
                ) : (
                  <Ionicons name="add" size={30} color={slot === 0 ? ACCENT : withAlpha(ACCENT, 0.6)} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
        {hand.length === 0 && !busy ? (
          <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.emptyState}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
