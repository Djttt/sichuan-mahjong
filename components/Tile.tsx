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

// 生成图片路径
const getTileImagePath = (tile: TileData): string => {
    const suitMap = {
        'WAN': 'wan',
        'TIAO': 'tiao',
        'TONG': 'tong'
    };
    return `/images/${tile.rank}${suitMap[tile.suit]}.png`;
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

    return (
        <div
            className={`${baseClasses} bg-gradient-to-b from-slate-50 to-slate-200 border border-slate-300 shadow-md overflow-hidden`}
            onClick={onClick}
            style={style}
        >
            {/* 3D Depth Layer */}
            {is3D && <div className="absolute bottom-[-4px] left-0 right-0 h-1 bg-slate-400/80 rounded-b-[4px]"></div>}

            {/* Tile Image */}
            <img
                src={getTileImagePath(tile)}
                alt={`${tile.rank} ${tile.suit}`}
                className="w-full h-full object-contain p-[5%]"
                draggable={false}
            />
        </div>
    );
};