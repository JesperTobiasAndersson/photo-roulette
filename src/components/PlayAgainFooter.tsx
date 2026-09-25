import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import { useI18n } from "../lib/i18n";
import { Button } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

type PlayAgainFooterProps = {
  isHost: boolean;
  /** Restarts the same room; every phone follows the room back to the lobby. */
  onPlayAgain: () => void;
  loading?: boolean;
  accent: string;
  /** Entry screen of the game, for starting a completely new room. */
  newRoomHref: string;
};

/** Game-over footer: the host restarts with the same players, everyone else waits. */
export function PlayAgainFooter({ isHost, onPlayAgain, loading, accent, newRoomHref }: PlayAgainFooterProps) {
  const { language } = useI18n();
  const sv = language === "sv";

  if (isHost) {
    return (
      <>
        <Button
          label={sv ? "Spela igen med samma gäng" : "Play again with the same group"}
          icon="refresh"
          accent={accent}
          loading={loading}
          onPress={onPlayAgain}
        />
        <Button
          label={sv ? "Nytt rum" : "New room"}
          icon="add-circle-outline"
          variant="ghost"
          size="md"
          onPress={() => router.replace(newRoomHref as any)}
        />
      </>
    );
  }

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <ActivityIndicator color={accent} />
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 15, fontWeight: "600" }}>
          {sv ? "Väntar på att värden startar en ny omgång…" : "Waiting for the host to start a new round…"}
        </Text>
      </View>
      <Button
        label={sv ? "Lämna" : "Leave"}
        icon="exit-outline"
        variant="ghost"
        size="md"
        onPress={() => router.replace(newRoomHref as any)}
      />
    </>
  );
}
