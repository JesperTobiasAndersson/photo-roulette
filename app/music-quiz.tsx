import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableWithoutFeedback, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { createMusicQuizRoom, joinMusicQuizRoom } from "../src/games/music-quiz/api";
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

export default function MusicQuizHome() {
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
            "Testa Music Quiz på Picklo: Spotify-drivna rundor, omslagsreveal och livepoäng. https://picklo.se/music-quiz",
          shareLabel: "Dela Music Quiz",
          seoTitle: "Music Quiz | Spotify-partyspel med rumskoder",
          seoDescription:
            "Spela Music Quiz på Picklo med Spotify-länkar, omslagsreveal, värdstyrd poängsättning och multiplayer med rumskoder.",
          eyebrow: "Music Quiz",
          title: "En musikquiz-landningssida som kan fånga party- och förfesttrafik",
          paragraphs: [
            "Music Quiz ger Picklo räckvidd bortom generella partyspelsökningar genom att också täcka musikquiz, Spotify quiz, låtgissning och game night-idéer.",
            "Sidan har nu tydligare copy för både användare och sökmotorer samtidigt som rumskodsflödet är kvar i fokus.",
          ],
          bullets: [
            "Stark koppling till playlist-kultur och creator-rekommendationer",
            "Lätt att dela före fester, road trips och hemmahäng",
            "Byggt för återkommande sessioner med olika värdar och kategorier",
          ],
        }
      : {
          shareMessage:
            "Try Music Quiz on Picklo: Spotify-powered party rounds with cover reveals and live scoring. https://picklo.se/music-quiz",
          shareLabel: "Share Music Quiz",
          seoTitle: "Music Quiz | Spotify Party Game With Room Codes",
          seoDescription:
            "Play Music Quiz on Picklo with Spotify links, cover reveals, host scoring and room-code multiplayer for parties and hangouts.",
          eyebrow: "Music Quiz",
          title: "A music quiz landing page that can capture party and pregame traffic",
          paragraphs: [
            "Music Quiz gives Picklo reach beyond generic party game searches by covering music quiz, Spotify quiz, song guessing game and game night ideas.",
            "The page now has clearer copy for users and search engines while keeping the room-code flow front and center.",
          ],
          bullets: [
            "Strong overlap with playlist culture and creator recommendations",
            "Easy to share before parties, road trips and house games",
            "Built for repeat sessions with different hosts and categories",
          ],
        };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Music Quiz Party Game",
    description: "Play a music quiz with Spotify links, cover reveals, room codes and host-led scoring on Picklo.",
    url: "https://picklo.se/music-quiz",
  };
  const relatedGames =
    language === "sv"
      ? [
          { href: "/trivia", title: "Trivia", description: "Ett naturligt nästa steg om gruppen vill fortsätta med quiz och fler kategorier.", accentColor: "#F97316" },
          { href: "/picklo", title: "MemeMatch", description: "Byt från musik till bilder för en mer kaotisk och kreativ runda.", accentColor: "#38BDF8" },
        ]
      : [
          { href: "/trivia", title: "Trivia", description: "A natural next stop if the group wants more quiz energy and categories.", accentColor: "#F97316" },
          { href: "/picklo", title: "MemeMatch", description: "Switch from music to images for a more chaotic and creative round.", accentColor: "#38BDF8" },
        ];

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const copy =
    language === "sv"
      ? {
          description: "Musikquiz med Spotify-länkar, omslagsreveal och hoststyrd poängsättning i realtid.",
          create: "Skapa rum",
          join: "Gå med i rum",
          name: "Ditt namn",
          code: "Rumskod",
          createRoom: "Skapa Music Quiz-rum",
          joinRoom: "Gå med i Music Quiz-rum",
          enterName: "Skriv ditt namn",
          enterNameCode: "Skriv ditt namn och rumskod",
          createFailed: "Kunde inte skapa Music Quiz-rum",
          joinFailed: "Kunde inte gå med i Music Quiz-rum",
        }
      : {
          description: "Music quiz with Spotify links, cover reveals, and host-controlled scoring in realtime.",
          create: "Create Room",
          join: "Join Room",
          name: "Your name",
          code: "Room code",
          createRoom: "Create Music Quiz Room",
          joinRoom: "Join Music Quiz Room",
          enterName: "Enter your name",
          enterNameCode: "Enter your name and room code",
          createFailed: "Could not create Music Quiz room",
          joinFailed: "Could not join Music Quiz room",
        };

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(copy.enterName);
    setLoading(true);
    try {
      const data = await createMusicQuizRoom(trimmedName);
      router.push({ pathname: "/music-quiz-room", params: { roomId: data.roomId, playerId: data.playerId } });
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
      const data = await joinMusicQuizRoom(trimmedCode, trimmedName);
      router.push({ pathname: "/music-quiz-room", params: { roomId: data.roomId, playerId: data.playerId } });
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
              borderColor: "rgba(34,197,94,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/musicquiz.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Music Quiz</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>{copy.description}</Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#4ADE80" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.create}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#4ADE80" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.join}</Text>
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
              backgroundColor: "#15803D",
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
            <ShareButton label={marketingCopy.shareLabel} message={marketingCopy.shareMessage} accentColor="#22C55E" />
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
        path="/music-quiz"
        keywords={["music quiz", "spotify quiz", "song guessing game", "party music game"]}
        structuredData={structuredData}
      />
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
