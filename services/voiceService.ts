import { Suit, TileData } from '../types';

// 可选的人物声音
export const VOICE_CHARACTERS = [
    { id: 'xiaobei', name: '小北', gender: 'female' },
    { id: 'xiaoni', name: '小妮', gender: 'female' },
    { id: 'xiaoxiao', name: '晓晓', gender: 'female' },
    { id: 'xiaoyi', name: '小艺', gender: 'female' },
    { id: 'yunjian', name: '云建', gender: 'male' },
    { id: 'yunxi', name: '云希', gender: 'male' },
    { id: 'yunxia', name: '云夏', gender: 'female' },
    { id: 'yunyang', name: '云扬', gender: 'male' },
] as const;

export type VoiceCharacter = typeof VOICE_CHARACTERS[number]['id'];

// 花色到声音文件后缀的映射
const SUIT_TO_VOICE: Record<Suit, string> = {
    WAN: 'wan',
    TIAO: 'tiao',
    TONG: 'tong',
};

// 预加载的音频缓存
const audioCache: Map<string, HTMLAudioElement> = new Map();

// 获取声音文件路径
export function getVoicePath(character: VoiceCharacter, type: string): string {
    return `/mahjong_voice/${character}/${type}.mp3`;
}

// 获取出牌声音路径
export function getDiscardVoicePath(character: VoiceCharacter, tile: TileData): string {
    const suitName = SUIT_TO_VOICE[tile.suit];
    return getVoicePath(character, `${tile.rank}${suitName}`);
}

// 预加载角色的所有声音
export async function preloadVoiceCharacter(character: VoiceCharacter): Promise<void> {
    const promises: Promise<void>[] = [];

    // 预加载所有牌的声音 (1-9 万/条/筒)
    const suits = ['wan', 'tiao', 'tong'];
    for (const suit of suits) {
        for (let rank = 1; rank <= 9; rank++) {
            const path = getVoicePath(character, `${rank}${suit}`);
            promises.push(preloadAudio(path));
        }
    }

    // 预加载动作声音
    const actions = ['hu', 'peng', 'gang', 'chi', 'zimo', 'tingpai'];
    for (const action of actions) {
        const path = getVoicePath(character, action);
        promises.push(preloadAudio(path));
    }

    await Promise.all(promises);
}

// 预加载单个音频
async function preloadAudio(path: string): Promise<void> {
    if (audioCache.has(path)) return;

    return new Promise((resolve) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.addEventListener('canplaythrough', () => {
            audioCache.set(path, audio);
            resolve();
        }, { once: true });
        audio.addEventListener('error', () => {
            console.warn(`Failed to preload audio: ${path}`);
            resolve();
        }, { once: true });
        audio.load();
    });
}

// 播放声音
export function playVoice(path: string, volume: number = 1.0): void {
    try {
        // 尝试使用缓存的音频
        const cachedAudio = audioCache.get(path);
        if (cachedAudio) {
            const audio = cachedAudio.cloneNode() as HTMLAudioElement;
            audio.volume = Math.min(1, Math.max(0, volume));
            audio.play().catch(e => console.warn('Audio play failed:', e));
            return;
        }

        // 创建新的音频对象
        const audio = new Audio(path);
        audio.volume = Math.min(1, Math.max(0, volume));
        audio.play().catch(e => console.warn('Audio play failed:', e));
    } catch (e) {
        console.warn('Failed to play voice:', e);
    }
}

// 播放出牌声音
export function playDiscardVoice(character: VoiceCharacter, tile: TileData, volume: number = 1.0): void {
    const path = getDiscardVoicePath(character, tile);
    playVoice(path, volume);
}

// 播放动作声音
export function playActionVoice(character: VoiceCharacter, action: 'hu' | 'peng' | 'gang' | 'zimo', volume: number = 1.0): void {
    const path = getVoicePath(character, action);
    playVoice(path, volume);
}

// 从 localStorage 获取保存的角色
export function getSavedCharacter(): VoiceCharacter {
    const saved = localStorage.getItem('mahjong_voice_character');
    if (saved && VOICE_CHARACTERS.some(c => c.id === saved)) {
        return saved as VoiceCharacter;
    }
    return 'xiaoni'; // 默认角色
}

// 保存角色到 localStorage
export function saveCharacter(character: VoiceCharacter): void {
    localStorage.setItem('mahjong_voice_character', character);
}

// 获取声音开关状态
export function getVoiceEnabled(): boolean {
    const saved = localStorage.getItem('mahjong_voice_enabled');
    return saved !== 'false'; // 默认开启
}

// 保存声音开关状态
export function saveVoiceEnabled(enabled: boolean): void {
    localStorage.setItem('mahjong_voice_enabled', enabled.toString());
}
