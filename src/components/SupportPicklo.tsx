import React from "react";
import { Linking, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../lib/i18n";
import { Button } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

// Any tip link works: a Swish payment link, Ko-fi, Buy Me a Coffee, GitHub Sponsors…
// Leave EXPO_PUBLIC_TIP_URL empty to hide this card completely.
const TIP_URL = process.env.EXPO_PUBLIC_TIP_URL?.trim();

/**
 * A quiet, optional "support Picklo" card for game-over screens only:
 * never shown mid-game, never a popup, and it unlocks nothing.
 */
export function SupportPicklo() {
  const { language } = useI18n();
  if (!TIP_URL) return null;
  const sv = language === "sv";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Ionicons name="heart" size={22} color="#F472B6" />
      <Text style={{ flex: 1, color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
        {sv
          ? "Picklo är gratis och reklamfritt. Gillade ni det? Ett litet bidrag håller servrarna igång."
          : "Picklo is free and ad-free. Enjoyed it? A small tip keeps the servers running."}
      </Text>
      <Button
        label={sv ? "Stötta" : "Tip"}
        size="sm"
        variant="secondary"
        onPress={() => Linking.openURL(TIP_URL)}
      />
    </View>
  );
}
