import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GAMES, type GameId } from "../games/catalog";
import { useI18n } from "../lib/i18n";
import { Chip, GameIcon, SectionLabel } from "../ui/components";
import { colors, radius, space } from "../ui/theme";

type RelatedGame = {
  href: string;
  title: string;
  description: string;
  accentColor: string;
};

type RelatedGamesSectionProps = {
  title: string;
  /** Games from the catalog (preferred). */
  gameIds?: GameId[];
  /** Free-form entries, for links that aren't catalog games. */
  games?: RelatedGame[];
};

const rowStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.md,
  padding: space.md,
  borderRadius: radius.lg,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
} as const;

/** Tappable game row matching the home screen list. Rendered on every platform. */
export function CatalogGameRow({ gameId, description, compact }: { gameId: GameId; description?: string; compact?: boolean }) {
  const game = GAMES[gameId];
  const { language, t } = useI18n();
  const text = description ?? game.tagline[language];
  // Link asChild drops style callbacks, so the style is static here.
  return (
    <Link href={game.href as any} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${game.title}. ${text}`} style={rowStyle}>
        <GameIcon source={game.icon} size={compact ? 48 : 64} accent={game.accent} />
        <View style={{ flex: 1, gap: compact ? 2 : 4 }}>
          <Text style={{ color: colors.text, fontSize: compact ? 16 : 18, fontWeight: "900" }}>{game.title}</Text>
          <Text numberOfLines={compact ? 1 : 3} style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
            {text}
          </Text>
          {compact ? null : <Chip label={t("common.players", { range: game.players })} color={game.accent} icon="people" />}
        </View>
        <Ionicons name="chevron-forward" size={compact ? 20 : 22} color={colors.textSubtle} />
      </Pressable>
    </Link>
  );
}

/** "More games" list for web landing pages (hidden in the native app). */
export function RelatedGamesSection({ title, gameIds = [], games = [] }: RelatedGamesSectionProps) {
  if (Platform.OS !== "web" || gameIds.length + games.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {gameIds.map((id) => (
        <CatalogGameRow key={id} gameId={id} compact />
      ))}
      {games.map((game) => (
        <Link key={game.href} href={game.href as any} asChild>
          <Pressable accessibilityRole="link" style={rowStyle}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: game.accentColor, marginHorizontal: space.xs }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{game.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{game.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
