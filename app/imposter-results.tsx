import React, { useEffect, useMemo, useState } from "react";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { getCategoryById } from "../src/games/imposter/logic";
import { imposterCategoryLabel, imposterWordLabel } from "../src/games/imposter/data";
import { WordPicture } from "../src/games/imposter/WordPicture";
import { useImposterRoom } from "../src/games/imposter/useImposterRoom";
import { returnImposterToLobby } from "../src/games/imposter/api";
import { PlayAgainFooter } from "../src/components/PlayAgainFooter";
import { showAlert } from "../src/lib/notify";
import { useI18n } from "../src/lib/i18n";
import { Button, Card, Chip, GameIcon, Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.imposter;
const ACCENT = GAME.accent;

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

/** Server messages are stored in English; translate the known ones for Swedish players. */
const PUBLIC_MESSAGES_SV: Record<string, string> = {
  "The group found the imposter.": "Gruppen hittade impostern.",
  "Only two players remain. The imposter takes the win.": "Bara två spelare är kvar. Impostern vinner.",
  "Nobody voted. The imposter slipped through.": "Ingen röstade. Impostern slank igenom.",
  "The vote tied. The imposter survives the round.": "Röstningen blev oavgjord. Impostern överlever rundan.",
  "The group voted out the wrong player. The imposter wins.": "Gruppen röstade ut fel spelare. Impostern vinner.",
  "The round ended without an assigned imposter.": "Rundan slutade utan någon imposter.",
};

export default function ImposterResults() {
  const { language, translateError } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, playerRoles, currentVotes, loading } = useImposterRoom(roomId, playerId);

  const copy =
    language === "sv"
      ? {
          loading: "Laddar resultat",
          ended: "Spelet är slut",
          crewWins: "Laget vinner",
          imposterWins: "Impostern vinner",
          imposterWas: "Impostern var",
          category: "Kategori",
          word: "Hemligt ord",
          unknown: "OKÄND",
          table: "SLUTTABELL",
          votes: (count: number) => `${count} röst${count === 1 ? "" : "er"}`,
          you: "Du",
          out: "Ute",
          playAgain: "Spela igen",
          home: "Alla spel",
        }
      : {
          loading: "Loading Results",
          ended: "Game Ended",
          crewWins: "Crew wins",
          imposterWins: "Imposter wins",
          imposterWas: "The imposter was",
          category: "Category",
          word: "Secret word",
          unknown: "UNKNOWN",
          table: "FINAL TABLE",
          votes: (count: number) => `${count} vote${count === 1 ? "" : "s"}`,
          you: "You",
          out: "Out",
          playAgain: "Play again",
          home: "All games",
        };

  const voteTallies = useMemo(() => {
    const counts = new Map<string, number>();
    currentVotes.forEach((vote) => {
      counts.set(vote.target_player_id, (counts.get(vote.target_player_id) ?? 0) + 1);
    });
    return counts;
  }, [currentVotes]);

  const category = getCategoryById(room?.category_id ?? null);
  const imposterIds = useMemo(
    () => new Set(playerRoles.filter((entry) => entry.role === "imposter").map((entry) => entry.player_id)),
    [playerRoles],
  );
  const imposterNames = players.filter((player) => imposterIds.has(player.id)).map((player) => player.display_name);

  const topBar = <TopBar title={GAME.title} onBack={() => router.replace(GAME.href as any)} />;
  const [restarting, setRestarting] = useState(false);
  const isHost = !!room && room.host_player_id === playerId;

  // When the host restarts, the room goes back to the lobby; everyone follows.
  useEffect(() => {
    if (room?.state === "lobby" && roomId && playerId) {
      router.replace({ pathname: "/imposter-lobby", params: { roomId, playerId } });
    }
  }, [room?.state, roomId, playerId]);

  const playAgain = async () => {
    setRestarting(true);
    try {
      await returnImposterToLobby(roomId, playerId);
    } catch (error) {
      showAlert(language === "sv" ? "Kunde inte starta om" : "Couldn't restart", translateError(error));
    } finally {
      setRestarting(false);
    }
  };

  if (loading || !room) {
    return (
      <Screen centered topBar={topBar}>
        <View style={{ alignItems: "center", gap: space.md }}>
          <GameIcon source={GAME.icon} size={96} accent={ACCENT} />
          <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.loading}</Text>
        </View>
      </Screen>
    );
  }

  const winnerTone = room.winner === "crew" ? ACCENT : colors.danger;
  const message = room.public_message
    ? language === "sv"
      ? PUBLIC_MESSAGES_SV[room.public_message] ?? room.public_message
      : room.public_message
    : "";

  return (
    <Screen
      topBar={topBar}
      footer={<PlayAgainFooter isHost={isHost} onPlayAgain={playAgain} loading={restarting} accent={ACCENT} newRoomHref={GAME.href} />}
    >
      {/* Verdict */}
      <AnimatedEntrance enterKey={`results-${room.winner}`} delay={30}>
        <Card accent={winnerTone} style={{ alignItems: "center", paddingVertical: space.xl, backgroundColor: withAlpha(winnerTone, 0.08) }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(winnerTone, 0.18),
            }}
          >
            <Ionicons name={room.winner === "crew" ? "trophy" : "skull"} size={36} color={winnerTone} />
          </View>
          <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.ended}</Text>
          <Text style={[type.display, { color: winnerTone, textAlign: "center" }]}>
            {room.winner === "crew" ? copy.crewWins : copy.imposterWins}
          </Text>
          {message ? <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{message}</Text> : null}
        </Card>
      </AnimatedEntrance>

      {/* Who was the imposter + the secret word */}
      <AnimatedEntrance enterKey={`reveal-${room.id}`} delay={80}>
        <View style={{ flexDirection: "row", gap: space.md }}>
          <Card accent={colors.danger} style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.imposterWas}</Text>
            <Text adjustsFontSizeToFit numberOfLines={2} style={[type.title, { color: colors.danger }]}>
              {imposterNames.length > 0 ? imposterNames.join(", ") : copy.unknown}
            </Text>
          </Card>
          <Card accent={ACCENT} style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.word}</Text>
            <Text adjustsFontSizeToFit numberOfLines={2} style={[type.title, { color: colors.text }]}>
              {(imposterWordLabel(room.secret_prompt, language) || copy.unknown).toUpperCase()}
            </Text>
            <WordPicture word={room.secret_prompt} size={96} language={language} />
            {category ? (
              <Text style={[type.small, { color: colors.textMuted }]}>
                {copy.category}: {category.emoji} {imposterCategoryLabel(category, language)}
              </Text>
            ) : null}
          </Card>
        </View>
      </AnimatedEntrance>

      {/* Final table */}
      <View style={{ gap: space.sm }}>
        <SectionLabel>{copy.table}</SectionLabel>
        {players.map((player, index) => {
          const isImposter = imposterIds.has(player.id);
          const votes = voteTallies.get(player.id) ?? 0;
          const eliminated = player.status === "eliminated";
          return (
            <AnimatedEntrance key={player.id} enterKey={`result-${player.id}-${votes}`} delay={120 + index * 32} distance={10}>
              <View
                style={{
                  minHeight: touch.min + 8,
                  paddingVertical: space.sm,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  backgroundColor: isImposter ? withAlpha(colors.danger, 0.08) : colors.sunken,
                  borderWidth: 1,
                  borderColor: isImposter ? withAlpha(colors.danger, 0.4) : colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(isImposter ? colors.danger : ACCENT, 0.16),
                  }}
                >
                  <Text style={{ color: isImposter ? colors.danger : ACCENT, fontWeight: "900", fontSize: 16 }}>
                    {player.display_name.trim().charAt(0).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
                      {player.display_name}
                    </Text>
                    {player.id === playerId ? <Chip label={copy.you} color={colors.brand} /> : null}
                  </View>
                  <Text style={[type.small, { color: colors.textMuted }]}>
                    {copy.votes(votes)}
                    {eliminated ? ` · ${copy.out}` : ""}
                  </Text>
                </View>
                <Chip label={isImposter ? "IMPOSTER" : language === "sv" ? "LAGET" : "CREW"} color={isImposter ? colors.danger : ACCENT} />
              </View>
            </AnimatedEntrance>
          );
        })}
      </View>
      <SupportPicklo />
    </Screen>
  );
}
