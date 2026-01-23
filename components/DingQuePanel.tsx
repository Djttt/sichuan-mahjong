import React from 'react';
import { Suit } from '../types';
import { SUIT_LABELS } from '../constants';

interface DingQuePanelProps {
  onSelect: (suit: Suit) => void;
  recommended?: Suit;
}

export const DingQuePanel: React.FC<DingQuePanelProps> = ({ onSelect, recommended }) => {
  const options: { suit: Suit; color: string; bg: string }[] = [
    { suit: 'WAN', color: 'text-red-600', bg: 'bg-red-100 hover:bg-red-200' },
    { suit: 'TIAO', color: 'text-emerald-600', bg: 'bg-emerald-100 hover:bg-emerald-200' },
    { suit: 'TONG', color: 'text-blue-600', bg: 'bg-blue-100 hover:bg-blue-200' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-xl shadow-2xl animate-in zoom-in duration-300 w-[400px]">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">定缺</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">
          请选择要缺的花色。手中仍有该花色时不能胡牌。
        </p>
        
        <div className="flex gap-4 justify-center">
          {options.map((opt) => (
            <button
              key={opt.suit}
              onClick={() => onSelect(opt.suit)}
              className={`
                group relative flex flex-col items-center justify-center w-24 h-32 
                rounded-lg border-2 border-transparent transition-all
                ${opt.bg}
                ${recommended === opt.suit ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
              `}
            >
              <span className={`text-4xl font-black mb-2 ${opt.color}`}>
                {SUIT_LABELS[opt.suit]}
              </span>
              <span className="text-gray-600 font-medium">
                {opt.suit === 'WAN' ? '万字' : opt.suit === 'TIAO' ? '条子' : '筒子'}
              </span>
              
              {recommended === opt.suit && (
                <div className="absolute -top-3 px-2 py-0.5 bg-yellow-400 text-xs font-bold rounded-full text-black shadow-sm">
                  推荐
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};