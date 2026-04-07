import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { createChicagoRoom, joinChicagoRoom } from "../src/games/chicago/api";
import { useI18n } from "../src/lib/i18n";
import { ShareButton } from "../src/components/ShareButton";
import { RelatedGamesSection } from "../src/components/RelatedGamesSection";
import { WebMarketingSection } from "../src/components/WebMarketingSection";
import { WebSeo } from "../src/components/WebSeo";

const isWeb = Platform.OS === "web";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function ChicagoHome() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const codeFromUrl = asString(params.code).trim().toUpperCase();
  const [name, setName] = useState("");
  const [code, setCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<"create" | "join">(codeFromUrl ? "join" : "create");
  const [loading, setLoading] = useState(false);
  const marketingCopy =
    language === "sv"
      ? {
          shareMessage:
            "Spela Chicago på Picklo: pokerpoäng, stickspel och smarta CHICAGO-utrop i ett multiplayer-kortspel. https://picklo.se/chicago",
          shareLabel: "Dela Chicago",
          seoTitle: "Chicago | Multiplayer-kortspel med pokerpoäng och stickspel",
          seoDescription:
            "Spela Chicago på Picklo med byten, pokerpoäng, stickspel, rumskoder och smart risk-reward för grupper som vill ha mer strategi.",
          eyebrow: "Chicago",
          title: "Ett kortspel för grupper som vill ha mer taktik än ren tur",
          paragraphs: [
            "Chicago ger Picklo en tydligare plats för spelare som söker kortspel för vänner, strategiska partyspel och multiplayer-spel med lite mer djup än vanliga icebreakers.",
            "Det blandar pokerpoäng, byten och stickspel i ett format som är lätt att starta men svårt att bemästra, vilket gör sidan relevant både för sök och för delning mellan vänner.",
          ],
          bullets: [
            "Bra mix av strategi, risk och social spänning",
            "Rumskoder gör det enkelt att dra in ett helt bord snabbt",
            "CHICAGO-utrop skapar tydliga höjdpunkter som folk minns och pratar om",
          ],
        }
      : {
          shareMessage:
            "Play Chicago on Picklo: poker scoring, trick-taking and bold CHICAGO calls in one multiplayer card game. https://picklo.se/chicago",
          shareLabel: "Share Chicago",
          seoTitle: "Chicago | Multiplayer Card Game With Poker Scoring and Trick-Taking",
          seoDescription:
            "Play Chicago on Picklo with draw phases, poker scoring, trick-taking, room codes and high-risk CHICAGO calls for groups that want more strategy.",
          eyebrow: "Chicago",
          title: "A card game for groups that want more strategy than pure luck",
          paragraphs: [
            "Chicago gives Picklo a stronger landing page for people searching for card games for friends, strategy party games and multiplayer games with more depth.",
            "It combines poker scoring, draw phases and trick-taking in a format that is easy to start but hard to master, which makes it strong for both search and sharing.",
          ],
          bullets: [
            "Strong mix of strategy, risk and social tension",
            "Room codes make it easy to pull a full table together fast",
            "CHICAGO calls create memorable swing moments people talk about after the round",
          ],
        };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Chicago Card Game",
    description:
      "Play Chicago with room codes, poker scoring, trick-taking and bold CHICAGO declarations on Picklo.",
    url: "https://picklo.se/chicago",
  };
  const relatedGames =
    language === "sv"
      ? [
          { href: "/trivia", title: "Trivia", description: "Bra nästa val om gruppen vill byta från kortstrategi till quiz och poängjakt.", accentColor: "#F97316" },
          { href: "/mafia", title: "Mafia", description: "För ett socialt spel med mer bluff och mindre kortlogik.", accentColor: "#F43F5E" },
        ]
      : [
          { href: "/trivia", title: "Trivia", description: "A good next choice if the group wants to switch from card strategy to quiz competition.", accentColor: "#F97316" },
          { href: "/mafia", title: "Mafia", description: "For a more social game with bluffing instead of card logic.", accentColor: "#F43F5E" },
        ];

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(t("alert.enter_name"));
    setLoading(true);
    try {
      const data = await createChicagoRoom(trimmedName);
      router.push({ pathname: "/chicago-room", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(t("alert.create_failed"), String((error as Error)?.message ?? error));
    } finally {
      setLoading(false);
    }
  };

  const goJoin = async () => {
    if (!trimmedName || !trimmedCode) return Alert.alert(t("alert.enter_name_code"));
    setLoading(true);
    try {
      const data = await joinChicagoRoom(trimmedCode, trimmedName);
      router.push({ pathname: "/chicago-room", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(t("alert.join_failed"), String((error as Error)?.message ?? error));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        paddingTop: isWeb ? 32 : 20,
        paddingBottom: 32,
      }}
    >
      <View style={{ width: "100%", maxWidth: 430 }}>
        <StatusBar style="light" />
        <View style={{ alignItems: "center", marginBottom: 18, gap: 10 }}>
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(56,189,248,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/chicago.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900" }}>Chicago</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center" }}>
            {t("chicago.home.description")}
          </Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#7DD3FC" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{t("chicago.mode.create")}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#7DD3FC" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{t("chicago.mode.join")}</Text>
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("chicago.input.name")}
            placeholderTextColor="#64748B"
            style={{
              height: 56,
              borderRadius: 16,
              paddingHorizontal: 18,
              fontSize: 16,
              backgroundColor: "#020617",
              borderWidth: 1,
              borderColor: "#1F2937",
              color: "white",
              fontWeight: "700",
              ...(isWeb ? ({ outlineStyle: "none", boxSizing: "border-box" } as any) : null),
            }}
          />

          {mode === "join" ? (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={t("chicago.input.code")}
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              style={{
                height: 56,
                borderRadius: 16,
                paddingHorizontal: 18,
                fontSize: 18,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#1F2937",
                color: "white",
                fontWeight: "900",
                letterSpacing: 3,
                textAlign: "center",
                ...(isWeb ? ({ outlineStyle: "none", boxSizing: "border-box" } as any) : null),
              }}
            />
          ) : null}

          <Pressable
            onPress={mode === "create" ? goCreate : goJoin}
            disabled={loading || !trimmedName || (mode === "join" && !trimmedCode)}
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0369A1",
              opacity: loading ? 0.6 : pressed ? 0.92 : 1,
              flexDirection: "row",
              gap: 10,
            })}
          >
            {loading ? <ActivityIndicator color="white" /> : null}
            <Text style={{ color: "white", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>
              {mode === "create" ? t("chicago.button.create") : t("chicago.button.join")}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            marginTop: 14,
            height: 50,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#111827",
            borderWidth: 1,
            borderColor: "#1F2937",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{t("common.back_to_games")}</Text>
        </Pressable>

        {isWeb ? (
          <View style={{ gap: 18, marginTop: 18 }}>
            <ShareButton label={marketingCopy.shareLabel} message={marketingCopy.shareMessage} accentColor="#38BDF8" />
            <WebMarketingSection
              eyebrow={marketingCopy.eyebrow}
              title={marketingCopy.title}
              paragraphs={marketingCopy.paragraphs}
              bullets={marketingCopy.bullets}
            />
            <RelatedGamesSection title={language === "sv" ? "Fler spel att testa" : "More Games To Try"} games={relatedGames} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "#070B14" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <WebSeo
        title={marketingCopy.seoTitle}
        description={marketingCopy.seoDescription}
        lang={language}
        path="/chicago"
        keywords={["chicago card game", "multiplayer card game", "trick-taking game", "poker scoring game", "strategy card game"]}
        structuredData={structuredData}
      />
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
