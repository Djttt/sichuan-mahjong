import React from 'react';
import { Suit, TileData } from '../types';
import { SUIT_LABELS } from '../constants';
import { Tile } from './Tile';

interface DingQuePanelProps {
  onSelect: (suit: Suit) => void;
  recommended?: Suit;
  hand?: TileData[]; // 玩家的手牌
}

export const DingQuePanel: React.FC<DingQuePanelProps> = ({ onSelect, recommended, hand = [] }) => {
  // 按花色分组并统计数量
  const groupedBySuit: Record<Suit, TileData[]> = {
    WAN: [],
    TIAO: [],
    TONG: []
  };

  hand.forEach(tile => {
    groupedBySuit[tile.suit].push(tile);
  });

  // 对每个花色内的牌按rank排序
  Object.values(groupedBySuit).forEach(tiles => {
    tiles.sort((a, b) => a.rank - b.rank);
  });

  const options: { suit: Suit; color: string; bg: string; borderColor: string }[] = [
    { suit: 'WAN', color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100', borderColor: 'border-red-300' },
    { suit: 'TIAO', color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', borderColor: 'border-emerald-300' },
    { suit: 'TONG', color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', borderColor: 'border-blue-300' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-xl shadow-2xl animate-in zoom-in duration-300 max-w-[700px] w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">定缺</h2>
        <p className="text-center text-gray-500 mb-4 text-sm">
          请选择要缺的花色。手中仍有该花色时不能胡牌。
        </p>

        {/* 手牌展示区域 - 按花色分组 */}
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3 text-center">你的手牌（按花色分组）</p>
          <div className="flex flex-col gap-3">
            {options.map((opt) => (
              <div
                key={opt.suit}
                className={`flex items-center gap-3 p-2 rounded-lg ${opt.bg} border ${opt.borderColor}`}
              >
                {/* 花色标签 */}
                <div className={`w-12 text-center font-bold ${opt.color}`}>
                  <span className="text-lg">{SUIT_LABELS[opt.suit]}</span>
                  <div className="text-xs text-gray-500">{groupedBySuit[opt.suit].length}张</div>
                </div>

                {/* 该花色的牌 */}
                <div className="flex gap-1 flex-wrap flex-1">
                  {groupedBySuit[opt.suit].length > 0 ? (
                    groupedBySuit[opt.suit].map((tile, i) => (
                      <Tile key={i} tile={tile} size="sm" is3D={false} />
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm italic">无</span>
                  )}
                </div>

                {/* 推荐标记 */}
                {recommended === opt.suit && (
                  <span className="bg-yellow-400 text-xs font-bold px-2 py-1 rounded-full text-black">
                    推荐缺
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 选择按钮 */}
        <div className="flex gap-4 justify-center">
          {options.map((opt) => (
            <button
              key={opt.suit}
              onClick={() => onSelect(opt.suit)}
              className={`
                group relative flex flex-col items-center justify-center w-28 h-24 
                rounded-lg border-2 transition-all font-bold
                ${opt.bg} ${opt.borderColor}
                ${recommended === opt.suit ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
                hover:scale-105 active:scale-95
              `}
            >
              <span className={`text-3xl font-black mb-1 ${opt.color}`}>
                {SUIT_LABELS[opt.suit]}
              </span>
              <span className="text-gray-600 text-sm">
                缺{opt.suit === 'WAN' ? '万' : opt.suit === 'TIAO' ? '条' : '筒'}
              </span>
              <span className="text-xs text-gray-400">
                ({groupedBySuit[opt.suit].length}张)
              </span>
            </button>
          ))}
        </div>

        {/* 提示 */}
        <p className="text-center text-xs text-gray-400 mt-4">
          💡 建议：选择手牌最少的花色作为定缺
        </p>
      </div>
    </div>
  );
};