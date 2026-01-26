import { Player, Suit, TileData } from '../types';

export const getRecommendedDingQue = (hand: TileData[]): Suit => {
    const counts: Record<Suit, number> = { WAN: 0, TONG: 0, TIAO: 0 };
    hand.forEach(t => counts[t.suit]++);

    // Simple strategy: void the suit with fewest tiles
    return Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0] as Suit;
};

// Robust HU Check using Frequency Map (Backtracking)
const checkHuRecursively = (inventory: number[][]): boolean => {
    // Find first available tile
    let s = -1, r = -1;
    outer: for (let i = 0; i < 3; i++) {
        for (let j = 1; j <= 9; j++) {
            if (inventory[i][j] > 0) {
                s = i;
                r = j;
                break outer;
            }
        }
    }

    // If no tiles left, we successfully depleted hand with sets
    if (s === -1) return true;

    // Try Triplet (AAA)
    if (inventory[s][r] >= 3) {
        inventory[s][r] -= 3;
        if (checkHuRecursively(inventory)) return true;
        inventory[s][r] += 3; // Backtrack
    }

    // Try Sequence (ABC)
    // Only if r <= 7 (since we need r, r+1, r+2)
    if (r <= 7 && inventory[s][r + 1] > 0 && inventory[s][r + 2] > 0) {
        inventory[s][r]--;
        inventory[s][r + 1]--;
        inventory[s][r + 2]--;
        if (checkHuRecursively(inventory)) return true;
        inventory[s][r]++;
        inventory[s][r + 1]++;
        inventory[s][r + 2]++; // Backtrack
    }

    return false;
};

export const canHu = (hand: TileData[], dingQue: Suit): boolean => {
    // 1. Must not have DingQue suit
    if (hand.some(t => t.suit === dingQue)) return false;

    if (hand.length % 3 !== 2) return false;

    // Build Inventory 3x10 (indices 1-9 used)
    const inventory: number[][] = [
        new Array(10).fill(0), // WAN (0)
        new Array(10).fill(0), // TIAO (1)
        new Array(10).fill(0)  // TONG (2)
    ];

    const suitMap: Record<Suit, number> = { WAN: 0, TIAO: 1, TONG: 2 };

    for (const t of hand) {
        inventory[suitMap[t.suit]][t.rank]++;
    }

    // 2. 7 Pairs Check (Special Hand)
    // Condition: 14 tiles, no sequences/triplets required, just 7 pairs.
    if (hand.length === 14) {
        let pairCount = 0;
        let is7Pairs = true;
        // Check if every count is even
        for (let s = 0; s < 3; s++) {
            for (let r = 1; r <= 9; r++) {
                if (inventory[s][r] % 2 !== 0) {
                    is7Pairs = false;
                    break;
                }
                pairCount += inventory[s][r] / 2;
            }
        }
        if (is7Pairs && pairCount === 7) return true;
    }

    // 3. Regular Hu (4 sets + 1 pair)
    // Try every possible pair
    for (let s = 0; s < 3; s++) {
        for (let r = 1; r <= 9; r++) {
            if (inventory[s][r] >= 2) {
                // Remove pair
                inventory[s][r] -= 2;

                // Check if rest are sets
                if (checkHuRecursively(inventory)) {
                    return true;
                }

                // Backtrack
                inventory[s][r] += 2;
            }
        }
    }

    return false;
};

const isSevenPairs = (hand: TileData[]): boolean => {
    if (hand.length !== 14) return false;

    const counts: Record<string, number> = {};
    hand.forEach(t => {
        const key = `${t.suit}-${t.rank}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    const values = Object.values(counts);
    return values.length === 7 && values.every(v => v === 2 || v === 4);
};

const isAllPungs = (tiles: TileData[]): boolean => {
    // All sets are triplets/quads with one pair
    const counts: Record<string, number> = {};
    tiles.forEach(t => {
        const key = `${t.suit}-${t.rank}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    let pairCount = 0;
    for (const v of Object.values(counts)) {
        if (v % 3 === 1) return false; // cannot form pungs/pair
        if (v % 3 === 2) pairCount += 1;
    }
    return pairCount === 1;
};

const isPureSuit = (tiles: TileData[]): boolean => {
    const suits = new Set(tiles.map(t => t.suit));
    return suits.size === 1;
};

export const calculateFan = (hand: TileData[], melds: TileData[][]): number => {
    const allTiles = [...hand, ...melds.flat()];
    let fan = 1; // Base fan

    if (isSevenPairs(hand) && melds.length === 0) {
        fan += 2; // 七对
    }

    if (isAllPungs(allTiles)) {
        fan += 2; // 碰碰胡
    }

    if (isPureSuit(allTiles)) {
        fan += 2; // 清一色
    }

    return fan;
};

export const canGang = (hand: TileData[], newTile?: TileData): boolean => {
    // Check for 4 of a kind in hand (An Gang), or 3 in hand + newTile (Ming Gang)
    if (!newTile) {
        // Dark Gang check
        const counts: Record<string, number> = {};
        hand.forEach(t => {
            const k = `${t.suit}-${t.rank}`;
            counts[k] = (counts[k] || 0) + 1;
        });
        return Object.values(counts).some(c => c === 4);
    } else {
        // Ming Gang (Dian Gang) check
        // We have newTile from discard. Do we have 3 matching in hand?
        let count = 0;
        hand.forEach(t => {
            if (t.suit === newTile.suit && t.rank === newTile.rank) count++;
        });
        return count === 3;
    }
}

export const canPeng = (hand: TileData[], tile: TileData): boolean => {
    let count = 0;
    hand.forEach(t => {
        if (t.suit === tile.suit && t.rank === tile.rank) count++;
    });
    return count >= 2;
}

/**
 * 加杠/补杠/弯杠检测
 * 
 * 加杠条件:
 * 1. 玩家已经有一个碰出去的牌组（melds中有3张相同的牌）
 * 2. 玩家自己摸到了第四张相同的牌（在hand中）
 * 
 * @param hand - 玩家手牌
 * @param melds - 玩家已有的牌组（碰/杠）
 * @returns 可以加杠的牌（可能有多张），如果不能加杠则返回空数组
 */
export const canBuGang = (hand: TileData[], melds: TileData[][]): TileData[] => {
    const buGangTiles: TileData[] = [];

    // 遍历所有牌组，找出碰牌（3张相同的牌）
    for (const meld of melds) {
        // 只检查碰牌（3张），杠牌（4张）不能再加杠
        if (meld.length !== 3) continue;

        // 检查是否是相同的3张牌（碰）
        const firstTile = meld[0];
        const isAllSame = meld.every(t => t.suit === firstTile.suit && t.rank === firstTile.rank);

        if (!isAllSame) continue; // 不是碰牌（可能是顺子，但四川麻将没有吃）

        // 检查手牌中是否有第四张
        const matchingTile = hand.find(t => t.suit === firstTile.suit && t.rank === firstTile.rank);

        if (matchingTile) {
            buGangTiles.push(matchingTile);
        }
    }

    return buGangTiles;
}

/**
 * 检查是否可以加杠（简单布尔版本）
 */
export const hasBuGang = (hand: TileData[], melds: TileData[][]): boolean => {
    return canBuGang(hand, melds).length > 0;
}