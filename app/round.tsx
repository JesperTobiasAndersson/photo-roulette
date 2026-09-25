import React, { useEffect, useMemo, useRef, useState } from "react";
import { getRandomStatement, getStatementText, type StatementCategory } from "../src/constants/statements";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { GAMES } from "../src/games/catalog";
import { Card, Chip, Screen, TopBar, onAccent, type IconName } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.memematch;
const ACCENT = GAME.accent;

const TOTAL_ROUNDS = 5;

type Submission = { id: string; player_id: string; image_path: string };
type PlayerImage = { id: string; image_path: string };

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default function RoundScreen() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const roundId = asString(params.roundId);

  const popAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current; // for winner image pop
  const transitionAnim = useRef(new Animated.Value(1)).current; // fade out/in between rounds
  const finalOverlayAnim = useRef(new Animated.Value(0)).current;

  const [playerCount, setPlayerCount] = useState<number>(0);
  const autoAdvanceRef = useRef(false);

  const lastAutoNextRoundFromRoundIdRef = useRef<string | null>(null);

  const [statement, setStatement] = useState("");
  const [status, setStatus] = useState<"collecting" | "voting" | "done">("collecting");
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [hostId, setHostId] = useState<string>("");
  const [statementCategory, setStatementCategory] = useState<StatementCategory>("innocent");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmissionId, setMySubmissionId] = useState<string | null>(null);

  const [myVoteSubmissionId, setMyVoteSubmissionId] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

  const [availableImages, setAvailableImages] = useState<PlayerImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);
  const [showFinalOverlay, setShowFinalOverlay] = useState(false);

  const lastSeenRoundIdRef = useRef<string | null>(null);
  const skipNextInsertNavRef = useRef<string | null>(null);
  const advancingRoundRef = useRef(false);
  const finalTransitionStartedRef = useRef(false);
  const [advancingRound, setAdvancingRound] = useState(false);

  const isHost = !!(playerId && hostId && playerId === hostId);

  const publicUrlFor = (path: string) => {
    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const navigateToResultsWithTransition = () => {
    if (!roomId || finalTransitionStartedRef.current) return;
    finalTransitionStartedRef.current = true;
    setShowWinnerOverlay(false);
    setShowFinalOverlay(true);
    finalOverlayAnim.setValue(0);

    Animated.parallel([
      Animated.timing(finalOverlayAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(transitionAnim, {
        toValue: 0,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        router.replace({ pathname: "/results", params: { roomId, playerId } });
      }, 280);
    });
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
      .select("*")
      .eq("id", roomId)
      .single();
    if (!error) {
      setHostId(data.host_player_id ?? "");
      setStatementCategory((data.statement_category as StatementCategory | null) ?? "innocent");
    }
  };

  const loadRound = async () => {
    if (!roundId) return;
    const { data, error } = await supabase
      .from("rounds")
      .select("statement,status,round_number")
      .eq("id", roundId)
      .single();

    if (error) return showAlert(copy.errorTitle, error.message);

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

    if (error) return showAlert(copy.errorTitle, error.message);

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

    if (error) return showAlert(copy.errorTitle, error.message);
    setMyVoteSubmissionId(data?.submission_id ?? null);
  };

  const loadVoteCounts = async () => {
    if (!roundId) return;

    const { data, error } = await supabase.from("votes").select("submission_id").eq("round_id", roundId);
    if (error) return showAlert(copy.errorTitle, error.message);

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

    if (error) return showAlert(copy.errorTitle, error.message);
    setAvailableImages(data ?? []);
  };

  // ✅ POP-animation when statement changes
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

  // winner overlay pop
  useEffect(() => {
    if (!showWinnerOverlay) return;
    overlayAnim.setValue(0);
    Animated.spring(overlayAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [showWinnerOverlay]);

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

// ✅ When round is "done": show winner briefly, then auto-next (or results after the last round)

useEffect(() => {
  if (!roomId || !playerId || !roundId) return;
  if (status !== "done") return;

  if (lastAutoNextRoundFromRoundIdRef.current === roundId) return;
  lastAutoNextRoundFromRoundIdRef.current = roundId;

  (async () => {
    // show winner image overlay for a moment
    setShowWinnerOverlay(true);

    if (roundNumber >= TOTAL_ROUNDS) {
      setTimeout(navigateToResultsWithTransition, 3500);
      return;
    }

    setTimeout(async () => {
      // hide overlay, then fade content out, advance round, fade back in
      setShowWinnerOverlay(false);
      Animated.timing(transitionAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(async () => {
        await nextRound();
        transitionAnim.setValue(0);
        Animated.timing(transitionAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [status, roundId, roundNumber, roomId, playerId]);

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
            router.replace({ pathname: "/results", params: { roomId, playerId } });
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
            navigateToResultsWithTransition();
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
    if (mySubmissionId) return showAlert(copy.alreadySubmitted);
    if (submitting) return;

    setSubmitting(true);
    try {
      const { data: sub, error: subErr } = await supabase
        .from("submissions")
        .insert({ round_id: roundId, player_id: playerId, image_path: imagePath })
        .select("id")
        .single();

      if (subErr) return showAlert(copy.errorTitle, subErr.message);

      const { error: lockErr } = await supabase
        .from("player_images")
        .update({ used_in_round_id: roundId })
        .eq("id", playerImageId)
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .is("used_in_round_id", null);

      if (lockErr) return showAlert(copy.errorTitle, lockErr.message);

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
    if (error) showAlert(copy.errorTitle, error.message);
  };

  const finishRound = async () => {
    if (!roundId) return;

    const { error: rpcErr } = await supabase.rpc("finalize_round", { p_round_id: roundId });
    if (rpcErr) return showAlert(copy.errorTitle, rpcErr.message);

    const { error } = await supabase.from("rounds").update({ status: "done" }).eq("id", roundId);
    if (error) showAlert(copy.errorTitle, error.message);
  };

  const nextRound = async () => {
    if (!roomId || !playerId) return;

    if (advancingRoundRef.current) return;
    advancingRoundRef.current = true;
    setAdvancingRound(true);

    try {
      const nextNumber = (roundNumber ?? 0) + 1;

      if (nextNumber > 5) {
        // Calculate final scores
        console.log("Calculating final scores...");
        const { data: rounds, error: roundsErr } = await supabase
          .from("rounds")
          .select("id")
          .eq("room_id", roomId);

        if (roundsErr) {
          console.error("Error fetching rounds:", roundsErr);
          showAlert(copy.scoreError, roundsErr.message);
          return;
        }

        console.log(`Found ${rounds?.length || 0} rounds`);
        const playerScores: Record<string, number> = {};

        for (const round of rounds ?? []) {
          const { data: votes, error: votesErr } = await supabase
            .from("votes")
            .select("submission_id")
            .eq("round_id", round.id);

          if (votesErr) {
            console.error(`Error fetching votes for round ${round.id}:`, votesErr);
            continue;
          }

          const voteCounts: Record<string, number> = {};
          votes?.forEach((v: any) => {
            voteCounts[v.submission_id] = (voteCounts[v.submission_id] || 0) + 1;
          });

          // Find the submission with most votes
          let maxVotes = 0;
          let winnerSubmissionId: string | null = null;
          for (const [subId, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
              maxVotes = count;
              winnerSubmissionId = subId;
            }
          }

          if (winnerSubmissionId) {
            const { data: submission, error: subErr } = await supabase
              .from("submissions")
              .select("player_id")
              .eq("id", winnerSubmissionId)
              .single();

            if (!subErr && submission) {
              playerScores[submission.player_id] = (playerScores[submission.player_id] || 0) + 1; // 1 point per round win
            } else {
              console.error(`Error fetching submission ${winnerSubmissionId}:`, subErr);
            }
          }
        }

        console.log("Player scores:", playerScores);

        // Insert scores into room_scores
        const scoreInserts = Object.entries(playerScores).map(([playerId, points]) => ({
          room_id: roomId,
          player_id: playerId,
          points,
        }));

        console.log(`Inserting ${scoreInserts.length} score records`);
        if (scoreInserts.length > 0) {
          const { error: scoreErr } = await supabase.from("room_scores").insert(scoreInserts);
          if (scoreErr) {
            console.error("Error inserting scores", scoreErr);
          } else {
            console.log("Scores inserted successfully");
          }
        }

        const { error: phaseErr } = await supabase.from("rooms").update({ phase: "finished" }).eq("id", roomId);
        if (phaseErr) return showAlert(copy.errorTitle, phaseErr.message);
        navigateToResultsWithTransition();
        return;
      }

      const { data: usedRows, error: usedErr } = await supabase
        .from("rounds")
        .select("statement")
        .eq("room_id", roomId);

      if (usedErr) {
        showAlert(copy.errorTitle, usedErr.message);
        return;
      }

      const usedStatements = (usedRows ?? [])
        .map((r: any) => r.statement)
        .filter((s: any): s is string => typeof s === "string" && s.length > 0);

      const statement = getRandomStatement({ exclude: usedStatements, category: statementCategory });
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
        showAlert(copy.errorTitle, error.message);
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
        if (updErr) return showAlert(copy.voteError, updErr.message);
      } else {
        const { error } = await supabase
          .from("votes")
          .insert({ round_id: roundId, voter_player_id: playerId, submission_id: submissionId });
        if (error) return showAlert(copy.voteError, error.message);
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
    let bestPath: string | null = null;
    for (const s of submissions) {
      const c = voteCounts[s.id] ?? 0;
      if (c > best) {
        best = c;
        bestId = s.id;
        bestPath = s.image_path;
      }
    }
    return { submissionId: bestId, votes: best < 0 ? 0 : best, imagePath: bestPath };
  }, [submissions, voteCounts]);

  const copy =
    language === "sv"
      ? {
          roundWinner: "Rundvinnare",
          nextRoundStarting: "Nästa runda startar…",
          roundLabel: "Runda",
          hostLabel: "Du är värd",
          playerLabel: "Spelare",
          statusCollecting: "Väljer",
          statusVoting: "Röstar",
          statusDone: "Klar",
          statementTitle: "Påstående",
          statementBody: "Välj bilden som passar bäst 👇",
          categoryInnocent: "OSKYLDIGT",
          categoryAdult: "18+",
          categoryGross: "GROVT",
          submitted: "Skickat in ✓",
          choosePicture: "Välj en bild ({count} kvar)",
          youVoted: "Du röstade ✓",
          voteHint: "Tryck på en bild för att rösta, men inte din egen.",
          winnerLabel: "Vinnare",
          voteSingle: "röst",
          votePlural: "röster",
          yourImage: "Din bild",
          yourVote: "Din röst",
          cardWinner: "Vinnare",
          loading: "Laddar...",
          noImagesLeft: "Inga bilder kvar i handen.",
          waitingForOthers: "Väntar på andra…",
          waitingForOthersBody: "När alla har skickat in går spelet vidare automatiskt.",
          finalResultsTitle: "Slutresultatet kommer",
          finalResultsBody: "Vi räknar ihop kvällens vinnare…",
          tapToPlay: "Tryck på en bild för att spela den.",
          waitingOne: "Väntar på 1 spelare till…",
          waitingMany: "Väntar på {count} spelare till…",
          voteFunniest: "Rösta på den roligaste",
          changeVoteHint: "Tryck på en annan bild för att byta röst.",
          leaveTitle: "Lämna spelet?",
          leaveBody: "Du lämnar matchen. Dina vänner kan fortsätta spela.",
          stay: "Stanna",
          errorTitle: "Något gick fel",
          scoreError: "Kunde inte räkna ihop poängen",
          voteError: "Kunde inte registrera din röst",
          alreadySubmitted: "Du har redan skickat in en bild ✅",
        }
      : {
          roundWinner: "Round Winner",
          nextRoundStarting: "Next round starting…",
          roundLabel: "Round",
          hostLabel: "You are host",
          playerLabel: "Player",
          statusCollecting: "Selecting",
          statusVoting: "Voting",
          statusDone: "Done",
          statementTitle: "Statement",
          statementBody: "Pick the best fitting picture 👇",
          categoryInnocent: "INNOCENT",
          categoryAdult: "18+",
          categoryGross: "GROSS",
          submitted: "Submitted ✓",
          choosePicture: "Choose a picture ({count} left)",
          youVoted: "You voted ✓",
          voteHint: "Tap an image to vote, not your own.",
          winnerLabel: "Winner",
          voteSingle: "vote",
          votePlural: "votes",
          yourImage: "Your image",
          yourVote: "Your vote",
          cardWinner: "Winner",
          loading: "Loading...",
          noImagesLeft: "No images left in hand.",
          waitingForOthers: "Waiting for others…",
          waitingForOthersBody: "When everyone has submitted the game moves on automatically.",
          finalResultsTitle: "Final results incoming",
          finalResultsBody: "Counting up tonight's winner…",
          tapToPlay: "Tap a photo to play it.",
          waitingOne: "Waiting for 1 more player…",
          waitingMany: "Waiting for {count} more players…",
          voteFunniest: "Vote for the funniest",
          changeVoteHint: "Tap another photo to change your vote.",
          leaveTitle: "Leave the game?",
          leaveBody: "You'll leave the match. Your friends can keep playing.",
          stay: "Stay",
          errorTitle: "Something went wrong",
          scoreError: "Could not calculate the scores",
          voteError: "Could not register your vote",
          alreadySubmitted: "You've already submitted ✅",
        };

  const { width: windowWidth } = useWindowDimensions();
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);

  const categoryLabel =
    statementCategory === "adult"
      ? copy.categoryAdult
      : statementCategory === "gross"
      ? copy.categoryGross
      : copy.categoryInnocent;

  const categoryColor =
    statementCategory === "adult" ? "#EC4899" : statementCategory === "gross" ? "#F97316" : colors.success;

  const isFinalRound = roundNumber >= TOTAL_ROUNDS;
  const remainingSubmissions = Math.max(0, playerCount - submissions.length);
  const totalVotes = Object.values(voteCounts).reduce((sum, n) => sum + n, 0);
  const remainingVotes = Math.max(0, playerCount - totalVotes);
  const waitingLine = (n: number) =>
    n > 0 ? (n === 1 ? copy.waitingOne : copy.waitingMany.replace("{count}", String(n))) : copy.waitingForOthers;
  const votesText = (n: number) => `${n} ${n === 1 ? copy.voteSingle : copy.votePlural}`;

  const leave = async () => {
    const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, {
      confirmLabel: t("common.leave"),
      cancelLabel: copy.stay,
      destructive: true,
    });
    if (ok) router.replace(GAME.href as any);
  };

  const pickFromHand = async (item: PlayerImage) => {
    if (submitting || mySubmissionId) return;
    setPendingImageId(item.id);
    try {
      await submitFromHand(item.id, item.image_path);
    } finally {
      setPendingImageId(null);
    }
  };

  // Status line pinned in the footer so it's always visible while scrolling the photos.
  const statusLine: { icon: IconName; color: string; title: string; body?: string; spinner?: boolean } =
    status === "collecting"
      ? mySubmissionId
        ? { icon: "hourglass-outline", color: ACCENT, title: waitingLine(remainingSubmissions), body: copy.waitingForOthersBody, spinner: true }
        : {
            icon: "hand-left-outline",
            color: ACCENT,
            title: copy.choosePicture.replace("{count}", String(availableImages.length)),
            body: copy.tapToPlay,
          }
      : status === "voting"
      ? myVoteSubmissionId
        ? {
            icon: "checkmark-circle",
            color: colors.success,
            title: `${copy.youVoted} · ${waitingLine(remainingVotes)}`,
            body: copy.changeVoteHint,
          }
        : { icon: "heart-outline", color: ACCENT, title: copy.voteFunniest, body: copy.voteHint }
      : { icon: "trophy", color: colors.warning, title: `${copy.winnerLabel}: ${votesText(winner.votes)}` };

  const footer = (
    <View
      accessibilityLiveRegion="polite"
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        backgroundColor: withAlpha(statusLine.color, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(statusLine.color, 0.4),
      }}
    >
      {statusLine.spinner ? (
        <ActivityIndicator color={statusLine.color} />
      ) : (
        <Ionicons name={statusLine.icon} size={24} color={statusLine.color} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{statusLine.title}</Text>
        {statusLine.body ? <Text style={[type.small, { color: colors.textMuted }]}>{statusLine.body}</Text> : null}
      </View>
    </View>
  );

  const winnerImageSize = Math.min(windowWidth - space.xxl * 2, 340);

  if (!roomId || !playerId || !roundId) {
    return (
      <Screen centered topBar={<TopBar title={GAME.title} backHref={GAME.href} />}>
        <View style={{ alignItems: "center", gap: space.md }}>
          <ActivityIndicator color={ACCENT} />
          <Text style={[type.body, { color: colors.textMuted }]}>{copy.loading}</Text>
        </View>
      </Screen>
    );
  }

  const tileStyle = { width: "50%" as const, padding: space.xs };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View style={{ flex: 1, opacity: transitionAnim }}>
        <Screen
          topBar={
            <TopBar
              title={`${copy.roundLabel} ${roundNumber || "–"}/${TOTAL_ROUNDS}`}
              onBack={leave}
              right={isHost ? <Chip label={t("common.host")} color={ACCENT} icon="star" /> : undefined}
            />
          }
          footer={footer}
        >
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
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: space.lg,
              borderWidth: 1,
              borderColor: withAlpha(ACCENT, 0.45),
              gap: space.sm,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
              <Text style={[type.caption, { color: ACCENT, textTransform: "uppercase" }]}>{copy.statementTitle}</Text>
              <Chip label={categoryLabel} color={categoryColor} />
            </View>
            <Text style={{ color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: "900" }}>
              {getStatementText(statement, language) || "..."}
            </Text>
          </Animated.View>

          {/* Main grid */}
          {status === "collecting" ? (
            !mySubmissionId ? (
              availableImages.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs }}>
                  {availableImages.map((item) => {
                    const uri = publicUrlFor(item.image_path);
                    const isPending = pendingImageId === item.id;
                    return (
                      <View key={item.id} style={tileStyle}>
                        <Pressable
                          onPress={() => pickFromHand(item)}
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityLabel={copy.tapToPlay}
                          style={({ pressed }) => ({
                            width: "100%",
                            aspectRatio: 0.8,
                            borderRadius: radius.md,
                            overflow: "hidden",
                            borderWidth: isPending ? 3 : 1,
                            borderColor: isPending ? ACCENT : colors.border,
                            backgroundColor: colors.sunken,
                            opacity: submitting && !isPending ? 0.45 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }],
                          })}
                        >
                          <Image
                            source={{ uri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                          {isPending ? (
                            <View
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: withAlpha(colors.bg, 0.45),
                              }}
                            >
                              <ActivityIndicator color={ACCENT} size="large" />
                            </View>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{copy.noImagesLeft}</Text>
              )
            ) : (
              <Card style={{ alignItems: "center", paddingVertical: space.xxl }}>
                <Ionicons name="checkmark-circle" size={44} color={colors.success} />
                <Text style={[type.heading, { color: colors.text, textAlign: "center" }]}>{copy.submitted}</Text>
                <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>
                  {copy.waitingForOthersBody}
                </Text>
              </Card>
            )
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -space.xs }}>
              {submissions.map((item) => {
                const uri = publicUrlFor(item.image_path);
                const votes = voteCounts[item.id] ?? 0;

                const isMine = item.id === mySubmissionId;
                const isVoted = item.id === myVoteSubmissionId;
                const isWinner = status === "done" && winner.submissionId === item.id;
                const canVote = status === "voting" && !isMine && !isVoted;

                const stateColor = isWinner ? colors.warning : isVoted ? colors.success : isMine ? colors.textMuted : null;
                const stateLabel = isWinner
                  ? copy.cardWinner
                  : isVoted
                  ? copy.yourVote
                  : isMine
                  ? copy.yourImage
                  : null;
                const stateIcon: IconName = isWinner ? "trophy" : isVoted ? "checkmark-circle" : "person";

                return (
                  <View key={item.id} style={tileStyle}>
                    <Pressable
                      onPress={() => {
                        if (status === "voting" && item.id !== myVoteSubmissionId) {
                          castVote(item.id);
                        }
                      }}
                      disabled={!canVote}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isVoted, disabled: !canVote }}
                      accessibilityLabel={stateLabel ?? copy.voteFunniest}
                      style={({ pressed }) => ({
                        width: "100%",
                        aspectRatio: 0.8,
                        borderRadius: radius.md,
                        overflow: "hidden",
                        borderWidth: stateColor && !isMine ? 3 : 1,
                        borderColor: stateColor && !isMine ? stateColor : colors.border,
                        backgroundColor: colors.sunken,
                        opacity: isMine && status === "voting" ? 0.55 : 1,
                        transform: [{ scale: pressed && canVote ? 0.97 : 1 }],
                      })}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />

                      {stateLabel && stateColor ? (
                        <View
                          style={{
                            position: "absolute",
                            top: space.sm,
                            left: space.sm,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: space.sm,
                            paddingVertical: 4,
                            borderRadius: radius.pill,
                            backgroundColor: isMine ? colors.overlay : stateColor,
                          }}
                        >
                          <Ionicons name={stateIcon} size={14} color={isMine ? colors.text : onAccent(stateColor)} />
                          <Text style={{ color: isMine ? colors.text : onAccent(stateColor), fontSize: 13, fontWeight: "800" }}>
                            {stateLabel}
                          </Text>
                        </View>
                      ) : null}

                      <View
                        style={{
                          position: "absolute",
                          bottom: space.sm,
                          right: space.sm,
                          paddingHorizontal: space.sm,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: colors.overlay,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{votesText(votes)}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </Screen>
      </Animated.View>

      {/* winner overlay */}
      {showWinnerOverlay && winner.submissionId && (
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
            zIndex: 10,
            opacity: overlayAnim,
            transform: [{ scale: overlayAnim }],
          }}
        >
          <View style={{ alignItems: "center", gap: space.lg }}>
            <View style={{ alignItems: "center", gap: space.xs }}>
              <Ionicons name="trophy" size={36} color={colors.warning} />
              <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.roundWinner}</Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: space.md,
                borderWidth: 2,
                borderColor: colors.warning,
                shadowColor: colors.warning,
                shadowOpacity: 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
                elevation: 15,
              }}
            >
              <Image
                source={{ uri: publicUrlFor(winner.imagePath ?? "") }}
                style={{ width: winnerImageSize, height: winnerImageSize, borderRadius: radius.lg }}
                contentFit="cover"
              />
            </View>

            <View style={{ alignItems: "center", gap: space.sm }}>
              <Text style={[type.heading, { color: colors.warning }]}>{votesText(winner.votes)}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <ActivityIndicator color={colors.textMuted} size="small" />
                <Text style={[type.bodyStrong, { color: colors.textMuted }]}>
                  {isFinalRound ? copy.finalResultsTitle : copy.nextRoundStarting}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {showFinalOverlay && (
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.overlay,
            alignItems: "center",
            justifyContent: "center",
            padding: space.xl,
            zIndex: 11,
            opacity: finalOverlayAnim,
            transform: [
              {
                scale: finalOverlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          }}
        >
          <Card
            accent={colors.warning}
            style={{ width: "100%", maxWidth: 420, alignItems: "center", paddingVertical: space.xxl, paddingHorizontal: space.xl }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.pill,
                backgroundColor: withAlpha(colors.warning, 0.14),
                borderWidth: 1,
                borderColor: withAlpha(colors.warning, 0.3),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="star" size={40} color={colors.warning} />
            </View>
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.finalResultsTitle}</Text>
            <Text style={[type.body, { color: colors.textMuted, textAlign: "center" }]}>{copy.finalResultsBody}</Text>
          </Card>
        </Animated.View>
      )}
    </View>
  );
}
