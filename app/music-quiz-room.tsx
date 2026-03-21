import React, { useEffect, useMemo, useState } from "react";
import { Alert, Animated, Easing, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { Image } from "react-native";
import { CopyToast } from "../src/components/CopyToast";
import { awardMusicQuizPoints, completeMusicQuizGame, loadRandomMusicQuizTrack, revealMusicQuizRound, resetMusicQuizToLobby, startMusicQuizRound, submitMusicQuizAnswer } from "../src/games/music-quiz/api";
import type { SpotifyTrackPreview } from "../src/games/music-quiz/spotify";
import type { MusicQuizSongPool } from "../src/games/music-quiz/types";
import { useMusicQuizRoom } from "../src/games/music-quiz/useMusicQuizRoom";
import { useI18n } from "../src/lib/i18n";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

export default function MusicQuizRoomScreen() {
  const { language, t } = useI18n();
  const params = useLocalSearchParams();
  const roomId = asString(params.roomId);
  const playerId = asString(params.playerId);
  const { room, players, myPlayer, currentRound, answers, myAnswer, loading, refresh } = useMusicQuizRoom(roomId, playerId);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [trackPreview, setTrackPreview] = useState<SpotifyTrackPreview | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [promptType, setPromptType] = useState<"title" | "artist" | null>(null);
  const [songPool, setSongPool] = useState<MusicQuizSongPool | null>(null);
  const winnerOpacity = React.useRef(new Animated.Value(0)).current;
  const winnerScale = React.useRef(new Animated.Value(0.92)).current;
  const rankingOpacity = React.useRef(new Animated.Value(0)).current;
  const baseUrl = Platform.OS === "web" ? window.location.origin : "https://picklo.app";

  const copy = language === "sv"
    ? { loading: "Laddar Music Quiz", actionFailed: "Åtgärden misslyckades", roomCode: "Rum {code}", host: "VÄRD", players: "Spelare", copyInvite: "Kopiera inbjudningslänk", waitHost: "Väntar på att värden ska välja kategori och ladda första låten.", setup: "Matchupplägg", setupBody: "Välj kategori en gång. Sedan spelas 10 rundor i samma kategori med olika låtar varje runda.", startRound: "Starta runda", startRoundHint: "Knappen laddar automatiskt en ny låt från vald kategori och startar rundan med vald frågetyp.", selectCategoryFirst: "Välj kategori först.", selectGuessFirst: "Välj vad spelarna ska gissa först.", selected: "Valt", hits: "Hits", classics: "Classics", mix: "Mix", guessTitle: "Gissa låttitel", guessArtist: "Gissa artist", points: "Poäng", nextRound: "Nästa runda", finishGame: "Avsluta match", winnerReveal: "Och vinnaren är...", champion: "Vinnare", finalStandings: "Slutplacering", place: "#{place}", openSong: "Öppna låt", iosReturnHint: "På iPhone kan du hoppa tillbaka snabbt via Picklo uppe till vänster efter att Spotify öppnas.", roundLive: "Rundan är live", roundCount: "Runda {current}/{total}", chosenCategory: "Kategori", completed: "Matchen är klar", completedBody: "Alla rundor är spelade. Slutställningen finns nedan.", answerPromptTitle: "Vilken låt är det?", answerPromptArtist: "Vilken artist är det?", answerHelp: "Alla svarar i appen. Hosten öppnar låten i Spotify och delar ut poäng i reveal-läget.", yourAnswer: "Ditt svar", submitAnswer: "Skicka svar", updateAnswer: "Uppdatera svar", answersIn: "Svar inne", reveal: "Visa facit", revealLive: "Facit", revealBody: "Tryck på omslaget för att öppna exakt låt i Spotify.", song: "Låt", artist: "Artist", scoreboard: "Poängtavla", noAnswer: "Inget svar ännu", award: "Rätta svar", markZero: "0 p", markOne: "+1 p", markFull: "+{points} p", resetGame: "Tillbaka till lobby", back: "Tillbaka till spel", invalidPoints: "Poängen måste vara mellan 1 och 10", noTrack: "Ladda en låt först" }
    : { loading: "Loading Music Quiz", actionFailed: "Action failed", roomCode: "Room {code}", host: "HOST", players: "Players", copyInvite: "Copy invite link", waitHost: "Waiting for the host to choose a category and load the first song.", setup: "Match setup", setupBody: "Choose one category once. Then the game runs 10 rounds in that category with a different song each round.", startRound: "Start round", startRoundHint: "This button automatically loads a new song from the selected category and starts the round with the selected guess mode.", selectCategoryFirst: "Choose a category first.", selectGuessFirst: "Choose what players should guess first.", selected: "Selected", hits: "Hits", classics: "Classics", mix: "Mix", guessTitle: "Guess song title", guessArtist: "Guess artist", points: "Points", nextRound: "Next round", finishGame: "Finish game", winnerReveal: "And the winner is...", champion: "Champion", finalStandings: "Final standings", place: "#{place}", openSong: "Open song", iosReturnHint: "On iPhone you can jump straight back using the Picklo shortcut at the top left after Spotify opens.", roundLive: "Round live", roundCount: "Round {current}/{total}", chosenCategory: "Category", completed: "Match complete", completedBody: "All rounds are done. The final scoreboard is below.", answerPromptTitle: "What song is this?", answerPromptArtist: "Which artist is this?", answerHelp: "Everyone answers in the app. The host opens the song in Spotify and awards points during reveal.", yourAnswer: "Your answer", submitAnswer: "Submit answer", updateAnswer: "Update answer", answersIn: "Answers in", reveal: "Reveal answer", revealLive: "Answer reveal", revealBody: "Tap the cover to open the exact song on Spotify.", song: "Song", artist: "Artist", scoreboard: "Scoreboard", noAnswer: "No answer yet", award: "Score answers", markZero: "0 pts", markOne: "+1 pt", markFull: "+{points} pts", resetGame: "Back to lobby", back: "Back to games", invalidPoints: "Points must be between 1 and 10", noTrack: "Load a song first" };

  const isHost = !!room && !!myPlayer && room.host_player_id === myPlayer.id;
  const inviteUrl = room?.code ? `${baseUrl}/music-quiz?code=${room.code}` : "";
  const answerCount = answers.filter((entry) => entry.submitted_at).length;
  const answerByPlayerId = useMemo(() => new Map(answers.map((entry) => [entry.player_id, entry])), [answers]);
  const totalRounds = room?.total_rounds ?? 10;
  const currentRoundNumber = currentRound?.round_number ?? 0;
  const selectedPool = (room?.selected_pool ?? songPool) as MusicQuizSongPool | null;
  const canStartRound = !!songPool && !!promptType && busy !== "start-round";
  const showIosReturnHint = Platform.OS === "ios" && isHost;
  const effectiveCompleted = room?.state === "completed" || (!!room?.public_message && /game complete|matchen är klar/i.test(room.public_message) && room.current_round_id == null);
  const sortedPlayers = useMemo(
    () => players.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.seat_order - b.seat_order),
    [players]
  );
  const winner = sortedPlayers[0] ?? null;

  useEffect(() => { setAnswerText(myAnswer?.answer_text ?? ""); }, [myAnswer?.answer_text, currentRound?.id]);
  useEffect(() => { if (room?.selected_pool) setSongPool(room.selected_pool); }, [room?.selected_pool]);
  useEffect(() => { if (currentRound) { setPromptType(currentRound.prompt_type); } }, [currentRound]);
  useEffect(() => {
    if (effectiveCompleted) {
      winnerOpacity.setValue(0);
      winnerScale.setValue(0.92);
      rankingOpacity.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(winnerOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(winnerScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
        ]),
        Animated.timing(rankingOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      return;
    }
    winnerOpacity.setValue(0);
    winnerScale.setValue(0.92);
    rankingOpacity.setValue(0);
  }, [effectiveCompleted, rankingOpacity, winnerOpacity, winnerScale]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await refresh(); } catch (error) { Alert.alert(copy.actionFailed, String((error as Error)?.message ?? error)); } finally { setBusy(null); }
  };

  const copyInvite = async () => { if (!inviteUrl) return; await Clipboard.setStringAsync(inviteUrl); setShowCopiedToast(true); setTimeout(() => setShowCopiedToast(false), 1400); };
  const openPreviewTrack = async (preview: SpotifyTrackPreview) => {
    if (Platform.OS === "web") return Linking.openURL(preview.spotifyUrl);
    const appUrl = `spotify:track:${preview.spotifyTrackId}`;
    if (await Linking.canOpenURL(appUrl)) return Linking.openURL(appUrl);
    return Linking.openURL(preview.spotifyUrl);
  };
  const openSpotifyTrack = async () => {
    if (!currentRound) return;
    if (Platform.OS === "web") return Linking.openURL(currentRound.spotify_url);
    const appUrl = `spotify:track:${currentRound.spotify_track_id}`;
    if (await Linking.canOpenURL(appUrl)) return Linking.openURL(appUrl);
    return Linking.openURL(currentRound.spotify_url);
  };
  const openArtistPage = async (artistName: string, artistSpotifyUrl?: string | null) => {
    const artistUrl = artistSpotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(artistName)}`;
    return Linking.openURL(artistUrl);
  };

  const startRound = () => run("start-round", async () => {
    if (!songPool) throw new Error(copy.selectCategoryFirst);
    if (!promptType) throw new Error(copy.selectGuessFirst);
    const preview = trackPreview ?? await loadRandomMusicQuizTrack(roomId, playerId, songPool);
    setTrackPreview(preview);
    await startMusicQuizRound(roomId, playerId, {
      songPool,
      promptType,
      spotifyUrl: preview.spotifyUrl,
      spotifyTrackId: preview.spotifyTrackId,
      songTitle: preview.songTitle,
      artistName: preview.artistName,
      artistSpotifyUrl: preview.artistSpotifyUrl,
      coverImageUrl: preview.coverImageUrl,
      pointValue: 1,
    });
    setAnswerText("");
    await openPreviewTrack(preview);
  });

  const goToNextRound = () => run("next-round", async () => {
    if (!selectedPool) throw new Error(copy.selectCategoryFirst);
    const preview = await loadRandomMusicQuizTrack(roomId, playerId, selectedPool);
    setTrackPreview(preview);
    await startMusicQuizRound(roomId, playerId, {
      songPool: selectedPool,
      promptType: currentRound?.prompt_type ?? "title",
      spotifyUrl: preview.spotifyUrl,
      spotifyTrackId: preview.spotifyTrackId,
      songTitle: preview.songTitle,
      artistName: preview.artistName,
      artistSpotifyUrl: preview.artistSpotifyUrl,
      coverImageUrl: preview.coverImageUrl,
      pointValue: 1,
    });
    setAnswerText("");
    await openPreviewTrack(preview);
  });

  const submitAnswer = () => run("submit-answer", async () => { await submitMusicQuizAnswer(roomId, playerId, answerText); });
  const revealRound = () => run("reveal-round", async () => { await revealMusicQuizRound(roomId, playerId); });
  const awardPoints = (targetPlayerId: string, points: number) => run(`award-${targetPlayerId}-${points}`, async () => {
    await awardMusicQuizPoints(roomId, playerId, targetPlayerId, points);
  });
  const finishGame = () => run("finish-game", async () => { await completeMusicQuizGame(roomId, playerId); });
  const resetGame = () => run("reset-game", async () => {
    await resetMusicQuizToLobby(roomId, playerId);
    setTrackPreview(null);
    setAnswerText("");
    setSongPool(null);
    setPromptType(null);
  });

  if (loading || !room) {
    return (
      <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900", textAlign: "center" }}>{copy.loading}</Text>
      </View>
    );
  }

  const renderPlayerRows = () =>
    players.map((player) => (
      <View key={player.id} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {player.id === room.host_player_id ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(34,197,94,0.14)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }}>
              <Text style={{ color: "#86EFAC", fontWeight: "900", fontSize: 12 }}>{copy.host}</Text>
            </View>
          ) : null}
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>{player.score}</Text>
        </View>
      </View>
    ));

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ color: "white", fontSize: 30, fontWeight: "900" }}>Music Quiz</Text>
          <Text style={{ color: "#94A3B8" }}>{copy.roomCode.replace("{code}", room.code)}</Text>
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>{copy.roundCount.replace("{current}", String(Math.min(currentRoundNumber, totalRounds))).replace("{total}", String(totalRounds))}</Text>
          {room.selected_pool ? <Text style={{ color: "#86EFAC", fontWeight: "900", textTransform: "uppercase" }}>{copy.chosenCategory}: {room.selected_pool}</Text> : null}
          <Text style={{ color: "#CBD5E1", lineHeight: 22 }}>{room.public_message ?? copy.waitHost}</Text>
        </View>

        <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.players}</Text>
            <Text style={{ color: "#94A3B8", fontWeight: "900" }}>{players.length}</Text>
          </View>
          {renderPlayerRows()}
          <Pressable onPress={copyInvite} style={({ pressed }) => ({ height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", opacity: pressed ? 0.92 : 1 })}>
            <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.copyInvite}</Text>
          </Pressable>
          {showCopiedToast ? <CopyToast visible={showCopiedToast} /> : null}
        </View>

        {room.state === "lobby" ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.setup}</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.setupBody}</Text>
            {isHost ? (
              <>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {([["hits", copy.hits], ["classics", copy.classics], ["mix", copy.mix]] as const).map(([value, label]) => (
                    <Pressable key={value} onPress={() => setSongPool(value)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: value === "hits" ? songPool === value ? "#7C2D12" : "rgba(124,45,18,0.18)" : value === "classics" ? songPool === value ? "#1D4ED8" : "rgba(29,78,216,0.18)" : songPool === value ? "#7E22CE" : "rgba(126,34,206,0.18)", borderWidth: songPool === value ? 2.5 : 1, borderColor: songPool === value ? value === "hits" ? "#FDBA74" : value === "classics" ? "#93C5FD" : "#D8B4FE" : value === "hits" ? "rgba(251,146,60,0.24)" : value === "classics" ? "rgba(96,165,250,0.24)" : "rgba(216,180,254,0.24)", opacity: pressed ? 0.92 : 1 })}>
                      <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => setPromptType("title")} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: promptType === "title" ? "#0F766E" : "rgba(15,118,110,0.14)", borderWidth: promptType === "title" ? 2.5 : 1, borderColor: promptType === "title" ? "#5EEAD4" : "rgba(45,212,191,0.22)", opacity: pressed ? 0.92 : 1 })}>
                    <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.guessTitle}</Text>
                  </Pressable>
                  <Pressable onPress={() => setPromptType("artist")} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: promptType === "artist" ? "#B45309" : "rgba(180,83,9,0.16)", borderWidth: promptType === "artist" ? 2.5 : 1, borderColor: promptType === "artist" ? "#FCD34D" : "rgba(251,191,36,0.22)", opacity: pressed ? 0.92 : 1 })}>
                    <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.guessArtist}</Text>
                  </Pressable>
                </View>
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", gap: 4 }}>
                  <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>{copy.selected}</Text>
                  <Text style={{ color: "white", fontWeight: "900" }}>
                    {songPool ? `${copy.chosenCategory}: ${songPool}` : copy.selectCategoryFirst}
                  </Text>
                  <Text style={{ color: "#E2E8F0", fontWeight: "800" }}>
                    {promptType ? (promptType === "artist" ? copy.guessArtist : copy.guessTitle) : copy.selectGuessFirst}
                  </Text>
                </View>
                <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.startRoundHint}</Text>
                {trackPreview ? (
                  <View style={{ padding: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", gap: 10 }}>
                    <View style={{ width: "100%", height: 180, borderRadius: 14, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }}>
                      <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 18, textTransform: "uppercase", textAlign: "center" }}>Track loaded</Text>
                      <Text style={{ color: "#94A3B8", textAlign: "center", marginTop: 8, lineHeight: 20 }}>
                        The song is ready for round start, but the cover stays hidden until reveal.
                      </Text>
                    </View>
                    <Text style={{ color: "#94A3B8", fontWeight: "800", textTransform: "uppercase" }}>Spotify track ready</Text>
                  </View>
                ) : null}
                <Pressable onPress={startRound} disabled={!canStartRound} style={({ pressed }) => ({ height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#15803D", opacity: !canStartRound ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.startRound}</Text>
                </Pressable>
              </>
            ) : <Text style={{ color: "#CBD5E1" }}>{copy.waitHost}</Text>}
          </View>
        ) : null}

        {room.state === "question" && currentRound ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.roundLive}</Text>
            <Text style={{ color: "#CBD5E1", fontSize: 18, fontWeight: "800" }}>
              {currentRound.prompt_type === "artist" ? copy.answerPromptArtist : copy.answerPromptTitle}
            </Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.answerHelp}</Text>
            {showIosReturnHint ? <Text style={{ color: "#93C5FD", lineHeight: 21 }}>{copy.iosReturnHint}</Text> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
                {copy.answersIn}: {answerCount}/{players.length}
              </Text>
              {isHost ? (
                <Pressable onPress={openSpotifyTrack} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#1D4ED8", opacity: pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.openSong}</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={answerText}
              onChangeText={setAnswerText}
              placeholder={copy.yourAnswer}
              placeholderTextColor="#64748B"
              style={{ minHeight: 56, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", paddingHorizontal: 16, color: "white", fontWeight: "700" }}
            />
            <Pressable onPress={submitAnswer} disabled={!answerText.trim() || busy === "submit-answer"} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#15803D", opacity: !answerText.trim() || busy === "submit-answer" ? 0.6 : pressed ? 0.92 : 1 })}>
              <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{myAnswer?.submitted_at ? copy.updateAnswer : copy.submitAnswer}</Text>
            </Pressable>
            {isHost ? (
              <Pressable onPress={revealRound} disabled={busy === "reveal-round"} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#B45309", opacity: busy === "reveal-round" ? 0.6 : pressed ? 0.92 : 1 })}>
                <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.reveal}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {room.state === "reveal" && currentRound ? (
          <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.revealLive}</Text>
            <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.revealBody}</Text>
            {showIosReturnHint ? <Text style={{ color: "#93C5FD", lineHeight: 21 }}>{copy.iosReturnHint}</Text> : null}
            <Pressable onPress={openSpotifyTrack} style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.94 : 1 })}>
              {currentRound.cover_image_url ? (
                <Image source={{ uri: currentRound.cover_image_url }} style={{ width: "100%", height: 220, borderRadius: 18 }} resizeMode="cover" />
              ) : null}
              <View style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937" }}>
                <Text style={{ color: "#94A3B8", fontWeight: "800", textTransform: "uppercase" }}>{copy.song}</Text>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 20 }}>{currentRound.song_title}</Text>
                <Text style={{ color: "#94A3B8", fontWeight: "800", textTransform: "uppercase", marginTop: 8 }}>{copy.artist}</Text>
                <Pressable onPress={() => openArtistPage(currentRound.artist_name, currentRound.artist_spotify_url)} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, alignSelf: "flex-start" })}>
                  <Text style={{ color: "#93C5FD", fontWeight: "800", fontSize: 18, textDecorationLine: "underline" }}>{currentRound.artist_name}</Text>
                </Pressable>
              </View>
            </Pressable>
            <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 16 }}>{copy.award}</Text>
            {players.map((player) => {
              const answer = answerByPlayerId.get(player.id);
              const fullPointsLabel = copy.markFull.replace("{points}", String(currentRound.point_value));
              const scoreOptions = Array.from(new Set([0, 1, currentRound.point_value]));
              return (
                <View key={player.id} style={{ padding: 14, borderRadius: 16, backgroundColor: "#020617", borderWidth: 1, borderColor: "#1F2937", gap: 10 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
                    <Text style={{ color: "#86EFAC", fontWeight: "900" }}>{answer?.awarded_points ?? 0}p</Text>
                  </View>
                  <Text style={{ color: "#CBD5E1" }}>{answer?.answer_text?.trim() ? answer.answer_text : copy.noAnswer}</Text>
                  {isHost ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {scoreOptions.map((points) => {
                        const selected = (answer?.awarded_points ?? 0) === points;
                        const label = points === 0 ? copy.markZero : points === 1 ? copy.markOne : fullPointsLabel;
                        return (
                          <Pressable
                            key={`${player.id}-${points}`}
                            onPress={() => awardPoints(player.id, points)}
                            disabled={busy === `award-${player.id}-${points}`}
                            style={({ pressed }) => ({
                              flex: 1,
                              minHeight: 44,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: selected ? "#15803D" : "#111827",
                              borderWidth: selected ? 2 : 1,
                              borderColor: selected ? "#86EFAC" : "#1F2937",
                              opacity: busy === `award-${player.id}-${points}` ? 0.6 : pressed ? 0.92 : 1,
                            })}
                          >
                            <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase", fontSize: 12 }}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {isHost ? (
              currentRound.round_number < totalRounds ? (
                <Pressable onPress={goToNextRound} disabled={busy === "next-round"} style={({ pressed }) => ({ minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#2563EB", opacity: busy === "next-round" ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.nextRound}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={finishGame} disabled={busy === "finish-game"} style={({ pressed }) => ({ minHeight: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#7C2D12", opacity: busy === "finish-game" ? 0.6 : pressed ? 0.92 : 1 })}>
                  <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.finishGame}</Text>
                </Pressable>
              )
            ) : null}
          </View>
        ) : null}

        {effectiveCompleted ? (
          <View style={{ gap: 14 }}>
            <Animated.View style={{ opacity: winnerOpacity, transform: [{ scale: winnerScale }] }}>
              <View style={{ borderRadius: 26, padding: 20, borderWidth: 1, borderColor: "rgba(250,204,21,0.28)", backgroundColor: "#120E05", overflow: "hidden", gap: 10 }}>
                <View style={{ position: "absolute", top: -60, right: -30, width: 220, height: 220, borderRadius: 999, backgroundColor: "rgba(250,204,21,0.12)" }} />
                <Text style={{ color: "#FCD34D", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>{copy.winnerReveal}</Text>
                <Text style={{ color: "white", fontWeight: "900", fontSize: 36, lineHeight: 40 }}>{winner?.display_name ?? "-"}</Text>
                <Text style={{ color: "#F8FAFC", fontWeight: "800", fontSize: 18 }}>{copy.champion}</Text>
                <Text style={{ color: "#FBBF24", fontWeight: "900", fontSize: 28 }}>{winner ? `${winner.score}p` : ""}</Text>
              </View>
            </Animated.View>

            <Animated.View style={{ opacity: rankingOpacity }}>
              <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 12 }}>
                <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17, textTransform: "uppercase" }}>{copy.finalStandings}</Text>
                <Text style={{ color: "#94A3B8", lineHeight: 22 }}>{copy.completedBody}</Text>
                {sortedPlayers.map((player, index) => (
                  <View key={`final-${player.id}`} style={{ paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: index === 0 ? "rgba(250,204,21,0.14)" : "#020617", borderWidth: 1, borderColor: index === 0 ? "rgba(250,204,21,0.24)" : "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      <Text style={{ color: index === 0 ? "#FCD34D" : "#94A3B8", fontWeight: "900", width: 34 }}>{copy.place.replace("{place}", String(index + 1))}</Text>
                      <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
                    </View>
                    <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>{player.score}p</Text>
                  </View>
                ))}
                {isHost ? (
                  <Pressable onPress={resetGame} disabled={busy === "reset-game"} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", opacity: busy === "reset-game" ? 0.6 : pressed ? 0.92 : 1 })}>
                    <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.resetGame}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          </View>
        ) : null}

        <View style={{ backgroundColor: "#0F172A", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#1E293B", gap: 10 }}>
          <Text style={{ color: "#F8FAFC", fontWeight: "900", fontSize: 17 }}>{copy.scoreboard}</Text>
          {sortedPlayers.map((player, index) => (
              <View key={`score-${player.id}`} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: index === 0 ? "rgba(21,128,61,0.14)" : "#020617", borderWidth: 1, borderColor: index === 0 ? "rgba(134,239,172,0.3)" : "#1F2937", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "900", flex: 1 }}>{player.display_name}</Text>
                <Text style={{ color: "#F8FAFC", fontWeight: "900" }}>{player.score}p</Text>
              </View>
            ))}
        </View>

        <Pressable onPress={() => router.replace("/")} style={({ pressed }) => ({ minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937", opacity: pressed ? 0.92 : 1 })}>
          <Text style={{ color: "white", fontWeight: "900", textTransform: "uppercase" }}>{copy.back}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
