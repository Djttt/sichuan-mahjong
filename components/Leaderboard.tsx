import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Trophy, Medal, Flame, Crown, Zap, Target, TrendingDown, RefreshCw, Swords } from 'lucide-react';

interface LeaderboardProps {
    onClose: () => void;
    currentUserId?: number;
}

interface MainLeaderboardEntry {
    username: string;
    user_id: number;
    elo_score: number;
    wins: number;
    total_games: number;
    win_rate: number;
    self_draw_count: number;
    discard_loss_count: number;
    replenish_count: number;
}

interface GamesLeaderboardEntry {
    username: string;
    user_id: number;
    total_games: number;
    wins: number;
    elo_score: number;
}

interface SpecialEntry {
    username: string;
    user_id: number;
    count: number;
    total_games: number;
}

interface FunLeaderboard {
    min_elo: { username: string; min_elo: number; current_elo: number }[];
    losing_streak: { username: string; max_losing_streak: number; total_games: number }[];
    replenish: { username: string; replenish_count: number; current_elo: number }[];
}

interface SpecialLeaderboard {
    qingyise: SpecialEntry[];
    qidui: SpecialEntry[];
    self_draw: SpecialEntry[];
    discard_loss: SpecialEntry[];
    gang: SpecialEntry[];
}

type TabType = 'main' | 'games' | 'special' | 'fun';

const API_URL = `http://${window.location.hostname}:6001/api`;

export function Leaderboard({ onClose, currentUserId }: LeaderboardProps) {
    const [activeTab, setActiveTab] = useState<TabType>('main');
    const [mainEntries, setMainEntries] = useState<MainLeaderboardEntry[]>([]);
    const [gamesEntries, setGamesEntries] = useState<GamesLeaderboardEntry[]>([]);
    const [specialData, setSpecialData] = useState<SpecialLeaderboard | null>(null);
    const [funData, setFunData] = useState<FunLeaderboard | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData(activeTab);
    }, [activeTab]);

    const fetchData = async (tab: TabType) => {
        setLoading(true);
        try {
            switch (tab) {
                case 'main':
                    const mainRes = await axios.get(`${API_URL}/leaderboard`, { withCredentials: true });
                    setMainEntries(mainRes.data);
                    break;
                case 'games':
                    const gamesRes = await axios.get(`${API_URL}/leaderboard/games`, { withCredentials: true });
                    setGamesEntries(gamesRes.data);
                    break;
                case 'special':
                    const specialRes = await axios.get(`${API_URL}/leaderboard/special`, { withCredentials: true });
                    setSpecialData(specialRes.data);
                    break;
                case 'fun':
                    const funRes = await axios.get(`${API_URL}/leaderboard/fun`, { withCredentials: true });
                    setFunData(funRes.data);
                    break;
            }
        } catch (err) {
            console.error("Failed to load leaderboard", err);
        } finally {
            setLoading(false);
        }
    };

    const getRankIcon = (index: number) => {
        if (index === 0) return <Trophy className="text-yellow-400" size={20} />;
        if (index === 1) return <Medal className="text-gray-300" size={20} />;
        if (index === 2) return <Medal className="text-orange-400" size={20} />;
        return <span className="font-bold text-slate-500 w-5 text-center">{index + 1}</span>;
    };

    const tabs = [
        { id: 'main' as TabType, label: '🏆 竞技榜', icon: Trophy },
        { id: 'games' as TabType, label: '🔥 肝帝榜', icon: Flame },
        { id: 'special' as TabType, label: '🀄 牌型榜', icon: Target },
        { id: 'fun' as TabType, label: '😅 娱乐榜', icon: TrendingDown },
    ];

    const renderMainLeaderboard = () => (
        <div className="space-y-2">
            <div className="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase px-4 pb-2 border-b border-slate-700/50">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-3">玩家</div>
                <div className="col-span-2 text-center">ELO</div>
                <div className="col-span-2 text-center">胜率</div>
                <div className="col-span-2 text-center">对局</div>
                <div className="col-span-2 text-center">补分</div>
            </div>

            {mainEntries.length === 0 ? (
                <div className="text-slate-500 text-center py-8">
                    <p>暂无记录</p>
                    <p className="text-xs mt-2">需要至少 10 局才能进入竞技榜</p>
                </div>
            ) : (
                mainEntries.map((entry, idx) => (
                    <div
                        key={entry.username}
                        className={`grid grid-cols-12 items-center rounded-lg p-3 transition-colors border ${currentUserId === entry.user_id
                                ? 'bg-emerald-900/30 border-emerald-500/50'
                                : 'bg-slate-900/50 hover:bg-slate-700/50 border-transparent hover:border-slate-600'
                            }`}
                    >
                        <div className="col-span-1 flex justify-center">{getRankIcon(idx)}</div>
                        <div className="col-span-3 font-medium text-white truncate flex items-center gap-1">
                            {entry.username}
                            {currentUserId === entry.user_id && <Crown size={14} className="text-yellow-400" />}
                        </div>
                        <div className="col-span-2 text-center font-mono text-emerald-400 font-bold">
                            {entry.elo_score}
                        </div>
                        <div className="col-span-2 text-center text-slate-300">
                            {entry.win_rate}%
                        </div>
                        <div className="col-span-2 text-center text-slate-400 text-sm">
                            {entry.total_games}
                        </div>
                        <div className="col-span-2 text-center">
                            {entry.replenish_count > 0 ? (
                                <span className="text-orange-400 text-sm flex items-center justify-center gap-1">
                                    <RefreshCw size={12} /> {entry.replenish_count}
                                </span>
                            ) : (
                                <span className="text-slate-600">-</span>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderGamesLeaderboard = () => (
        <div className="space-y-2">
            <div className="grid grid-cols-12 text-xs font-bold text-slate-500 uppercase px-4 pb-2 border-b border-slate-700/50">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4">玩家</div>
                <div className="col-span-3 text-center">对局数</div>
                <div className="col-span-2 text-center">胜场</div>
                <div className="col-span-2 text-center">ELO</div>
            </div>

            {gamesEntries.length === 0 ? (
                <div className="text-slate-500 text-center py-8">暂无记录</div>
            ) : (
                gamesEntries.map((entry, idx) => (
                    <div
                        key={entry.username}
                        className={`grid grid-cols-12 items-center rounded-lg p-3 transition-colors border ${currentUserId === entry.user_id
                                ? 'bg-orange-900/30 border-orange-500/50'
                                : 'bg-slate-900/50 hover:bg-slate-700/50 border-transparent hover:border-slate-600'
                            }`}
                    >
                        <div className="col-span-1 flex justify-center">
                            {idx === 0 ? <Flame className="text-orange-500" size={20} /> : getRankIcon(idx)}
                        </div>
                        <div className="col-span-4 font-medium text-white truncate">{entry.username}</div>
                        <div className="col-span-3 text-center font-mono text-orange-400 font-bold text-lg">
                            {entry.total_games}
                        </div>
                        <div className="col-span-2 text-center text-slate-300">{entry.wins}</div>
                        <div className="col-span-2 text-center text-slate-400">{entry.elo_score}</div>
                    </div>
                ))
            )}
        </div>
    );

    const renderSpecialLeaderboard = () => {
        if (!specialData) return <div className="text-slate-500 text-center py-8">加载中...</div>;

        const sections = [
            { key: 'qingyise', title: '🌈 清一色王', data: specialData.qingyise, color: 'text-purple-400' },
            { key: 'qidui', title: '🎴 七对狂魔', data: specialData.qidui, color: 'text-blue-400' },
            { key: 'self_draw', title: '✨ 自摸王', data: specialData.self_draw, color: 'text-green-400' },
            { key: 'gang', title: '🔨 杠神', data: specialData.gang, color: 'text-yellow-400' },
            { key: 'discard_loss', title: '💥 放炮之王', data: specialData.discard_loss, color: 'text-red-400' },
        ];

        return (
            <div className="space-y-6">
                {sections.map(section => (
                    <div key={section.key}>
                        <h3 className={`${section.color} font-bold mb-2 flex items-center gap-2`}>
                            {section.title}
                        </h3>
                        {section.data.length === 0 ? (
                            <div className="text-slate-600 text-sm pl-4">暂无记录</div>
                        ) : (
                            <div className="space-y-1">
                                {section.data.slice(0, 5).map((entry, idx) => (
                                    <div
                                        key={entry.username}
                                        className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 w-5 text-center">{idx + 1}</span>
                                            <span className="text-white">{entry.username}</span>
                                        </div>
                                        <span className={`font-mono font-bold ${section.color}`}>
                                            {entry.count} 次
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderFunLeaderboard = () => {
        if (!funData) return <div className="text-slate-500 text-center py-8">加载中...</div>;

        return (
            <div className="space-y-6">
                {/* 最低分记录 */}
                <div>
                    <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                        📉 最大负分
                    </h3>
                    {funData.min_elo.length === 0 ? (
                        <div className="text-slate-600 text-sm pl-4">暂无记录</div>
                    ) : (
                        <div className="space-y-1">
                            {funData.min_elo.slice(0, 5).map((entry, idx) => (
                                <div
                                    key={entry.username}
                                    className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 w-5 text-center">{idx + 1}</span>
                                        <span className="text-white">{entry.username}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-red-400 font-mono font-bold">{entry.min_elo}</span>
                                        <span className="text-slate-500 text-sm ml-2">→ {entry.current_elo}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 连败记录 */}
                <div>
                    <h3 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                        😰 最高连败
                    </h3>
                    {funData.losing_streak.length === 0 ? (
                        <div className="text-slate-600 text-sm pl-4">暂无记录</div>
                    ) : (
                        <div className="space-y-1">
                            {funData.losing_streak.slice(0, 5).map((entry, idx) => (
                                <div
                                    key={entry.username}
                                    className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 w-5 text-center">{idx + 1}</span>
                                        <span className="text-white">{entry.username}</span>
                                    </div>
                                    <span className="text-orange-400 font-mono font-bold">
                                        {entry.max_losing_streak} 连败
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 补分次数 */}
                <div>
                    <h3 className="text-yellow-400 font-bold mb-2 flex items-center gap-2">
                        🔄 补分大户
                    </h3>
                    {funData.replenish.length === 0 ? (
                        <div className="text-slate-600 text-sm pl-4">暂无记录</div>
                    ) : (
                        <div className="space-y-1">
                            {funData.replenish.slice(0, 5).map((entry, idx) => (
                                <div
                                    key={entry.username}
                                    className="flex items-center justify-between bg-slate-900/30 rounded px-3 py-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 w-5 text-center">{idx + 1}</span>
                                        <span className="text-white">{entry.username}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-yellow-400 font-mono font-bold">
                                            {entry.replenish_count} 次
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl w-full max-w-2xl relative animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <Trophy className="text-yellow-400" />
                    排行榜
                </h2>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-slate-900/50 rounded-lg">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-slate-700 text-white shadow-md'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="text-slate-400 text-center py-8">正在加载排行榜...</div>
                    ) : (
                        <>
                            {activeTab === 'main' && renderMainLeaderboard()}
                            {activeTab === 'games' && renderGamesLeaderboard()}
                            {activeTab === 'special' && renderSpecialLeaderboard()}
                            {activeTab === 'fun' && renderFunLeaderboard()}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
