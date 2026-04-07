import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createMafiaRoom, joinMafiaRoom } from "../src/games/mafia/api";
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

export default function MafiaHome() {
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
            "Spela Mafia på Picklo: dolda roller, live dag- och nattfaser och multiplayer med rumskod. https://picklo.se/mafia",
          shareLabel: "Dela Mafia",
          seoTitle: "Mafia | Social deduction-spel online",
          seoDescription:
            "Spela Mafia på Picklo med dolda roller, dag- och nattfaser, rumskoder och snabb mobilanpassad setup för grupper.",
          eyebrow: "Mafia",
          title: "Mafia fångar tydlig sökintention kring social deduction",
          paragraphs: [
            "Mafia ger Picklo en stark landningssida för personer som söker efter online Mafia, hidden role-spel och social deduction-partyspel.",
            "Sidan behåller ett enkelt join-flow men får nu tydligare beskrivningar och metadata för bättre upptäckbarhet och delning.",
          ],
          bullets: [
            "Dolda roller och bluff är enkla hooks att förstå direkt",
            "Rumskoder gör det lätt att bjuda in via Discord, Snapchat och gruppchattar",
            "Hög replay value hjälper delad trafik att komma tillbaka",
          ],
        }
      : {
          shareMessage:
            "Play Mafia on Picklo: hidden roles, live day and night phases and room-code multiplayer. https://picklo.se/mafia",
          shareLabel: "Share Mafia",
          seoTitle: "Mafia | Online Social Deduction Party Game",
          seoDescription:
            "Play Mafia on Picklo with hidden roles, day and night rounds, room codes and fast mobile-friendly setup for groups.",
          eyebrow: "Mafia",
          title: "Mafia targets high-intent social deduction traffic",
          paragraphs: [
            "Mafia gives Picklo a strong landing page for users searching for online Mafia, hidden role games and social deduction party games.",
            "The page still keeps the join flow simple, but now adds the descriptive copy and metadata needed for better discovery and sharing.",
          ],
          bullets: [
            "Hidden roles and bluffing are instantly understandable hooks",
            "Room codes make invites easy across Discord, Snapchat and group chats",
            "Replayable enough to keep referral traffic coming back",
          ],
        };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Mafia Party Game",
    description: "Play Mafia with hidden roles, live phase updates, room codes and fast group setup on Picklo.",
    url: "https://picklo.se/mafia",
  };
  const relatedGames =
    language === "sv"
      ? [
          { href: "/imposter", title: "Imposter", description: "Kortare och snabbare bluffrundor med ett delat hemligt ord.", accentColor: "#F59E0B" },
          { href: "/trivia", title: "Trivia", description: "För grupper som vill byta från bluff till quiz och poängjakt.", accentColor: "#F97316" },
        ]
      : [
          { href: "/imposter", title: "Imposter", description: "Shorter and faster bluff rounds built around a shared secret word.", accentColor: "#F59E0B" },
          { href: "/trivia", title: "Trivia", description: "For groups that want to switch from bluffing to quiz competition.", accentColor: "#F97316" },
        ];

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const copy =
    language === "sv"
      ? {
          description: "Partyspel utan spelledare med livefaser och privatkänsla i mafiasamordningen.",
          create: "Skapa rum",
          join: "Gå med i rum",
          name: "Ditt namn",
          code: "Rumskod",
          createRoom: "Skapa Mafia-rum",
          joinRoom: "Gå med i Mafia-rum",
          enterName: "Skriv ditt namn",
          noRoomResponse: "Inget rumsvar mottogs",
          createFailed: "Kunde inte skapa rum",
          enterNameCode: "Skriv ditt namn och rumskod",
          joinFailed: "Kunde inte gå med i rum",
        }
      : {
          description: "Narratorless party game with live phase updates and private-feeling mafia coordination.",
          create: "Create Room",
          join: "Join Room",
          name: "Your name",
          code: "Room code",
          createRoom: "Create Mafia room",
          joinRoom: "Join Mafia room",
          enterName: "Enter your name",
          noRoomResponse: "No room response received",
          createFailed: "Could not create room",
          enterNameCode: "Enter your name and room code",
          joinFailed: "Could not join room",
        };

  const goCreate = async () => {
    if (!trimmedName) return Alert.alert(copy.enterName);
    setLoading(true);
    try {
      const data = await createMafiaRoom(trimmedName);
      if (!data) throw new Error(copy.noRoomResponse);
      router.push({ pathname: "/mafia-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (err) {
      Alert.alert(copy.createFailed, String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  };

  const goJoin = async () => {
    if (!trimmedName || !trimmedCode) return Alert.alert(copy.enterNameCode);
    setLoading(true);
    try {
      const data = await joinMafiaRoom(trimmedCode, trimmedName);
      if (!data) throw new Error(copy.noRoomResponse);
      router.push({ pathname: "/mafia-lobby", params: { roomId: data.roomId, playerId: data.playerId } });
    } catch (err) {
      Alert.alert(copy.joinFailed, String((err as Error)?.message ?? err));
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
              borderColor: "rgba(244,63,94,0.35)",
              backgroundColor: "#111827",
            }}
          >
            <Image source={require("../assets/mafia.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </View>
          <Text style={{ color: "white", fontSize: 40, fontWeight: "900", marginTop: 14 }}>Mafia</Text>
          <Text style={{ color: "#94A3B8", fontSize: 15, lineHeight: 24, textAlign: "center", marginTop: 8 }}>
            {copy.description}
          </Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 22, padding: 20, borderWidth: 1, borderColor: "#1E293B", gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Pressable onPress={() => setMode("create")} disabled={loading}>
              <Text style={{ color: mode === "create" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.create}</Text>
            </Pressable>
            <Text style={{ color: "#475569" }}>|</Text>
            <Pressable onPress={() => setMode("join")} disabled={loading}>
              <Text style={{ color: mode === "join" ? "#FDA4AF" : "#94A3B8", fontWeight: "900", textTransform: "uppercase", fontSize: 14 }}>{copy.join}</Text>
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
              backgroundColor: "#7F1D1D",
              opacity: loading ? 0.6 : pressed ? 0.92 : 1,
              flexDirection: "row",
              gap: 10,
            })}
          >
            {loading ? <ActivityIndicator color="white" /> : null}
            <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", fontSize: 18 }}>
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
            <ShareButton label={marketingCopy.shareLabel} message={marketingCopy.shareMessage} accentColor="#F43F5E" />
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
        path="/mafia"
        keywords={["mafia game online", "social deduction game", "party game with hidden roles", "group bluffing game"]}
        structuredData={structuredData}
      />
      {isWeb ? content : <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{content}</TouchableWithoutFeedback>}
    </KeyboardAvoidingView>
  );
}
