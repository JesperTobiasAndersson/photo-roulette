import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";

type TopicLink = {
  href: string;
  title: string;
  description: string;
  accentColor: string;
};

type TopicLinksSectionProps = {
  title: string;
  topics: TopicLink[];
};

export function TopicLinksSection({ title, topics }: TopicLinksSectionProps) {
  if (Platform.OS !== "web" || topics.length === 0) {
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
      {topics.map((topic) => (
        <Link key={topic.href} href={topic.href as any} asChild>
          <Pressable
            style={({ pressed }) => ({
              borderRadius: 18,
              padding: 16,
              backgroundColor: "#020617",
              borderWidth: 1,
              borderColor: pressed ? topic.accentColor : "#1F2937",
              opacity: pressed ? 0.94 : 1,
            })}
          >
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 16 }}>{topic.title}</Text>
            <Text style={{ color: "#94A3B8", marginTop: 6, lineHeight: 21 }}>{topic.description}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
