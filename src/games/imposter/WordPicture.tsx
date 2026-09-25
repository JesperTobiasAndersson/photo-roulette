import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { colors, radius } from "../../ui/theme";
import { IMPOSTER_WORDS, imposterWordLabel } from "./data";

/** Photo (or flag) for a secret word, with the attribution Wikimedia's licences ask for. */
export function WordPicture({ word, size, language }: { word: string | null; size: number; language: "en" | "sv" }) {
  const info = word ? IMPOSTER_WORDS[word] : undefined;
  const [failed, setFailed] = useState(false);
  if (!info?.image || failed) return null;
  // Flags keep their 3:2 shape instead of being cropped to a square.
  const isFlag = info.image.includes("flagcdn.com");
  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Image
        source={{ uri: info.image }}
        onError={() => setFailed(true)}
        accessibilityLabel={imposterWordLabel(word, language)}
        style={{
          width: isFlag ? size * 1.2 : size,
          height: isFlag ? size * 0.8 : size,
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceRaised,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        resizeMode="cover"
      />
      {info.credit === "wikipedia" ? (
        <Text style={{ color: colors.textSubtle, fontSize: 11 }}>{language === "sv" ? "Foto: Wikipedia" : "Photo: Wikipedia"}</Text>
      ) : null}
    </View>
  );
}
