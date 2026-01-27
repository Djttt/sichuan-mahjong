import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    X, User, Trophy, Target, Flame, TrendingUp, TrendingDown,
    RefreshCw, Award, Zap, AlertCircle, Clock
} from 'lucide-react';

interface UserStatsData {
    elo_score: number;
    max_elo: number;
    min_elo: number;
    total_games: number;
    wins: number;
    win_rate: number;
    self_draw_count: number;
    discard_loss_count: number;
    qingyise_count: number;
    qidui_count: number;
    gang_count: number;
    current_streak: number;
    max_winning_streak: number;
    max_losing_streak: number;
    replenish_count: number;
}

interface UserProfileProps {
    userId: number;
    username: string;
    onClose: () => void;
    onStatsUpdated?: () => void;
}

const API_URL = `http://${window.location.hostname}:6001/api`;

export function UserProfile({ userId, username, onClose, onStatsUpdated }: UserProfileProps) {
    const [stats, setStats] = useState<UserStatsData | null>(null);
    const [canReplenish, setCanReplenish] = useState(false);
    const [replenishReason, setReplenishReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [replenishing, setReplenishing] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 获取用户统计
            const statsRes = await axios.get(`${API_URL}/user/${userId}/stats`, { withCredentials: true });
            setStats(statsRes.data.stats);

            // 检查是否可以补分
            const replenishRes = await axios.get(`${API_URL}/user/${userId}/can-replenish`, { withCredentials: true });
            setCanReplenish(replenishRes.data.can_replenish);
            setReplenishReason(replenishRes.data.reason);
        } catch (err) {
            console.error('Failed to fetch user data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReplenish = async () => {
        if (!canReplenish || replenishing) return;

        setReplenishing(true);
        setMessage(null);

        try {
            const res = await axios.post(`${API_URL}/user/${userId}/replenish`, {}, { withCredentials: true });
            setMessage({ text: `补分成功！${res.data.before_elo} → ${res.data.after_elo}`, type: 'success' });
            setStats(res.data.stats);
            setCanReplenish(false);
            setReplenishReason('积分仍为正数，无需补分');
            onStatsUpdated?.();
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || '补分失败';
            setMessage({ text: errorMsg, type: 'error' });
        } finally {
            setReplenishing(false);
        }
    };

    const StatCard = ({ icon: Icon, label, value, color = 'text-white', subtext = '' }: {
        icon: React.ElementType;
        label: string;
        value: string | number;
        color?: string;
        subtext?: string;
    }) => (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className="text-slate-400" />
                <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
        </div>
    );

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl">
                    <div className="text-slate-400">加载中...</div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    const streakDisplay = stats.current_streak >= 0
        ? `${stats.current_streak} 连胜`
        : `${Math.abs(stats.current_streak)} 连败`;

    const streakColor = stats.current_streak >= 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl w-full max-w-lg relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-2xl font-bold text-white">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{username}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Trophy size={16} className="text-yellow-400" />
                            <span className="text-emerald-400 font-bold text-lg">{stats.elo_score} ELO</span>
                            {stats.replenish_count > 0 && (
                                <span className="text-orange-400 text-sm flex items-center gap-1">
                                    <RefreshCw size={12} /> ×{stats.replenish_count}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'
                        }`}>
                        {message.type === 'success' ? <Award size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                    </div>
                )}

                {/* ELO Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">📊 ELO 积分</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <StatCard icon={Trophy} label="当前 ELO" value={stats.elo_score} color="text-emerald-400" />
                        <StatCard icon={TrendingUp} label="历史最高" value={stats.max_elo} color="text-green-400" />
                        <StatCard icon={TrendingDown} label="历史最低" value={stats.min_elo} color="text-red-400" />
                    </div>

                    {/* Replenish Section */}
                    {stats.elo_score <= 0 && (
                        <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-yellow-400 font-bold flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        积分归零了！
                                    </div>
                                    <div className="text-slate-400 text-sm mt-1">
                                        {canReplenish ? '可以补分到 1000' : replenishReason}
                                    </div>
                                </div>
                                <button
                                    onClick={handleReplenish}
                                    disabled={!canReplenish || replenishing}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${canReplenish && !replenishing
                                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                                            : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <RefreshCw size={16} className={replenishing ? 'animate-spin' : ''} />
                                    {replenishing ? '补分中...' : '补分'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🎮 对局统计</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <StatCard icon={Target} label="总对局" value={stats.total_games} />
                        <StatCard icon={Award} label="胜场" value={stats.wins} color="text-green-400" />
                        <StatCard
                            icon={Flame}
                            label="胜率"
                            value={`${stats.win_rate}%`}
                            color={stats.win_rate >= 50 ? 'text-green-400' : 'text-slate-300'}
                        />
                    </div>
                </div>

                {/* Streak Section */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🔥 连胜/连败</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <StatCard
                            icon={stats.current_streak >= 0 ? TrendingUp : TrendingDown}
                            label="当前状态"
                            value={streakDisplay}
                            color={streakColor}
                        />
                        <StatCard icon={TrendingUp} label="最高连胜" value={stats.max_winning_streak} color="text-green-400" />
                        <StatCard icon={TrendingDown} label="最高连败" value={stats.max_losing_streak} color="text-red-400" />
                    </div>
                </div>

                {/* Special Stats */}
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">🀄 四川麻将特色</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard icon={Zap} label="自摸" value={stats.self_draw_count} color="text-green-400" />
                        <StatCard icon={Target} label="放炮" value={stats.discard_loss_count} color="text-red-400" />
                        <StatCard
                            icon={Award}
                            label="清一色"
                            value={stats.qingyise_count}
                            color="text-purple-400"
                        />
                        <StatCard
                            icon={Award}
                            label="七对"
                            value={stats.qidui_count}
                            color="text-blue-400"
                        />
                    </div>
                    <div className="mt-3">
                        <StatCard
                            icon={Award}
                            label="杠"
                            value={stats.gang_count}
                            color="text-yellow-400"
                        />
                    </div>
                </div>

                {/* Replenish History */}
                {stats.replenish_count > 0 && (
                    <div className="p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-orange-400">
                            <RefreshCw size={16} />
                            <span>已补分 {stats.replenish_count} 次</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
