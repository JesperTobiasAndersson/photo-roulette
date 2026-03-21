export type SpotifyTrackPreview = {
  spotifyUrl: string;
  spotifyTrackId: string;
  songTitle: string;
  artistName: string;
  coverImageUrl: string | null;
};

function normalizeSpotifyUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a Spotify track link");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid Spotify track link");
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.includes("spotify.com") && !hostname.includes("spotify.link")) {
    throw new Error("Paste a Spotify track link");
  }

  return trimmed;
}

function parseTrackIdFromUrl(input: string) {
  const normalized = normalizeSpotifyUrl(input);
  const trackMatch = normalized.match(/track\/([A-Za-z0-9]+)/i);
  if (!trackMatch?.[1]) {
    throw new Error("That link does not look like a Spotify track");
  }
  return { normalized, trackId: trackMatch[1] };
}

function splitSpotifyTitle(title: string) {
  const clean = title.replace(/\s*\|\s*Spotify\s*$/i, "").trim();
  const songByArtistMatch = clean.match(/^(.*?)\s*-\s*(?:song and lyrics by\s*)?(.*)$/i);
  if (songByArtistMatch?.[1] && songByArtistMatch?.[2]) {
    return {
      songTitle: songByArtistMatch[1].trim(),
      artistName: songByArtistMatch[2].trim(),
    };
  }

  return {
    songTitle: clean,
    artistName: "",
  };
}

export async function loadSpotifyTrackPreview(input: string): Promise<SpotifyTrackPreview> {
  const { normalized, trackId } = parseTrackIdFromUrl(input);
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(normalized)}`;
  const response = await fetch(oembedUrl);
  if (!response.ok) {
    throw new Error("Could not load that Spotify track");
  }

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  const titleParts = splitSpotifyTitle(data.title ?? "");
  const artistName = data.author_name?.trim() || titleParts.artistName;
  const songTitle = titleParts.songTitle.trim();

  if (!songTitle) {
    throw new Error("Could not read the song title from Spotify");
  }

  return {
    spotifyUrl: normalized,
    spotifyTrackId: trackId,
    songTitle,
    artistName: artistName || "Unknown artist",
    coverImageUrl: data.thumbnail_url ?? null,
  };
}
