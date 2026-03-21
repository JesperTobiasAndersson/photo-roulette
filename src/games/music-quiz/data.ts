export type MusicQuizLibraryCategory = "hits" | "classics";

export type MusicQuizLibraryEntry = {
  spotifyUrl: string;
  category: MusicQuizLibraryCategory;
};

export const MUSIC_QUIZ_LIBRARY: MusicQuizLibraryEntry[] = [
  { spotifyUrl: "https://open.spotify.com/track/07TGjTgMGUDW5qrsMrOnYA", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/49JfoBc3DUw2EwDIo6YQmR", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/3Hwl0OPFb6d66RFoV3cMzP", category: "hits" },
  { spotifyUrl: "https://open.spotify.com/track/4TJk6iQu8B8DCRLV7TwzaM", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/1TfqLAPs4K3s2rJMoCokcS", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/1XsfDGslxnCPm5RDlD874U", category: "classics" },
  { spotifyUrl: "https://open.spotify.com/track/2ACLo9BX4IHonF4vDy6GoH", category: "classics" },
];
