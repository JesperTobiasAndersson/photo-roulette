import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionLabel } from "../ui/components";
import { colors, radius, space, withAlpha } from "../ui/theme";

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

/** Links between the web landing pages (hidden in the native app). */
export function TopicLinksSection({ title, topics }: TopicLinksSectionProps) {
  if (Platform.OS !== "web" || topics.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{title}</SectionLabel>
      {topics.map((topic) => (
        <Link key={topic.href} href={topic.href as any} asChild>
          <Pressable
            accessibilityRole="link"
            // Link asChild drops style callbacks, so the style is static here.
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              minHeight: 64,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: topic.accentColor,
                borderWidth: 3,
                borderColor: withAlpha(topic.accentColor, 0.3),
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, lineHeight: 22 }}>{topic.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>{topic.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
