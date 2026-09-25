import React, { useEffect, useMemo, useState } from "react";
import { SupportPicklo } from "../src/components/SupportPicklo";
import { ActivityIndicator, Animated, Easing, Image, Linking, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ShareButton } from "../src/components/ShareButton";
import { GAMES } from "../src/games/catalog";
import { awardMusicQuizPoints, completeMusicQuizGame, loadRandomMusicQuizTrack, revealMusicQuizRound, resetMusicQuizToLobby, startMusicQuizRound, submitMusicQuizAnswer } from "../src/games/music-quiz/api";
import type { SpotifyTrackPreview } from "../src/games/music-quiz/spotify";
import type { MusicQuizPromptType, MusicQuizSongPool } from "../src/games/music-quiz/types";
import { useMusicQuizRoom } from "../src/games/music-quiz/useMusicQuizRoom";
import { useI18n } from "../src/lib/i18n";
import { confirmAction, showAlert } from "../src/lib/notify";
import { Button, Card, Chip, RoomCodeBadge, Screen, SectionLabel, SegmentedControl, TextField, TopBar, type IconName } from "../src/ui/components";
import { colors, radius, space, type, withAlpha } from "../src/ui/theme";
import { SITE_URL } from "../src/lib/site";

const GAME = GAMES.musicQuiz;
const ACCENT = GAME.accent;

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
  const [trackPreview, setTrackPreview] = useState<SpotifyTrackPreview | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [promptType, setPromptType] = useState<"title" | "artist" | null>(null);
  const [songPool, setSongPool] = useState<MusicQuizSongPool | null>(null);
  const winnerOpacity = React.useRef(new Animated.Value(0)).current;
  const winnerScale = React.useRef(new Animated.Value(0.92)).current;
  const rankingOpacity = React.useRef(new Animated.Value(0)).current;
  const baseUrl = SITE_URL;

  const copy = language === "sv"
    ? { loading: "Laddar Music Quiz", actionFailed: "Åtgärden misslyckades", roomCode: "Rum {code}", host: "VÄRD", players: "Spelare", copyInvite: "Kopiera inbjudningslänk", waitHost: "Väntar på att värden ska välja kategori och ladda första låten.", setup: "Matchupplägg", setupBody: "Välj kategori en gång. Sedan spelas 10 rundor i samma kategori med olika låtar varje runda.", startRound: "Starta runda", startRoundHint: "Knappen laddar automatiskt en ny låt från vald kategori och startar rundan med vald frågetyp.", selectCategoryFirst: "Välj kategori först.", selectGuessFirst: "Välj vad spelarna ska gissa först.", selected: "Valt", hits: "Hits", classics: "Classics", mix: "Mix", guessTitle: "Gissa låttitel", guessArtist: "Gissa artist", points: "Poäng", nextRound: "Nästa runda", finishGame: "Avsluta match", winnerReveal: "Och vinnaren är...", champion: "Vinnare", finalStandings: "Slutplacering", place: "#{place}", openSong: "Öppna låt", iosReturnHint: "På iPhone kan du hoppa tillbaka snabbt via Picklo uppe till vänster efter att Spotify öppnas.", roundLive: "Rundan är live", roundCount: "Runda {current}/{total}", chosenCategory: "Kategori", completed: "Matchen är klar", completedBody: "Alla rundor är spelade. Slutställningen finns nedan.", answerPromptTitle: "Vilken låt är det?", answerPromptArtist: "Vilken artist är det?", answerHelp: "Alla svarar i appen. Hosten öppnar låten i Spotify och delar ut poäng i reveal-läget.", yourAnswer: "Ditt svar", submitAnswer: "Skicka svar", updateAnswer: "Uppdatera svar", answersIn: "Svar inne", reveal: "Visa facit", revealLive: "Facit", revealBody: "Tryck på omslaget för att öppna exakt låt i Spotify.", song: "Låt", artist: "Artist", scoreboard: "Poängtavla", noAnswer: "Inget svar ännu", award: "Rätta svar", markZero: "0 p", markOne: "+1 p", markFull: "+{points} p", resetGame: "Tillbaka till lobby", back: "Tillbaka till spel", invalidPoints: "Poängen måste vara mellan 1 och 10", noTrack: "Ladda en låt först",
        // UI pass additions
        youHost: "Du är värd", youPlayer: "Du spelar", you: "Du", category: "Kategori", guessMode: "Vad ska gissas?", openInSpotify: "Öppna i Spotify", trackLoaded: "Låten är laddad", trackLoadedBody: "Låten är redo för rundstart, men omslaget är dolt tills facit visas.", hostLobbyTitle: "Välj kategori och frågetyp", hostLobbyBody: "Tryck sedan på Starta runda. Låten öppnas i Spotify så att du kan spela den för alla.", playerLobbyTitle: "Väntar på värden", hostQuestionTitle: "Spela låten och låt alla svara", hostQuestionBody: "Svara gärna själv också. Tryck på Visa facit när alla har svarat.", playerQuestionTitle: "Skriv ditt svar nedan", playerAnswerSent: "Svaret är skickat", playerAnswerSentBody: "Du kan ändra det tills värden visar facit.", hostRevealTitle: "Dela ut poäng", hostRevealBody: "Tryck +1 p på alla som svarade rätt och gå sedan vidare.", playerRevealTitle: "Värden rättar svaren", playerRevealBody: "Kolla omslaget och se hur det gick.", playerDoneBody: "Värden kan starta en ny match från lobbyn.", leaveTitle: "Lämna rummet?", leaveBody: "Du lämnar matchen. Du kan gå med igen med rumskoden.", leave: "Lämna", cancel: "Avbryt", shareMessage: "Kör Music Quiz med mig på Picklo! Rumskod: {code}", leader: "Leder" }
    : { loading: "Loading Music Quiz", actionFailed: "Action failed", roomCode: "Room {code}", host: "HOST", players: "Players", copyInvite: "Copy invite link", waitHost: "Waiting for the host to choose a category and load the first song.", setup: "Match setup", setupBody: "Choose one category once. Then the game runs 10 rounds in that category with a different song each round.", startRound: "Start round", startRoundHint: "This button automatically loads a new song from the selected category and starts the round with the selected guess mode.", selectCategoryFirst: "Choose a category first.", selectGuessFirst: "Choose what players should guess first.", selected: "Selected", hits: "Hits", classics: "Classics", mix: "Mix", guessTitle: "Guess song title", guessArtist: "Guess artist", points: "Points", nextRound: "Next round", finishGame: "Finish game", winnerReveal: "And the winner is...", champion: "Champion", finalStandings: "Final standings", place: "#{place}", openSong: "Open song", iosReturnHint: "On iPhone you can jump straight back using the Picklo shortcut at the top left after Spotify opens.", roundLive: "Round live", roundCount: "Round {current}/{total}", chosenCategory: "Category", completed: "Match complete", completedBody: "All rounds are done. The final scoreboard is below.", answerPromptTitle: "What song is this?", answerPromptArtist: "Which artist is this?", answerHelp: "Everyone answers in the app. The host opens the song in Spotify and awards points during reveal.", yourAnswer: "Your answer", submitAnswer: "Submit answer", updateAnswer: "Update answer", answersIn: "Answers in", reveal: "Reveal answer", revealLive: "Answer reveal", revealBody: "Tap the cover to open the exact song on Spotify.", song: "Song", artist: "Artist", scoreboard: "Scoreboard", noAnswer: "No answer yet", award: "Score answers", markZero: "0 pts", markOne: "+1 pt", markFull: "+{points} pts", resetGame: "Back to lobby", back: "Back to games", invalidPoints: "Points must be between 1 and 10", noTrack: "Load a song first",
        // UI pass additions
        youHost: "You're the host", youPlayer: "You're playing", you: "You", category: "Category", guessMode: "What do players guess?", openInSpotify: "Open in Spotify", trackLoaded: "Track loaded", trackLoadedBody: "The song is ready for round start, but the cover stays hidden until reveal.", hostLobbyTitle: "Pick a category and guess mode", hostLobbyBody: "Then tap Start round. The song opens in Spotify so you can play it for everyone.", playerLobbyTitle: "Waiting for the host", hostQuestionTitle: "Play the song and let everyone answer", hostQuestionBody: "Feel free to answer too. Tap Reveal answer once everyone is in.", playerQuestionTitle: "Type your answer below", playerAnswerSent: "Answer sent", playerAnswerSentBody: "You can change it until the host reveals the answer.", hostRevealTitle: "Award points", hostRevealBody: "Tap +1 pt for everyone who got it right, then move on.", playerRevealTitle: "The host is scoring answers", playerRevealBody: "Check the cover and see how you did.", playerDoneBody: "The host can start a new match from the lobby.", leaveTitle: "Leave the room?", leaveBody: "You'll leave the match. You can rejoin with the room code.", leave: "Leave", cancel: "Cancel", shareMessage: "Play Music Quiz with me on Picklo! Room code: {code}", leader: "Leading" };

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
    try { await fn(); await refresh(); } catch (error) { showAlert(copy.actionFailed, String((error as Error)?.message ?? error)); } finally { setBusy(null); }
  };

  const openSpotifyDestination = async (trackId: string, webUrl: string) => {
    const appUrl = `spotify:track:${trackId}`;

    if (Platform.OS === "web") {
      const visibleDocument = typeof document !== "undefined" ? document : null;
      const visibleWindow = typeof window !== "undefined" ? window : null;

      if (!visibleWindow) return Linking.openURL(webUrl);

      return new Promise<void>((resolve) => {
        let finished = false;
        const cleanup = () => {
          if (visibleDocument) visibleDocument.removeEventListener("visibilitychange", handleVisibilityChange);
        };
        const finish = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve();
        };
        const handleVisibilityChange = () => {
          if (visibleDocument?.hidden) finish();
        };

        if (visibleDocument) visibleDocument.addEventListener("visibilitychange", handleVisibilityChange, { once: true });

        visibleWindow.location.href = appUrl;

        visibleWindow.setTimeout(() => {
          if (!visibleDocument?.hidden) {
            visibleWindow.location.href = webUrl;
          }
          finish();
        }, 900);
      });
    }

    if (await Linking.canOpenURL(appUrl)) return Linking.openURL(appUrl);
    return Linking.openURL(webUrl);
  };
  const openPreviewTrack = async (preview: SpotifyTrackPreview) => {
    return openSpotifyDestination(preview.spotifyTrackId, preview.spotifyUrl);
  };
  const openSpotifyTrack = async () => {
    if (!currentRound) return;
    return openSpotifyDestination(currentRound.spotify_track_id, currentRound.spotify_url);
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

  const leaveRoom = async () => {
    if (!effectiveCompleted) {
      const ok = await confirmAction(copy.leaveTitle, copy.leaveBody, { confirmLabel: copy.leave, cancelLabel: copy.cancel, destructive: true });
      if (!ok) return;
    }
    router.replace(GAME.href as any);
  };

  if (loading || !room) {
    return (
      <Screen topBar={<TopBar title={GAME.title} backHref={GAME.href} />} centered>
        <View style={{ alignItems: "center", gap: space.md }}>
          <ActivityIndicator color={ACCENT} size="large" />
          <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{copy.loading}</Text>
        </View>
      </Screen>
    );
  }

  const inLobby = room.state === "lobby" && !effectiveCompleted;
  const inQuestion = room.state === "question" && !!currentRound && !effectiveCompleted;
  const inReveal = room.state === "reveal" && !!currentRound && !effectiveCompleted;
  const answerSubmitted = !!myAnswer?.submitted_at;
  const roundLabel = copy.roundCount.replace("{current}", String(Math.min(currentRoundNumber, totalRounds))).replace("{total}", String(totalRounds));
  const poolLabel = (pool: MusicQuizSongPool | null | undefined) =>
    pool === "hits" ? copy.hits : pool === "classics" ? copy.classics : pool === "mix" ? copy.mix : "";

  // What this phone should do right now.
  const banner: { icon: IconName; title: string; body?: string | null } | null = effectiveCompleted
    ? isHost ? null : { icon: "trophy", title: copy.completed, body: copy.playerDoneBody }
    : inLobby
      ? isHost
        ? { icon: "options", title: copy.hostLobbyTitle, body: copy.hostLobbyBody }
        : { icon: "hourglass", title: copy.playerLobbyTitle, body: room.public_message ?? copy.waitHost }
      : inQuestion
        ? isHost
          ? { icon: "musical-notes", title: copy.hostQuestionTitle, body: copy.hostQuestionBody }
          : answerSubmitted
            ? { icon: "checkmark-circle", title: copy.playerAnswerSent, body: copy.playerAnswerSentBody }
            : { icon: "create", title: copy.playerQuestionTitle, body: copy.answerHelp }
        : inReveal
          ? isHost
            ? { icon: "ribbon", title: copy.hostRevealTitle, body: copy.hostRevealBody }
            : { icon: "hourglass", title: copy.playerRevealTitle, body: copy.playerRevealBody }
          : { icon: "hourglass", title: room.public_message ?? copy.waitHost };

  // ---------------------------------------------------------------------------
  // Footer: primary actions in thumb reach.
  // ---------------------------------------------------------------------------
  let footer: React.ReactNode = null;
  if (inLobby && isHost) {
    footer = (
      <Button
        label={copy.startRound}
        icon="play"
        accent={ACCENT}
        onPress={startRound}
        loading={busy === "start-round"}
        disabled={!canStartRound}
      />
    );
  } else if (inQuestion) {
    footer = (
      <>
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={answerText}
              onChangeText={setAnswerText}
              placeholder={copy.yourAnswer}
              accessibilityLabel={copy.yourAnswer}
              returnKeyType="send"
              onSubmitEditing={() => { if (answerText.trim()) submitAnswer(); }}
              accent={ACCENT}
              maxLength={80}
            />
          </View>
          <Button
            label={answerSubmitted ? copy.updateAnswer : copy.submitAnswer}
            icon={answerSubmitted ? "refresh" : "send"}
            variant={isHost ? "secondary" : "primary"}
            accent={ACCENT}
            onPress={submitAnswer}
            loading={busy === "submit-answer"}
            disabled={!answerText.trim()}
            style={{ maxWidth: 170 }}
          />
        </View>
        {isHost ? (
          <Button label={copy.reveal} icon="eye" accent={ACCENT} onPress={revealRound} loading={busy === "reveal-round"} />
        ) : null}
      </>
    );
  } else if (inReveal && isHost && currentRound) {
    footer =
      currentRound.round_number < totalRounds ? (
        <Button label={copy.nextRound} icon="play-forward" accent={ACCENT} onPress={goToNextRound} loading={busy === "next-round"} />
      ) : (
        <Button label={copy.finishGame} icon="flag" accent={ACCENT} onPress={finishGame} loading={busy === "finish-game"} />
      );
  } else if (effectiveCompleted && isHost) {
    footer = <Button label={copy.resetGame} icon="refresh" accent={ACCENT} onPress={resetGame} loading={busy === "reset-game"} />;
  }

  return (
    <Screen
      topBar={
        <TopBar
          title={GAME.title}
          onBack={leaveRoom}
          right={!inLobby ? <Chip label={room.code} icon="key" color={colors.textMuted} /> : undefined}
        />
      }
      footer={footer}
    >
      {/* Role + what to do now */}
      {banner ? <RoleBanner isHost={isHost} roleLabel={isHost ? copy.youHost : copy.youPlayer} icon={banner.icon} title={banner.title} body={banner.body} /> : null}

      {/* Lobby */}
      {inLobby ? (
        <>
          <Card accent={ACCENT} style={{ alignItems: "center", gap: space.md }}>
            <RoomCodeBadge code={room.code} label={t("common.room_code")} accent={ACCENT} />
            <View style={{ alignSelf: "stretch" }}>
              <ShareButton
                label={t("common.invite")}
                message={copy.shareMessage.replace("{code}", room.code)}
                url={inviteUrl}
                accentColor={ACCENT}
              />
            </View>
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionLabel right={<Text style={[type.caption, { color: colors.textMuted }]}>{players.length}</Text>}>{copy.players}</SectionLabel>
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                name={player.display_name}
                isHost={player.id === room.host_player_id}
                isMe={player.id === myPlayer?.id}
                hostLabel={t("common.host")}
                youLabel={copy.you}
              />
            ))}
          </View>

          {isHost ? (
            <Card>
              <Text style={[type.heading, { color: colors.text }]}>{copy.setup}</Text>
              <Text style={[type.small, { color: colors.textMuted }]}>{copy.setupBody}</Text>
              <SectionLabel>{copy.category}</SectionLabel>
              <SegmentedControl<MusicQuizSongPool>
                value={songPool as MusicQuizSongPool}
                onChange={setSongPool}
                accent={ACCENT}
                options={[
                  { value: "hits", label: copy.hits },
                  { value: "classics", label: copy.classics },
                  { value: "mix", label: copy.mix },
                ]}
              />
              <SectionLabel>{copy.guessMode}</SectionLabel>
              <SegmentedControl<MusicQuizPromptType>
                value={promptType as MusicQuizPromptType}
                onChange={setPromptType}
                accent={ACCENT}
                options={[
                  { value: "title", label: copy.guessTitle },
                  { value: "artist", label: copy.guessArtist },
                ]}
              />
              {!songPool || !promptType ? (
                <Text style={[type.small, { color: colors.warning }]}>{!songPool ? copy.selectCategoryFirst : copy.selectGuessFirst}</Text>
              ) : (
                <Text style={[type.small, { color: colors.textMuted }]}>{copy.startRoundHint}</Text>
              )}
              {trackPreview ? (
                <View style={{ flexDirection: "row", gap: space.md, alignItems: "center", padding: space.md, borderRadius: radius.md, backgroundColor: colors.sunken }}>
                  <Ionicons name="musical-note" size={22} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: colors.text }]}>{copy.trackLoaded}</Text>
                    <Text style={[type.small, { color: colors.textMuted }]}>{copy.trackLoadedBody}</Text>
                  </View>
                </View>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {/* Question */}
      {inQuestion && currentRound ? (
        <Card accent={ACCENT} style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <Chip label={roundLabel} color={ACCENT} icon="musical-notes" />
            {room.selected_pool ? <Chip label={poolLabel(room.selected_pool)} color={colors.textMuted} icon="albums" /> : null}
          </View>
          <Text accessibilityRole="header" style={[type.display, { color: colors.text }]}>
            {currentRound.prompt_type === "artist" ? copy.answerPromptArtist : copy.answerPromptTitle}
          </Text>
          <AnswersProgress label={copy.answersIn} count={answerCount} total={players.length} />
          {isHost ? (
            <Button label={copy.openSong} icon="play-circle" variant="secondary" size="md" onPress={openSpotifyTrack} />
          ) : null}
          {showIosReturnHint ? <Text style={[type.small, { color: colors.brand }]}>{copy.iosReturnHint}</Text> : null}
        </Card>
      ) : null}

      {/* Reveal */}
      {inReveal && currentRound ? (
        <>
          <Card accent={ACCENT} style={{ alignItems: "center", gap: space.md }}>
            <SectionLabel>{copy.revealLive}</SectionLabel>
            {currentRound.cover_image_url ? (
              <Pressable
                onPress={openSpotifyTrack}
                accessibilityRole="button"
                accessibilityLabel={copy.openInSpotify}
                style={({ pressed }) => ({ width: "100%", maxWidth: 260, alignSelf: "center", opacity: pressed ? 0.9 : 1 })}
              >
                <Image
                  source={{ uri: currentRound.cover_image_url }}
                  style={{ width: "100%", aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.sunken }}
                  resizeMode="cover"
                />
              </Pressable>
            ) : null}
            <View style={{ alignItems: "center", gap: 2, alignSelf: "stretch" }}>
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.song}</Text>
              <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{currentRound.song_title}</Text>
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase", marginTop: space.sm }]}>{copy.artist}</Text>
              <Pressable
                onPress={() => openArtistPage(currentRound.artist_name, currentRound.artist_spotify_url)}
                accessibilityRole="link"
                hitSlop={8}
                style={({ pressed }) => ({ minHeight: 32, justifyContent: "center", opacity: pressed ? 0.8 : 1 })}
              >
                <Text style={[type.heading, { color: ACCENT, textAlign: "center", textDecorationLine: "underline" }]}>{currentRound.artist_name}</Text>
              </Pressable>
            </View>
            <Button label={copy.openInSpotify} icon="play-circle" accent={ACCENT} size="md" onPress={openSpotifyTrack} style={{ alignSelf: "stretch" }} />
            <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.revealBody}</Text>
            {showIosReturnHint ? <Text style={[type.small, { color: colors.brand, textAlign: "center" }]}>{copy.iosReturnHint}</Text> : null}
          </Card>

          <View style={{ gap: space.sm }}>
            <SectionLabel>{copy.award}</SectionLabel>
            {players.map((player) => {
              const answer = answerByPlayerId.get(player.id);
              const awarded = answer?.awarded_points ?? 0;
              const fullPointsLabel = copy.markFull.replace("{points}", String(currentRound.point_value));
              const scoreOptions = Array.from(new Set([0, 1, currentRound.point_value]));
              const hasAnswer = !!answer?.answer_text?.trim();
              return (
                <View
                  key={player.id}
                  style={{
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: awarded > 0 ? withAlpha(colors.success, 0.5) : colors.border,
                    gap: space.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
                      {player.display_name}
                      {player.id === myPlayer?.id ? <Text style={{ color: colors.textMuted }}>{` · ${copy.you}`}</Text> : null}
                    </Text>
                    {awarded > 0 ? <Chip label={`+${awarded}p`} color={colors.success} icon="checkmark" /> : null}
                  </View>
                  <Text style={[type.body, { color: hasAnswer ? colors.textSecondary : colors.textSubtle, fontStyle: hasAnswer ? "normal" : "italic" }]}>
                    {hasAnswer ? answer!.answer_text : copy.noAnswer}
                  </Text>
                  {isHost ? (
                    <View style={{ flexDirection: "row", gap: space.sm }}>
                      {scoreOptions.map((points) => (
                        <ScoreToggle
                          key={`${player.id}-${points}`}
                          label={points === 0 ? copy.markZero : points === 1 ? copy.markOne : fullPointsLabel}
                          selected={awarded === points}
                          positive={points > 0}
                          busy={busy === `award-${player.id}-${points}`}
                          onPress={() => awardPoints(player.id, points)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {/* Completed */}
      {effectiveCompleted ? (
        <View style={{ gap: space.lg }}>
          <Animated.View style={{ opacity: winnerOpacity, transform: [{ scale: winnerScale }] }}>
            <View
              style={{
                borderRadius: radius.xl,
                padding: space.xl,
                borderWidth: 1,
                borderColor: withAlpha(colors.warning, 0.4),
                backgroundColor: withAlpha(colors.warning, 0.08),
                alignItems: "center",
                gap: space.sm,
              }}
            >
              <Ionicons name="trophy" size={40} color={colors.warning} />
              <Text style={[type.caption, { color: colors.warning, textTransform: "uppercase" }]}>{copy.winnerReveal}</Text>
              <Text style={[type.display, { color: colors.text, fontSize: 36, lineHeight: 42, textAlign: "center" }]}>{winner?.display_name ?? "-"}</Text>
              <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{copy.champion}</Text>
              <Text style={{ color: colors.warning, fontWeight: "900", fontSize: 28 }}>{winner ? `${winner.score}p` : ""}</Text>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: rankingOpacity, gap: space.sm }}>
            <SectionLabel>{copy.finalStandings}</SectionLabel>
            <Text style={[type.small, { color: colors.textMuted }]}>{copy.completedBody}</Text>
            {sortedPlayers.map((player, index) => (
              <ScoreRow
                key={`final-${player.id}`}
                rank={index + 1}
                name={player.display_name}
                score={player.score}
                leader={index === 0}
                isMe={player.id === myPlayer?.id}
                youLabel={copy.you}
                leaderColor={colors.warning}
              />
            ))}
          </Animated.View>
          <SupportPicklo />
        </View>
      ) : null}

      {/* Live scoreboard */}
      {!inLobby && !effectiveCompleted ? (
        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.scoreboard}</SectionLabel>
          {sortedPlayers.map((player, index) => (
            <ScoreRow
              key={`score-${player.id}`}
              rank={index + 1}
              name={player.display_name}
              score={player.score}
              leader={index === 0 && (player.score ?? 0) > 0}
              isMe={player.id === myPlayer?.id}
              youLabel={copy.you}
              leaderColor={ACCENT}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

function RoleBanner({ isHost, roleLabel, icon, title, body }: { isHost: boolean; roleLabel: string; icon: IconName; title: string; body?: string | null }) {
  const tint = isHost ? ACCENT : colors.brand;
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: "row",
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        backgroundColor: withAlpha(tint, 0.1),
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.35),
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(tint, 0.18) }}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Chip label={roleLabel} color={tint} icon={isHost ? "star" : "person"} />
        <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
        {body ? <Text style={[type.small, { color: colors.textSecondary }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

function PlayerRow({ name, isHost, isMe, hostLabel, youLabel }: { name: string; isHost: boolean; isMe: boolean; hostLabel: string; youLabel: string }) {
  return (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: isMe ? withAlpha(ACCENT, 0.08) : colors.surface,
        borderWidth: 1,
        borderColor: isMe ? withAlpha(ACCENT, 0.35) : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
      }}
    >
      <Ionicons name="person-circle" size={24} color={isMe ? ACCENT : colors.textSubtle} />
      <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
        {name}
        {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{` (${youLabel})`}</Text> : null}
      </Text>
      {isHost ? <Chip label={hostLabel} color={ACCENT} icon="star" /> : null}
    </View>
  );
}

function ScoreRow({ rank, name, score, leader, isMe, youLabel, leaderColor }: { rank: number; name: string; score: number; leader: boolean; isMe: boolean; youLabel: string; leaderColor: string }) {
  return (
    <View
      style={{
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        backgroundColor: leader ? withAlpha(leaderColor, 0.12) : colors.surface,
        borderWidth: 1,
        borderColor: leader ? withAlpha(leaderColor, 0.45) : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
      }}
    >
      {leader ? (
        <Ionicons name="trophy" size={18} color={leaderColor} style={{ width: 24, textAlign: "center" }} />
      ) : (
        <Text style={{ width: 24, textAlign: "center", color: colors.textMuted, fontWeight: "900", fontSize: 14 }}>{rank}</Text>
      )}
      <Text numberOfLines={1} style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>
        {name}
        {isMe ? <Text style={{ color: colors.textMuted, fontWeight: "600" }}>{` (${youLabel})`}</Text> : null}
      </Text>
      <Text style={{ color: leader ? leaderColor : colors.text, fontWeight: "900", fontSize: 18 }}>{score}p</Text>
    </View>
  );
}

function ScoreToggle({ label, selected, positive, busy, onPress }: { label: string; selected: boolean; positive: boolean; busy: boolean; onPress: () => void }) {
  const tone = positive ? colors.success : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ selected, busy }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        borderRadius: radius.sm,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        backgroundColor: selected ? withAlpha(tone, 0.22) : colors.sunken,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? tone : colors.border,
        opacity: busy ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      {busy ? <ActivityIndicator size="small" color={tone} /> : selected ? <Ionicons name="checkmark" size={16} color={tone} /> : null}
      <Text style={{ color: selected ? colors.text : colors.textSecondary, fontWeight: "900", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function AnswersProgress({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.min(1, count / total) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[type.small, { color: colors.textSecondary, fontWeight: "700" }]}>{label}</Text>
        <Text style={[type.small, { color: colors.text, fontWeight: "900" }]}>{count}/{total}</Text>
      </View>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.sunken, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: "100%", borderRadius: radius.pill, backgroundColor: ACCENT }} />
      </View>
    </View>
  );
}
