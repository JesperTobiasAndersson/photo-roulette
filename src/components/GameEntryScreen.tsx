import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GAMES, type GameId } from "../games/catalog";
import { useI18n } from "../lib/i18n";
import { useRememberedName } from "../lib/playerName";
import { ensureSession } from "../lib/supabase";
import { Button, Card, Chip, GameIcon, Screen, SectionLabel, SegmentedControl, TextField, TopBar } from "../ui/components";
import { colors, radius, space, type, withAlpha } from "../ui/theme";
import { ShareButton } from "./ShareButton";
import { WebSeo } from "./WebSeo";
import { siteUrl } from "../lib/site";

type RoomTarget = { pathname: string; params: Record<string, string> };

type GameEntryScreenProps = {
  gameId: GameId;
  createRoom: (name: string) => Promise<RoomTarget>;
  joinRoom: (code: string, name: string) => Promise<RoomTarget>;
  /** Small print under the form (e.g. image-usage consent). */
  notice?: string;
};

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

/** Maps raw backend errors to something a player can act on. */
function friendlyError(error: unknown, language: "en" | "sv", mode: "create" | "join") {
  const raw = String((error as Error)?.message ?? error ?? "");
  const sv = language === "sv";
  if (/ROOM_NOT_FOUND|0 rows|no rows|multiple \(or no\)|PGRST116/i.test(raw)) {
    return sv ? "Hittade inget rum med den koden. Dubbelkolla och försök igen." : "No room with that code. Double-check it and try again.";
  }
  if (/GAME_ALREADY_STARTED/.test(raw)) {
    return sv ? "Spelet har redan börjat. Be värden starta ett nytt rum." : "That game has already started. Ask the host to start a new room.";
  }
  if (/GAME_ALREADY_ENDED/.test(raw)) {
    return sv ? "Det spelet är redan slut. Be värden starta ett nytt rum." : "That game has already ended. Ask the host to start a new room.";
  }
  if (/ROOM_FULL/.test(raw)) {
    return sv ? "Rummet är fullt." : "That room is full.";
  }
  if (/anonymous sign-ins are disabled/i.test(raw)) {
    // Server misconfiguration (see SETUP.md), not something the player can fix.
    return sv ? "Picklo kan inte ansluta just nu. Försök igen om en stund." : "Picklo can't connect right now. Please try again in a moment.";
  }
  if (/network|fetch|failed to fetch/i.test(raw)) {
    return language === "sv" ? "Ingen anslutning. Kolla internet och försök igen." : "No connection. Check your internet and try again.";
  }
  const prefix =
    mode === "create"
      ? language === "sv" ? "Kunde inte skapa rummet." : "Couldn't create the room."
      : language === "sv" ? "Kunde inte gå med." : "Couldn't join the room.";
  return raw ? `${prefix} (${raw})` : prefix;
}

export function GameEntryScreen({ gameId, createRoom, joinRoom, notice }: GameEntryScreenProps) {
  const game = GAMES[gameId];
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const codeFromUrl = asString(params.code).trim().toUpperCase();

  const [name, setName, rememberName] = useRememberedName();
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"create" | "join">(codeFromUrl ? "join" : "create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On web the query string can arrive after the first render; switch to "join" once it does.
  useEffect(() => {
    if (!codeFromUrl) return;
    setCode(codeFromUrl);
    setMode("join");
  }, [codeFromUrl]);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);
  const accent = game.accent;

  const submit = async () => {
    if (!trimmedName) return setError(t("common.enter_name"));
    if (mode === "join" && !trimmedCode) return setError(t("common.enter_code"));
    setError(null);
    setLoading(true);
    try {
      await ensureSession();
      const target = mode === "create" ? await createRoom(trimmedName) : await joinRoom(trimmedCode, trimmedName);
      rememberName();
      router.push(target as any);
    } catch (err) {
      console.error(`${game.id} ${mode} failed`, err);
      setError(friendlyError(err, language, mode));
    } finally {
      setLoading(false);
    }
  };

  const shareMessage =
    language === "sv"
      ? `Spela ${game.title} med mig på Picklo! ${game.tagline.sv}`
      : `Play ${game.title} with me on Picklo! ${game.tagline.en}`;

  return (
    <Screen topBar={<TopBar backHref="/" />}>
      <WebSeo
        title={game.seoTitle[language]}
        description={game.seoDescription[language]}
        lang={language}
        path={game.href}
        keywords={game.keywords}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${game.title} – Picklo`,
          description: game.seoDescription.en,
          url: siteUrl(game.href),
        }}
      />

      {/* Hero */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <GameIcon source={game.icon} size={84} accent={accent} />
        <View style={{ flex: 1, gap: 6 }}>
          <Text accessibilityRole="header" style={[type.display, { color: colors.text }]}>
            {game.title}
          </Text>
          <Chip label={t("common.players", { range: game.players })} color={accent} icon="people" />
        </View>
      </View>
      <Text style={[type.body, { color: colors.textSecondary, marginTop: -space.xs }]}>{game.tagline[language]}</Text>

      {/* Create / join */}
      <Card accent={accent}>
        <SegmentedControl
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError(null);
          }}
          accent={accent}
          disabled={loading}
          options={[
            { value: "create", label: t("common.new_room") },
            { value: "join", label: t("common.join_room") },
          ]}
        />

        <TextField
          label={t("common.name")}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError(null);
          }}
          placeholder={t("common.name_placeholder")}
          autoComplete="nickname"
          maxLength={24}
          returnKeyType={mode === "join" ? "next" : "go"}
          onSubmitEditing={mode === "create" ? submit : undefined}
          accent={accent}
        />

        {mode === "join" ? (
          <TextField
            code
            label={t("common.room_code")}
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="ABCD"
            returnKeyType="go"
            onSubmitEditing={submit}
            accent={accent}
          />
        ) : null}

        {error ? (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.md,
              backgroundColor: withAlpha(colors.danger, 0.12),
            }}
          >
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={{ color: colors.danger, flex: 1, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>{error}</Text>
          </View>
        ) : null}

        <Button
          label={mode === "create" ? t("common.create_room") : t("common.join_room")}
          icon={mode === "create" ? "add-circle" : "enter"}
          accent={accent}
          loading={loading}
          disabled={!trimmedName || (mode === "join" && !trimmedCode)}
          onPress={submit}
        />

        {notice ? <Text style={{ color: colors.textSubtle, fontSize: 13, lineHeight: 18, textAlign: "center" }}>{notice}</Text> : null}
      </Card>

      {/* How to play */}
      <View style={{ gap: space.md }}>
        <SectionLabel>{language === "sv" ? "Så spelar ni" : "How to play"}</SectionLabel>
        {game.howTo[language].map((step, index) => (
          <View key={step} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(accent, 0.16),
              }}
            >
              <Text style={{ color: accent, fontWeight: "900" }}>{index + 1}</Text>
            </View>
            <Text style={[type.body, { color: colors.textSecondary, flex: 1, fontSize: 15, lineHeight: 22 }]}>{step}</Text>
          </View>
        ))}
      </View>

      <ShareButton label={t("common.invite")} message={shareMessage} url={siteUrl(game.href)} accentColor={accent} />

      {/* About (also the indexable body text on the web) */}
      <View style={{ gap: space.sm }}>
        <SectionLabel>{language === "sv" ? `Om ${game.title}` : `About ${game.title}`}</SectionLabel>
        {game.about[language].map((paragraph) => (
          <Text key={paragraph} style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>
            {paragraph}
          </Text>
        ))}
      </View>

      {/* More games */}
      <View style={{ gap: space.sm }}>
        <SectionLabel>{t("common.more_games")}</SectionLabel>
        {game.related.map((id) => (
          <RelatedGameRow key={id} gameId={id} />
        ))}
      </View>
    </Screen>
  );
}

function RelatedGameRow({ gameId }: { gameId: GameId }) {
  const game = GAMES[gameId];
  const { language } = useI18n();
  return (
    <Link href={game.href as any} asChild>
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.md,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <GameIcon source={game.icon} size={48} accent={game.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{game.title}</Text>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 14 }}>
            {game.tagline[language]}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>
    </Link>
  );
}

