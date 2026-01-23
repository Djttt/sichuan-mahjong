import React from 'react';
import { Player, Suit } from '../types';
import { SUIT_COLORS, SUIT_LABELS } from '../constants';
import { Settings } from 'lucide-react';

interface Props {
    player: Player;
    isCurrentTurn: boolean;
    className?: string;
}

export const PlayerAvatar: React.FC<Props> = ({ player, isCurrentTurn, className }) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
             {/* Avatar Image */}
             <div className="relative">
                <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 shadow-lg bg-gray-800 ${isCurrentTurn ? 'border-yellow-400 ring-2 ring-yellow-400/50' : 'border-gray-600'}`}>
                    <div className="w-full h-full flex items-center justify-center text-3xl select-none bg-gradient-to-b from-gray-700 to-gray-900">
                        {player.avatar}
                    </div>
                </div>
                {/* Ready/Hu Status */}
                {player.isHu && (
                    <div className="absolute -bottom-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-red-400">
                        HU
                    </div>
                )}
             </div>

             {/* Info Box */}
             <div className="flex flex-col">
                 <div className="text-white font-bold text-sm drop-shadow-md tracking-wide max-w-[80px] truncate">
                     {player.name}
                 </div>
                 <div className="bg-black/40 rounded-full px-2 py-0.5 flex items-center gap-1 mt-0.5 border border-white/10">
                    <span className="text-yellow-400 text-xs">💰</span>
                    <span className="text-yellow-200 text-xs font-mono">{player.score}</span>
                 </div>
             </div>

             {/* DingQue Indicator */}
             {player.dingQue && (
                 <div className="ml-1 relative">
                    <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border-2 border-[#b8860b] flex items-center justify-center shadow-lg">
                        <span className={`font-black text-sm ${SUIT_COLORS[player.dingQue]}`}>
                            {SUIT_LABELS[player.dingQue]}
                        </span>
                    </div>
                 </div>
             )}
        </div>
    );
};