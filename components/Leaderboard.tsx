import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Trophy, Medal } from 'lucide-react';

interface LeaderboardProps {
    onClose: () => void;
}

interface LeaderboardEntry {
    username: string;
    wins: number;
    games_played: number;
    rank_score: number;
}

const API_URL = `http://${window.location.hostname}:6001/api`;

export function Leaderboard({ onClose }: LeaderboardProps) {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await axios.get(`${API_URL}/leaderboard`, { withCredentials: true });
                setEntries(res.data);
            } catch (err) {
                console.error("Failed to load leaderboard", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, []);

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="text-yellow-400" size={20} />;
        if (index === 1) return <Medal className="text-gray-300" size={20} />;
        if (index === 2) return <Medal className="text-orange-400" size={20} />;
        return <span className="font-bold text-slate-500 w-5 text-center">{index + 1}</span>;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Trophy className="text-yellow-400" />
                    排行榜
                </h2>

                {loading ? (
                    <div className="text-slate-400 text-center py-8">正在加载排行榜...</div>
                ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase px-4 pb-2 border-b border-slate-700/50">
                            <div className="col-span-2 text-center">排名</div>
                            <div className="col-span-5">玩家</div>
                            <div className="col-span-2 text-center">胜场</div>
                            <div className="col-span-3 text-right">积分</div>
                        </div>

                        {entries.length === 0 ? (
                            <div className="text-slate-500 text-center py-8">暂无记录</div>
                        ) : (
                            entries.map((entry, idx) => (
                                <div k={entry.username} className="grid grid-cols-12 items-center bg-slate-900/50 hover:bg-slate-700/50 rounded-lg p-3 transition-colors border border-transparent hover:border-slate-600">
                                    <div className="col-span-2 flex justify-center">{getRankIcon(idx)}</div>
                                    <div className="col-span-5 font-medium text-white truncate">{entry.username}</div>
                                    <div className="col-span-2 text-center text-slate-300">{entry.wins}</div>
                                    <div className="col-span-3 text-right font-mono text-emerald-400 font-bold">{entry.rank_score}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
