// src/constants/statements.ts

// src/constants/statements.ts

export const STATEMENTS: string[] = [
  // Klassiska igenkänningar
  "När din mamma kommer in och säger att vi ska äta",
  "När du inser att du glömde skicka det viktiga mailet",
  "När någon säger “bara en till runda”",
  "När läraren säger att provet är lätt",
  "När du öppnar kylskåpet för femte gången",
  "När någon säger att de är klara om 5 minuter",
  "När du inser att det är måndag imorgon",
  "När Spotify shuffle förstör stämningen",
  "När du hör ditt namn nämnas i ett annat rum",
  "När någon säger “vi behöver prata”",

  // Sociala situationer
  "När du skrattar men inte fattar skämtet",
  "När du vinkar tillbaka till någon som inte vinkade till dig",
  "När du råkar likea en gammal bild",
  "När du inser att alla redan känner varandra",
  "När du säger “du med” till servitören",
  "När du låtsas lyssna men redan zonat ut",
  "När du går åt fel håll efter att ha sagt hej då",

  // Vardag / kaos
  "När du tappar något och låtsas att det var med mening",
  "När alarmet ringer för tredje gången",
  "När du googlar något du egentligen redan vet",
  "När du lägger ifrån dig mobilen och direkt letar efter den",
  "När du öppnar fel app fem gånger i rad",
  "När du läser ett meddelande och inte svarar direkt",

  // Grupp / fest / spel
  "När någon säger att de inte bryr sig men uppenbart gör det",
  "När stämningen dör mitt i en mening",
  "När någon tar spelet alldeles för seriöst",
  "När alla tittar på dig samtidigt",
  "När någon fuskar men låtsas som ingenting",

  // Intern humor / meta
  "När det där lät bättre i ditt huvud",
  "När du inser att det är för sent att backa",
  "När du skrattar men egentligen mår lite dåligt",
  "När du säger okej men menar nej",
  "När du inser att det är du som är problemet",
];


// 🔀 Slumpa men undvik statements i exclude-listan
export function getRandomStatement(exclude: string[] = []): string {
  const excludeSet = new Set(exclude);

  const remaining = STATEMENTS.filter((s) => !excludeSet.has(s));

  // Om alla är slut: börja om (eller byt till annan fallback om du vill)
  const pool = remaining.length > 0 ? remaining : STATEMENTS;

  return pool[Math.floor(Math.random() * pool.length)];
}
