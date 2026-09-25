import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useI18n } from "../src/lib/i18n";
import { showAlert } from "../src/lib/notify";
import { ShareButton } from "../src/components/ShareButton";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { GAMES } from "../src/games/catalog";
import { Button, Card, Chip, Screen, SectionLabel, TopBar } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";
import { siteUrl } from "../src/lib/site";

const GAME = GAMES.memematch;
const ACCENT = GAME.accent;

type Row = { player_id: string; points: number; name?: string };

const MEDAL = {
  gold: "#F6C85F",
  silver: "#C9D1E6",
  bronze: "#D08B5B",
};

function getMedal(place: number, language: "en" | "sv") {
  if (place === 1) return { emoji: "👑", color: MEDAL.gold, label: language === "sv" ? "1:a" : "1st" };
  if (place === 2) return { emoji: "🥈", color: MEDAL.silver, label: language === "sv" ? "2:a" : "2nd" };
  if (place === 3) return { emoji: "🥉", color: MEDAL.bronze, label: language === "sv" ? "3:a" : "3rd" };
  return { emoji: "•", color: colors.textMuted, label: language === "sv" ? `${place}:a` : `${place}th` };
}

export default function ResultsScreen() {
  const { language, t } = useI18n();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.92)).current;
  const heroLift = useRef(new Animated.Value(28)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const listLift = useRef(new Animated.Value(18)).current;
  const glowPulse = useRef(new Animated.Value(0.72)).current;

  const copy =
    language === "sv"
      ? {
          scoreError: "Fel (poäng)",
          playerError: "Fel (spelare)",
          failedLoad: "Det gick inte att ladda resultatet",
          title: "Slutresultat",
          room: "Rum",
          winner: "Vinnare",
          winnerBody: "Snyggt spelat!",
          winnerSpotlight: "Kvällens vinnare",
          pointsLabel: "poäng",
          leaderboard: "Topplista",
          loading: "Laddar",
          updating: "Uppdaterar",
          noMorePlayers: "Inga fler spelare att visa.",
          noResults: "Inga resultat att visa.",
          back: "Tillbaka till MemeMatch",
          backBody: "Starta ett nytt rum eller gå med igen",
          refresh: "Uppdatera",
          shareResult: "Dela resultatet",
        }
      : {
          scoreError: "Error (scores)",
          playerError: "Error (players)",
          failedLoad: "Failed to load results",
          title: "Final Results",
          room: "Room",
          winner: "Winner",
          winnerBody: "Great job!",
          winnerSpotlight: "Tonight's winner",
          pointsLabel: "points",
          leaderboard: "Leaderboard",
          loading: "Loading",
          updating: "Updating",
          noMorePlayers: "No more players to show.",
          noResults: "No results to show.",
          back: "Back to MemeMatch",
          backBody: "Start a new room or join again",
          refresh: "Refresh",
          shareResult: "Share the result",
        };

  const load = async () => {
    if (!roomId) return;
    setLoading(true);

    try {
      const { data: scores, error: sErr } = await supabase.from("room_scores").select("player_id,points").eq("room_id", roomId).order("points", { ascending: false });
      if (sErr) return showAlert(copy.scoreError, sErr.message);

      const { data: players, error: pErr } = await supabase.from("players").select("id,name").eq("room_id", roomId);
      if (pErr) return showAlert(copy.playerError, pErr.message);

      const scoresMap = new Map((scores ?? []).map((s: any) => [s.player_id, s.points]));
      const merged = (players ?? []).map((p: any) => ({
        player_id: p.id,
        points: scoresMap.get(p.id) ?? 0,
        name: p.name,
      }));

      merged.sort((a, b) => b.points - a.points);
      setRows(merged);
    } catch (error) {
      showAlert(copy.failedLoad, String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [roomId]);

  useEffect(() => {
    heroOpacity.setValue(0);
    heroScale.setValue(0.92);
    heroLift.setValue(28);
    listOpacity.setValue(0);
    listLift.setValue(18);
    glowPulse.setValue(0.72);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 55,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(heroLift, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(listOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(listLift, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.72,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [glowPulse, heroLift, heroOpacity, heroScale, listLift, listOpacity, rows.length]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const rest = useMemo(() => rows.slice(3), [rows]);
  const winnerName = top3[0]?.name ?? "—";
  const winnerPoints = top3[0]?.points ?? 0;

  const shareMessage =
    language === "sv"
      ? `🏆 ${winnerName} vann MemeMatch på Picklo med ${winnerPoints} poäng! Tror du att du kan slå oss?`
      : `🏆 ${winnerName} won MemeMatch on Picklo with ${winnerPoints} points! Think you can beat us?`;

  const footer = (
    <Button
      label={t("common.play_again")}
      icon="refresh"
      accent={ACCENT}
      onPress={() => router.replace(GAME.href as any)}
    />
  );

  return (
    <Screen topBar={<TopBar title={copy.title} backHref={GAME.href} />} footer={footer}>
      {/* Winner spotlight + podium */}
      <Animated.View
        style={{
          opacity: heroOpacity,
          transform: [{ translateY: heroLift }, { scale: heroScale }],
        }}
      >
        <Card accent={MEDAL.gold} style={{ alignItems: "center", paddingVertical: space.xl, overflow: "hidden" }}>
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              width: 260,
              height: 260,
              borderRadius: radius.pill,
              backgroundColor: withAlpha(MEDAL.gold, 0.14),
              opacity: glowPulse,
              transform: [{ scale: glowPulse }],
            }}
          />
          <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.winnerSpotlight}</Text>
          <Text style={{ fontSize: 44, lineHeight: 52 }}>👑</Text>
          <Text numberOfLines={1} style={[type.display, { color: colors.text, textAlign: "center" }]}>
            {winnerName}
          </Text>
          <Chip label={`${winnerPoints} ${copy.pointsLabel}`} color={MEDAL.gold} icon="trophy" />
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.winnerBody}</Text>
        </Card>

        {top3.length > 1 ? (
          <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.md, alignItems: "flex-end" }}>
            {[top3[1], top3[0], top3[2]].map((player, i) => {
              if (!player) return <View key={`empty-${i}`} style={{ flex: 1 }} />;
              const place = i === 1 ? 1 : i === 0 ? 2 : 3;
              const medal = getMedal(place, language);
              return (
                <View
                  key={player.player_id}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    gap: 2,
                    paddingVertical: place === 1 ? space.xl : place === 2 ? space.lg : space.md,
                    paddingHorizontal: space.sm,
                    borderRadius: radius.lg,
                    backgroundColor: withAlpha(medal.color, 0.1),
                    borderWidth: 1,
                    borderColor: withAlpha(medal.color, 0.45),
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{medal.emoji}</Text>
                  <Text style={{ color: medal.color, fontSize: 14, fontWeight: "900" }}>{medal.label}</Text>
                  <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text }]}>
                    {player.name}
                  </Text>
                  <Text style={[type.small, { color: colors.textMuted, fontWeight: "800" }]}>{player.points}p</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </Animated.View>

      <ShareButton label={copy.shareResult} message={shareMessage} url={siteUrl("/picklo")} accentColor={ACCENT} />
      <SupportPicklo />

      {/* Rest of the leaderboard */}
      <Animated.View style={{ opacity: listOpacity, transform: [{ translateY: listLift }], gap: space.sm }}>
        <SectionLabel
          right={
            <Button
              label={loading ? copy.loading : copy.refresh}
              onPress={load}
              variant="ghost"
              size="sm"
              icon="refresh"
              loading={loading}
            />
          }
        >
          {copy.leaderboard}
        </SectionLabel>

        {rest.length === 0 ? (
          <Text style={[type.small, { color: colors.textMuted }]}>
            {rows.length <= 3 && rows.length > 0 ? copy.noMorePlayers : copy.noResults}
          </Text>
        ) : (
          rest.map((item, index) => {
            const place = index + 4;
            return (
              <View
                key={item.player_id}
                style={{
                  minHeight: 56,
                  paddingHorizontal: space.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "900" }}>{place}</Text>
                </View>
                <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
                  {item.name}
                </Text>
                <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{item.points}p</Text>
              </View>
            );
          })
        )}
      </Animated.View>

    </Screen>
  );
}
