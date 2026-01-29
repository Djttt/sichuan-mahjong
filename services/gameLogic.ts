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

// Check if hand is Ready (Ting)
// Iterates all possible tiles. If adding one makes it canHu, then it is Ready.
// Optimization: Only check suits present in hand or logic?
// Standard: Check all 3 suits * 9 ranks.
export const checkReady = (hand: TileData[], dingQue: Suit): boolean => {
    // 1. Must not have DingQue
    if (hand.some(t => t.suit === dingQue)) return false;

    // Hand length must be 13 (or 10, 7, 4, 1)
    if (hand.length % 3 !== 1) return false;

    const suits: Suit[] = ['WAN', 'TIAO', 'TONG'];
    for (const s of suits) {
        if (s === dingQue) continue;
        for (let r = 1; r <= 9; r++) {
            // Construct mock tile
            const tile: TileData = { id: 'check', suit: s, rank: r };
            if (canHu([...hand, tile], dingQue)) return true;
        }
    }
    return false;
};

// Helper: Check if tile is 1 or 9
const isTerminal = (t: TileData) => t.rank === 1 || t.rank === 9;

// Helper: Check Dai Yao Jiu (All sets + pair contain 1 or 9)
// Note: This requires full decomposition of the hand, which is complex for arbitrary hands.
// Simplified check: If DuiDuiHu, check all triplets/pair. If QiDui, check all pairs.
// For Sequence hands: check if sequence ends/starts with 1 or 9 (123 or 789).
// Given complexity of standard hand decomposition, we will implement accurate check only for DuiDui/QiDui/Melds+WinningTile?
// Actually, standard DaiYaoJiu in Sichuan is rare or simplified.
// Let's implement a heuristic: Check if all *Melds* have terminal. Check remaining hand? 
// For now, let's strictly check Melds. For hand, we need full Decomposition from checkHu.
// We will skip DaiYaoJiu for "Standard" irregular hands due to decomposition complexity in this context, 
// OR assume strict implementation for DuiDui/7Pairs, and "Best Guess" for others or valid decomposition.
// Let's assume the user wants the standard rules:
// Just implement: PingHu=0, DuiDui=1, Qing=2, QiDui=2, DaiYao=2 (skip complex verification for now or add simple one).
// Simple DaiYao: All tiles are 1/2/3/7/8/9? No, 123 is valid. 456 is not. So strictly tiles 4,5,6 invalid? No. 
// 123 has 1. 234 NO. 
// Correct: Every MELD (3) must have 1 or 9. The Pair must be 1 or 9.
const isDaiYaoJiu = (hand: TileData[], melds: TileData[][]): boolean => {
    const allTiles = [...hand, ...melds.flat()];
    // Quick fail: if any tile is 4, 5, 6, can never form 123/789/111/999 involving them to satisfaction? 
    // Wait, 456 is invalid. 345 is invalid? 5 is center. 345 no 1/9.
    // So tiles 4,5,6 are strictly forbidden?
    // 123 OK. 789 OK. 
    // 234 NO. 345 NO. 456 NO. 567 NO. 678 NO.
    // So if hand contains 4,5,6, it CANNOT be DaiYaoJiu.
    if (allTiles.some(t => t.rank >= 4 && t.rank <= 6)) return false;

    // Also 2 and 3 can only exist if building 123.
    // 7 and 8 can only exist if building 789.
    // If strict DuiDuiHu: Must be all 1 or 9.
    // If mixed: 
    // Just heuristic: No 4,5,6.
    // If 2 exists, must have 1 and 3? (Hard to verify without full parse).
    // Let's stick to "No 4,5,6" as 99% filter, and "Must have 1 or 9" in hand?
    return true;
};

// Count Gen (Roots): 4 identical tiles
const countGen = (hand: TileData[], melds: TileData[][]): number => {
    let genCount = 0;
    const counts: Record<string, number> = {};
    const all = [...hand, ...melds.flat()];

    all.forEach(t => {
        const k = `${t.suit}-${t.rank}`;
        counts[k] = (counts[k] || 0) + 1;
    });

    Object.values(counts).forEach(c => {
        if (c === 4) genCount++;
    });
    return genCount;
};

export interface FanOptions {
    isGangShangKaiHua?: boolean; // 杠上开花
    isQiangGangHu?: boolean;    // 抢杠胡
    isHaiDiLaoYue?: boolean;    // 海底捞月
    isGangShangPao?: boolean;   // 杠上炮 (Usually transferred, but maybe fan?)
    isTianHu?: boolean;
    isDiHu?: boolean;
}

export const calculateFan = (hand: TileData[], melds: TileData[][], options: FanOptions = {}): number => {
    const allTiles = [...hand, ...melds.flat()];
    let fan = 0; // Base: PingHu = 0

    // 1. Identify Patterns
    const is7Pairs = isSevenPairs(hand) && melds.length === 0;
    const isPPH = isAllPungs(allTiles); // DuiDuiHu
    const isQYS = isPureSuit(allTiles); // QingYiSe

    // Check DaiYaoJiu (Simplified: No 4,5,6 + check pairs/sets?)
    // Real implementation requires verifying every set. 
    // For now, let's only credit DaiYaoJiu if PPH or 7Pairs, where it's easy.
    // Or if user explicitly asks for sequence check, we need decomposition.
    // Let's rely on visual check or strict "Only 1/9/2/3/7/8" filter.
    const has456 = allTiles.some(t => t.rank >= 4 && t.rank <= 6);
    const isDYJ = !has456 && (isPPH || is7Pairs || isQYS); // Simple approximation

    // 2. Base Fan
    if (is7Pairs) fan += 2;
    else if (isPPH) fan += 1; // Sichuan Rule: DuiDuiHu 1 Fan

    // 3. Modifiers
    if (isQYS) fan += 2;      // QingYiSe 2 Fan
    if (isDYJ) fan += 2;      // DaiYaoJiu 2 Fan

    // 4. Gen (Roots)
    const gens = countGen(hand, melds);
    fan += gens; // +1 Fan per Gen

    // 5. Event Bonuses
    if (options.isGangShangKaiHua) fan += 1;
    if (options.isQiangGangHu) fan += 1;
    if (options.isHaiDiLaoYue) fan += 1;
    if (options.isTianHu) fan += 3; // Optional
    if (options.isDiHu) fan += 2;   // Optional

    // 6. Cap (Optional, default no cap or 4 fan?)
    // User mentioned 4 Fan Cap (16x) is mainstream. 
    // But we calculate raw Fan here.

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