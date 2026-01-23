import React, { useEffect, useState } from 'react';

// A simple toast system for score updates like "+200" or "Hu!"
// In a real app this would be a context, here it's a simple local component for demo

interface ScoreEvent {
    id: number;
    text: string;
    type: 'positive' | 'negative' | 'neutral';
}

export const ScoreToast: React.FC<{ events: ScoreEvent[] }> = ({ events }) => {
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex flex-col items-center justify-end h-64 w-full">
            {events.map((ev) => (
                <div 
                    key={ev.id}
                    className={`
                        mb-2 px-6 py-2 rounded-full font-black text-2xl shadow-lg border-2 border-white/50 animate-out fade-out slide-out-to-top-10 duration-1000 fill-mode-forwards
                        ${ev.type === 'positive' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' : ''}
                        ${ev.type === 'negative' ? 'bg-gradient-to-r from-gray-600 to-gray-800 text-red-200' : ''}
                        ${ev.type === 'neutral' ? 'bg-blue-500 text-white' : ''}
                    `}
                >
                    {ev.text}
                </div>
            ))}
        </div>
    )
}