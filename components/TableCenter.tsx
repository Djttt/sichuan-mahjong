import React from 'react';
import { GamePhase } from '../types';

interface TableCenterProps {
  remainingTiles: number;
  phase: GamePhase;
}

export const TableCenter: React.FC<TableCenterProps> = ({ 
  remainingTiles, 
  phase
}) => {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-[#0a3a3a] rounded-2xl shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] border border-[#1a5c5c] flex flex-col items-center justify-center z-0">
      
      {/* Logo Text */}
      <div className="text-[#1a5c5c] font-black text-xl mb-2 tracking-widest drop-shadow-sm">
        血战到底
      </div>

      {/* Center Display */}
      <div className="w-16 h-16 bg-[#082a2a] rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] border border-[#144444] flex items-center justify-center relative overflow-hidden">
          {/* A generic icon representing the deck/wall */}
          <div className="w-10 h-12 bg-emerald-800 rounded shadow-lg border border-emerald-600/30"></div>
      </div>

      {/* Counter Text */}
      <div className="mt-2 text-[#4a9c9c] font-medium text-sm flex items-center gap-1">
         剩余张数: <span className="text-emerald-100 font-bold text-lg">{remainingTiles}</span>
      </div>

    </div>
  );
};