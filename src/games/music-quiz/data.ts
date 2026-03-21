export type MusicQuizLibraryCategory = "hits" | "classics";

export type MusicQuizLibraryEntry = {
  spotifyUrl: string;
  spotifyTrackId: string;
  songTitle: string;
  artistName: string;
  artistSpotifyUrl: string;
  category: MusicQuizLibraryCategory;
};

export const MUSIC_QUIZ_LIBRARY: MusicQuizLibraryEntry[] = [
  { spotifyUrl: "https://open.spotify.com/track/07TGjTgMGUDW5qrsMrOnYA", spotifyTrackId: "07TGjTgMGUDW5qrsMrOnYA", songTitle: "Blinding Lights", artistName: "The Weeknd", artistSpotifyUrl: "https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS", spotifyTrackId: "32OlwWuMpZ6b0aN2RZOeMS", songTitle: "Uptown Funk (feat. Bruno Mars)", artistName: "Mark Ronson, Bruno Mars", artistSpotifyUrl: "https://open.spotify.com/artist/3hv9jJF3adDNsBSIQDqcjp", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/3Hwl0OPFb6d66RFoV3cMzP", spotifyTrackId: "3Hwl0OPFb6d66RFoV3cMzP", songTitle: "Rolling In The Deep", artistName: "Adele", artistSpotifyUrl: "https://open.spotify.com/artist/4dpARuHxo51G3z768sgnrY", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/5avln5GEFcjd1iQDx5xjVN", spotifyTrackId: "5avln5GEFcjd1iQDx5xjVN", songTitle: "Billie Jean", artistName: "Michael Jackson", artistSpotifyUrl: "https://open.spotify.com/artist/3fMbdgg4jU18AjLCKBhRSm", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/2x7Sc5js1etrlZ50lH482p", spotifyTrackId: "2x7Sc5js1etrlZ50lH482p", songTitle: "Mr. Brightside", artistName: "The Killers", artistSpotifyUrl: "https://open.spotify.com/artist/0C0XlULifJtAgn6ZNCW2eu", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/6FyfOXMpEkiIV6cuVx5PgH", spotifyTrackId: "6FyfOXMpEkiIV6cuVx5PgH", songTitle: "Smells Like Teen Spirit", artistName: "Nirvana", artistSpotifyUrl: "https://open.spotify.com/artist/6olE6TJLqED3rqDCT0FyPh", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/49JfoBc3DUw2EwDIo6YQmR", spotifyTrackId: "49JfoBc3DUw2EwDIo6YQmR", songTitle: "Shape of You", artistName: "Ed Sheeran", artistSpotifyUrl: "https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/2patgfDMwQsMBGdlwHDKOg", spotifyTrackId: "2patgfDMwQsMBGdlwHDKOg", songTitle: "CAN'T STOP THE FEELING! (Original Song from DreamWorks Animation's \"TROLLS\")", artistName: "Justin Timberlake", artistSpotifyUrl: "https://open.spotify.com/artist/31TPClRtHm23RisEBtV3X7", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/4RPkqiTSRzdo0RPg13bE8n", spotifyTrackId: "4RPkqiTSRzdo0RPg13bE8n", songTitle: "Shake It Off", artistName: "Taylor Swift", artistSpotifyUrl: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/7uatTgUs1ygl1ScYyRYVP2", spotifyTrackId: "7uatTgUs1ygl1ScYyRYVP2", songTitle: "Levitating", artistName: "Dua Lipa", artistSpotifyUrl: "https://open.spotify.com/artist/6M2wZ9GZgrQXHCFfjv46we", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/4TJk6iQu8B8DCRLV7TwzaM", spotifyTrackId: "4TJk6iQu8B8DCRLV7TwzaM", songTitle: "Dancing Queen", artistName: "ABBA", artistSpotifyUrl: "https://open.spotify.com/artist/0LcJLqbBmaGUft1e9Mm8HV", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/1TfqLAPs4K3s2rJMoCokcS", spotifyTrackId: "1TfqLAPs4K3s2rJMoCokcS", songTitle: "Sweet Dreams (Are Made of This) - 2005 Remaster", artistName: "Eurythmics, Annie Lennox, Dave Stewart", artistSpotifyUrl: "https://open.spotify.com/artist/0NKDgy9j66h3DLnN8qu1bB", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/1XsfDGslxnCPm5RDlD874U", spotifyTrackId: "1XsfDGslxnCPm5RDlD874U", songTitle: "Take on Me - 1985 Single Mix; 2015 Remaster", artistName: "a-ha", artistSpotifyUrl: "https://open.spotify.com/artist/2jzc5TC5TVFLXQlBNiIUzE", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/2ACLo9BX4IHonF4vDy6GoH", spotifyTrackId: "2ACLo9BX4IHonF4vDy6GoH", songTitle: "I Wanna Dance With Somebody (Who Loves Me)", artistName: "Whitney Houston", artistSpotifyUrl: "https://open.spotify.com/artist/6XpaIBNiVzIetEPCWDvAFP", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/29MVHxUqkpG2vGhMTokBGl", spotifyTrackId: "29MVHxUqkpG2vGhMTokBGl", songTitle: "I Will Survive", artistName: "Gloria Gaynor", artistSpotifyUrl: "https://open.spotify.com/artist/6V6WCgi7waF55bJmylC4H5", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/3oTlkzk1OtrhH8wBAduVEi", spotifyTrackId: "3oTlkzk1OtrhH8wBAduVEi", songTitle: "Smells Like Teen Spirit", artistName: "Nirvana", artistSpotifyUrl: "https://open.spotify.com/artist/6olE6TJLqED3rqDCT0FyPh", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/1uTbFcWsB8Vptdf7U9qCHT", spotifyTrackId: "1uTbFcWsB8Vptdf7U9qCHT", songTitle: "Livin' On A Prayer", artistName: "Bon Jovi", artistSpotifyUrl: "https://open.spotify.com/artist/58lV9VcRSjABbAbfWS6skp", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/5MvX4j51ArXH28d17vCJ0M", spotifyTrackId: "5MvX4j51ArXH28d17vCJ0M", songTitle: "Wake Me Up Before You Go-Go", artistName: "Wham!", artistSpotifyUrl: "https://open.spotify.com/artist/6jSC3cT0qM0pcRgrdvkp3x", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/7Cuk8jsPPoNYQWXK9XRFvG", spotifyTrackId: "7Cuk8jsPPoNYQWXK9XRFvG", songTitle: "September", artistName: "Earth, Wind & Fire", artistSpotifyUrl: "https://open.spotify.com/artist/4t9H3pMvAmifmk16zK5UO3", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/4EZz8Byhbjk0tOKFJlCgPB", spotifyTrackId: "4EZz8Byhbjk0tOKFJlCgPB", songTitle: "Never Gonna Give You Up - 7\" Mix", artistName: "Rick Astley", artistSpotifyUrl: "https://open.spotify.com/search/Rick%20Astley", category: "classics" },
];
