import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../lib/i18n";
import { confirmAction } from "../../lib/notify";
import { Button, Card, Chip, SectionLabel, TextField, TopBar, goBackOr, onAccent } from "../../ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../../ui/theme";

const NAMES_KEY = "picklo_local_player_names";
const MAX_NAME = 24;

/** The names typed in last time, so the same group doesn't retype them for every game. */
export function useRememberedPlayerNames(): [string[], (names: string[]) => void] {
  const [names, setNamesRaw] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(NAMES_KEY)
      .then((saved) => {
        const parsed = saved ? (JSON.parse(saved) as unknown) : null;
        if (Array.isArray(parsed)) setNamesRaw((current) => (current.length ? current : parsed.filter((n) => typeof n === "string")));
      })
      .catch(() => undefined);
  }, []);

  const setNames = (next: string[]) => {
    setNamesRaw(next);
    AsyncStorage.setItem(NAMES_KEY, JSON.stringify(next)).catch(() => undefined);
  };

  return [names, setNames];
}

/** Add / remove the players sitting around the phone. */
export function PlayerNamesEditor({
  names,
  onChange,
  min,
  max,
  accent,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  min: number;
  max: number;
  accent: string;
}) {
  const { language } = useI18n();
  const sv = language === "sv";
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const name = draft.trim().slice(0, MAX_NAME);
    if (!name) return;
    if (names.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      setError(sv ? "Det namnet finns redan." : "That name is already in the list.");
      return;
    }
    if (names.length >= max) {
      setError(sv ? `Max ${max} spelare.` : `At most ${max} players.`);
      return;
    }
    onChange([...names, name]);
    setDraft("");
    setError(null);
  };

  return (
    <View style={{ gap: space.sm }}>
      <SectionLabel right={<Chip label={`${names.length}`} color={accent} icon="people" />}>{sv ? "Spelare" : "Players"}</SectionLabel>

      {names.map((name, index) => (
        <View
          key={name}
          style={{
            minHeight: touch.min,
            paddingLeft: space.md,
            borderRadius: radius.md,
            backgroundColor: colors.sunken,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
          }}
        >
          <Text style={{ color: accent, fontWeight: "900", width: 22 }}>{index + 1}</Text>
          <Text numberOfLines={1} style={[type.bodyStrong, { flex: 1, color: colors.text }]}>
            {name}
          </Text>
          <Pressable
            onPress={() => onChange(names.filter((entry) => entry !== name))}
            accessibilityRole="button"
            accessibilityLabel={sv ? `Ta bort ${name}` : `Remove ${name}`}
            hitSlop={6}
            style={{ width: touch.min, height: touch.min, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (error) setError(null);
            }}
            placeholder={sv ? "Spelarens namn" : "Player name"}
            maxLength={MAX_NAME}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={add}
            accent={accent}
            error={error}
          />
        </View>
        <Button label={sv ? "Lägg till" : "Add"} icon="add" accent={accent} disabled={!draft.trim()} onPress={add} style={{ minWidth: 110 }} />
      </View>

      {names.length < min ? (
        <Text style={[type.small, { color: colors.warning }]}>
          {sv ? `Minst ${min} spelare behövs (${names.length}/${min}).` : `At least ${min} players are needed (${names.length}/${min}).`}
        </Text>
      ) : null}
    </View>
  );
}

/** Full-screen hand-over: nothing secret is shown until the right person taps. */
export function PassPhoneCard({
  name,
  accent,
  hint,
  buttonLabel,
  step,
  onReady,
}: {
  name: string;
  accent: string;
  hint?: string;
  buttonLabel?: string;
  /** e.g. "2/5" */
  step?: string;
  onReady: () => void;
}) {
  const { language } = useI18n();
  const sv = language === "sv";
  return (
    <Card accent={accent} style={{ alignItems: "center", paddingVertical: space.xxl, gap: space.lg }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(accent, 0.16),
        }}
      >
        <Ionicons name="phone-portrait-outline" size={34} color={accent} />
      </View>
      {step ? <Chip label={step} color={accent} /> : null}
      <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>
        {sv ? "Ge telefonen till" : "Pass the phone to"}
      </Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: colors.text, fontSize: 36, lineHeight: 42, fontWeight: "900", textAlign: "center" }}>
        {name}
      </Text>
      <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>
        {hint ?? (sv ? "Se till att ingen annan tittar på skärmen." : "Make sure nobody else can see the screen.")}
      </Text>
      <View style={{ alignSelf: "stretch" }}>
        <Button label={buttonLabel ?? (sv ? `Jag är ${name}` : `I'm ${name}`)} icon="eye-outline" accent={accent} onPress={onReady} />
      </View>
    </Card>
  );
}

/** Pick one player from a list (votes, night targets). */
export function PlayerPicker({
  players,
  selectedId,
  onSelect,
  accent,
}: {
  players: { id: string; name: string; note?: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  accent: string;
}) {
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
      {players.map((player) => {
        const selected = selectedId === player.id;
        return (
          <Pressable
            key={player.id}
            onPress={() => onSelect(player.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              minHeight: 60,
              paddingHorizontal: space.lg,
              borderRadius: radius.lg,
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              backgroundColor: selected ? withAlpha(accent, 0.18) : colors.surface,
              borderWidth: 2,
              borderColor: selected ? accent : colors.border,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? accent : withAlpha(accent, 0.14),
              }}
            >
              <Text style={{ color: selected ? onAccent(accent) : accent, fontWeight: "900", fontSize: 16 }}>
                {player.name.trim().charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {player.name}
            </Text>
            {player.note ? <Chip label={player.note} color={colors.textMuted} /> : null}
            <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={26} color={selected ? accent : colors.textSubtle} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Big mm:ss countdown to `endsAt` (epoch ms). Shows 0:00 once time is up. */
export function Countdown({ endsAt, accent, label }: { endsAt: number; accent: string; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{label}</Text>
      <Text style={{ color: left === 0 ? colors.danger : accent, fontSize: 48, lineHeight: 54, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
        {`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
      </Text>
    </View>
  );
}

/** Ranked list of players and points, ties share a place. */
export function LocalScoreboard({ players, accent }: { players: { id: string; name: string; score: number }[]; accent: string }) {
  const ranked = players.slice().sort((a, b) => b.score - a.score);
  return (
    <View style={{ gap: space.sm }}>
      {ranked.map((player) => {
        const place = ranked.findIndex((entry) => entry.score === player.score) + 1;
        const leader = place === 1 && player.score > 0;
        return (
          <View
            key={player.id}
            style={{
              minHeight: touch.min,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: leader ? withAlpha(accent, 0.14) : colors.sunken,
              borderWidth: 1,
              borderColor: leader ? withAlpha(accent, 0.6) : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
            }}
          >
            <Text style={{ color: leader ? accent : colors.textMuted, fontWeight: "900", width: 28 }}>#{place}</Text>
            <Text numberOfLines={1} style={[type.bodyStrong, { flex: 1, color: colors.text }]}>
              {player.name}
            </Text>
            <Text style={{ color: accent, fontWeight: "900", fontSize: 18 }}>{player.score}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Top bar for one-phone games: leaving asks first, because the running game would end. */
export function LocalTopBar({ title, backHref, running, onQuit }: { title: string; backHref: string; running: boolean; onQuit: () => void }) {
  const { language } = useI18n();
  const sv = language === "sv";
  const leave = async () => {
    if (running) {
      const ok = await confirmAction(
        sv ? "Avsluta spelet?" : "End the game?",
        sv ? "Spelet på den här telefonen avslutas." : "The game on this phone will end.",
        { confirmLabel: sv ? "Avsluta" : "End game", cancelLabel: sv ? "Fortsätt spela" : "Keep playing", destructive: true }
      );
      if (!ok) return;
      onQuit();
    }
    goBackOr(backHref);
  };
  return <TopBar title={title} onBack={leave} />;
}
