import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";

type RelatedGame = {
  href: string;
  title: string;
  description: string;
  accentColor: string;
};

type RelatedGamesSectionProps = {
  title: string;
  games: RelatedGame[];
};

export function RelatedGamesSection({ title, games }: RelatedGamesSectionProps) {
  if (Platform.OS !== "web" || games.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        marginTop: 18,
        backgroundColor: "#0B1222",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#1E293B",
        padding: 20,
        gap: 12,
      }}
    >
      <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "900" }}>{title}</Text>
      {games.map((game) => (
        <Link key={game.href} href={game.href as any} asChild>
          <Pressable
            style={({ pressed }) => ({
              borderRadius: 18,
              padding: 16,
              backgroundColor: "#020617",
              borderWidth: 1,
              borderColor: pressed ? game.accentColor : "#1F2937",
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 16 }}>{game.title}</Text>
            <Text style={{ color: "#94A3B8", marginTop: 6, lineHeight: 21 }}>{game.description}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
