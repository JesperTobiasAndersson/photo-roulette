import { Platform, Text, View } from "react-native";

type MarketingSectionProps = {
  eyebrow?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  faq?: Array<{ question: string; answer: string }>;
};

export function WebMarketingSection({ eyebrow, title, paragraphs, bullets, faq }: MarketingSectionProps) {
  if (Platform.OS !== "web") {
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
      {eyebrow ? (
        <Text style={{ color: "#7DD3FC", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text accessibilityRole="header" style={{ color: "#F8FAFC", fontSize: 24, fontWeight: "900", lineHeight: 32 }}>
        {title}
      </Text>
      {paragraphs.map((paragraph) => (
        <Text key={paragraph} style={{ color: "#CBD5E1", fontSize: 15, lineHeight: 24 }}>
          {paragraph}
        </Text>
      ))}
      {bullets?.map((bullet) => (
        <Text key={bullet} style={{ color: "#E2E8F0", fontSize: 14, lineHeight: 22 }}>
          {"• "}
          {bullet}
        </Text>
      ))}
      {faq?.length ? (
        <View style={{ marginTop: 4, gap: 10 }}>
          {faq.map((item) => (
            <View key={item.question} style={{ gap: 4 }}>
              <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 15 }}>{item.question}</Text>
              <Text style={{ color: "#94A3B8", fontSize: 14, lineHeight: 22 }}>{item.answer}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

