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
import { createImposterRoom, joinImposterRoom } from "../src/games/imposter/api";
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

export default function ImposterHome() {
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
            "Spela Imposter på Picklo: en dold bluffare, ett hemligt ord och direkt kaos med rumskod. https://picklo.se/imposter",
          shareLabel: "Dela Imposter",
          seoTitle: "Imposter | Partyspel med hemligt ord för vänner",
          seoDescription:
            "Spela Imposter på Picklo: en dold bluffare, ett delat ord, snabb rumskods-setup och perfekt energi för grupper, fester och häng.",
          eyebrow: "Imposter",
          title: "Ett social deduction-spel som är lätt att pitcha och lätt att dela",
          paragraphs: [
            "Imposter fungerar bra för viral spridning eftersom konceptet är tydligt i en mening: alla får samma ord utom en spelare som måste improvisera.",
            "Det hjälper sidan att fånga sökintention kring imposter game, bluffspel, icebreakers för vänner och social deduction på mobilen.",
          ],
          bullets: [
            "Enkel hook för creators och korta klipp",
            "Låg friktion tack vare rumskods-join",
            "Stark replay value för kompisgäng och studentevent",
          ],
        }
      : {
          shareMessage:
            "Play Imposter on Picklo: one hidden fake, one secret word and instant room-code chaos. https://picklo.se/imposter",
          shareLabel: "Share Imposter",
          seoTitle: "Imposter | Hidden Word Party Game for Friends",
          seoDescription:
            "Play Imposter on Picklo: one hidden fake, one shared word, fast room-code setup and great energy for groups, parties and hangouts.",
          eyebrow: "Imposter",
          title: "A social deduction game that is easy to pitch and easy to share",
          paragraphs: [
            "Imposter works well for viral growth because the concept is sticky in one line: everyone gets the same word except one player who has to improvise.",
            "That helps this page target intent around imposter game, bluffing party game, icebreaker for friends and social deduction game for mobile.",
          ],
          bullets: [
            "Simple hook for creators and short-form clips",
            "Low setup friction with room-code join flow",
            "Strong replay value for friend groups and student events",
          ],
        };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Imposter Party Game",
    description: "Play Imposter with room codes, hidden roles and one secret word that almost everyone shares.",
    url: "https://picklo.se/imposter",
  };
  const relatedGames =
    language === "sv"
      ? [
          { href: "/mafia", title: "Mafia", description: "Ett djupare social deduction-spel med fler roller och längre rundor.", accentColor: "#F43F5E" },
          { href: "/picklo", title: "MemeMatch", description: "Ett mer lättsamt partyspel med bilder, röstning och inside jokes.", accentColor: "#38BDF8" },
        ]
      : [
          { href: "/mafia", title: "Mafia", description: "A deeper social deduction game with more roles and longer rounds.", accentColor: "#F43F5E" },
          { href: "/picklo", title: "MemeMatch", description: "A lighter party game with photos, voting, and inside jokes.", accentColor: "#38BDF8" },
        ];

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const copy =
    language === "sv"
      ? {
          description: "Partyspel med rumskod där alla får samma ord utom en dold imposter.",
          create: "Skapa rum",
          join: "Gå med i rum",
          name: "Ditt namn",
          code: "Rumskod",
          createRoom: "Skapa Imposter-rum",
          joinRoom: "Gå med i Imposter-rum",
          enterName: "Skriv ditt namn",
          createFailed: "Kunde inte skapa rum",
          enterNameCode: "Skriv ditt namn och rumskod",
          joinFailed: "Kunde inte gå med i rum",
        }
      : {
          description: "Room-code party game where everyone gets the same word except one hidden imposter.",
          create: "Create Room",
          join: "Join Room",
          name: "Your name",
          code: "Room code",
          createRoom: "Create Imposter Room",
          joinRoom: "Join Imposter Room",
          enterName: "Enter your name",
          createFailed: "Could not create room",
          enterNameCode: "Enter your name and room code",
          joinFailed: "Could not join room",
        };

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(copy.enterName);
    setLoading(true);
    try {
      const data = await createImposterRoom(trimmedName);
      router.push({ pathname: "/imposter-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(copy.createFailed, String((error as Error)?.message ?? error));
    } finally {
      setLoading(false);
    }
  };

  const goJoin = async () => {
    if (!trimmedName || !trimmedCode) return Alert.alert(copy.enterNameCode);
    setLoading(true);
    try {
      const data = await joinImposterRoom(trimmedCode, trimmedName);
      router.push({ pathname: "/imposter-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (error) {
      Alert.alert(copy.joinFailed, String((error as Error)?.message ?? error));
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
        <View style={{ alignItems: "center", marginBottom: 18 }}>
          <View
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(245,158,11,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/imposter.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Imposter</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>
            {copy.description}
          </Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#FCD34D" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.create}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#FCD34D" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.join}</Text>
            </Pressable>
          </View>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={copy.name}
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
              placeholder={copy.code}
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
              backgroundColor: "#D97706",
              opacity: loading ? 0.6 : pressed ? 0.92 : 1,
              flexDirection: "row",
              gap: 10,
            })}
          >
              {loading ? <ActivityIndicator color="white" /> : null}
              <Text style={{ color: "white", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>
              {mode === "create" ? copy.createRoom : copy.joinRoom}
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
            <ShareButton label={marketingCopy.shareLabel} message={marketingCopy.shareMessage} accentColor="#F59E0B" />
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
        path="/imposter"
        keywords={["imposter game", "hidden word game", "bluffing party game", "social deduction game"]}
        structuredData={structuredData}
      />
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
