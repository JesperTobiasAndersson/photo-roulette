import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Row = { player_id: string; points: number; name?: string };

const COLORS = {
  bgTop: "#0B1020",
  bgBottom: "#070A12",
  card: "rgba(255,255,255,0.08)",
  cardStrong: "rgba(255,255,255,0.12)",
  border: "rgba(255,255,255,0.14)",
  text: "#EAF0FF",
  subText: "rgba(234,240,255,0.75)",
  accent: "#7C5CFF",
  gold: "#F6C85F",
  silver: "#C9D1E6",
  bronze: "#D08B5B",
  blackBtn: "#111",
};

function medalForPlace(place: number) {
  if (place === 1) return { emoji: "👑", color: COLORS.gold, label: "1:a" };
  if (place === 2) return { emoji: "🥈", color: COLORS.silver, label: "2:a" };
  if (place === 3) return { emoji: "🥉", color: COLORS.bronze, label: "3:a" };
  return { emoji: "•", color: COLORS.subText, label: `${place}:a` };
}

export default function ResultsScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!roomId) return;
    setLoading(true);

    const { data: scores, error: sErr } = await supabase
      .from("room_scores")
      .select("player_id,points")
      .eq("room_id", roomId)
      .order("points", { ascending: false });

    if (sErr) {
      setLoading(false);
      return Alert.alert("Fel (scores)", sErr.message);
    }

    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id,name")
      .eq("room_id", roomId);

    if (pErr) {
      setLoading(false);
      return Alert.alert("Fel (players)", pErr.message);
    }

    const nameMap = new Map((players ?? []).map((p: any) => [p.id, p.name]));
    const merged = (scores ?? []).map((r: any) => ({
      player_id: r.player_id,
      points: r.points,
      name: nameMap.get(r.player_id) ?? r.player_id,
    }));

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [roomId]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);
  const rest = useMemo(() => rows.slice(3), [rows]);

  const winnerName = top3[0]?.name ?? "—";
  const winnerPoints = top3[0]?.points ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgBottom }}>
      <StatusBar barStyle="light-content" />
      {/* “Gradient” bakgrund: två lager */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280, backgroundColor: COLORS.bgTop }} />
      <View
        style={{
          position: "absolute",
          top: 70,
          left: -80,
          width: 240,
          height: 240,
          borderRadius: 999,
          backgroundColor: "rgba(124,92,255,0.22)",
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 20,
          right: -90,
          width: 260,
          height: 260,
          borderRadius: 999,
          backgroundColor: "rgba(246,200,95,0.12)",
        }}
      />

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        {/* Header */}
        <View style={{ gap: 6 }}>
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "900" }}>
            Final Results
          </Text>
          <Text style={{ color: COLORS.subText, fontSize: 13 }}>
            Room: <Text style={{ color: COLORS.text, fontWeight: "700" }}>{roomId ?? "—"}</Text>
          </Text>
        </View>

        {/* Winner card */}
        <View
          style={{
            padding: 14,
            borderRadius: 18,
            backgroundColor: COLORS.cardStrong,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ color: COLORS.subText, fontSize: 12, fontWeight: "700" }}>
            Winner
          </Text>

          <View
            style={{
              marginTop: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900" }}>
                👑 {winnerName}
              </Text>
              <Text style={{ color: COLORS.subText, marginTop: 2 }}>
                Great job!
              </Text>
            </View>

            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: "rgba(124,92,255,0.18)",
                borderWidth: 1,
                borderColor: "rgba(124,92,255,0.28)",
              }}
            >
              <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 16 }}>
                {winnerPoints}p
              </Text>
            </View>
          </View>

          {/* Podium */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            {top3.map((p, i) => {
              const place = i + 1;
              const m = medalForPlace(place);
              return (
                <View
                  key={p.player_id}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: COLORS.card,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: m.color, fontWeight: "900", fontSize: 14 }}>
                    {m.emoji} {m.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: COLORS.text,
                      fontWeight: "800",
                      marginTop: 6,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Text style={{ color: COLORS.subText, marginTop: 4, fontWeight: "800" }}>
                    {p.points}p
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* List header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "900" }}>
            Placeringar
          </Text>
          <Pressable
            onPress={load}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: pressed ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: COLORS.border,
            })}
          >
            <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 12 }}>
              {loading ? "Laddar…" : "Uppdatera"}
            </Text>
          </Pressable>
        </View>

        {/* Rest list */}
        <FlatList
          data={rest}
          keyExtractor={(x) => x.player_id}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: COLORS.card,
                borderWidth: 1,
                borderColor: COLORS.border,
                marginTop: 6,
              }}
            >
              <Text style={{ color: COLORS.subText }}>
                {rows.length <= 3 ? "Inga fler spelare att visa." : "Inga resultat att visa."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const place = index + 4; // eftersom top3 tar platser 1-3
            return (
              <View
                style={{
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: COLORS.card,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.10)",
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: "900" }}>{place}</Text>
                  </View>

                  <Text
                    numberOfLines={1}
                    style={{ color: COLORS.text, fontWeight: "800", flex: 1 }}
                  >
                    {item.name}
                  </Text>
                </View>

                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: COLORS.text, fontWeight: "900" }}>{item.points}p</Text>
                </View>
              </View>
            );
          }}
        />

        {/* CTA */}
        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            paddingVertical: 14,
            borderRadius: 18,
            backgroundColor: pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            marginBottom: 14,
          })}
        >
          <Text style={{ color: COLORS.text, textAlign: "center", fontWeight: "900", fontSize: 15 }}>
            Till startsidan
          </Text>
          <Text style={{ color: COLORS.subText, textAlign: "center", marginTop: 2, fontSize: 12 }}>
            Start a new room or join again
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
