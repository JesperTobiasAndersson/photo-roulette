import React, { useEffect, useMemo, useRef, useState } from "react";
import { getRandomStatement } from "../src/constants/statements";
import {
  View,
  Text,
  Pressable,
  Alert,
  FlatList,
  Animated,
  Easing,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { StatusBar } from "expo-status-bar";
import { getIsPremium } from "../src/lib/premium";

type Submission = { id: string; player_id: string; image_path: string };
type PlayerImage = { id: string; image_path: string };

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default function RoundScreen() {
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const roundId = asString(params.roundId);

  const popAnim = useRef(new Animated.Value(0)).current;

  const [playerCount, setPlayerCount] = useState<number>(0);
  const autoAdvanceRef = useRef(false);

  const [isPremiumUser, setIsPremiumUser] = useState(false);
  useEffect(() => {
    (async () => {
      const v = await getIsPremium();
      setIsPremiumUser(v);
    })();
  }, []);

  const lastAutoNextRoundFromRoundIdRef = useRef<string | null>(null);

  const [statement, setStatement] = useState("");
  const [status, setStatus] = useState<"collecting" | "voting" | "done">("collecting");
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [hostId, setHostId] = useState<string>("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmissionId, setMySubmissionId] = useState<string | null>(null);

  const [myVoteSubmissionId, setMyVoteSubmissionId] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  const [availableImages, setAvailableImages] = useState<PlayerImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const lastSeenRoundIdRef = useRef<string | null>(null);
  const skipNextInsertNavRef = useRef<string | null>(null);
  const advancingRoundRef = useRef(false);
  const [advancingRound, setAdvancingRound] = useState(false);

  const isHost = !!(playerId && hostId && playerId === hostId);

  const publicUrlFor = (path: string) => {
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const tryAutoAdvance = async () => {
    if (!roundId) return;
    if (autoAdvanceRef.current) return;
    autoAdvanceRef.current = true;

    try {
      const { data, error } = await supabase.rpc("advance_round_if_ready", { p_round_id: roundId });
      console.log("advance_round_if_ready =>", { data, error });
    } finally {
      setTimeout(() => {
        autoAdvanceRef.current = false;
      }, 250);
    }
  };

  const loadPlayerCount = async () => {
    if (!roomId) return;
    const { count, error } = await supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    if (!error) setPlayerCount(count ?? 0);
  };

  const loadHost = async () => {
    if (!roomId) return;
    const { data, error } = await supabase
      .from("rooms")
      .select("host_player_id")
      .eq("id", roomId)
      .single();
    if (!error) setHostId(data.host_player_id ?? "");
  };

  const loadRound = async () => {
    if (!roundId) return;
    const { data, error } = await supabase
      .from("rounds")
      .select("statement,status,round_number")
      .eq("id", roundId)
      .single();

    if (error) return Alert.alert("Error (round)", error.message);

    setStatement(data.statement ?? "");
    setStatus(data.status);
    setRoundNumber(data.round_number ?? 0);
  };

  const loadSubmissions = async () => {
    if (!roundId) return;
    const { data, error } = await supabase
      .from("submissions")
      .select("id,player_id,image_path")
      .eq("round_id", roundId);

    if (error) return Alert.alert("Error (subs)", error.message);

    const list = data ?? [];
    setSubmissions(list);

    const mine = list.find((s) => s.player_id === playerId);
    setMySubmissionId(mine?.id ?? null);
  };

  const loadMyVote = async () => {
    if (!roundId || !playerId) return;
    const { data, error } = await supabase
      .from("votes")
      .select("submission_id")
      .eq("round_id", roundId)
      .eq("voter_player_id", playerId)
      .maybeSingle();

    if (error) return Alert.alert("Error (vote)", error.message);
    setMyVoteSubmissionId(data?.submission_id ?? null);
  };

  const loadVoteCounts = async () => {
    if (!roundId) return;

    const { data, error } = await supabase.from("votes").select("submission_id").eq("round_id", roundId);
    if (error) return Alert.alert("Error (votes)", error.message);

    const counts: Record<string, number> = {};
    for (const v of data ?? []) {
      counts[v.submission_id] = (counts[v.submission_id] ?? 0) + 1;
    }
    setVoteCounts(counts);
  };

  const loadAvailableImages = async () => {
    if (!roomId || !playerId) return;

    const { data, error } = await supabase
      .from("player_images")
      .select("id,image_path")
      .eq("room_id", roomId)
      .eq("player_id", playerId)
      .is("used_in_round_id", null)
      .order("created_at", { ascending: true });

    if (error) return Alert.alert("Error (hand)", error.message);
    setAvailableImages(data ?? []);
  };

  // ✅ POP-animation när statement ändras
  useEffect(() => {
    if (!statement) return;

    popAnim.setValue(0);
    Animated.timing(popAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [statement]);

  // ✅ reset only the nav guard when round changes
  useEffect(() => {
    lastSeenRoundIdRef.current = null;
  }, [roundId]);

  // Prefetch för “handen” (collecting)
  useEffect(() => {
    if (!availableImages.length) return;
    availableImages.forEach((img) => {
      const uri = publicUrlFor(img.image_path);
      uri;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableImages]);

// ✅ När rundan är "done": show winner briefly then auto-next (free users stop after 5)
const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);

useEffect(() => {
  if (!roomId || !playerId || !roundId) return;
  if (status !== "done") return;

  if (lastAutoNextRoundFromRoundIdRef.current === roundId) return;
  lastAutoNextRoundFromRoundIdRef.current = roundId;

  (async () => {
    // Gratis-limit: efter 5 rundor -> direkt till resultat
    if (!isPremiumUser && roundNumber >= 5) {
      router.replace({ pathname: "/results", params: { roomId } });
      return;
    }

    // show winner image overlay for a moment
    setShowWinnerOverlay(true);
    setTimeout(async () => {
      setShowWinnerOverlay(false);
      await nextRound();
    }, 3000);
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [status, roundId, roundNumber, isPremiumUser, roomId, playerId]);

  // Init + realtime: round/submissions/votes/hand
  useEffect(() => {
    if (!roomId || !playerId || !roundId) return;

    let isMounted = true;

    (async () => {
      await loadHost();
      await loadRound();
      await loadSubmissions();
      await loadMyVote();
      await loadVoteCounts();
      await loadAvailableImages();
      await loadPlayerCount();

      tryAutoAdvance();
    })();

    const roundChannel = supabase
      .channel(`round-${roundId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${roundId}` },
        async () => {
          if (!isMounted) return;
          await loadRound();
          tryAutoAdvance();
        }
      )
      .subscribe();

    const subsChannel = supabase
      .channel(`subs-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `round_id=eq.${roundId}` },
        async () => {
          if (!isMounted) return;
          await loadSubmissions();
          tryAutoAdvance();
        }
      )
      .subscribe();

    const votesChannel = supabase
      .channel(`votes-${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `round_id=eq.${roundId}` },
        async () => {
          if (!isMounted) return;
          await loadMyVote();
          await loadVoteCounts();
          tryAutoAdvance();
        }
      )
      .subscribe();

    const handChannel = supabase
      .channel(`hand-${roomId}-${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_images",
          filter: `room_id=eq.${roomId},player_id=eq.${playerId}`,
        },
        async () => {
          if (!isMounted) return;
          await loadAvailableImages();
        }
      )
      .subscribe();

    const playersChannel = supabase
      .channel(`players-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        async () => {
          if (!isMounted) return;
          await loadPlayerCount();
          tryAutoAdvance();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(roundChannel);
      supabase.removeChannel(subsChannel);
      supabase.removeChannel(votesChannel);
      supabase.removeChannel(handChannel);
      supabase.removeChannel(playersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, playerId, roundId]);

  // Alla lyssnar på nya rounds i rummet och navigerar dit (eller results)
  useEffect(() => {
    if (!roomId || !playerId) return;

    const roundsRoomChannel = supabase
      .channel(`rounds-room-nav-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const newRound = payload.new as any;
          const newRoundId = newRound.id as string;
          const newNumber = (newRound.round_number as number) ?? 0;

          if (skipNextInsertNavRef.current === newRoundId) {
            skipNextInsertNavRef.current = null;
            return;
          }

          if (roundNumber && newNumber <= roundNumber) return;
          if (lastSeenRoundIdRef.current === newRoundId) return;

          lastSeenRoundIdRef.current = newRoundId;

          if (newRoundId === roundId) return;

          if (newNumber > 5) {
            router.replace({ pathname: "/results", params: { roomId } });
            return;
          }

          router.replace({ pathname: "/round", params: { roomId, playerId, roundId: newRoundId } });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roundsRoomChannel);
    };
  }, [roomId, playerId, roundId, roundNumber]);

  // ✅ Alla ska hoppa till results när rooms.phase blir "finished"
  useEffect(() => {
    if (!roomId) return;

    const roomPhaseChannel = supabase
      .channel(`room-phase-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const newPhase = (payload.new as any)?.phase as string | undefined;
          if (newPhase === "finished") {
            router.replace({ pathname: "/results", params: { roomId } });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomPhaseChannel);
    };
  }, [roomId]);

  const submitFromHand = async (playerImageId: string, imagePath: string) => {
    if (!roomId || !playerId || !roundId) return;
    if (mySubmissionId) return Alert.alert("You've already submitted ✅");
    if (submitting) return;

    setSubmitting(true);
    try {
      const { data: sub, error: subErr } = await supabase
        .from("submissions")
        .insert({ round_id: roundId, player_id: playerId, image_path: imagePath })
        .select("id")
        .single();

      if (subErr) return Alert.alert("DB error", subErr.message);

      const { error: lockErr } = await supabase
        .from("player_images")
        .update({ used_in_round_id: roundId })
        .eq("id", playerImageId)
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .is("used_in_round_id", null);

      if (lockErr) return Alert.alert("Error (lock image)", lockErr.message);

      setMySubmissionId(sub.id);
      await loadAvailableImages();
      tryAutoAdvance();
    } finally {
      setSubmitting(false);
    }
  };

  const goVoting = async () => {
    if (!roundId) return;
    const { error } = await supabase.from("rounds").update({ status: "voting" }).eq("id", roundId);
    if (error) Alert.alert("Error (voting)", error.message);
  };

  const finishRound = async () => {
    if (!roundId) return;

    const { error: rpcErr } = await supabase.rpc("finalize_round", { p_round_id: roundId });
    if (rpcErr) return Alert.alert("Error (points)", rpcErr.message);

    const { error } = await supabase.from("rounds").update({ status: "done" }).eq("id", roundId);
    if (error) Alert.alert("Error (done)", error.message);
  };

  const nextRound = async () => {
    if (!roomId || !playerId) return;

    if (advancingRoundRef.current) return;
    advancingRoundRef.current = true;
    setAdvancingRound(true);

    try {
      const nextNumber = (roundNumber ?? 0) + 1;

      if (nextNumber > 5) {
        const { error: phaseErr } = await supabase.from("rooms").update({ phase: "finished" }).eq("id", roomId);
        if (phaseErr) return Alert.alert("Error (finished)", phaseErr.message);

        router.replace({ pathname: "/results", params: { roomId } });
        return;
      }

      const { data: usedRows, error: usedErr } = await supabase
        .from("rounds")
        .select("statement")
        .eq("room_id", roomId);

      if (usedErr) {
        Alert.alert("Error (rounds)", usedErr.message);
        return;
      }

      const usedStatements = (usedRows ?? [])
        .map((r: any) => r.statement)
        .filter((s: any): s is string => typeof s === "string" && s.length > 0);

      const statement = getRandomStatement(usedStatements);
      const endsAt = new Date(Date.now() + 60_000).toISOString();

      const { data, error } = await supabase
        .from("rounds")
        .insert({
          room_id: roomId,
          statement,
          status: "collecting",
          ends_at: endsAt,
          round_number: nextNumber,
        })
        .select("id")
        .single();

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("rounds_room_roundnumber_unique")) {
          return; // någon annan skapade redan
        }
        Alert.alert("Error (next round)", error.message);
        return;
      }

      skipNextInsertNavRef.current = data.id;
      router.replace({ pathname: "/round", params: { roomId, playerId, roundId: data.id } });
    } finally {
      advancingRoundRef.current = false;
      setAdvancingRound(false);
    }
  };

  const castVote = async (submissionId: string) => {
    if (!roundId || !playerId) return;

    if (submissionId === mySubmissionId) {
      // tapping the same image again does nothing
      return;
    }

    if (submissionId === mySubmissionId) return;

    try {
      if (myVoteSubmissionId) {
        // change existing vote
        const { error: updErr } = await supabase
          .from("votes")
          .update({ submission_id: submissionId })
          .eq("round_id", roundId)
          .eq("voter_player_id", playerId);
        if (updErr) return Alert.alert("Röstning", updErr.message);
      } else {
        const { error } = await supabase
          .from("votes")
          .insert({ round_id: roundId, voter_player_id: playerId, submission_id: submissionId });
        if (error) return Alert.alert("Röstning", error.message);
      }

      setMyVoteSubmissionId(submissionId);
      tryAutoAdvance();
    } catch (e) {
      console.error('vote error', e);
    }
  };

  const winner = useMemo(() => {
    let bestId: string | null = null;
    let best = -1;
    for (const s of submissions) {
      const c = voteCounts[s.id] ?? 0;
      if (c > best) {
        best = c;
        bestId = s.id;
      }
    }
    return { submissionId: bestId, votes: best < 0 ? 0 : best };
  }, [submissions, voteCounts]);

  const statusLabel = status === "collecting" ? "Selecting" : status === "voting" ? "Voting" : "Done";
  const statusBg = status === "collecting" ? "#0B1222" : status === "voting" ? "#111827" : "#052e1b";

  if (!roomId || !playerId || !roundId) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0F19", padding: 16, justifyContent: "center" }}>
        <Text style={{ color: "white" }}>Laddar...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F19" }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        {/* winner overlay */}
        {showWinnerOverlay && winner.submissionId && (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: "rgba(0,0,0,0.75)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", marginBottom: 12 }}>
              Round winner
            </Text>
            <Image
              source={{ uri: publicUrlFor(winner.submissionId) }}
              style={{ width: 240, height: 240, borderRadius: 16 }}
              contentFit="cover"
            />
          </View>
        )}
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>Round {roundNumber}/5</Text>
            <Text style={{ color: "#94A3B8", fontWeight: "700" }}>{isHost ? "Du är host" : "Spelare"}</Text>
          </View>

          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: statusBg,
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>{statusLabel}</Text>
          </View>
        </View>

        {/* Statement card */}
        <Animated.View
          style={{
            transform: [
              {
                scale: popAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1],
                }),
              },
            ],
            opacity: popAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            }),
            backgroundColor: "#0F172A",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(56,189,248,0.35)",
            shadowColor: "#38BDF8",
            shadowOpacity: 0.25,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 10, height: 34, borderRadius: 999, backgroundColor: "#38BDF8" }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#E2E8F0", fontWeight: "900", letterSpacing: 0.2 }}>Påstående</Text>
              <Text style={{ color: "#94A3B8", fontWeight: "700", marginTop: 2 }}>Pick the best fitting picture 👇</Text>
            </View>
          </View>

          <Text style={{ color: "white", fontSize: 20, lineHeight: 28, fontWeight: "900" }}>{statement || "..."}</Text>

          {status === "collecting" && (
            <Text style={{ color: "#A5B4FC", fontWeight: "800" }}>
              {mySubmissionId ? "Submitted ✅" : `Choose a picture (${availableImages.length} left)`}
            </Text>
          )}

          {status === "voting" && (
            <Text style={{ color: "#86EFAC", fontWeight: "900" }}>
              {myVoteSubmissionId ? "You voted ✅" : "Tap an image to vote (not your own)."}
            </Text>
          )}

          {status === "done" && (
            <Text style={{ color: "#FDE68A", fontWeight: "900" }}>
              Winner: {winner.votes} votes {winner.submissionId ? "🏆" : ""}
            </Text>
          )}
        </Animated.View>

        {/* Main grid */}
        {status === "collecting" ? (
          !mySubmissionId ? (
            <FlatList
              data={availableImages}
              keyExtractor={(x) => x.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 10 }}
              contentContainerStyle={{ gap: 10, paddingBottom: 18 }}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              updateCellsBatchingPeriod={50}
              renderItem={({ item }) => {
                const uri = publicUrlFor(item.image_path);
                return (
                  <Pressable
                    onPress={() => submitFromHand(item.id, item.image_path)}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: 16,
                      overflow: "hidden",
                      opacity: submitting ? 0.6 : pressed ? 0.9 : 1,
                      borderWidth: 1,
                      borderColor: "#1F2937",
                      backgroundColor: "#0B1222",
                    })}
                  >
                    <Image source={{ uri }} style={{ width: "100%", height: 180 }} contentFit="cover" cachePolicy="memory-disk" />
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={{ color: "#94A3B8" }}>No images left in hand.</Text>}
            />
          ) : (
            <View
              style={{
                flex: 1,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: "#1F2937",
                backgroundColor: "#0F172A",
                padding: 14,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>Waiting for others…</Text>
              <Text style={{ color: "#94A3B8", marginTop: 6, textAlign: "center" }}>
                När alla har skickat in går spelet automatiskt vidare.
              </Text>
            </View>
          )
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={submissions}
            keyExtractor={(x) => x.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 18 }}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={5}
            updateCellsBatchingPeriod={50}
            renderItem={({ item }) => {
              const uri = publicUrlFor(item.image_path);
              const votes = voteCounts[item.id] ?? 0;

              const isMine = item.id === mySubmissionId;
              const isVoted = item.id === myVoteSubmissionId;
              const isWinner = status === "done" && winner.submissionId === item.id;

              const borderColor = isWinner ? "#F59E0B" : isVoted ? "#22C55E" : isMine ? "#38BDF8" : "#1F2937";

              return (
                <Pressable
                  onPress={() => {
                    if (status === "voting" && item.id !== myVoteSubmissionId) {
                      castVote(item.id);
                    }
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor,
                    backgroundColor: "#0B1222",
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Image source={{ uri }} style={{ width: "100%", height: 180 }} contentFit="cover" cachePolicy="memory-disk" />

                  <View style={{ padding: 10, gap: 2 }}>
                    <Text style={{ color: "white", fontWeight: "900" }}>{votes} votes</Text>
                    {isMine && <Text style={{ color: "#38BDF8", fontWeight: "800" }}>Your image</Text>}
                    {isVoted && <Text style={{ color: "#22C55E", fontWeight: "800" }}>Your vote</Text>}
                    {isWinner && <Text style={{ color: "#F59E0B", fontWeight: "900" }}>Winner</Text>}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
