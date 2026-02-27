// src/constants/statements.ts

// src/constants/statements.ts

export const STATEMENTS: string[] = [
  // Classic moments
  "When your mom walks in and says it's time to eat",
  "When you realize you forgot to send that important email",
  "When someone says 'just one more round'",
  "When the teacher says the test is easy",
  "When you open the fridge for the fifth time",
  "When someone says they'll be ready in 5 minutes",
  "When you remember tomorrow is Monday",
  "When Spotify shuffle ruins the vibe",
  "When you hear your name mentioned in another room",
  "When someone says 'we need to talk'",

  // Social situations
  "When you laugh but don't get the joke",
  "When you wave back at someone who wasn't waving at you",
  "When you accidentally like an old photo",
  "When you realize everyone already knows each other",
  "When you say 'you too' to the waiter",
  "When you pretend to listen but you're already zoned out",
  "When you walk the wrong way after saying goodbye",

  // Everyday chaos
  "When you drop something and pretend it was on purpose",
  "When the alarm goes off for the third time",
  "When you google something you already know",
  "When you put your phone down and immediately look for it",
  "When you open the wrong app five times in a row",
  "When you read a message and don't reply right away",

  // Group / party / game
  "When someone says they don't care but obviously do",
  "When the mood dies mid-sentence",
  "When someone takes the game way too seriously",
  "When everyone looks at you at the same time",
  "When someone cheats but acts like nothing happened",

  // Internal humor / meta
  "When that sounded better in your head",
  "When you realize it's too late to back out",
  "When you're laughing but actually feeling a bit bad",
  "When you say okay but mean no",
  "When you realize you're the problem",
];


// 🔀 Slumpa men undvik statements i exclude-listan
export function getRandomStatement(exclude: string[] = []): string {
  const excludeSet = new Set(exclude);

  const remaining = STATEMENTS.filter((s) => !excludeSet.has(s));

  // Om alla är slut: börja om (eller byt till annan fallback om du vill)
  const pool = remaining.length > 0 ? remaining : STATEMENTS;

  return pool[Math.floor(Math.random() * pool.length)];
}
