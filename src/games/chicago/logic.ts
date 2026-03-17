import type {
  ChicagoCard,
  ChicagoPhase,
  ChicagoPlayedCardDto,
  ChicagoPokerEvaluation,
  ChicagoPokerHandName,
  ChicagoRank,
  ChicagoSuit,
} from "./types";

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

const HAND_SCORES: Record<ChicagoPokerHandName, { points: number; weight: number; label: string }> = {
  high_card: { points: 0, weight: 0, label: "High Card" },
  pair: { points: 1, weight: 1, label: "Pair" },
  two_pair: { points: 2, weight: 2, label: "Two Pair" },
  three_of_a_kind: { points: 3, weight: 3, label: "Three of a Kind" },
  straight: { points: 4, weight: 4, label: "Straight" },
  flush: { points: 5, weight: 5, label: "Flush" },
  full_house: { points: 6, weight: 6, label: "Full House" },
  four_of_a_kind: { points: 7, weight: 7, label: "Four of a Kind" },
  straight_flush: { points: 8, weight: 8, label: "Straight Flush" },
  royal_straight_flush: { points: 52, weight: 9, label: "Royal Straight Flush" },
};

export function makeDeck(): ChicagoCard[] {
  const suits: ChicagoSuit[] = ["clubs", "diamonds", "hearts", "spades"];
  const ranks: ChicagoRank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(cards: ChicagoCard[]) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeRoomCode(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function cardId(card: ChicagoCard) {
  return `${card.rank}-${card.suit}`;
}

export function compareCardsDesc(a: ChicagoCard, b: ChicagoCard) {
  return RANK_VALUES[b.rank] - RANK_VALUES[a.rank];
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

  const isWheel = unique.join(",") === "2,3,4,5,14";
  if (isWheel) return 5;

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

export function evaluatePokerHand(cards: ChicagoCard[]): ChicagoPokerEvaluation {
  const values = getSortedValues(cards);
  const flush = isFlush(cards);
  const straightHigh = getStraightHigh(values);
  const rankCounts = countRanks(cards);
  const sortedDesc = [...values].sort((a, b) => b - a);

  if (flush && straightHigh === 14 && values.join(",") === "10,11,12,13,14") {
    return { name: "royal_straight_flush", label: HAND_SCORES.royal_straight_flush.label, points: 52, tiebreak: [HAND_SCORES.royal_straight_flush.weight, 14] };
  }

  if (flush && straightHigh) {
    return { name: "straight_flush", label: HAND_SCORES.straight_flush.label, points: 8, tiebreak: [HAND_SCORES.straight_flush.weight, straightHigh] };
  }

  if (rankCounts[0][1] === 4) {
    return {
      name: "four_of_a_kind",
      label: HAND_SCORES.four_of_a_kind.label,
      points: 7,
      tiebreak: [HAND_SCORES.four_of_a_kind.weight, rankCounts[0][0], rankCounts[1][0]],
    };
  }

  if (rankCounts[0][1] === 3 && rankCounts[1][1] === 2) {
    return {
      name: "full_house",
      label: HAND_SCORES.full_house.label,
      points: 6,
      tiebreak: [HAND_SCORES.full_house.weight, rankCounts[0][0], rankCounts[1][0]],
    };
  }

  if (flush) {
    return { name: "flush", label: HAND_SCORES.flush.label, points: 5, tiebreak: [HAND_SCORES.flush.weight, ...sortedDesc] };
  }

  if (straightHigh) {
    return { name: "straight", label: HAND_SCORES.straight.label, points: 4, tiebreak: [HAND_SCORES.straight.weight, straightHigh] };
  }

  if (rankCounts[0][1] === 3) {
    const kickers = rankCounts.slice(1).map(([value]) => value);
    return {
      name: "three_of_a_kind",
      label: HAND_SCORES.three_of_a_kind.label,
      points: 3,
      tiebreak: [HAND_SCORES.three_of_a_kind.weight, rankCounts[0][0], ...kickers],
    };
  }

  if (rankCounts[0][1] === 2 && rankCounts[1][1] === 2) {
    const pairs = rankCounts.slice(0, 2).map(([value]) => value).sort((a, b) => b - a);
    const kicker = rankCounts[2][0];
    return {
      name: "two_pair",
      label: HAND_SCORES.two_pair.label,
      points: 2,
      tiebreak: [HAND_SCORES.two_pair.weight, ...pairs, kicker],
    };
  }

  if (rankCounts[0][1] === 2) {
    const kickers = rankCounts.slice(1).map(([value]) => value);
    return {
      name: "pair",
      label: HAND_SCORES.pair.label,
      points: 1,
      tiebreak: [HAND_SCORES.pair.weight, rankCounts[0][0], ...kickers],
    };
  }

  return { name: "high_card", label: HAND_SCORES.high_card.label, points: 0, tiebreak: [HAND_SCORES.high_card.weight, ...sortedDesc] };
}

export function comparePokerEvaluations(a: ChicagoPokerEvaluation, b: ChicagoPokerEvaluation) {
  const max = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < max; i += 1) {
    const left = a.tiebreak[i] ?? 0;
    const right = b.tiebreak[i] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

export function getPokerWinner<T extends { playerId: string; cards: ChicagoCard[] }>(entries: T[]) {
  const evaluated = entries.map((entry) => ({
    playerId: entry.playerId,
    evaluation: evaluatePokerHand(entry.cards),
  }));

  let winner = evaluated[0] ?? null;
  for (const current of evaluated.slice(1)) {
    if (!winner) {
      winner = current;
      continue;
    }
    if (comparePokerEvaluations(current.evaluation, winner.evaluation) > 0) {
      winner = current;
    }
  }

  return winner;
}

export function getNextChicagoPhase(current: ChicagoPhase): ChicagoPhase {
  if (current === "draw_phase_1") return "poker_score_1";
  if (current === "poker_score_1") return "draw_phase_2";
  if (current === "draw_phase_2") return "poker_score_2";
  if (current === "poker_score_2") return "draw_phase_3";
  if (current === "draw_phase_3") return "trick_phase";
  return "result";
}

export function getCardDisplay(card: ChicagoCard) {
  const suitMap: Record<ChicagoSuit, string> = {
    clubs: "C",
    diamonds: "D",
    hearts: "H",
    spades: "S",
  };
  return `${card.rank}${suitMap[card.suit]}`;
}

export function canFollowSuit(hand: ChicagoCard[], leadSuit: ChicagoSuit | null, selectedCard: ChicagoCard) {
  if (!leadSuit) return true;
  if (selectedCard.suit === leadSuit) return true;
  return !hand.some((card) => card.suit === leadSuit);
}

export function resolveTrick(leadSuit: ChicagoSuit, cards: ChicagoPlayedCardDto[]) {
  const suitedCards = cards.filter((entry) => entry.card.suit === leadSuit);
  return suitedCards.reduce((winner, current) => {
    if (!winner) return current;
    return RANK_VALUES[current.card.rank] > RANK_VALUES[winner.card.rank] ? current : winner;
  }, suitedCards[0] ?? null);
}
