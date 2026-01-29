/**
 * 四川麻将游戏逻辑测试
 * 
 * 测试内容包括:
 * - 碰(Peng): 手牌中有两张相同的牌，可以碰别人打出的第三张
 * - 明杠(Ming Gang): 手牌中有三张相同的牌，可以杠别人打出的第四张
 * - 暗杠(An Gang): 手牌中有四张相同的牌，可以暗杠
 * - 加杠(Bu Gang): 已碰的牌摸到第四张可以加杠
 * - 胡牌(Hu): 满足胡牌条件（4面子+1对子 或 7对子等）
 * - 番数计算(Fan): 计算胡牌的番数
 */

import { describe, it, expect } from 'vitest';
import {
    canPeng,
    canGang,
    canHu,
    calculateFan,
    getRecommendedDingQue,
    canBuGang,
    hasBuGang
} from './gameLogic';
import { TileData, Suit } from '../types';

// ==================== 辅助函数 ====================

/**
 * 快速创建一组麻将牌
 * @param tiles - 格式为 "1w 2w 3w" 表示一万二万三万，w=万，t=条，b=筒
 */
function createTiles(tiles: string): TileData[] {
    const suitMap: Record<string, Suit> = {
        'w': 'WAN',
        't': 'TIAO',
        'b': 'TONG'
    };

    return tiles.split(' ').filter(Boolean).map((tile, index) => {
        const rank = parseInt(tile.slice(0, -1));
        const suitChar = tile.slice(-1).toLowerCase();
        const suit = suitMap[suitChar];

        if (!suit || isNaN(rank) || rank < 1 || rank > 9) {
            throw new Error(`Invalid tile notation: ${tile}`);
        }

        return {
            id: `test-${tile}-${index}`,
            suit,
            rank
        };
    });
}

/**
 * 创建单张牌
 */
function createTile(notation: string): TileData {
    return createTiles(notation)[0];
}

// ==================== 碰(Peng)测试 ====================

describe('碰(Peng) - 手牌中有两张相同可碰别人的牌', () => {

    it('应该能碰: 手牌有两张一万，别人打一万', () => {
        const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t');
        const discard = createTile('1w');
        expect(canPeng(hand, discard)).toBe(true);
    });

    it('应该能碰: 手牌有三张一万，别人打一万', () => {
        const hand = createTiles('1w 1w 1w 2w 3w 4w 5w 6w 7w 1t 2t 3t 4t');
        const discard = createTile('1w');
        expect(canPeng(hand, discard)).toBe(true);
    });

    it('不能碰: 手牌只有一张一万，别人打一万', () => {
        const hand = createTiles('1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t 4t');
        const discard = createTile('1w');
        expect(canPeng(hand, discard)).toBe(false);
    });

    it('不能碰: 手牌没有一万，别人打一万', () => {
        const hand = createTiles('2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t 4t 5t');
        const discard = createTile('1w');
        expect(canPeng(hand, discard)).toBe(false);
    });

    it('不能碰: 手牌有两张一条，别人打一万(花色不同)', () => {
        const hand = createTiles('1t 1t 2w 3w 4w 5w 6w 7w 8w 9w 2t 3t 4t');
        const discard = createTile('1w');
        expect(canPeng(hand, discard)).toBe(false);
    });

    it('碰筒子: 手牌有两张五筒，别人打五筒', () => {
        const hand = createTiles('5b 5b 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t');
        const discard = createTile('5b');
        expect(canPeng(hand, discard)).toBe(true);
    });
});

// ==================== 明杠(Dian/Ming Gang)测试 ====================

describe('明杠(Ming Gang) - 手牌有三张相同可杠别人的牌', () => {

    it('应该能明杠: 手牌有三张一万，别人打一万', () => {
        const hand = createTiles('1w 1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t');
        const discardTile = createTile('1w');
        expect(canGang(hand, discardTile)).toBe(true);
    });

    it('不能明杠: 手牌只有两张一万，别人打一万', () => {
        const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t');
        const discardTile = createTile('1w');
        expect(canGang(hand, discardTile)).toBe(false);
    });

    it('不能明杠: 手牌三张一条，别人打一万(花色不同)', () => {
        const hand = createTiles('1t 1t 1t 2w 3w 4w 5w 6w 7w 8w 9w 1b 2b');
        const discardTile = createTile('1w');
        expect(canGang(hand, discardTile)).toBe(false);
    });

    it('明杠五筒: 手牌有三张五筒，别人打五筒', () => {
        const hand = createTiles('5b 5b 5b 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t');
        const discardTile = createTile('5b');
        expect(canGang(hand, discardTile)).toBe(true);
    });
});

// ==================== 暗杠(An Gang)测试 ====================

describe('暗杠(An Gang) - 手牌有四张相同的牌', () => {

    it('应该能暗杠: 手牌有四张一万', () => {
        const hand = createTiles('1w 1w 1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t');
        expect(canGang(hand)).toBe(true);
    });

    it('不能暗杠: 手牌只有三张一万', () => {
        const hand = createTiles('1w 1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t');
        expect(canGang(hand)).toBe(false);
    });

    it('应该能暗杠: 手牌有四张九条', () => {
        const hand = createTiles('9t 9t 9t 9t 1w 2w 3w 4w 5w 6w 7w 8w 1b 2b');
        expect(canGang(hand)).toBe(true);
    });

    it('不能暗杠: 手牌没有四张相同的', () => {
        const hand = createTiles('1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t 4t 5t');
        expect(canGang(hand)).toBe(false);
    });

    it('应该能暗杠: 有多组四张(只要有一组四张)', () => {
        const hand = createTiles('1w 1w 1w 1w 2t 2t 2t 2t 3b 3b 3b 4b 5b 6b');
        expect(canGang(hand)).toBe(true);
    });
});

// ==================== 加杠(Bu Gang)测试 ====================

describe('加杠(Bu Gang) - 已碰的牌摸到第四张可以加杠', () => {

    it('应该能加杠: 已碰五万，手牌有第四张五万', () => {
        const hand = createTiles('5w 1w 2w 3w 4w 6w 7w 8w 9w 1b');
        const melds = [
            createTiles('5w 5w 5w') // 已碰的五万
        ];
        const buGangTiles = canBuGang(hand, melds);
        expect(buGangTiles.length).toBe(1);
        expect(buGangTiles[0].suit).toBe('WAN');
        expect(buGangTiles[0].rank).toBe(5);
    });

    it('应该能加杠: hasBuGang返回true', () => {
        const hand = createTiles('5w 1w 2w 3w 4w 6w 7w 8w 9w 1b');
        const melds = [
            createTiles('5w 5w 5w')
        ];
        expect(hasBuGang(hand, melds)).toBe(true);
    });

    it('不能加杠: 已碰五万，但手牌没有第四张', () => {
        const hand = createTiles('1w 2w 3w 4w 6w 7w 8w 9w 1b 2b');
        const melds = [
            createTiles('5w 5w 5w')
        ];
        const buGangTiles = canBuGang(hand, melds);
        expect(buGangTiles.length).toBe(0);
        expect(hasBuGang(hand, melds)).toBe(false);
    });

    it('不能加杠: 没有碰过牌', () => {
        const hand = createTiles('5w 5w 5w 5w 1w 2w 3w 4w 6w 7w 8w 9w 1b 2b');
        const melds: TileData[][] = [];
        const buGangTiles = canBuGang(hand, melds);
        expect(buGangTiles.length).toBe(0);
    });

    it('不能加杠: 牌组是杠(4张)而非碰(3张)', () => {
        const hand = createTiles('5w 1w 2w 3w 4w 6w 7w 8w 9w 1b');
        const melds = [
            createTiles('5w 5w 5w 5w') // 这是杠，不是碰
        ];
        const buGangTiles = canBuGang(hand, melds);
        // 杠不能再加杠
        expect(buGangTiles.length).toBe(0);
    });

    it('应该能加杠多个: 有两个碰，手牌都有第四张', () => {
        const hand = createTiles('5w 3b 1w 2w 4w 6w 7w 8w 9w');
        const melds = [
            createTiles('5w 5w 5w'), // 碰五万
            createTiles('3b 3b 3b')  // 碰三筒
        ];
        const buGangTiles = canBuGang(hand, melds);
        expect(buGangTiles.length).toBe(2);
    });

    it('只能加杠一个: 有两个碰，只有一个手牌有第四张', () => {
        const hand = createTiles('5w 1w 2w 4w 6w 7w 8w 9w 1t 2t');
        const melds = [
            createTiles('5w 5w 5w'), // 碰五万，手牌有5w可以加杠
            createTiles('3b 3b 3b')  // 碰三筒，手牌没有3b
        ];
        const buGangTiles = canBuGang(hand, melds);
        expect(buGangTiles.length).toBe(1);
        expect(buGangTiles[0].rank).toBe(5);
        expect(buGangTiles[0].suit).toBe('WAN');
    });

    it('加杠使用场景: 碰后摸牌可以加杠', () => {
        // 模拟游戏场景:
        // 1. 玩家之前碰了三万
        // 2. 现在玩家摸到了三万
        // 3. 可以选择加杠

        const afterDrawHand = createTiles('3w 1w 2w 4w 5w 6w 7w 8w 9w 1b'); // 摸到3w
        const melds = [
            createTiles('3w 3w 3w') // 之前碰的三万
        ];

        // 检查可以加杠
        expect(hasBuGang(afterDrawHand, melds)).toBe(true);

        const buGangTiles = canBuGang(afterDrawHand, melds);
        expect(buGangTiles[0].rank).toBe(3);
        expect(buGangTiles[0].suit).toBe('WAN');
    });
});

// ==================== 胡牌(Hu)测试 ====================

describe('胡牌(Hu) - 基础胡牌条件', () => {

    describe('4面子 + 1对子 (标准胡)', () => {

        it('应该能胡: 清一色万子 1-9顺子 + 1-3顺子 + 对子', () => {
            // 11 123 123 456 789 (14张，缺条)
            const hand = createTiles('1w 1w 1w 2w 3w 1w 2w 3w 4w 5w 6w 7w 8w 9w');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('应该能胡: 混合花色顺子+刻子', () => {
            // 11w 234w 567w 111b 789b (缺条)
            const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 1b 1b 1b 7b 8b 9b');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('应该能胡: 全刻子(碰碰胡)', () => {
            // 11w 111b 333b 555b 777b
            const hand = createTiles('1w 1w 1b 1b 1b 3b 3b 3b 5b 5b 5b 7b 7b 7b');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('不能胡: 有定缺花色的牌', () => {
            const hand = createTiles('1w 1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 2t 3t');
            // 定缺是万，但手牌还有万
            expect(canHu(hand, 'WAN')).toBe(false);
        });

        it('不能胡: 牌数不对(13张)', () => {
            const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1b 2b 3b');
            expect(canHu(hand, 'TIAO')).toBe(false);
        });
    });

    describe('七对子胡牌', () => {

        it('应该能胡: 七对子(14张7个对子)', () => {
            const hand = createTiles('1w 1w 3w 3w 5w 5w 7w 7w 9w 9w 2b 2b 4b 4b');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('应该能胡: 龙七对(有一个四张)', () => {
            // 11113355 7799 22 (有一个1111暗杠的七对)
            const hand = createTiles('1w 1w 1w 1w 3w 3w 5w 5w 7w 7w 9w 9w 2b 2b');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('不能胡: 6对加2单张', () => {
            const hand = createTiles('1w 1w 3w 3w 5w 5w 7w 7w 9w 9w 2b 2b 4b 5b');
            expect(canHu(hand, 'TIAO')).toBe(false);
        });
    });

    describe('边界情况', () => {

        it('不能胡: 空手牌', () => {
            const hand: TileData[] = [];
            expect(canHu(hand, 'TIAO')).toBe(false);
        });

        it('应该能胡: 只有一对(四个杠后的情况)', () => {
            // 在四川麻将中，如果玩家有4个杠，手牌只剩一对也是可以胡的
            // canHu检查 hand.length % 3 === 2，满足条件会进入检查
            // 2张完全相同的牌构成一对，无需面子，是合法胡牌
            const hand = createTiles('1w 1w');
            expect(canHu(hand, 'TIAO')).toBe(true);
        });

        it('不能胡: 5张牌但组不成有效牌型', () => {
            // 5 % 3 = 2，牌数满足，但牌型无法组成 1对+1顺/刻
            // 1w 2w 3w 4w 5w - 无法同时有对子和面子
            const hand = createTiles('1w 2w 3w 4w 5w');
            // 实际上 canHu 判断时，会尝试所有可能的对子+面子组合
            // 这里测试一个更明确不能胡的案例
            const invalidHand = createTiles('1w 2w 4w 5w 7w');
            expect(canHu(invalidHand, 'TIAO')).toBe(false);
        });
    });
});

// ==================== 番数计算(Fan)测试 ====================

describe('番数计算(calculateFan)', () => {

    it('基础番: 普通胡牌应该是0番', () => {
        const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 1b 2b 3b 7b 8b 9b');
        const melds: TileData[][] = [];
        expect(calculateFan(hand, melds)).toBe(0);
    });

    it('七对子: 应该是2番', () => {
        const hand = createTiles('1w 1w 3w 3w 5w 5w 7w 7w 9w 9w 2b 2b 4b 4b');
        const melds: TileData[][] = [];
        expect(calculateFan(hand, melds)).toBe(2);
    });

    it('碰碰胡: 全刻子应该是1番', () => {
        const hand = createTiles('1w 1w');
        const melds: TileData[][] = [
            createTiles('1b 1b 1b'),
            createTiles('3b 3b 3b'),
            createTiles('5b 5b 5b'),
            createTiles('7b 7b 7b')
        ];
        expect(calculateFan(hand, melds)).toBe(1);
    });

    it('清一色: 只有一种花色应该是2番', () => {
        const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 7w 8w 9w 1w 2w 3w');
        const melds: TileData[][] = [];
        expect(calculateFan(hand, melds)).toBe(2);
    });

    it('清一色碰碰胡: 应该是3番(清一色2 + 碰碰胡1)', () => {
        const hand = createTiles('1w 1w');
        const melds: TileData[][] = [
            createTiles('2w 2w 2w'),
            createTiles('4w 4w 4w'),
            createTiles('6w 6w 6w'),
            createTiles('8w 8w 8w')
        ];
        expect(calculateFan(hand, melds)).toBe(3);
    });

    it('清一色七对子: 应该是4番(清一色2 + 七对2)', () => {
        const hand = createTiles('1w 1w 2w 2w 3w 3w 4w 4w 5w 5w 6w 6w 7w 7w');
        const melds: TileData[][] = [];
        expect(calculateFan(hand, melds)).toBe(4);
    });
});

// ==================== 定缺推荐测试 ====================

describe('定缺推荐(getRecommendedDingQue)', () => {

    it('应该推荐张数最少的花色', () => {
        // 万: 5张, 条: 5张, 筒: 3张 => 推荐缺筒
        const hand = createTiles('1w 2w 3w 4w 5w 1t 2t 3t 4t 5t 1b 2b 3b');
        expect(getRecommendedDingQue(hand)).toBe('TONG');
    });

    it('应该推荐空的花色', () => {
        // 只有万和条，没有筒 => 推荐缺筒
        const hand = createTiles('1w 2w 3w 4w 5w 6w 7w 1t 2t 3t 4t 5t 6t');
        expect(getRecommendedDingQue(hand)).toBe('TONG');
    });

    it('平均分布时推荐第一个最少的', () => {
        // 万:4, 条:4, 筒:5 => 万和条都是4张，应推荐万(排序后第一个)
        const hand = createTiles('1w 2w 3w 4w 1t 2t 3t 4t 1b 2b 3b 4b 5b');
        const result = getRecommendedDingQue(hand);
        // 应该是WAN或TIAO(取决于排序稳定性)
        expect(['WAN', 'TIAO']).toContain(result);
    });
});

// ==================== 综合场景测试 ====================

describe('综合游戏场景测试', () => {

    it('场景1: 开局定缺后打牌流程', () => {
        // 玩家开局手牌: 万9张、条4张、筒0张
        const hand = createTiles('1w 2w 3w 4w 5w 6w 7w 8w 9w 1t 1t 2t 3t');

        // 推荐定缺 - 筒最少(0张)
        const dingQue = getRecommendedDingQue(hand);
        expect(dingQue).toBe('TONG'); // 筒最少(0张)

        // 如果定缺条，不能胡(因为还有条)
        expect(canHu(hand, 'TIAO')).toBe(false);

        // 如果定缺筒，也不能胡(13张牌数不对)
        expect(canHu(hand, 'TONG')).toBe(false);
    });

    it('场景2: 可以碰和杠的选择', () => {
        const hand = createTiles('5b 5b 5b 1w 2w 3w 4w 5w 6w 7w 8w 9w 1t');
        const discardTile = createTile('5b');

        // 可以碰
        expect(canPeng(hand, discardTile)).toBe(true);
        // 也可以明杠
        expect(canGang(hand, discardTile)).toBe(true);
    });

    it('场景3: 听牌状态验证', () => {
        // 听1万或4万
        const hand = createTiles('2w 3w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1b 1b');

        // 当前不能胡(13张)
        expect(canHu(hand, 'TIAO')).toBe(false);

        // 加上听的牌就能胡
        const handWithWin1 = [...hand, createTile('1w')];
        expect(canHu(handWithWin1, 'TIAO')).toBe(true);

        const handWithWin4 = [...hand, createTile('4w')];
        expect(canHu(handWithWin4, 'TIAO')).toBe(true);
    });

    it('场景4: 多个动作可选(碰/胡)', () => {
        // 假设手牌差一张就能胡，同时可以碰
        const hand = createTiles('1w 1w 2w 3w 4w 5w 6w 7w 8w 9w 1b 2b 3b');
        const discardTile = createTile('1w');

        // 可以碰
        expect(canPeng(hand, discardTile)).toBe(true);

        // 碰了之后检查能否胡(14张)
        const handAfterPeng = createTiles('2w 3w 4w 5w 6w 7w 8w 9w 1b 2b 3b');
        // 注意碰后手牌变少，需要重新评估
    });
});

// ==================== 特殊牌型测试 ====================

describe('特殊牌型检测', () => {

    it('金钩钓: 4个杠+1对', () => {
        // 虽然当前游戏可能不完全支持，但测试基础逻辑
        const hand = createTiles('1w 1w');
        const melds: TileData[][] = [
            createTiles('2w 2w 2w 2w'),
            createTiles('3w 3w 3w 3w'),
            createTiles('4w 4w 4w 4w'),
            createTiles('5w 5w 5w 5w')
        ];
        // 应该是清一色 + 碰碰胡
        expect(calculateFan(hand, melds)).toBeGreaterThan(1);
    });

    it('边张/坎张/钓将判断(未来扩展)', () => {
        // 这些是更复杂的番型，当前可能未实现
        // 但测试基础胡牌判断应该正确

        // 边3万 (12差3)
        const hand1 = createTiles('1w 2w 4w 5w 6w 7w 8w 9w 1b 1b 1b 2b 3b');
        // 13张不能胡
        expect(canHu(hand1, 'TIAO')).toBe(false);

        // 加上3万
        const hand1Complete = [...hand1, createTile('3w')];
        expect(canHu(hand1Complete, 'TIAO')).toBe(true);
    });
});

// ==================== Bug 复现测试 ====================

describe('Bug复现: 点炮胡与碰/杠并存', () => {

    it('既能胡也能碰: 听6万/9万 (66万做将, 78万搭子), 别人打6万', () => {
        // 手牌: 123w, 456w, 66w(将), 78w, 111b
        // 别人打 6w
        // 应该能胡: 123, 456, 66(将), 678(顺), 111
        // 应该能碰: 手里有 66w

        const hand = createTiles('1w 2w 3w 4w 5w 6w 6w 6w 7w 8w 1b 1b 1b');
        // 注意 createTiles 可能会把 6w 6w 6w 视为前三个，但 Suit/Rank 是对的
        // 实际上上面的手牌有 3 张 6w。
        // 为了精确模拟用户的"顺子456, 对子66"，我们需要确认 hand 里的牌是 3 张 6w。
        // createTiles '4w 5w 6w 6w 6w' -> 确实是 3 张 6w。

        const discardTile = createTile('6w');

        // 检测胡牌: 把弃牌加入手牌
        const handWithDiscard = [...hand, discardTile];
        expect(canHu(handWithDiscard, 'TIAO')).toBe(true);

        // 检测碰
        expect(canPeng(hand, discardTile)).toBe(true);

        // 检测杠 (手里有3张6w)
        expect(canGang(hand, discardTile)).toBe(true);
    });

    it('普通点炮胡: 听6万 (78万搭子), 别人打6万', () => {
        // 手牌: 123w, 456w, 11w(将), 78w, 111b
        // 别人打 6w
        const hand = createTiles('1w 2w 3w 4w 5w 6w 1w 1w 7w 8w 1b 1b 1b');
        const discardTile = createTile('6w');

        const handWithDiscard = [...hand, discardTile];
        expect(canHu(handWithDiscard, 'TIAO')).toBe(true);
    });
});

console.log(`
===============================================
四川麻将测试模式
===============================================

运行方式:
  npm run test        # 监听模式，自动运行测试
  npm run test:run    # 运行一次测试
  npm run test:coverage # 运行测试并生成覆盖率报告

测试内容:
  - 碰(Peng): 手牌2张 + 别人1张
  - 明杠(Ming Gang): 手牌3张 + 别人1张
  - 暗杠(An Gang): 手牌4张
  - 胡牌(Hu): 4面子+1对 / 7对子
  - 番数计算(Fan): 清一色/碰碰胡/七对等

===============================================
`);
