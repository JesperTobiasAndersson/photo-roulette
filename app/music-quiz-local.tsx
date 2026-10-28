import React, { useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedEntrance } from "../src/components/AnimatedEntrance";
import { GAMES } from "../src/games/catalog";
import { LocalScoreboard, LocalTopBar, PlayerNamesEditor, useRememberedPlayerNames } from "../src/games/local/components";
import { localPlayerId, useLocalGame } from "../src/games/local/useLocalGame";
import { loadMusicQuizLibrary } from "../src/games/music-quiz/api";
import type { MusicQuizLibraryEntry } from "../src/games/music-quiz/data";
import { loadSpotifyTrackPreview, openSpotifyTrack } from "../src/games/music-quiz/spotify";
import type { MusicQuizPromptType, MusicQuizSongPool } from "../src/games/music-quiz/types";
import { useI18n } from "../src/lib/i18n";
import { showAlert } from "../src/lib/notify";
import { ensureSession } from "../src/lib/supabase";
import { Button, Card, Chip, Screen, SectionLabel, SegmentedControl } from "../src/ui/components";
import { colors, radius, space, touch, type, withAlpha } from "../src/ui/theme";

const GAME = GAMES.musicQuiz;
const ACCENT = GAME.accent;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 20;
const TOTAL_ROUNDS = 10;

type Track = { spotifyUrl: string; spotifyTrackId: string; songTitle: string; artistName: string; coverImageUrl: string | null };

type MusicQuizLocalGame = {
  players: { id: string; name: string; score: number }[];
  pool: MusicQuizSongPool;
  promptType: MusicQuizPromptType;
  round: number;
  track: Track;
  /** Every song played this game, so none repeats. */
  playedKeys: string[];
  /** Players marked right in the current reveal. */
  correctIds: string[];
  phase: "playing" | "reveal" | "ended";
};

const COPY = {
  en: {
    title: "Music Quiz · one phone",
    setupTitle: "One phone, one speaker",
    setupBody: "The phone plays the song in Spotify, everyone shouts (or writes down) their guess, and the phone keeps score.",
    category: "Category",
    hits: "Hits",
    classics: "Classics",
    mix: "Mix",
    guessMode: "What do you guess?",
    guessTitle: "Song title",
    guessArtist: "Artist",
    start: "Start the game",
    round: (a: number, b: number) => `Round ${a}/${b}`,
    promptTitle: "What song is this?",
    promptArtist: "Which artist is this?",
    playingBody: "Play the song for everyone. Shout your guess – or write it down so nobody can copy – then show the answer.",
    playSong: "Play the song in Spotify",
    iosReturnHint: "On iPhone, tap \"Picklo\" / the browser at the top left to come back after Spotify opens.",
    showAnswer: "Show answer",
    song: "Song",
    artist: "Artist",
    whoRight: "Who got it right? Tap everyone who did.",
    nextRound: "Next round",
    finish: "Finish game",
    scoreboard: "Scoreboard",
    finished: "Match complete",
    winner: (names: string) => `Winner: ${names}`,
    playAgain: "Play again – new songs",
    changeSetup: "Change players or category",
    loadFailed: "Couldn't load a song",
    loadFailedBody: "Check your internet connection and try again.",
  },
  sv: {
    title: "Music Quiz · en telefon",
    setupTitle: "En telefon, en högtalare",
    setupBody: "Telefonen spelar låten i Spotify, alla ropar (eller skriver ner) sin gissning och telefonen håller koll på poängen.",
    category: "Kategori",
    hits: "Hits",
    classics: "Klassiker",
    mix: "Mix",
    guessMode: "Vad ska ni gissa?",
    guessTitle: "Låttitel",
    guessArtist: "Artist",
    start: "Starta spelet",
    round: (a: number, b: number) => `Runda ${a}/${b}`,
    promptTitle: "Vilken låt är det?",
    promptArtist: "Vilken artist är det?",
    playingBody: "Spela låten för alla. Ropa ut er gissning – eller skriv ner den så att ingen kan härma – och visa sedan svaret.",
    playSong: "Spela låten i Spotify",
    iosReturnHint: "På iPhone trycker du på \"Picklo\" / webbläsaren uppe till vänster för att komma tillbaka när Spotify har öppnats.",
    showAnswer: "Visa svaret",
    song: "Låt",
    artist: "Artist",
    whoRight: "Vem hade rätt? Tryck på alla som hade det.",
    nextRound: "Nästa runda",
    finish: "Avsluta matchen",
    scoreboard: "Poängtavla",
    finished: "Matchen är klar",
    winner: (names: string) => `Vinnare: ${names}`,
    playAgain: "Spela igen – nya låtar",
    changeSetup: "Byt spelare eller kategori",
    loadFailed: "Kunde inte ladda en låt",
    loadFailedBody: "Kolla internetanslutningen och försök igen.",
  },
};

const songKey = (title: string, artist: string) => `${title}|${artist}`.toLowerCase();

export default function MusicQuizLocalScreen() {
  const { language } = useI18n();
  const copy = COPY[language];
  const { state: game, setState: setGame, loaded } = useLocalGame<MusicQuizLocalGame>("music-quiz");
  const [names, setNames] = useRememberedPlayerNames();
  const [pool, setPool] = useState<MusicQuizSongPool>("mix");
  const [promptType, setPromptType] = useState<MusicQuizPromptType>("title");
  const [busy, setBusy] = useState(false);
  const libraries = useRef<Partial<Record<MusicQuizSongPool, MusicQuizLibraryEntry[]>>>({});

  /** A random song from the pool that hasn't been played this game (cover art when Spotify answers). */
  const pickTrack = async (songPool: MusicQuizSongPool, playedKeys: string[]): Promise<Track> => {
    let library = libraries.current[songPool];
    if (!library) {
      // The full library is readable by any signed-in device; without a connection the bundled list is used.
      await ensureSession().catch(() => undefined);
      library = await loadMusicQuizLibrary(songPool);
      libraries.current[songPool] = library;
    }
    const played = new Set(playedKeys);
    const unused = library.filter((entry) => !played.has(songKey(entry.songTitle, entry.artistName)));
    const source = unused.length > 0 ? unused : library;
    const entry = source[Math.floor(Math.random() * source.length)];
    try {
      return await loadSpotifyTrackPreview(entry);
    } catch {
      return { spotifyUrl: entry.spotifyUrl, spotifyTrackId: entry.spotifyTrackId, songTitle: entry.songTitle, artistName: entry.artistName, coverImageUrl: null };
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      console.error("music quiz (one phone) failed", error);
      showAlert(copy.loadFailed, copy.loadFailedBody);
    } finally {
      setBusy(false);
    }
  };

  const startGame = (playerNames: string[], songPool: MusicQuizSongPool, guess: MusicQuizPromptType) =>
    withBusy(async () => {
      const track = await pickTrack(songPool, []);
      setGame({
        players: playerNames.map((name, index) => ({ id: localPlayerId(index), name, score: 0 })),
        pool: songPool,
        promptType: guess,
        round: 1,
        track,
        playedKeys: [songKey(track.songTitle, track.artistName)],
        correctIds: [],
        phase: "playing",
      });
    });

  const topBar = <LocalTopBar title={copy.title} backHref={GAME.href} running={!!game && game.phase !== "ended"} onQuit={() => setGame(null)} />;

  if (!loaded) return <Screen topBar={topBar}>{null}</Screen>;

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  if (!game) {
    return (
      <Screen
        topBar={topBar}
        footer={
          <Button
            label={copy.start}
            icon="play"
            accent={ACCENT}
            loading={busy}
            disabled={names.length < MIN_PLAYERS}
            onPress={() => startGame(names, pool, promptType)}
          />
        }
      >
        <View style={{ gap: space.xs }}>
          <Text style={[type.title, { color: colors.text }]}>{copy.setupTitle}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{copy.setupBody}</Text>
        </View>

        <PlayerNamesEditor names={names} onChange={setNames} min={MIN_PLAYERS} max={MAX_PLAYERS} accent={ACCENT} />

        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.category}</SectionLabel>
          <SegmentedControl
            value={pool}
            onChange={setPool}
            accent={ACCENT}
            options={[
              { value: "hits", label: copy.hits },
              { value: "classics", label: copy.classics },
              { value: "mix", label: copy.mix },
            ]}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <SectionLabel>{copy.guessMode}</SectionLabel>
          <SegmentedControl
            value={promptType}
            onChange={setPromptType}
            accent={ACCENT}
            options={[
              { value: "title", label: copy.guessTitle },
              { value: "artist", label: copy.guessArtist },
            ]}
          />
        </View>
      </Screen>
    );
  }

  const scoreboard = (
    <View style={{ gap: space.sm }}>
      <SectionLabel>{copy.scoreboard}</SectionLabel>
      <LocalScoreboard players={game.players} accent={ACCENT} />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Game over
  // ---------------------------------------------------------------------------
  if (game.phase === "ended") {
    const top = Math.max(...game.players.map((p) => p.score));
    const winners = game.players.filter((p) => p.score === top);
    return (
      <Screen
        topBar={topBar}
        footer={
          <>
            <Button
              label={copy.playAgain}
              icon="refresh"
              accent={ACCENT}
              loading={busy}
              onPress={() =>
                startGame(
                  game.players.map((p) => p.name),
                  game.pool,
                  game.promptType
                )
              }
            />
            <Button label={copy.changeSetup} icon="settings-outline" variant="ghost" size="md" onPress={() => setGame(null)} />
          </>
        }
      >
        <AnimatedEntrance enterKey="ended" style={{ gap: space.lg }}>
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="trophy" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{copy.finished}</Text>
            <Text style={[type.heading, { color: ACCENT, textAlign: "center" }]}>{copy.winner(winners.map((p) => p.name).join(", "))}</Text>
          </Card>
          {scoreboard}
        </AnimatedEntrance>
      </Screen>
    );
  }

  const roundChip = <Chip label={copy.round(game.round, TOTAL_ROUNDS)} color={ACCENT} icon="musical-notes" />;
  const play = () => openSpotifyTrack(game.track.spotifyTrackId, game.track.spotifyUrl).catch(() => undefined);

  // ---------------------------------------------------------------------------
  // Song playing
  // ---------------------------------------------------------------------------
  if (game.phase === "playing") {
    return (
      <Screen
        topBar={topBar}
        footer={<Button label={copy.showAnswer} icon="eye-outline" accent={ACCENT} onPress={() => setGame((g) => ({ ...g, phase: "reveal", correctIds: [] }))} />}
      >
        <AnimatedEntrance enterKey={`round-${game.round}`} style={{ gap: space.md }}>
          {roundChip}
          <Card accent={ACCENT} style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Ionicons name="musical-notes" size={48} color={ACCENT} />
            <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
              {game.promptType === "artist" ? copy.promptArtist : copy.promptTitle}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: "center" }]}>{copy.playingBody}</Text>
            <View style={{ alignSelf: "stretch" }}>
              <Button label={copy.playSong} icon="play-circle" accent={ACCENT} variant="secondary" onPress={play} />
            </View>
            {Platform.OS === "web" && typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
              <Text style={[type.small, { color: colors.textMuted, textAlign: "center" }]}>{copy.iosReturnHint}</Text>
            ) : null}
          </Card>
        </AnimatedEntrance>
        {scoreboard}
      </Screen>
    );
  }

  // ---------------------------------------------------------------------------
  // Answer: tick everyone who was right
  // ---------------------------------------------------------------------------
  const last = game.round >= TOTAL_ROUNDS;
  const nextRound = () =>
    withBusy(async () => {
      const players = game.players.map((p) => (game.correctIds.includes(p.id) ? { ...p, score: p.score + 1 } : p));
      if (last) {
        setGame({ ...game, players, phase: "ended" });
        return;
      }
      const track = await pickTrack(game.pool, game.playedKeys);
      setGame({
        ...game,
        players,
        round: game.round + 1,
        track,
        playedKeys: [...game.playedKeys, songKey(track.songTitle, track.artistName)],
        correctIds: [],
        phase: "playing",
      });
    });

  return (
    <Screen
      topBar={topBar}
      footer={<Button label={last ? copy.finish : copy.nextRound} icon={last ? "flag" : "play-forward"} accent={ACCENT} loading={busy} onPress={nextRound} />}
    >
      <AnimatedEntrance enterKey={`reveal-${game.round}`} style={{ gap: space.md }}>
        {roundChip}
        <Card accent={ACCENT} style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Pressable onPress={play} accessibilityRole="button" accessibilityLabel={copy.playSong}>
            {game.track.coverImageUrl ? (
              <Image source={{ uri: game.track.coverImageUrl }} style={{ width: 96, height: 96, borderRadius: radius.md }} />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(ACCENT, 0.16) }}>
                <Ionicons name="musical-note" size={40} color={ACCENT} />
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: space.sm }}>
            <View>
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.song}</Text>
              <Text style={[type.heading, { color: colors.text }]}>{game.track.songTitle}</Text>
            </View>
            <View>
              <Text style={[type.caption, { color: colors.textMuted, textTransform: "uppercase" }]}>{copy.artist}</Text>
              <Text style={[type.bodyStrong, { color: colors.textSecondary }]}>{game.track.artistName}</Text>
            </View>
          </View>
        </Card>

        <Text style={[type.body, { color: colors.textSecondary }]}>{copy.whoRight}</Text>
        <View style={{ gap: space.sm }}>
          {game.players.map((player) => {
            const right = game.correctIds.includes(player.id);
            return (
              <Pressable
                key={player.id}
                onPress={() =>
                  setGame((g) => ({
                    ...g,
                    correctIds: right ? g.correctIds.filter((id) => id !== player.id) : [...g.correctIds, player.id],
                  }))
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: right }}
                style={({ pressed }) => ({
                  minHeight: touch.primary,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  backgroundColor: right ? withAlpha(colors.success, 0.16) : colors.surface,
                  borderWidth: 2,
                  borderColor: right ? colors.success : colors.border,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Ionicons name={right ? "checkmark-circle" : "ellipse-outline"} size={26} color={right ? colors.success : colors.textSubtle} />
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }}>
                  {player.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontWeight: "800" }}>
                  {player.score}
                  {right ? <Text style={{ color: colors.success }}> +1</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </AnimatedEntrance>
    </Screen>
  );
}
