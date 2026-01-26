import React, { useState } from 'react';
import axios from 'axios';
import { X, User, Lock, LogIn } from 'lucide-react';

interface AuthProps {
    onClose: () => void;
    onLogin: (user: any, stats: any) => void;
}

const API_URL = `http://${window.location.hostname}:6001/api`;

export function Auth({ onClose, onLogin }: AuthProps) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? '/login' : '/register';
            const res = await axios.post(`${API_URL}${endpoint}`, { username, password }, { withCredentials: true });

            if (isLogin) {
                onLogin(res.data.user, res.data.stats);
            } else {
                // Auto login after register or just switch to login?
                // Let's switch to login view or auto-login if the API returned user
                // My API for register returns { message, user }.
                // Let's just ask them to login strictly or auto-login?
                // For better UX, let's switch to login mode with success message
                setIsLogin(true);
                setError('注册成功！请登录。');
                // clear password
                setPassword('');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || '发生错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <LogIn className="text-emerald-400" />
                    {isLogin ? '登录' : '创建新账号'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-slate-400 text-sm mb-1">用户名</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                placeholder="输入用户名"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-slate-400 text-sm mb-1">密码</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                placeholder="输入密码"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className={`p-3 rounded-lg text-sm ${error.includes('成功') ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 shadow-lg shadow-emerald-900/20"
                    >
                        {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
                    </button>
                </form>

                <div className="mt-6 text-center text-slate-400 text-sm">
                    {isLogin ? "还没有账号？ " : "已有账号？ "}
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                    >
                        {isLogin ? '去注册' : '去登录'}
                    </button>
                </div>
            </div>
        </div>
    );
}
