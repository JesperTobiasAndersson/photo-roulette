import React from "react";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMafiaRoom } from "../src/games/mafia/useMafiaRoom";
import { GAMES } from "../src/games/catalog";
import { useI18n } from "../src/lib/i18n";
import { Button, Card, Chip, GameIcon, Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, gameAccents, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const ACCENT = gameAccents.mafia;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function getRoleBadge(role: string | undefined, language: "en" | "sv") {
  if (role === "mafia") return { label: "MAFIA", color: ACCENT };
  if (role === "doctor") return { label: language === "sv" ? "DOKTOR" : "DOCTOR", color: colors.success };
  if (role === "police") return { label: language === "sv" ? "POLIS" : "POLICE", color: colors.brand };
  return { label: language === "sv" ? "BYBO" : "VILLAGER", color: colors.textSecondary };
}

export default function MafiaResults() {
  const { language } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, myRole, playerRoles, loading } = useMafiaRoom(roomId, playerId);

  const copy =
    language === "sv"
      ? {
          loading: "Laddar resultat",
          loadingBody: "Hämtar slutresultatet och bordets status.",
          ended: "Spelet är slut",
          mafiaWins: "Mafian vinner",
          villageWins: "Byn vinner",
          yourRole: "Din roll",
          unknown: "OKÄND",
          table: "SLUTTABELL",
          survived: "Överlevde",
          eliminated: "Utslagen",
          back: "Tillbaka till Mafia",
          you: "Du",
        }
      : {
          loading: "Loading Results",
          loadingBody: "Pulling in the final outcome and table status.",
          ended: "Game Ended",
          mafiaWins: "Mafia wins",
          villageWins: "Village wins",
          yourRole: "Your role",
          unknown: "UNKNOWN",
          table: "FINAL TABLE",
          survived: "Survived",
          eliminated: "Eliminated",
          back: "Back to Mafia home",
          you: "You",
        };

  const goHome = () => router.replace(GAMES.mafia.href as any);
  const topBar = <TopBar title="Mafia" onBack={goHome} />;

  if (loading || !room) {
    return (
      <Screen topBar={topBar} centered>
        <View style={{ alignItems: "center", gap: space.md }}>
          <GameIcon source={GAMES.mafia.icon} size={96} accent={ACCENT} />
          <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.loading}</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{copy.loadingBody}</Text>
        </View>
      </Screen>
    );
  }

  const mafiaWon = room.winner === "mafia";
  const winColor = mafiaWon ? ACCENT : colors.brand;
  const myBadge = myRole?.role ? getRoleBadge(myRole.role, language) : null;

  return (
    <Screen topBar={topBar} footer={<Button label={copy.back} icon="refresh" accent={ACCENT} onPress={goHome} />}>
      <Card accent={winColor} style={{ alignItems: "center", paddingVertical: space.xl }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(winColor, 0.18),
            borderWidth: 1,
            borderColor: withAlpha(winColor, 0.4),
          }}
        >
          <Ionicons name={mafiaWon ? "skull" : "home"} size={38} color={winColor} />
        </View>
        <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.ended}</Text>
        <Text accessibilityRole="header" style={[type.display, { color: winColor, textAlign: "center" }]}>
          {mafiaWon ? copy.mafiaWins : copy.villageWins}
        </Text>
        {room.public_message ? (
          <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{room.public_message}</Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text style={[type.small, { color: colors.textMuted }]}>{copy.yourRole}:</Text>
          {myBadge ? <Chip label={myBadge.label} color={myBadge.color} /> : <Chip label={copy.unknown} />}
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <SectionLabel>{copy.table}</SectionLabel>
        {players.map((player) => {
          const playerRole = playerRoles.find((role) => role.player_id === player.id)?.role;
          const roleBadge = getRoleBadge(playerRole, language);
          const alive = player.status === "alive";
          const isMe = player.id === playerId;

          return (
            <View
              key={player.id}
              style={{
                minHeight: touch.primary,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
                borderWidth: 1,
                borderColor: isMe ? withAlpha(ACCENT, 0.35) : colors.border,
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>
                  {player.display_name}
                  {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{`  (${copy.you})`}</Text> : null}
                </Text>
                <Text style={{ color: alive ? colors.success : colors.danger, fontSize: 14, fontWeight: "600" }}>
                  {alive ? copy.survived : copy.eliminated}
                </Text>
              </View>
              <Chip label={roleBadge.label} color={roleBadge.color} />
            </View>
          );
        })}
      </View>
      <SupportPicklo />
    </Screen>
  );
}
