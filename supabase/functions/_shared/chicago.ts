export type ChicagoSuit = "clubs" | "diamonds" | "hearts" | "spades";
export type ChicagoRank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export type ChicagoCard = { rank: ChicagoRank; suit: ChicagoSuit };

const RANK_VALUES: Record<ChicagoRank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeDeck(): ChicagoCard[] {
  const suits: ChicagoSuit[] = ["clubs", "diamonds", "hearts", "spades"];
  const ranks: ChicagoRank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  return shuffle(suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit }))));
}

export function cardId(card: ChicagoCard) {
  return `${card.rank}-${card.suit}`;
}

export function removeCardsFromHand(hand: ChicagoCard[], cardsToRemove: ChicagoCard[]) {
  const counts = new Map<string, number>();
  cardsToRemove.forEach((card) => {
    const id = cardId(card);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });

  return hand.filter((card) => {
    const id = cardId(card);
    const count = counts.get(id) ?? 0;
    if (count > 0) {
      counts.set(id, count - 1);
      return false;
    }
    return true;
  });
}

function getSortedValues(cards: ChicagoCard[]) {
  return cards.map((card) => RANK_VALUES[card.rank]).sort((a, b) => a - b);
}

function isFlush(cards: ChicagoCard[]) {
  return new Set(cards.map((card) => card.suit)).size === 1;
}

function getStraightHigh(values: number[]) {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.length !== 5) return null;
  if (unique.join(",") === "2,3,4,5,14") return 5;
  for (let i = 1; i < unique.length; i += 1) {
    if (unique[i] !== unique[i - 1] + 1) return null;
  }
  return unique[4];
}

function countRanks(cards: ChicagoCard[]) {
  const counts = new Map<number, number>();
  cards.forEach((card) => {
    const value = RANK_VALUES[card.rank];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
}

export function evaluatePokerHand(cards: ChicagoCard[]) {
  const values = getSortedValues(cards);
  const flush = isFlush(cards);
  const straightHigh = getStraightHigh(values);
  const rankCounts = countRanks(cards);
  const desc = [...values].sort((a, b) => b - a);

  if (flush && straightHigh === 14 && values.join(",") === "10,11,12,13,14") {
    return { name: "royal_straight_flush", points: 52, tiebreak: [9, 14] };
  }
  if (flush && straightHigh) return { name: "straight_flush", points: 8, tiebreak: [8, straightHigh] };
  if (rankCounts[0][1] === 4) return { name: "four_of_a_kind", points: 7, tiebreak: [7, rankCounts[0][0], rankCounts[1][0]] };
  if (rankCounts[0][1] === 3 && rankCounts[1][1] === 2) return { name: "full_house", points: 6, tiebreak: [6, rankCounts[0][0], rankCounts[1][0]] };
  if (flush) return { name: "flush", points: 5, tiebreak: [5, ...desc] };
  if (straightHigh) return { name: "straight", points: 4, tiebreak: [4, straightHigh] };
  if (rankCounts[0][1] === 3) return { name: "three_of_a_kind", points: 3, tiebreak: [3, rankCounts[0][0], ...rankCounts.slice(1).map(([value]) => value)] };
  if (rankCounts[0][1] === 2 && rankCounts[1][1] === 2) {
    const pairs = rankCounts.slice(0, 2).map(([value]) => value).sort((a, b) => b - a);
    return { name: "two_pair", points: 2, tiebreak: [2, ...pairs, rankCounts[2][0]] };
  }
  if (rankCounts[0][1] === 2) return { name: "pair", points: 1, tiebreak: [1, rankCounts[0][0], ...rankCounts.slice(1).map(([value]) => value)] };
  return { name: "high_card", points: 0, tiebreak: [0, ...desc] };
}

export function compareEvaluations(a: { tiebreak: number[] }, b: { tiebreak: number[] }) {
  const max = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < max; i += 1) {
    const left = a.tiebreak[i] ?? 0;
    const right = b.tiebreak[i] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

export function getPokerWinner(entries: { playerId: string; cards: ChicagoCard[] }[]) {
  let winner: { playerId: string; evaluation: ReturnType<typeof evaluatePokerHand> } | null = null;
  for (const entry of entries) {
    const evaluation = evaluatePokerHand(entry.cards);
    if (!winner || compareEvaluations(evaluation, winner.evaluation) > 0) {
      winner = { playerId: entry.playerId, evaluation };
    }
  }
  return winner;
}

export function canFollowSuit(hand: ChicagoCard[], leadSuit: ChicagoSuit | null, selectedCard: ChicagoCard) {
  if (!leadSuit) return true;
  if (selectedCard.suit === leadSuit) return true;
  return !hand.some((card) => card.suit === leadSuit);
}

export function resolveTrick(leadSuit: ChicagoSuit, cards: { player_id: string; card: ChicagoCard }[]) {
  const suited = cards.filter((entry) => entry.card.suit === leadSuit);
  return suited.reduce((winner, current) => {
    if (!winner) return current;
    return RANK_VALUES[current.card.rank] > RANK_VALUES[winner.card.rank] ? current : winner;
  }, suited[0] ?? null);
}
