import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, ChevronDown, X } from 'lucide-react';
import {
    VOICE_CHARACTERS,
    VoiceCharacter,
    getSavedCharacter,
    saveCharacter,
    getVoiceEnabled,
    saveVoiceEnabled,
    preloadVoiceCharacter,
    playDiscardVoice
} from '../services/voiceService';



interface VoiceSettingsProps {
    onClose: () => void;
    onCharacterSelect?: (character: VoiceCharacter) => void;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ onClose, onCharacterSelect }) => {
    const [selectedCharacter, setSelectedCharacter] = useState<VoiceCharacter>(getSavedCharacter());
    const [voiceEnabled, setVoiceEnabled] = useState(getVoiceEnabled());
    const [isPreloading, setIsPreloading] = useState(false);

    const handleCharacterChange = async (character: VoiceCharacter) => {
        setSelectedCharacter(character);
        saveCharacter(character);
        if (onCharacterSelect) {
            onCharacterSelect(character);
        }

        // 预加载新角色的声音
        setIsPreloading(true);
        try {
            await preloadVoiceCharacter(character);
        } catch (e) {
            console.warn('Failed to preload character voice:', e);
        }
        setIsPreloading(false);
    };

    const handleVoiceToggle = () => {
        const newState = !voiceEnabled;
        setVoiceEnabled(newState);
        saveVoiceEnabled(newState);
    };

    // 试听功能
    const handlePreview = () => {
        if (!voiceEnabled) return;
        // 播放一个示例声音，例如 "三万"
        playDiscardVoice(selectedCharacter, { id: 'preview', suit: 'WAN', rank: 3 }, 1.0);
    };

    return (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-2xl w-[90%] max-w-md border border-slate-600/50">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Volume2 className="text-emerald-400" />
                        声音设置
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* 声音开关 */}
                <div className="mb-6">
                    <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                        <span className="text-white font-medium">出牌声音</span>
                        <button
                            onClick={handleVoiceToggle}
                            className={`relative w-14 h-8 rounded-full transition-colors ${voiceEnabled ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${voiceEnabled ? 'translate-x-7' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* 角色选择 */}
                <div className="mb-6">
                    <label className="block text-gray-300 text-sm mb-3">选择配音角色</label>
                    <div className="grid grid-cols-2 gap-3">
                        {VOICE_CHARACTERS.map((char) => (
                            <button
                                key={char.id}
                                onClick={() => handleCharacterChange(char.id)}
                                disabled={!voiceEnabled}
                                className={`p-3 rounded-xl border-2 transition-all ${selectedCharacter === char.id
                                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                                    : 'border-slate-600 bg-slate-700/50 text-gray-300 hover:border-slate-500'
                                    } ${!voiceEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">
                                        {char.gender === 'female' ? '👩' : '👨'}
                                    </span>
                                    <span className="font-medium">{char.name}</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {char.gender === 'female' ? '女声' : '男声'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 试听按钮 */}
                <div className="flex gap-3">
                    <button
                        onClick={handlePreview}
                        disabled={!voiceEnabled || isPreloading}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${voiceEnabled && !isPreloading
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Volume2 size={18} />
                        {isPreloading ? '加载中...' : '试听'}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                    >
                        确定
                    </button>
                </div>
            </div>
        </div>
    );
};

// 小型声音设置按钮组件，可用于在界面上显示
interface VoiceSettingsButtonProps {
    onClick: () => void;
    className?: string; // Add className support
}

export const VoiceSettingsButton: React.FC<VoiceSettingsButtonProps> = ({ onClick, className = '' }) => {
    const [voiceEnabled] = useState(getVoiceEnabled());

    return (
        <button
            onClick={onClick}
            className={`bg-white/10 hover:bg-white/20 backdrop-blur-md text-white p-2 rounded-lg transition-all border border-white/20 shadow-lg ${className}`}
            title="声音设置"
        >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
    );
};
