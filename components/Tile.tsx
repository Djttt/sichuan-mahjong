import React from 'react';
import { TileData } from '../types';
import { RANK_CHARS, SUIT_COLORS, SUIT_LABELS } from '../constants';

interface TileProps {
  tile?: TileData; // If undefined, it's a face-down tile or back of tile
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isFaceUp?: boolean;
  is3D?: boolean; // Adds depth perspective
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean; // Used for DingQue tiles
  highlight?: boolean; // Used for suggesting moves
  className?: string;
  rotation?: number; // 0, 90, 180, 270
}

const SIZE_CLASSES = {
  sm: 'w-6 h-9 text-[10px] leading-3', // Discard pile
  md: 'w-8 h-12 text-xs', // Opponent melds
  lg: 'w-9 h-14 text-sm', // Opponent hand (side)
  xl: 'w-14 h-20 text-xl', // Player hand
};

export const Tile: React.FC<TileProps> = ({
  tile,
  size = 'xl',
  isFaceUp = true,
  is3D = true,
  onClick,
  selected,
  dimmed,
  highlight,
  className = '',
  rotation = 0,
}) => {
  // Styles for the "JoyGames" look: White face, Green back
  const baseClasses = `
    relative flex items-center justify-center rounded-[4px] select-none transition-transform duration-200
    ${SIZE_CLASSES[size]}
    ${className}
    ${selected ? '-translate-y-4 shadow-xl z-10' : ''}
    ${dimmed ? 'opacity-60 grayscale-[0.8] brightness-75' : ''}
    ${onClick ? 'cursor-pointer active:scale-95' : ''}
    ${is3D ? 'tile-shadow' : 'border border-gray-300'}
    ${highlight ? 'ring-2 ring-blue-400' : ''}
  `;

  // Rotate wrapper for side views
  const style = rotation ? { transform: `rotate(${rotation}deg)` } : {};

  // Render Back of Tile (Green)
  if (!tile || !isFaceUp) {
    return (
      <div 
        className={`${baseClasses} bg-emerald-700 border border-emerald-600/50 shadow-inner`}
        onClick={onClick}
        style={style}
      >
        {/* Simple pattern on back */}
        <div className="w-[80%] h-[80%] border-2 border-emerald-600 rounded-sm opacity-50"></div>
      </div>
    );
  }

  // Render Face of Tile (Ivory White)
  const renderContent = () => {
    if (tile.suit === 'WAN') {
      return (
        <div className={`flex flex-col items-center justify-center h-full font-serif font-black text-red-600`}>
          <span className="text-[0.8em] text-black/80">{RANK_CHARS[tile.rank]}</span>
          <span className="text-[1.2em] -mt-1 text-red-600">{SUIT_LABELS.WAN}</span>
        </div>
      );
    }
    
    if (tile.suit === 'TONG') {
        // Helper Circle Component
        const Circle = ({ color = 'bg-blue-600', size = 'w-[28%]', extraClass = '' }) => (
            <div className={`rounded-full ${color} ${size} aspect-square border border-black/10 shadow-sm ${extraClass}`}></div>
        );
        
        // 1 Tong: Large pancake
        if (tile.rank === 1) {
            return (
                <div className="flex items-center justify-center w-full h-full">
                    <div className="w-[80%] aspect-square rounded-full bg-gradient-to-tr from-emerald-500 via-red-500 to-blue-600 border-4 border-dashed border-white shadow-inner flex items-center justify-center">
                        <div className="w-[40%] aspect-square rounded-full bg-red-600"></div>
                    </div>
                </div>
            );
        }

        const containerClass = "flex flex-col items-center justify-between w-full h-full p-[15%]";

        if (tile.rank === 2) {
             return (
                 <div className="flex flex-col items-center justify-around w-full h-full py-[10%]">
                     <Circle color="bg-emerald-600" />
                     <Circle color="bg-blue-600" />
                 </div>
             );
        }
        if (tile.rank === 3) {
             return (
                 <div className="relative w-full h-full p-[10%]">
                     <div className="absolute top-[10%] left-[10%] w-[30%]"><Circle size="w-full" color="bg-blue-600"/></div>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%]"><Circle size="w-full" color="bg-red-600"/></div>
                     <div className="absolute bottom-[10%] right-[10%] w-[30%]"><Circle size="w-full" color="bg-emerald-600"/></div>
                 </div>
             );
        }
        if (tile.rank === 4) {
             return (
                 <div className="flex flex-col justify-center gap-[10%] w-full h-full p-[15%]">
                     <div className="flex justify-between">
                         <Circle color="bg-blue-600" size="w-[38%]" />
                         <Circle color="bg-emerald-600" size="w-[38%]" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-emerald-600" size="w-[38%]" />
                         <Circle color="bg-blue-600" size="w-[38%]" />
                     </div>
                 </div>
             );
        }
        if (tile.rank === 5) {
             return (
                 <div className="relative w-full h-full p-[15%] flex flex-col justify-between">
                     <div className="flex justify-between">
                         <Circle color="bg-blue-600" size="w-[35%]" />
                         <Circle color="bg-blue-600" size="w-[35%]" />
                     </div>
                     {/* Center */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35%]">
                         <Circle color="bg-red-600" size="w-full" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-blue-600" size="w-[35%]" />
                         <Circle color="bg-blue-600" size="w-[35%]" />
                     </div>
                 </div>
             );
        }
        if (tile.rank === 6) {
             return (
                 <div className="flex flex-col justify-between w-full h-full p-[15%] py-[10%]">
                     <div className="flex justify-between">
                         <Circle color="bg-emerald-600" size="w-[32%]" />
                         <Circle color="bg-emerald-600" size="w-[32%]" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-red-600" size="w-[32%]" />
                         <Circle color="bg-red-600" size="w-[32%]" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-red-600" size="w-[32%]" />
                         <Circle color="bg-red-600" size="w-[32%]" />
                     </div>
                 </div>
             );
        }
        if (tile.rank === 7) {
            // 7: 3 diagonal top, 4 square red bottom (Common style) or just 3 top, 2 middle 2 bottom
            // Let's do 3 diag (top-left) and 4 bottom square
             return (
                 <div className="relative w-full h-full p-[10%]">
                     {/* 3 Diagonal Green */}
                     <div className="absolute top-0 left-0 w-[40%] h-[40%] flex justify-between">
                        <Circle color="bg-emerald-600" size="w-[50%]" />
                     </div>
                     <div className="absolute top-[18%] left-[25%] w-[25%]"><Circle size="w-full" color="bg-emerald-600"/></div>
                     <div className="absolute top-[36%] left-[50%] w-[25%]"><Circle size="w-full" color="bg-emerald-600"/></div>

                     {/* 4 Red Bottom */}
                     <div className="absolute bottom-0 w-full h-[50%] flex flex-col justify-between pt-1">
                        <div className="flex justify-around">
                            <Circle color="bg-red-600" size="w-[28%]" />
                            <Circle color="bg-red-600" size="w-[28%]" />
                        </div>
                        <div className="flex justify-around">
                            <Circle color="bg-red-600" size="w-[28%]" />
                            <Circle color="bg-red-600" size="w-[28%]" />
                        </div>
                     </div>
                 </div>
             );
        }

        if (tile.rank === 8) {
             return (
                 <div className="flex flex-col justify-between w-full h-full p-[12%] py-[6%]">
                    {Array.from({length: 4}).map((_, i) => (
                        <div key={i} className="flex justify-between">
                             <Circle color="bg-blue-600" size="w-[28%]" />
                             <Circle color="bg-blue-600" size="w-[28%]" />
                        </div>
                    ))}
                 </div>
             );
        }

        if (tile.rank === 9) {
             return (
                 <div className="flex flex-col justify-between w-full h-full p-[10%]">
                     <div className="flex justify-between">
                         <Circle color="bg-emerald-600" size="w-[30%]" />
                         <Circle color="bg-emerald-600" size="w-[30%]" />
                         <Circle color="bg-emerald-600" size="w-[30%]" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-red-600" size="w-[30%]" />
                         <Circle color="bg-red-600" size="w-[30%]" />
                         <Circle color="bg-red-600" size="w-[30%]" />
                     </div>
                     <div className="flex justify-between">
                         <Circle color="bg-blue-600" size="w-[30%]" />
                         <Circle color="bg-blue-600" size="w-[30%]" />
                         <Circle color="bg-blue-600" size="w-[30%]" />
                     </div>
                 </div>
             );
        }
    }

    if (tile.suit === 'TIAO') {
       const isSmall = size === 'sm';
       if (tile.rank === 1) {
           return <div className={`${isSmall ? 'text-lg' : 'text-4xl'} -mt-1`}>🦚</div>
       }

       // Helper for Tiao bars
       const Stick = ({ color = 'bg-emerald-600', height = 'h-full', width = 'w-[20%]', rotate = '' }) => (
           <div className={`${color} ${height} ${width} max-w-[6px] min-w-[3px] rounded-full ${rotate}`}></div>
       );

       const Row = ({ count, height = 'h-full', color = 'bg-emerald-600', rotate = '' }: { count: number, height?: string, color?: string, rotate?: string }) => (
            <div className={`flex justify-center gap-[10%] w-full ${height} items-center`}>
                {Array.from({ length: count }).map((_, i) => (
                    <Stick key={i} color={color} rotate={rotate} />
                ))}
            </div>
       );

       return (
        <div className={`flex flex-col items-center justify-between w-full h-full p-[15%] gap-[2px]`}>
             {tile.rank === 2 && (
                 <>
                    <Row count={1} height="h-[40%]" />
                    <Row count={1} height="h-[40%]" />
                 </>
             )}
             {tile.rank === 3 && (
                 <>
                    <Row count={1} height="h-[25%]" />
                    <Row count={1} height="h-[25%]" />
                    <Row count={1} height="h-[25%]" />
                 </>
             )}
             {tile.rank === 4 && (
                 <>
                    <Row count={2} height="h-[40%]" color="bg-emerald-600" />
                    <Row count={2} height="h-[40%]" color="bg-blue-600" />
                 </>
             )}
             {tile.rank === 5 && (
                 <>
                    <Row count={2} height="h-[30%]" />
                    <Row count={1} height="h-[20%]" color="bg-red-600" />
                    <Row count={2} height="h-[30%]" />
                 </>
             )}
             {tile.rank === 6 && (
                 <>
                    <Row count={3} height="h-[40%]" />
                    <div className="h-[5%]"></div>
                    <Row count={3} height="h-[40%]" />
                 </>
             )}
             {tile.rank === 7 && (
                 <>
                    <Row count={2} height="h-[30%]" />
                    <Row count={2} height="h-[30%]" />
                    <Row count={3} height="h-[30%]" />
                 </>
             )}
             {tile.rank === 8 && (
                 <>
                    <Row count={4} height="h-[40%]" />
                    <div className="h-[5%]"></div>
                    <Row count={4} height="h-[40%]" />
                 </>
             )}
             {tile.rank === 9 && (
                 <>
                    <Row count={3} height="h-[30%]" />
                    <Row count={3} height="h-[30%]" color="bg-red-600" />
                    <Row count={3} height="h-[30%]" />
                 </>
             )}
        </div>
       )
    }
  };

  return (
    <div 
      className={`${baseClasses} bg-gradient-to-b from-slate-50 to-slate-200 border border-slate-300 shadow-md`}
      onClick={onClick}
      style={style}
    >
      {/* 3D Depth Layer */}
      {is3D && <div className="absolute bottom-[-4px] left-0 right-0 h-1 bg-slate-400/80 rounded-b-[4px]"></div>}
      
      {/* Content */}
      <div className="w-full h-full flex items-center justify-center pb-1">
          {renderContent()}
      </div>

      {/* Helper Number */}
      <div className="absolute top-0.5 left-0.5 text-[8px] text-gray-300 font-sans">
        {tile.rank}
      </div>
    </div>
  );
};