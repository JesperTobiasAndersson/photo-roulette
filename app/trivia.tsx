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
import { createTriviaRoom, joinTriviaRoom } from "../src/games/trivia/api";
import { useI18n } from "../src/lib/i18n";
import { ShareButton } from "../src/components/ShareButton";
import { RelatedGamesSection } from "../src/components/RelatedGamesSection";
import { WebMarketingSection } from "../src/components/WebMarketingSection";
import { WebSeo } from "../src/components/WebSeo";

const isWeb = Platform.OS === "web";

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export default function TriviaHomeScreen() {
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
            "Spela Trivia på Picklo: kategorier, rumskoder och snabb värdstyrd poäng för nästa game night. https://picklo.se/trivia",
          shareLabel: "Dela Trivia",
          seoTitle: "Trivia | Multiplayer-quiz med rumskoder",
          seoDescription:
            "Spela Trivia på Picklo med kategorier, rumskoder, värdstyrd poängsättning och ett mobilvänligt flöde för snabba gruppsessioner.",
          eyebrow: "Trivia",
          title: "Trivia-trafik har hög intention och är värd att fånga",
          paragraphs: [
            "Trivia-sökningar konverterar ofta bra eftersom användaren redan vet vilken typ av gruppspel de vill ha. Den här sidan matchar nu den intentionen tydligare.",
            "Den hjälper också viral spridning genom att göra värdet lättare att förklara i inbjudningar, DM:s och planeringschattar.",
          ],
          bullets: [
            "Kategoridrivet upplägg som passar game nights",
            "Fungerar för klassrum, kontor och kompisgäng",
            "Tydlig rumskods-CTA för snabb multiplayer-start",
          ],
        }
      : {
          shareMessage:
            "Play Trivia on Picklo: categories, room codes and fast host-led scoring for your next game night. https://picklo.se/trivia",
          shareLabel: "Share Trivia",
          seoTitle: "Trivia | Multiplayer Quiz Game With Room Codes",
          seoDescription:
            "Play Trivia on Picklo with categories, room codes, host-controlled scoring and a mobile-friendly flow for fast group sessions.",
          eyebrow: "Trivia",
          title: "Trivia traffic is high-intent and worth capturing",
          paragraphs: [
            "Trivia searches often convert well because the user already knows what type of group game they want. This page now speaks directly to that intent with clearer copy and stronger metadata.",
            "It also helps virality by making the value proposition easier to pitch in invites, DMs and event-planning chats.",
          ],
          bullets: [
            "Category-based game night appeal",
            "Works for classrooms, offices and friend groups",
            "Clear room-code CTA for instant multiplayer setup",
          ],
        };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Trivia Party Game",
    description: "Play realtime trivia with room codes, categories and host-controlled scoring on Picklo.",
    url: "https://picklo.se/trivia",
  };
  const relatedGames =
    language === "sv"
      ? [
          { href: "/music-quiz", title: "Music Quiz", description: "Perfekt om gruppen vill fortsätta med ett quiz men byta till musik och Spotify.", accentColor: "#22C55E" },
          { href: "/mafia", title: "Mafia", description: "När ni vill gå från frågor och svar till bluff, roller och misstankar.", accentColor: "#F43F5E" },
        ]
      : [
          { href: "/music-quiz", title: "Music Quiz", description: "Perfect if the group wants to stay in quiz mode but switch to Spotify and songs.", accentColor: "#22C55E" },
          { href: "/mafia", title: "Mafia", description: "For when you want to move from questions and answers into bluffing and suspicion.", accentColor: "#F43F5E" },
        ];

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const copy =
    language === "sv"
      ? {
          description: "Trivia i realtid med rumskod, kategorier och hoststyrd rättning där alla kan spela från sina egna telefoner.",
          create: "Skapa rum",
          join: "Gå med i rum",
          name: "Ditt namn",
          code: "Rumskod",
          createRoom: "Skapa Trivia-rum",
          joinRoom: "Gå med i Trivia-rum",
          enterName: "Skriv ditt namn",
          enterNameCode: "Skriv ditt namn och rumskod",
          createFailed: "Kunde inte skapa Trivia-rum",
          joinFailed: "Kunde inte gå med i Trivia-rum",
        }
      : {
          description: "Realtime trivia with room codes, categories, and host-controlled scoring so everyone can play on their own phone.",
          create: "Create Room",
          join: "Join Room",
          name: "Your name",
          code: "Room code",
          createRoom: "Create Trivia Room",
          joinRoom: "Join Trivia Room",
          enterName: "Enter your name",
          enterNameCode: "Enter your name and room code",
          createFailed: "Could not create Trivia room",
          joinFailed: "Could not join Trivia room",
        };

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(copy.enterName);
    setLoading(true);
    try {
      const data = await createTriviaRoom(trimmedName);
      router.push({ pathname: "/trivia-room", params: { roomId: data.roomId, playerId: data.playerId } });
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
      const data = await joinTriviaRoom(trimmedCode, trimmedName);
      router.push({ pathname: "/trivia-room", params: { roomId: data.roomId, playerId: data.playerId } });
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
              borderColor: "rgba(249,115,22,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/trivia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Trivia</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>{copy.description}</Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#FB923C" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.create}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#FB923C" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.join}</Text>
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
              backgroundColor: "#EA580C",
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
            <ShareButton label={marketingCopy.shareLabel} message={marketingCopy.shareMessage} accentColor="#F97316" />
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
        path="/trivia"
        keywords={["trivia game", "multiplayer trivia", "quiz game for friends", "room code quiz"]}
        structuredData={structuredData}
      />
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
