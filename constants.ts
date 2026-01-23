import { Suit, TileData } from './types';

export const SUITS: Suit[] = ['WAN', 'TIAO', 'TONG'];

// Map numbers to Chinese characters for display
export const RANK_CHARS: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九'
};

export const SUIT_COLORS: Record<Suit, string> = {
  WAN: 'text-red-600',
  TIAO: 'text-emerald-600',
  TONG: 'text-blue-600',
};

export const SUIT_LABELS: Record<Suit, string> = {
  WAN: '万',
  TIAO: '条',
  TONG: '筒',
};

// Generate a full 108 tile deck
export const generateDeck = (): TileData[] => {
  const deck: TileData[] = [];
  let idCounter = 0;

  SUITS.forEach((suit) => {
    for (let rank = 1; rank <= 9; rank++) {
      // 4 copies of each tile
      for (let i = 0; i < 4; i++) {
        deck.push({
          id: `${suit}-${rank}-${i}-${idCounter++}`,
          suit,
          rank,
        });
      }
    }
  });

  return shuffle(deck);
};

// Fisher-Yates shuffle
export const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Sort hand logic (DingQue logic: DingQue suit moves to end/dimmed, others sorted by Suit then Rank)
export const sortHand = (hand: TileData[], dingQue: Suit | null): TileData[] => {
  return [...hand].sort((a, b) => {
    // If DingQue is active, move those tiles to the very end (or beginning, depending on pref. usually end is "trash")
    // Let's implement: DingQue tiles go to the far right (highest sort value)
    if (dingQue) {
      if (a.suit === dingQue && b.suit !== dingQue) return 1;
      if (a.suit !== dingQue && b.suit === dingQue) return -1;
    }

    // Normal Sort: Suit order (Wan -> Tiao -> Tong), then Rank
    const suitOrder: Record<Suit, number> = { WAN: 0, TIAO: 1, TONG: 2 };
    if (a.suit !== b.suit) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return a.rank - b.rank;
  });
};