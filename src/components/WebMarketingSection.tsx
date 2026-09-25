import { Platform, Text, View } from "react-native";
import { SectionLabel } from "../ui/components";
import { colors, space, type } from "../ui/theme";

type MarketingSectionProps = {
  eyebrow?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  faq?: Array<{ question: string; answer: string }>;
  /** Colour of the bullet dots; defaults to the brand colour. */
  accentColor?: string;
  /** Heading above the FAQ list. */
  faqTitle?: string;
};

/** Indexable body copy for web landing pages (hidden in the native app). */
export function WebMarketingSection({ eyebrow, title, paragraphs, bullets, faq, accentColor = colors.brand, faqTitle }: MarketingSectionProps) {
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={{ gap: space.md }}>
      {eyebrow ? <SectionLabel>{eyebrow}</SectionLabel> : null}
      <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>
        {title}
      </Text>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25 }}>
          {paragraph}
        </Text>
      ))}
      {bullets?.length ? (
        <View style={{ gap: space.sm }}>
          {bullets.map((bullet) => (
            <View key={bullet} style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accentColor, marginTop: 9 }} />
              <Text style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24, flex: 1 }}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {faq?.length ? (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          {faqTitle ? (
            <Text accessibilityRole="header" style={[type.heading, { color: colors.text }]}>
              {faqTitle}
            </Text>
          ) : null}
          {faq.map((item) => (
            <View key={item.question} style={{ gap: space.xs }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16, lineHeight: 22 }}>{item.question}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 23 }}>{item.answer}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
