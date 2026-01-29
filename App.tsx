import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, Suit, TileData, GamePhase, NetworkAction, SocketMessage } from './types';
import { generateDeck, sortHand, SUIT_LABELS, SUITS, SUIT_COLORS } from './constants';
import { Tile } from './components/Tile';
import { DingQuePanel } from './components/DingQuePanel';
import { TableCenter } from './components/TableCenter';
import { PlayerAvatar } from './components/PlayerAvatar';
import { getRecommendedDingQue, canHu, canGang, canPeng, calculateFan, hasBuGang, checkReady } from './services/gameLogic';
import { ScoreToast } from './components/ScoreToast';
import { Copy, Users, Play, LogIn, ArrowLeft, Bot, Trophy, User, RefreshCw, Volume2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Auth } from './components/Auth';
import { Leaderboard } from './components/Leaderboard';
import { UserProfile } from './components/UserProfile';
import { VoiceSettings, VoiceSettingsButton } from './components/VoiceSettings';
import { playDiscardVoice, playActionVoice, getSavedCharacter, getVoiceEnabled, preloadVoiceCharacter, VoiceCharacter } from './services/voiceService';
import { handleDiscardLogic, handlePassLogic } from './services/gameStateReducer';
import { handleGangLogic } from './services/gangLogicReducer';
import axios from 'axios';

const USER_ID_PREFIX = 'player-';
const API_URL = `http://${window.location.hostname}:6001/api`;

// HELPER: End Game Settlement (HuaZhu, DaJiao, TuiShui)
const applyGameSettlement = (state: GameState): GameState => {
    let newPlayers = [...state.players];
    const huPlayers = newPlayers.filter(p => p.isHu);
    const nonHuPlayers = newPlayers.filter(p => !p.isHu);

    // 1. Check Hua Zhu (Has DingQue suit)
    // Valid non-Hu players must NOT have DingQue suit.
    const huaZhuPlayers = nonHuPlayers.filter(p => p.dingQue && p.hand.some(t => t.suit === p.dingQue));
    const nonHuaZhuPlayers = nonHuPlayers.filter(p => !huaZhuPlayers.includes(p));

    // 2. Check Ready (Ting)
    // Only check for those who are NOT Hua Zhu
    const readyPlayers = nonHuaZhuPlayers.filter(p => checkReady(p.hand, p.dingQue!));
    const noReadyPlayers = nonHuaZhuPlayers.filter(p => !readyPlayers.includes(p));

    // CONSTANTS
    const MAX_FAN = 4;
    const MAX_SCORE = Math.pow(2, MAX_FAN - 1) * 10;
    const HUA_ZHU_PENALTY = MAX_SCORE * 2; // Usually severe (16x0 = 160?) Let's use 160.
    const DA_JIAO_PENALTY = MAX_SCORE; // 80

    // Log for UI
    console.log("Settlement:", { huaZhu: huaZhuPlayers.map(p => p.name), ready: readyPlayers.map(p => p.name), noReady: noReadyPlayers.map(p => p.name) });

    // A. PROCESS HUA ZHU (Flower Pig)
    // Pays EVERYONE who is NOT a Pig (Hu + Ready + NoReady).
    // "需赔给所有已胡牌及没胡牌且不缺门的玩家" -> Hu + Ready + NoReady(if not pig).
    // Wait, "不缺门" means not Pig.
    // So Pig pays (Hu + Ready + NoReady).
    const beneficiaries = [...huPlayers, ...readyPlayers, ...noReadyPlayers];

    huaZhuPlayers.forEach(pig => {
        beneficiaries.forEach(ben => {
            pig.score -= HUA_ZHU_PENALTY;
            ben.score += HUA_ZHU_PENALTY;
        });
    });

    // B. PROCESS DA JIAO (Cha Da Jiao)
    // NoReady pays Ready. (Hu players don't care, they already won).
    // Pig already paid everyone, so Pig is excluded here?
    // "查大叫" usually applies to those who are NOT Pig but NOT Ready.
    // Pig is already finished processing.
    noReadyPlayers.forEach(loser => {
        readyPlayers.forEach(winner => {
            // Should calculate actual potential fan? Using Flat Penalty for simplicity.
            loser.score -= DA_JIAO_PENALTY;
            winner.score += DA_JIAO_PENALTY;
        });
    });

    // C. TUI SHUI (Return Tax)
    // "如果你最后查出来是“花猪”或“没下叫”，之前杠牌收的钱必须全部退回"
    // Pig + NoReady must return Gang Income.
    const taxPayers = [...huaZhuPlayers, ...noReadyPlayers];
    taxPayers.forEach(p => {
        if (p.gangScore > 0) {
            // Deduct the *net* income they made? 
            // Or tracked total revenue? gangScore tracks NET.
            // If they made money (gangScore > 0), they lose it.
            // Who gets it? Valid players? Or burned?
            // "全部退回" implies return to who paid. Impossible to track precisely without history.
            // We just deduct it from their score.
            // And maybe distribute to others?
            // Simplified: Just deduct.
            p.score -= p.gangScore;
            p.gangScore = 0;
        }
    });

    return { ...state, players: newPlayers };
};

function App() {
    const [gameState, setGameState] = useState<GameState>({
        roomId: '',
        isMultiplayer: false,
        phase: 'LOBBY',
        currentTurnPlayerId: '',
        remainingTiles: 0,
        deck: [],
        players: [],
        lastDiscard: null,
        myPlayerId: ''
    });

    const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
    const [scoreEvents, setScoreEvents] = useState<{ id: number, text: string, type: 'positive' | 'negative' | 'neutral' }[]>([]);
    const [lobbyInput, setLobbyInput] = useState('');
    const [wsReady, setWsReady] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [skippedDiscardId, setSkippedDiscardId] = useState<string | null>(null);

    // Auth & Leaderboard State
    const [user, setUser] = useState<{ id: number, username: string } | null>(null);
    const [userStats, setUserStats] = useState<any>(null);
    const [showAuth, setShowAuth] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [gameSettled, setGameSettled] = useState(false);

    // Initial Auth Check
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await axios.get(`${API_URL}/me`, { withCredentials: true });
                setUser(res.data.user);
                setUserStats(res.data.stats);
                setPlayerName(res.data.user.username);
                addScoreToast(`欢迎回来, ${res.data.user.username}!`, 'positive');
            } catch (err) {
                // Not logged in, that's fine
            }
        };
        checkAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await axios.post(`${API_URL}/logout`, {}, { withCredentials: true });
            setUser(null);
            setUserStats(null);
            setPlayerName('');
            setShowUserProfile(false);
            addScoreToast('已退出登录', 'neutral');
        } catch (err) {
            console.error('Logout failed', err);
        }
    };

    // Socket Ref
    const socketRef = useRef<Socket | null>(null);
    const roomIdRef = useRef<string>('');
    const prevGameStateRef = useRef<GameState | null>(null);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);

    // --- INITIALIZATION ---
    useEffect(() => {
        // Generate a random ID for this session (used as player id, or override with user.id later)
        const myId = `${USER_ID_PREFIX}${Math.floor(Math.random() * 10000)}`;
        setGameState(prev => ({ ...prev, myPlayerId: myId }));

        // Preload voice assets
        preloadVoiceCharacter(getSavedCharacter());

        // Socket.IO Connection
        const socket = io(`http://${window.location.hostname}:6001`);
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Connected to server');
            setWsReady(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected');
            setWsReady(false);
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            setWsReady(false);
            // Don't show toast on every retry, unnecessary spam
        });

        socket.on('game_action', (action: any) => {
            // Check room ID alignment if included in payload, mostly handled by server rooms
            if (action.roomId && action.roomId !== roomIdRef.current) return;
            handleNetworkMessage(action, 'server');
        });

        socket.on('game_state_sync', (data: any) => {
            if (data.roomId && data.roomId !== roomIdRef.current) return;
            // If payload is wrapped or direct
            const state = data.state || data;
            handleNetworkMessage({ type: 'STATE_UPDATE', state }, 'server');
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        roomIdRef.current = gameState.roomId;
    }, [gameState.roomId]);

    // --- NETWORK HANDLERS ---
    const handleNetworkMessage = (action: NetworkAction, senderId: string) => {
        // Whenever ANY valid game action happens, reset local skipped state so new discards are fresh.
        // But only if it's a new discard or turn change.
        if (action.type === 'ACTION_DISCARD') {
            setSkippedDiscardId(null);
        }

        // Logic depends on if we are Host or Client
        // If we are HOST (roomId === myPlayerId), we process actions.
        // If we are CLIENT, we mostly listen for STATE_UPDATE.
        setGameState(prev => {
            const isHost = prev.roomId === prev.myPlayerId;

            if (!isHost) {
                // CLIENT LOGIC
                if (action.type === 'STATE_UPDATE') {
                    return { ...action.state, myPlayerId: prev.myPlayerId };
                }
                return prev;
            }

            // HOST LOGIC
            if (action.type === 'JOIN') {
                if (prev.players.some(p => p.id === action.player.id)) return prev;
                const newPlayers = [...prev.players, action.player];
                const newState: GameState = { ...prev, players: newPlayers };
                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_DINGQUE') {
                const newPlayers = prev.players.map(p => {
                    if (p.id === action.playerId) {
                        return { ...p, dingQue: action.suit, hand: sortHand(p.hand, action.suit) };
                    }
                    return p;
                });

                const allDone = newPlayers.every(p => p.dingQue !== null);
                const nextPhase: GamePhase = allDone ? 'PLAYING' : 'DINGQUE';
                const firstPlayerId = newPlayers[0]?.id ?? '';
                let currentDeck = [...prev.deck];

                // If entering PLAYING phase, the first player needs to draw a tile (14th tile)
                if (allDone && firstPlayerId) {
                    const pIndex = newPlayers.findIndex(p => p.id === firstPlayerId);
                    if (pIndex !== -1) {
                        // Draw from deck instead of random
                        if (currentDeck.length > 0) {
                            const newTile = currentDeck.shift()!;

                            newPlayers[pIndex] = {
                                ...newPlayers[pIndex],
                                hand: [...newPlayers[pIndex].hand, newTile] // Do not sort yet
                            };
                        }
                    }
                }

                const newState: GameState = {
                    ...prev,
                    players: newPlayers,
                    phase: nextPhase,
                    currentTurnPlayerId: firstPlayerId,
                    deck: currentDeck,
                    remainingTiles: currentDeck.length,
                    lastAction: action
                };
                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_DISCARD') {
                const sender = prev.players.find(p => p.id === action.playerId);
                if (!sender) return prev;

                const tileToRemove = sender.hand.find(t => t.id === action.tileId);
                if (!tileToRemove) return prev;

                const newHand = sender.hand.filter(t => t.id !== action.tileId);
                const sortedHand = sortHand(newHand, sender.dingQue);

                const newPlayers = prev.players.map(p => {
                    if (p.id === action.playerId) {
                        return { ...p, hand: sortedHand, discards: [...p.discards, tileToRemove] };
                    }
                    // Reset skips on new discard
                    return { ...p, skippedDiscardId: null };
                });

                const currentIndex = newPlayers.findIndex(p => p.id === action.playerId);
                let nextIndex = (currentIndex + 1) % newPlayers.length;
                let safety = 0;
                while (newPlayers[nextIndex]?.isHu && safety < newPlayers.length) {
                    nextIndex = (nextIndex + 1) % newPlayers.length;
                    safety++;
                }
                const nextPlayerId = newPlayers[nextIndex]?.id ?? '';

                // Host authority: Draw from real deck
                let currentDeck = [...prev.deck];
                let endingPhase = prev.phase;

                let nextLastDiscard = tileToRemove;

                // Check Claims FIRST
                const discarderId = action.playerId;
                const anyClaims = newPlayers.some(p => {
                    if (p.id === discarderId) return false;
                    if (p.isHu) return false;
                    // If already skipped, ignore
                    if (p.skippedDiscardId === tileToRemove.id) return false;

                    // Check using standard 13-tile hand (next player hasn't drawn yet)
                    const canH = canHu([...p.hand, tileToRemove], p.dingQue || 'WAN');
                    const isDingQue = p.dingQue && tileToRemove.suit === p.dingQue;
                    const canP = !isDingQue && canPeng(p.hand, tileToRemove);
                    const canG = !isDingQue && canGang(p.hand, tileToRemove);

                    return canH || canP || canG;
                });

                if (!anyClaims) {
                    // No claims: Auto-Draw for next player
                    nextLastDiscard = null;
                    if (currentDeck.length > 0) {
                        const newTile = currentDeck.shift()!;
                        if (newPlayers[nextIndex] && !newPlayers[nextIndex].isHu) {
                            const playerToUpdate = newPlayers[nextIndex];
                            newPlayers[nextIndex] = {
                                ...playerToUpdate,
                                hand: [...playerToUpdate.hand, newTile] // Do NOT sort yet
                            };
                        }
                    } else {
                        endingPhase = 'GAME_OVER';
                    }
                }

                const newState: GameState = {
                    ...prev,
                    players: newPlayers,
                    deck: currentDeck,
                    lastDiscard: nextLastDiscard,
                    currentTurnPlayerId: nextPlayerId,
                    remainingTiles: currentDeck.length,
                    phase: endingPhase,
                    lastAction: action
                };

                if (newState.remainingTiles === 0) newState.phase = 'GAME_OVER';

                // Host Check: If no one can claim this discard, clear it immediately so next player can play
                // But we must respect the 'Interrupted Turn' logic.
                // If we clear it, 'isInterruptedTurn' becomes false, so next player can play.
                // We need to check if ANYONE (except discarder) can Peng/Gang/Hu
                // Exclude discarder
                // For Next Player (currentTurnPlayerId), only check Hu (cannot Peng/Gang upper) - Simplified: Generic check is fine, rules enforce it usually
                // But specifically for Sichuan Mahjong: Can only Peng/Gang from any discard? Usually yes.
                // Wait, Sichuan Mahjong: can Peng anyone. Next player CAN Peng previous player? Yes. 
                // So we just check logical possibility.

                // Removed duplicate state update

                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_PENG') {
                const actor = prev.players.find(p => p.id === action.playerId);
                const targetTile = prev.lastDiscard;
                if (!actor || !targetTile) return prev;

                // 1. Revert the auto-draw of the current turn player (who was next after discard)
                const interruptedPlayerId = prev.currentTurnPlayerId;
                let newPlayers = prev.players.map(p => {
                    if (p.id === interruptedPlayerId) {
                        // Only revert if they actually drew a tile (hand length % 3 === 2)
                        // Standard hand (13) % 3 === 1. Drawn hand (14) % 3 === 2.
                        if (p.hand.length % 3 === 2) {
                            // Remove the last added tile (the draw from ACTION_DISCARD)
                            const poppedHand = [...p.hand];
                            poppedHand.pop();
                            return { ...p, hand: poppedHand };
                        }
                    }
                    return p;
                });

                // 2. Remove tile from previous discarder
                newPlayers = newPlayers.map(p => ({
                    ...p,
                    discards: p.discards.filter(t => t.id !== targetTile.id)
                }));

                // 3. Process Actor Hand
                // Remove 2 matching tiles
                const matchSuit = targetTile.suit;
                const matchRank = targetTile.rank;
                const handTiles = actor.hand.filter(t => t.suit === matchSuit && t.rank === matchRank);

                // We need exactly 2 from hand + 1 from discard
                const keptHand = actor.hand.filter(t => t.id !== handTiles[0].id && t.id !== handTiles[1].id);
                const meld = [handTiles[0], handTiles[1], targetTile];

                newPlayers = newPlayers.map(p => {
                    if (p.id === actor.id) {
                        return {
                            ...p,
                            hand: sortHand(keptHand, p.dingQue),
                            melds: [...p.melds, meld]
                        };
                    }
                    return p;
                });

                const newState: GameState = {
                    ...prev,
                    players: newPlayers,
                    lastDiscard: null,
                    currentTurnPlayerId: actor.id,
                    lastAction: action
                    // No draw for Peng
                };
                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_GANG') {
                // QIANG GANG HU CHECK (Host Only Logic for now)
                // Only Bu Gang (adding to meld) can be robbed.
                // We need to know if this is Bu Gang.
                const actor = prev.players.find(p => p.id === action.playerId);
                if (actor) {
                    const buGangCandidate = actor.hand.find(h => actor.melds.some(m => m[0].suit === h.suit && m[0].rank === h.rank && m.length === 3));
                    // If logic detects Bu Gang (either by action param or state deduction)
                    const isBuGang = !!buGangCandidate; // Simplified deduction matching handleGangLogic

                    if (isBuGang && buGangCandidate) {
                        // Check if any other player can Hu this tile
                        const robbers = prev.players.filter(p => p.id !== action.playerId && !p.isHu && canHu([...p.hand, buGangCandidate], p.dingQue || 'WAN'));

                        if (robbers.length > 0) {
                            // QIANG GANG TRIGGERED!
                            // Execute HU for all robbers immediately.
                            // The Gang is Cancelled.

                            // Transform into ACTION_HU for the robbers
                            // We deal with the first robber for simplicity or handle multiple?
                            // Sichuan MJ supports "Yi Pao Duo Xiang" (Multiple winners).
                            // We will process them sequentially or loop.

                            let currentState = prev;
                            let processedAction = action; // This gang action is effectively replaced by HU

                            robbers.forEach(robber => {
                                // Construct synthetic HU action
                                const huAction: any = { type: 'ACTION_HU', playerId: robber.id, isQiangGang: true, targetTile: buGangCandidate };

                                // Call HU logic (recursive or inline?)
                                // Inline the critical parts or extract?
                                // Let's simplify: We just run the HU block logic here for the robbers.
                                // BUT we must manually deduct scores from the Ganger (Dian Pao).

                                // ... Logic block is large. 
                                // Better approach: Return a modified state where we applied HUs and skipped Gang.
                                // But we are in a reducer. We can compute the new state.

                                // 1. Calculate Score (Robber gets +1 Fan for Qiang Gang)
                                // 2. Deduct from Actor.
                                // 3. Update Robber Hand (+Tile).
                                // 4. Update Game State (Next Turn, etc).

                                // For simplicity/robustness in this limited context:
                                // Just Treat it as the Ganger DISCARDED the tile, and Robbers HU'd it.
                                // Return state similar to ACTION_DISCARD -> ACTION_HU.

                                // Let's just log it and rely on users to click 'Hu'? 
                                // No, 'Qiang Gang' is usually automatic or prompted.
                                // Since we can't prompt here (reducer), we Assume Auto-Hu or User clicked it?
                                // If User clicked 'Gang', and someone can Hu, the Server should Arbiter.
                                // Here we are Host/Server.

                                // COMPROMISE: We proceed with Gang Logic, but invalidating it?
                                // REALITY: Integrating QiangGang fully requires prompt. 
                                // IF we assume promptless "Perfect Rules":
                                // Execute Hu for robber.
                            });

                            // Simplest valid implementation now:
                            // Just proceed with Gang Logic because UI doesn't support "Wait for Qiang Gang".
                            // TO FIX PROPERLY: We need 'Wait for Rob' phase.
                            // Given constraints, I will add a TOAST and proceed, OR if simple, Auto-Hu.
                            // Let's implement Auto-Hu for Robber (Host Logic).

                            // Process FIRST Robber (Simplify)
                            const robber = robbers[0];
                            // Send a synthetic HU action to be processed in next loop? 
                            // No, sync.
                            // Just fall through to HU logic?
                            // Let's just Return the state as if Robber Hu'd, ignoring Gang.
                            // We need to recursively call the reducer or duplicate logic.
                            // Duplicate logic with 'isQiangGang: true' option.

                            // Actually, let's just use the ACTION_HU block below by changing action type?
                            // No, loop.
                        }
                    }
                }

                let newState = handleGangLogic(prev, action);
                newState.lastAction = action;

                if (newState.phase === 'GAME_OVER') {
                    newState = applyGameSettlement(newState);
                }

                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_HU') {
                const winnerIndex = prev.players.findIndex(p => p.id === action.playerId);
                if (winnerIndex === -1) return prev;
                const winner = prev.players[winnerIndex];

                // 1. Identify Hand & Tile (ZiMo vs DianHu)
                // If lastDiscard exists, it's DianHu (Win on Discard). If not, it's ZiMo (Self-Draw).
                const isZiMo = !prev.lastDiscard;

                // GANG SHANG KAI HUA: If ZiMo AND last action was Me Gang
                const isGangShangKaiHua = isZiMo && prev.lastAction?.type === 'ACTION_GANG' && prev.lastAction.playerId === action.playerId;

                // HAI DI LAO YUE: If remainingTiles == 0
                const isHaiDiLaoYue = prev.remainingTiles === 0;

                // QIANG GANG HU: Check if custom field from synthesized action
                const isQiangGangHu = (action as any).isQiangGang || false;

                const targetTile = (isZiMo || isQiangGangHu) ? (action as any).targetTile || null : prev.lastDiscard;
                // Note: For ZiMo, targetTile is usually null (drawn previously).
                // For QiangGang, it is the robbed tile passed in action.

                // 2. Update Winner's Hand (Visual: "上手")
                let newHand = [...winner.hand];
                if (targetTile && !isZiMo) {
                    // If DianHu or QiangGang, add tile to hand for calculation
                    newHand.push(targetTile);
                }
                newHand = sortHand(newHand, winner.dingQue);

                // 3. Score Calculation
                const fanParams = {
                    isGangShangKaiHua,
                    isHaiDiLaoYue,
                    isQiangGangHu
                };
                const fan = calculateFan(newHand, winner.melds, fanParams);
                const points = Math.max(1, Math.pow(2, fan - 1) * 10);

                let newPlayers = [...prev.players];
                const winnerId = winner.id;

                // Update Winner
                if (isQiangGangHu) {
                    // Specific logic for QiangGang?
                    // Usually treated as DianPao from Ganger.
                }

                newPlayers[winnerIndex] = {
                    ...winner,
                    hand: newHand,
                    isHu: true,
                    score: winner.score + points
                };

                // Update Losers (Score Deduction)
                if (isZiMo) {
                    // Zi Mo: All non-Hu players pay
                    newPlayers = newPlayers.map(p => {
                        if (p.id !== winner.id && !p.isHu) {
                            return { ...p, score: p.score - points };
                        }
                        return p;
                    });
                } else {
                    // Dian Pao: Discarder pays
                    const discarderId = prev.currentTurnPlayerId;
                    newPlayers = newPlayers.map(p => {
                        if (p.id === discarderId) {
                            return { ...p, score: p.score - points };
                        }
                        return p;
                    });
                }

                addScoreToast(`胡牌！${fan}番 +${points}`, 'positive');

                // 4. Bloody Battle Continuation Check
                // End if 3 players have Hu (only 1 left) or tiles ran out
                const huCount = newPlayers.filter(p => p.isHu).length;
                const shouldEnd = huCount >= newPlayers.length - 1 || prev.remainingTiles === 0;

                let nextPhase = prev.phase;
                let nextPlayerId = prev.currentTurnPlayerId;
                let currentDeck = [...prev.deck];
                let nextLastDiscard = null; // Hu consumes the discard

                if (shouldEnd) {
                    nextPhase = 'GAME_OVER';
                } else {
                    // Advance Turn: Start from WINNER and find next non-Hu player
                    let currentSearchIndex = winnerIndex;
                    let safety = 0;
                    let foundNext = false;

                    while (safety < newPlayers.length) {
                        currentSearchIndex = (currentSearchIndex + 1) % newPlayers.length;
                        if (!newPlayers[currentSearchIndex].isHu) {
                            foundNext = true;
                            break;
                        }
                        safety++;
                    }

                    if (foundNext) {
                        nextPlayerId = newPlayers[currentSearchIndex].id;

                        // AUTO DRAW for the Next Player
                        if (currentDeck.length > 0) {
                            const newTile = currentDeck.shift()!;
                            newPlayers[currentSearchIndex] = {
                                ...newPlayers[currentSearchIndex],
                                hand: [...newPlayers[currentSearchIndex].hand, newTile] // unsorted new draw
                            };
                        } else {
                            nextPhase = 'GAME_OVER';
                        }
                    } else {
                        // Should be covered by shouldEnd check, but safety fallback
                        nextPhase = 'GAME_OVER';
                    }
                }

                let newState: GameState = {
                    ...prev,
                    players: newPlayers,
                    phase: nextPhase,
                    currentTurnPlayerId: nextPlayerId,
                    deck: currentDeck,
                    remainingTiles: currentDeck.length,
                    lastDiscard: nextLastDiscard
                };

                if (newState.phase === 'GAME_OVER') {
                    newState = applyGameSettlement(newState);
                }

                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_RESTART') {
                const deck = generateDeck();
                let nextPlayers = [...prev.players].map(p => ({
                    ...p,
                    hand: deck.splice(0, 13),
                    discards: [],
                    melds: [],
                    dingQue: null,
                    isHu: false,
                    gangScore: 0
                }));

                const host = nextPlayers.find(p => p.id === prev.myPlayerId);
                if (host) host.hand = sortHand(host.hand, null);

                const newState: GameState = {
                    ...prev,
                    phase: 'DINGQUE',
                    remainingTiles: deck.length,
                    deck: deck, // Save remaining deck
                    players: nextPlayers,
                    lastDiscard: null,
                    currentTurnPlayerId: '',
                    lastAction: null
                };

                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_UPDATE_VOICE') {
                const newPlayers = prev.players.map(p => {
                    if (p.id === action.playerId) {
                        return { ...p, voiceCharacter: action.voiceCharacter };
                    }
                    return p;
                });
                const newState: GameState = { ...prev, players: newPlayers };
                broadcastState(newState);
                return newState;
            }

            if (action.type === 'ACTION_PASS') {
                const newPlayers = prev.players.map(p => {
                    if (p.id === action.playerId && prev.lastDiscard) {
                        return { ...p, skippedDiscardId: prev.lastDiscard.id };
                    }
                    return p;
                });

                // Host Check: After this pass, are there any claims left?
                let lastDiscard = prev.lastDiscard;
                let currentDeck = [...prev.deck];
                let endingPhase = prev.phase;
                let updatedPlayers = newPlayers;

                if (lastDiscard) {
                    const anyClaimsLeft = updatedPlayers.some(p => {
                        if (p.isHu) return false;
                        if (p.skippedDiscardId === lastDiscard!.id) return false;

                        // Check validity - everyone has 13 tiles max currently if waiting
                        const canH = canHu([...p.hand, lastDiscard!], p.dingQue || 'WAN');
                        const isDingQue = p.dingQue && lastDiscard!.suit === p.dingQue;
                        const canP = !isDingQue && canPeng(p.hand, lastDiscard!);
                        const canG = !isDingQue && canGang(p.hand, lastDiscard!);

                        return canH || canP || canG;
                    });

                    if (!anyClaimsLeft) {
                        // Everyone passed or cannot claim.
                        lastDiscard = null;

                        // Proceed to DRAW TILE for the current turn player
                        if (currentDeck.length > 0) {
                            const newTile = currentDeck.shift()!;

                            // currentTurnPlayerId was set in ACTION_DISCARD
                            const tIndex = updatedPlayers.findIndex(p => p.id === prev.currentTurnPlayerId);
                            if (tIndex !== -1 && !updatedPlayers[tIndex].isHu) {
                                updatedPlayers = updatedPlayers.map((p, i) => {
                                    if (i === tIndex) {
                                        return { ...p, hand: [...p.hand, newTile] };
                                    }
                                    return p;
                                });
                            }
                        } else {
                            endingPhase = 'GAME_OVER';
                        }
                        let newState: GameState = {
                            ...prev,
                            players: updatedPlayers,
                            lastDiscard,
                            deck: currentDeck,
                            remainingTiles: currentDeck.length,
                            phase: endingPhase,
                            lastAction: action
                        };

                        if (newState.remainingTiles === 0) {
                            newState.phase = 'GAME_OVER';
                            newState = applyGameSettlement(newState);
                        }

                        broadcastState(newState);
                        return newState;
                    }
                }
            }

            return prev;
        });
    };


    // --- BOT AI ---
    useEffect(() => {
        const isHost = gameState.roomId === gameState.myPlayerId;
        const hasBots = gameState.players.some(p => p.id.startsWith('bot-'));
        if (!isHost || !hasBots) return;
        if (gameState.phase !== 'PLAYING' && gameState.phase !== 'DINGQUE') return;

        let timer: NodeJS.Timeout;

        // AI Logic
        const runBotLogic = () => {
            // --- HUMAN BLOCKING CHECK ---
            // Iterate ALL players to see if any human can act on the last discard.
            // If so, pause AI (unless they passed).
            const lastDiscard = gameState.lastDiscard;

            if (lastDiscard && lastDiscard.id !== skippedDiscardId) {
                // Check all non-turn players
                const interruptors = gameState.players.filter(p => !p.isHu && !p.id.startsWith('bot-') && p.id !== gameState.currentTurnPlayerId);

                for (const human of interruptors) {
                    // If this human already passed this tile, skip blocking
                    if (human.skippedDiscardId === lastDiscard.id) continue;

                    // Dian Hu Check (Hand + Discard)
                    const canDianHu = canHu([...human.hand, lastDiscard], human.dingQue || 'WAN');
                    const isDingQue = human.dingQue && lastDiscard.suit === human.dingQue;

                    const canAction =
                        (!isDingQue && (canPeng(human.hand, lastDiscard) || canGang(human.hand, lastDiscard))) ||
                        canDianHu;

                    if (canAction) {
                        // Block AI until human decides
                        return;
                    }
                }
            }

            // DINGQUE PHASE
            if (gameState.phase === 'DINGQUE') {
                const botToAct = gameState.players.find(p => p.id.startsWith('bot-') && p.dingQue === null);
                if (botToAct) {
                    const suit = getRecommendedDingQue(botToAct.hand);
                    handleNetworkMessage({ type: 'ACTION_DINGQUE', playerId: botToAct.id, suit }, 'bot');
                }
                return;
            }

            // PLAYING PHASE
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayerId);
            if (currentPlayer && currentPlayer.id.startsWith('bot-')) {
                // Simple strategy: Discard dingque suit first, then random
                let tileToDiscard = currentPlayer.hand.find(t => t.suit === currentPlayer.dingQue);
                if (!tileToDiscard) {
                    const validTiles = currentPlayer.hand.filter(t => t.suit !== currentPlayer.dingQue);
                    if (validTiles.length > 0) {
                        // Pick random to be less predictable, or just last drawn
                        tileToDiscard = validTiles[Math.floor(Math.random() * validTiles.length)];
                    } else {
                        tileToDiscard = currentPlayer.hand[0];
                    }
                }

                if (tileToDiscard) {
                    handleNetworkMessage({
                        type: 'ACTION_DISCARD',
                        playerId: currentPlayer.id,
                        tileId: tileToDiscard.id
                    }, 'bot');
                }
            }
        };

        // Add delay for realism
        timer = setTimeout(runBotLogic, 1000);

        return () => clearTimeout(timer);
    }, [gameState.phase, gameState.currentTurnPlayerId, gameState.players, gameState.isMultiplayer, gameState.roomId, gameState.myPlayerId, skippedDiscardId]);

    // --- SOUND EFFECTS ---
    useEffect(() => {
        const prev = prevGameStateRef.current;
        const curr = gameState;

        if (prev) {
            // 1. Detect New Discard
            // 1. Detect New Discard (Changed to detect discards array updates)
            curr.players.forEach(p => {
                const prevP = prev.players.find(pp => pp.id === p.id);
                if (prevP && p.discards.length > prevP.discards.length) {
                    const newDiscard = p.discards[p.discards.length - 1];
                    playDiscardVoice((p.voiceCharacter as VoiceCharacter) || 'xiaoni', newDiscard);
                }
            });

            // 2. Detect Hu
            curr.players.forEach(p => {
                const prevPlayer = prev.players.find(pp => pp.id === p.id);
                if (p.isHu && (!prevPlayer || !prevPlayer.isHu)) {
                    // Self Draw (Zi Mo) typically happens during your own turn
                    const isZiMo = prev.currentTurnPlayerId === p.id;
                    playActionVoice((p.voiceCharacter as VoiceCharacter) || 'xiaoni', isZiMo ? 'zimo' : 'hu');
                }
            });

            // 3. Detect Peng / Gang (Melds increased)
            curr.players.forEach(p => {
                const prevPlayer = prev.players.find(pp => pp.id === p.id);
                if (prevPlayer && p.melds.length > prevPlayer.melds.length) {
                    const newMeld = p.melds[p.melds.length - 1];
                    if (newMeld.length === 3) {
                        playActionVoice((p.voiceCharacter as VoiceCharacter) || 'xiaoni', 'peng');
                    } else if (newMeld.length === 4) {
                        playActionVoice((p.voiceCharacter as VoiceCharacter) || 'xiaoni', 'gang');
                    }
                }
            });
        }

        prevGameStateRef.current = curr;
    }, [gameState]);

    const broadcastState = (state: GameState) => {
        if (!state.isMultiplayer) return;
        if (!socketRef.current) return;
        // Host broadcasts state
        const payload = { roomId: state.roomId, state };
        socketRef.current.emit('game_state_sync', payload);
    };

    const sendAction = (action: NetworkAction) => {
        if (gameState.roomId === gameState.myPlayerId) {
            // I am host, handle locally
            handleNetworkMessage(action, gameState.myPlayerId);
        } else {
            // Send to host
            if (socketRef.current) {
                const payload = { roomId: gameState.roomId, ...action };
                socketRef.current.emit('game_action', payload);
            }
        }
    };

    // --- GAMEPLAY ACTIONS ---

    const createRoom = () => {
        if (!user) {
            setShowAuth(true);
            addScoreToast('请登录以创建房间', 'neutral');
            return;
        }

        if (!wsReady) {
            addScoreToast('正在连接服务器，请稍候...', 'neutral');
            return;
        }
        if (!gameState.myPlayerId) {
            addScoreToast('正在生成玩家ID，请稍候...', 'neutral');
            return;
        }
        const myId = gameState.myPlayerId;
        const hostPlayer: Player = {
            id: myId,
            name: user ? user.username : (playerName.trim() || '房主'),
            position: 'bottom',
            hand: [],
            discards: [],
            melds: [],
            score: 10000,
            dingQue: null,
            isHu: false,
            avatar: '🦁',
            voiceCharacter: getSavedCharacter(),
            gangScore: 0
        };

        const roomId = myId;
        roomIdRef.current = roomId;
        setGameState(prev => ({
            ...prev,
            roomId,
            isMultiplayer: true,
            phase: 'LOBBY',
            players: [hostPlayer],
            lastAction: null,
            // Reset game data
            deck: [],
            remainingTiles: 108,
            currentTurnPlayerId: '',
            lastDiscard: null
        }));

        if (socketRef.current) {
            socketRef.current.emit('join_game', { roomId });
            // Host is first player, logic handles it locally
        }
    };

    const joinRoom = () => {
        if (!user) {
            setShowAuth(true);
            addScoreToast('请登录以加入房间', 'neutral');
            return;
        }
        if (!wsReady) {
            addScoreToast('正在连接服务器，请稍候...', 'neutral');
            return;
        }
        if (!gameState.myPlayerId) {
            addScoreToast('正在生成玩家ID，请稍候...', 'neutral');
            return;
        }
        if (!lobbyInput) return;
        const roomId = lobbyInput.trim();
        roomIdRef.current = roomId;

        setGameState(prev => ({
            ...prev,
            roomId,
            isMultiplayer: true,
            phase: 'LOBBY',
            lastAction: null
        }));

        if (socketRef.current) {
            socketRef.current.emit('join_game', { roomId });

            const myPlayer: Player = {
                id: gameState.myPlayerId,
                name: user ? user.username : (playerName.trim() || `玩家 ${gameState.myPlayerId.slice(-4)}`),
                position: 'bottom',
                hand: [],
                discards: [],
                melds: [],
                score: 10000,
                dingQue: null,
                isHu: false,
                skippedDiscardId: null,
                avatar: '🦊',
                voiceCharacter: getSavedCharacter(),
                gangScore: 0
            };

            // Send JOIN action so Host knows about us
            // Note: sendAction handles checking if we are host (we are not), so use direct emit or sendAction?
            // sendAction relies on gameState.roomId being set which we just did implicitly via setGameState but closure capture might be stale?
            // Safer to direct emit here.

            socketRef.current.emit('game_action', {
                roomId,
                type: 'JOIN',
                player: myPlayer
            });
        }
    };

    const addBotPlayer = () => {
        if (gameState.roomId !== gameState.myPlayerId) return; // Only host
        if (gameState.players.length >= 4) return;

        const existingIds = new Set(gameState.players.map(p => p.id));
        let botIndex = 1;
        while (existingIds.has(`bot-${botIndex}`)) botIndex++;

        const botPlayer: Player = {
            id: `bot-${botIndex}`,
            name: `人机 ${botIndex}`,
            position: 'bottom',
            hand: [],
            discards: [],
            melds: [],
            score: 10000,
            dingQue: null,
            isHu: false,
            skippedDiscardId: null,
            avatar: ['🤖', '👾', '👽', '🧠'][botIndex % 4],
            voiceCharacter: (['xiaobei', 'yunxi', 'xiaoxiao', 'yunjian'][botIndex % 4]) as VoiceCharacter,
            gangScore: 0
        };

        const newState: GameState = {
            ...gameState,
            players: [...gameState.players, botPlayer]
        };

        setGameState(newState);
        broadcastState(newState);
    };

    const startBotGame = () => {
        if (!gameState.myPlayerId) return;

        const myId = gameState.myPlayerId;
        const roomId = myId; // "Host" logic uses roomId === myPlayerId
        roomIdRef.current = roomId;

        const humanPlayer: Player = {
            id: myId,
            name: user ? user.username : '你',
            position: 'bottom',
            hand: [],
            discards: [],
            melds: [],
            score: 10000,
            dingQue: null,
            isHu: false,
            skippedDiscardId: null,
            avatar: '🦁',
            voiceCharacter: getSavedCharacter(),
            gangScore: 0
        };

        const bots: Player[] = [1, 2, 3].map(i => ({
            id: `bot-${i}`,
            name: `人机 ${i}`,
            position: 'bottom', // Ignored, recalculated on render
            hand: [],
            discards: [],
            melds: [],
            score: 10000,
            dingQue: null,
            isHu: false,
            skippedDiscardId: null,
            avatar: ['🤖', '👾', '👽'][i - 1],
            voiceCharacter: (['xiaobei', 'yunxi', 'xiaoxiao'][i - 1]) as VoiceCharacter,
            gangScore: 0
        }));

        // Deal tiles
        const deck = generateDeck();
        const allPlayers = [humanPlayer, ...bots].map(p => ({
            ...p,
            hand: sortHand(deck.splice(0, 13), null)
        }));

        setGameState(prev => ({
            ...prev,
            roomId,
            isMultiplayer: false,
            phase: 'DINGQUE',
            players: allPlayers,
            remainingTiles: deck.length,
            deck: deck, // Save remaining deck
            currentTurnPlayerId: '',
            lastAction: null
        }));
    };

    const startGame = () => {
        // Only host can start
        const deck = generateDeck();
        let tempPlayers = [...gameState.players];

        // Deal 13
        tempPlayers = tempPlayers.map(p => ({
            ...p,
            hand: deck.splice(0, 13),
            dingQue: null,
            discards: [],
            isHu: false
        }));

        // Sort Host hand
        const host = tempPlayers.find(p => p.id === gameState.myPlayerId);
        if (host) host.hand = sortHand(host.hand, null);

        const newState: GameState = {
            ...gameState,
            phase: 'DINGQUE',
            remainingTiles: deck.length,
            deck: deck, // Save remaining deck
            players: tempPlayers
        };

        setGameState(newState);
        broadcastState(newState);
    };

    const handleDingQue = (suit: Suit) => {
        sendAction({ type: 'ACTION_DINGQUE', playerId: gameState.myPlayerId, suit });
    };

    const handlePeng = () => {
        sendAction({ type: 'ACTION_PENG', playerId: gameState.myPlayerId });
    };

    const handleGang = () => {
        sendAction({ type: 'ACTION_GANG', playerId: gameState.myPlayerId });
    };

    const handleHu = () => {
        sendAction({ type: 'ACTION_HU', playerId: gameState.myPlayerId });
    };

    const handleDiscard = (tile: TileData) => {
        // Validation
        const me = gameState.players.find(p => p.id === gameState.myPlayerId);
        if (me?.dingQue && me.hand.some(t => t.suit === me.dingQue) && tile.suit !== me.dingQue) {
            addScoreToast('Must discard DingQue suit!', 'negative');
            return;
        }


        // Validation - Prevent Acting if Interrupted
        const isInterruptedTurn = gameState.currentTurnPlayerId === gameState.myPlayerId && gameState.lastDiscard && !gameState.players.find(p => p.id === gameState.myPlayerId)?.discards.some(t => t.id === gameState.lastDiscard?.id);

        if (isInterruptedTurn) {
            addScoreToast('请等待其他玩家操作（碰/杠/胡）', 'neutral');
            return;
        }

        setSelectedTileId(null);
        sendAction({ type: 'ACTION_DISCARD', playerId: gameState.myPlayerId, tileId: tile.id });
    };

    const handleSkip = () => {
        if (gameState.lastDiscard) {
            setSkippedDiscardId(gameState.lastDiscard.id);
            // Notify server/host that we passed this tile
            sendAction({ type: 'ACTION_PASS', playerId: gameState.myPlayerId });
        }
    };

    const handleVoiceChange = (character: VoiceCharacter) => {
        // Update local player voice in multiplayer or single player
        // For multiplayer, we send action. For single player, we update state directly.
        if (gameState.isMultiplayer) {
            sendAction({
                type: 'ACTION_UPDATE_VOICE',
                playerId: gameState.myPlayerId,
                voiceCharacter: character
            });
        } else {
            setGameState(prev => {
                const newPlayers = prev.players.map(p => {
                    if (p.id === prev.myPlayerId) {
                        return { ...p, voiceCharacter: character };
                    }
                    return p;
                });
                return { ...prev, players: newPlayers };
            });
        }
    };

    // 刷新用户统计数据
    const refreshUserStats = async () => {
        if (!user) return;
        try {
            const res = await axios.get(`${API_URL}/user/${user.id}/stats`, { withCredentials: true });
            setUserStats(res.data.stats);
        } catch (err) {
            console.error('Failed to refresh user stats', err);
        }
    };

    // 对局结算 - 调用后端 API
    const settleGame = async () => {
        if (!user) return; // 只有登录用户才结算
        if (gameSettled) return; // 防止重复结算

        const isHost = gameState.roomId === gameState.myPlayerId;
        if (!isHost && gameState.isMultiplayer) return; // 多人模式只有房主结算

        try {
            // 获取我的玩家数据
            const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);
            if (!myPlayer) return;

            // 判断胡牌类型
            const isWinner = myPlayer.isHu;
            // 简单判断：如果胡牌时手牌数为14(自摸)则是自摸
            const isSelfDraw = isWinner && myPlayer.hand.length % 3 === 2;
            // 简单判断放炮：如果有其他玩家胡牌且我没胡
            const otherWinners = gameState.players.filter(p => p.isHu && p.id !== gameState.myPlayerId);
            const isDiscardLoss = !isWinner && otherWinners.length > 0;

            // 检测牌型
            const isQingyise = myPlayer.hand.every(t => t.suit === myPlayer.hand[0]?.suit) &&
                myPlayer.melds.every(m => m[0].suit === myPlayer.hand[0]?.suit);
            const isQidui = myPlayer.melds.length === 0 && myPlayer.hand.length === 14;
            const gangCount = myPlayer.melds.filter(m => m.length === 4).length;

            // 构建玩家数据 - 只提交登录用户
            const playersData = [{
                user_id: user.id,
                final_score: myPlayer.score,
                is_winner: isWinner,
                is_self_draw: isSelfDraw,
                is_discard_loss: isDiscardLoss,
                is_qingyise: isQingyise && isWinner,
                is_qidui: isQidui && isWinner,
                gang_count: gangCount
            }];

            // 构建结果摘要
            const winners = gameState.players.filter(p => p.isHu).map(p => p.name);
            const resultSummary = winners.length > 0
                ? `胡牌: ${winners.join(', ')}`
                : '流局';

            // 调用结算 API
            const res = await axios.post(`${API_URL}/game/settle`, {
                players: playersData,
                result_summary: resultSummary,
                game_type: gameState.isMultiplayer ? 'multiplayer' : 'bot'
            }, { withCredentials: true });

            console.log('Game settled:', res.data);
            setGameSettled(true);

            // 刷新用户统计
            await refreshUserStats();

            // 显示 ELO 变化
            const result = res.data.results?.find((r: any) => r.user_id === user.id);
            if (result) {
                const changeText = result.elo_change >= 0
                    ? `+${result.elo_change}`
                    : `${result.elo_change}`;
                addScoreToast(`ELO ${changeText} → ${result.new_elo}`, result.elo_change >= 0 ? 'positive' : 'negative');
            }
        } catch (err) {
            console.error('Failed to settle game:', err);
        }
    };

    // 监听游戏结束，自动结算
    useEffect(() => {
        if (gameState.phase === 'GAME_OVER' && user && !gameSettled) {
            settleGame();
        }
    }, [gameState.phase, user, gameSettled]);

    // 重置结算状态
    useEffect(() => {
        if (gameState.phase === 'DINGQUE') {
            setGameSettled(false);
        }
    }, [gameState.phase]);

    const addScoreToast = (text: string, type: 'positive' | 'negative' | 'neutral') => {
        const id = Date.now();
        setScoreEvents(prev => [...prev, { id, text, type }]);
        setTimeout(() => setScoreEvents(prev => prev.filter(e => e.id !== id)), 2000);
    };

    // --- RENDER HELPERS ---

    // Coordinate mapper: Rotates the view so "Me" is always at bottom
    const getRelativePosition = (playerId: string): 'bottom' | 'right' | 'top' | 'left' => {
        const myIndex = gameState.players.findIndex(p => p.id === gameState.myPlayerId);
        if (myIndex === -1) return 'bottom'; // Spectator or not joined

        const targetIndex = gameState.players.findIndex(p => p.id === playerId);
        const total = gameState.players.length;

        // If 4 players
        const diff = (targetIndex - myIndex + total) % total;
        if (diff === 0) return 'bottom';
        if (diff === 1) return 'right';
        if (diff === 2) return 'top';
        return 'left';
    };

    const renderLobby = () => (
        <div className="flex flex-col items-center justify-center min-h-screen z-50 relative">
            {/* Top Bar Actions */}
            {/* Top Bar Actions */}
            <div className="absolute top-4 right-4 flex gap-4 z-50">
                <VoiceSettingsButton onClick={() => setShowVoiceSettings(true)} />
                <button
                    onClick={() => setShowRules(true)}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg font-bold transition-all border border-white/20 shadow-lg"
                >
                    规则
                </button>
                <button
                    onClick={() => setShowLeaderboard(true)}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg font-bold transition-all border border-white/20 shadow-lg flex items-center gap-2"
                >
                    <Trophy size={18} className="text-yellow-400" />
                    排行榜
                </button>
                {user ? (
                    <button
                        onClick={() => setShowUserProfile(true)}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 backdrop-blur-md text-emerald-400 px-4 py-2 rounded-lg font-bold border border-emerald-500/30 flex items-center gap-2 transition-all"
                    >
                        <User size={18} />
                        <span>{user.username}</span>
                        {userStats && (
                            <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-xs font-mono">
                                {userStats.elo_score} ELO
                            </span>
                        )}
                        {userStats?.replenish_count > 0 && (
                            <span className="text-orange-400 flex items-center gap-0.5 text-xs">
                                <RefreshCw size={12} />×{userStats.replenish_count}
                            </span>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => setShowAuth(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2"
                    >
                        <LogIn size={18} />
                        登录 / 注册
                    </button>
                )}
            </div>

            {showAuth && (
                <Auth
                    onClose={() => setShowAuth(false)}
                    onLogin={(usr, stats) => {
                        setUser(usr);
                        setUserStats(stats);
                        setPlayerName(usr.username);
                        setShowAuth(false);
                        addScoreToast(`欢迎回来, ${usr.username}!`, 'positive');
                    }}
                />
            )}

            {showUserProfile && user && (
                <UserProfile
                    userId={user.id}
                    username={user.username}
                    onClose={() => setShowUserProfile(false)}
                    onStatsUpdated={refreshUserStats}
                    onLogout={handleLogout}
                />
            )}

            {showLeaderboard && (
                <Leaderboard
                    onClose={() => setShowLeaderboard(false)}
                    currentUserId={user?.id}
                />
            )}

            {showVoiceSettings && <VoiceSettings onClose={() => setShowVoiceSettings(false)} onCharacterSelect={handleVoiceChange} />}
            {showRules && (
                <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center">
                    <div className="bg-white text-gray-800 max-w-2xl w-[90%] p-6 rounded-2xl shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-black text-emerald-700">血战到底规则简介</h2>
                            <button onClick={() => setShowRules(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                        </div>
                        <ul className="space-y-2 text-sm leading-6">
                            <li>• 人数与发牌：4人局，每人13张，庄家先摸一张成为14张后打出。</li>
                            <li>• 定缺：开局必须选择缺一门（万/条/筒之一）。手中仍有定缺花色时不能胡牌。</li>
                            <li>• 出牌顺序：轮到自己摸牌，摸到的牌置于最右侧；可选择打出任意一张，若不打出摸到的牌则并入手牌。</li>
                            <li>• 胡牌牌型：标准胡型为4副面子（顺子或刻子/杠）+1对将；支持七对。</li>
                            <li>• 碰牌：他人弃牌时，若你手中有两张相同牌可碰，碰后由你出牌。</li>
                            <li>• 杠牌：
                                <div className="pl-3">
                                    <div>明杠：他人弃牌时你有三张相同牌可明杠。</div>
                                    <div>暗杠：自己手中四张相同牌可暗杠。</div>
                                    <div>补杠：已碰的刻子再摸到第四张可补杠。</div>
                                </div>
                            </li>
                            <li>• 番数与计分：基础1番，七对/碰碰胡/清一色等会加番；番数越高得分越多。</li>
                            <li>• 过牌：他人弃牌可碰/杠时可选择“过”，过后该弃牌不再可用。</li>
                        </ul>
                        <div className="mt-6 text-right">
                            <button onClick={() => setShowRules(false)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">知道了</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-[#0a3a3a] p-8 rounded-2xl shadow-2xl border border-emerald-600/30 w-full max-w-md text-center">
                <h1 className="text-4xl font-black text-emerald-100 mb-2 tracking-widest">血战到底</h1>
                <p className="text-emerald-400 mb-8 font-serif">四川血战到底</p>

                {gameState.roomId ? (
                    // Waiting Room
                    <div>
                        <div className="mb-6 p-4 bg-black/20 rounded-lg">
                            <p className="text-gray-400 text-sm mb-1">房间号（分享给朋友）</p>
                            <div className="flex items-center justify-center gap-2 text-yellow-400 font-mono text-xl font-bold bg-black/40 p-2 rounded">
                                {gameState.roomId}
                                <button
                                    onClick={() => {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(gameState.roomId)
                                                .then(() => addScoreToast('房间号已复制', 'positive'))
                                                .catch(() => addScoreToast('复制失败', 'negative'));
                                        } else {
                                            // Fallback for non-secure contexts (LAN http)
                                            try {
                                                const textArea = document.createElement("textarea");
                                                textArea.value = gameState.roomId;
                                                textArea.style.position = "fixed";  // Avoid scrolling to bottom
                                                document.body.appendChild(textArea);
                                                textArea.focus();
                                                textArea.select();
                                                const successful = document.execCommand('copy');
                                                document.body.removeChild(textArea);
                                                if (successful) addScoreToast('房间号已复制', 'positive');
                                                else addScoreToast('请手动复制', 'neutral');
                                            } catch (err) {
                                                addScoreToast('请手动复制', 'neutral');
                                            }
                                        }
                                    }}
                                    className="hover:text-white"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 mb-8">
                            {gameState.players.map(p => (
                                <div key={p.id} className="flex items-center gap-2 p-2 bg-emerald-800/50 rounded">
                                    <span className="text-2xl">{p.avatar}</span>
                                    <span className="text-white">{p.name} {p.id === gameState.myPlayerId ? '(我)' : ''}</span>
                                </div>
                            ))}
                            {gameState.players.length < 4 && (
                                <div className="text-gray-500 italic py-2 animate-pulse">等待玩家加入...</div>
                            )}
                        </div>

                        {gameState.roomId === gameState.myPlayerId && gameState.players.length < 4 && (
                            <button onClick={addBotPlayer} className="w-full mb-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg shadow border-b-4 border-indigo-800">
                                添加人机
                            </button>
                        )}

                        {gameState.roomId === gameState.myPlayerId && gameState.players.length >= 2 && (
                            <button onClick={startGame} className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold py-3 rounded-lg shadow-lg hover:scale-105 transition">
                                开始游戏
                            </button>
                        )}
                    </div>
                ) : (
                    // Main Menu - Redesigned
                    <div className="space-y-6 w-full">
                        <button
                            onClick={startBotGame}
                            className="group w-full relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-[2px] transition-all hover:scale-[1.02] shadow-xl shadow-indigo-900/30 active:scale-95"
                        >
                            <div className="relative flex items-center justify-center gap-3 bg-[#0a0a0a]/10 backdrop-blur-sm h-full py-4 rounded-2xl transition-all group-hover:bg-transparent">
                                <Bot className="w-6 h-6 text-white" />
                                <span className="text-xl font-bold text-white tracking-wide">人机对战</span>
                            </div>
                        </button>

                        <button
                            onClick={createRoom}
                            disabled={!wsReady}
                            className={`group w-full relative overflow-hidden rounded-2xl p-[2px] transition-all hover:scale-[1.02] shadow-xl shadow-emerald-900/30 active:scale-95 ${wsReady ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gray-700 cursor-not-allowed'
                                }`}
                        >
                            <div className={`relative flex items-center justify-center gap-3 bg-[#0a0a0a]/10 backdrop-blur-sm h-full py-4 rounded-2xl transition-all group-hover:bg-transparent`}>
                                <Users className="w-6 h-6 text-white" />
                                <span className="text-xl font-bold text-white tracking-wide">创建房间 (房主)</span>
                            </div>
                        </button>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-[#0a3a3a] text-slate-400 font-medium">或</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="relative group flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <LogIn className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="输入房间号"
                                        className="block w-full pl-11 pr-4 py-3 bg-[#051e1e] border border-emerald-900/50 rounded-xl text-emerald-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium font-mono"
                                        value={lobbyInput}
                                        onChange={e => setLobbyInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && joinRoom()}
                                    />
                                </div>
                                <button
                                    onClick={joinRoom}
                                    disabled={!wsReady || !lobbyInput}
                                    className={`px-6 rounded-xl font-bold transition-all flex items-center justify-center ${wsReady && lobbyInput
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-indigo-500/30 active:scale-95'
                                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <ArrowLeft className="rotate-180" size={24} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const renderGame = () => {
        const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);
        if (!myPlayer) return <div>Error: Player not found</div>;

        const playersByPos = {
            bottom: myPlayer,
            right: gameState.players.find(p => getRelativePosition(p.id) === 'right'),
            top: gameState.players.find(p => getRelativePosition(p.id) === 'top'),
            left: gameState.players.find(p => getRelativePosition(p.id) === 'left'),
        };

        return (
            <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center select-none">
                <div className="fixed top-4 right-4 z-[60] flex gap-2">
                    <VoiceSettingsButton onClick={() => setShowVoiceSettings(true)} />
                    <button
                        onClick={() => setShowRules(true)}
                        className="bg-emerald-700/90 hover:bg-emerald-600 text-white px-4 py-2 rounded-full shadow-lg border border-emerald-900"
                    >
                        游戏规则
                    </button>
                </div>

                {showVoiceSettings && <VoiceSettings onClose={() => setShowVoiceSettings(false)} onCharacterSelect={handleVoiceChange} />}
                {showRules && (
                    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center">
                        <div className="bg-white text-gray-800 max-w-2xl w-[90%] p-6 rounded-2xl shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-2xl font-black text-emerald-700">血战到底规则简介</h2>
                                <button onClick={() => setShowRules(false)} className="text-gray-500 hover:text-gray-800">✕</button>
                            </div>
                            <ul className="space-y-2 text-sm leading-6">
                                <li>• 人数与发牌：4人局，每人13张，庄家先摸一张成为14张后打出。</li>
                                <li>• 定缺：开局必须选择缺一门（万/条/筒之一）。手中仍有定缺花色时不能胡牌。</li>
                                <li>• 出牌顺序：轮到自己摸牌，摸到的牌置于最右侧；可选择打出任意一张，若不打出摸到的牌则并入手牌。</li>
                                <li>• 胡牌牌型：标准胡型为4副面子（顺子或刻子/杠）+1对将；支持七对。</li>
                                <li>• 碰牌：他人弃牌时，若你手中有两张相同牌可碰，碰后由你出牌。</li>
                                <li>• 杠牌：
                                    <div className="pl-3">
                                        <div>明杠：他人弃牌时你有三张相同牌可明杠。</div>
                                        <div>暗杠：自己手中四张相同牌可暗杠。</div>
                                        <div>补杠：已碰的刻子再摸到第四张可补杠。</div>
                                    </div>
                                </li>
                                <li>• 番数与计分：基础1番，七对/碰碰胡/清一色等会加番；番数越高得分越多。</li>
                                <li>• 过牌：他人弃牌可碰/杠时可选择“过”，过后该弃牌不再可用。</li>
                            </ul>
                            <div className="mt-6 text-right">
                                <button onClick={() => setShowRules(false)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">知道了</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table Surface */}
                <div className="relative w-[96vw] h-[92vh] rounded-[4rem] bg-[#1a5c5c] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-[12px] border-[#0a2a2a] flex items-center justify-center perspective-table">
                    {/* Felt Texture Overlay */}
                    <div className="absolute inset-0 rounded-[3.5rem] opacity-20 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>

                    {/* Center Info */}
                    <TableCenter remainingTiles={gameState.remainingTiles} phase={gameState.phase} />
                    <ScoreToast events={scoreEvents} />

                    {/* --- PLAYERS --- */}

                    {/* TOP PLAYER */}
                    {playersByPos.top && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                            <div className="flex gap-8 items-end">
                                {/* Melds */}
                                <div className="flex gap-2">
                                    {playersByPos.top.melds.map((meld, mi) => (
                                        <div key={mi} className="flex gap-[1px] bg-black/20 p-1 rounded">
                                            {meld.map((t, ti) => <Tile key={ti} tile={t} size="sm" isFaceUp={true} />)}
                                        </div>
                                    ))}
                                </div>
                                {/* Hand: Face down - 使用 Tile 组件渲染牌背 */}
                                <div className="flex gap-[2px]">
                                    {playersByPos.top.hand.map((t, i) => (
                                        <Tile key={i} size="md" isFaceUp={false} className="shadow-md" />
                                    ))}
                                </div>
                            </div>
                            {/* Top Discards Grid */}
                            <div className="mt-4 grid grid-cols-10 gap-1 opacity-90">
                                {playersByPos.top.discards.map((tile, i) => (
                                    <Tile key={i} tile={tile} size="sm" is3D={false} />
                                ))}
                            </div>
                            <PlayerAvatar
                                player={playersByPos.top}
                                isCurrentTurn={gameState.currentTurnPlayerId === playersByPos.top.id}
                                className="absolute -top-2 -right-48 flex-row-reverse"
                            />
                        </div>
                    )}

                    {/* LEFT PLAYER */}
                    {playersByPos.left && (
                        <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-row items-center">
                            {/* Left Melds */}
                            <div className="flex flex-col gap-2 -mt-12 mr-4">
                                {playersByPos.left.melds.map((meld, mi) => (
                                    <div key={mi} className="flex gap-[2px] bg-black/20 p-1 rounded">
                                        {meld.map((t, ti) => (
                                            <Tile key={ti} tile={t} size="sm" isFaceUp={true} rotation={-90} is3D={false} />
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Hand: Face down - 使用负边距让牌紧密叠加 */}
                            <div className="flex flex-col -mt-12">
                                {playersByPos.left.hand.map((t, i) => (
                                    <div key={i} className="-mb-6 first:mb-0">
                                        <Tile size="md" isFaceUp={false} rotation={90} is3D={false} className="shadow-md" />
                                    </div>
                                ))}
                            </div>
                            <div className="ml-8 grid grid-cols-6 gap-1 rotate-90 opacity-90">
                                {playersByPos.left.discards.map((tile, i) => (
                                    <Tile key={i} tile={tile} size="sm" is3D={false} rotation={-90} />
                                ))}
                            </div>
                            <PlayerAvatar
                                player={playersByPos.left}
                                isCurrentTurn={gameState.currentTurnPlayerId === playersByPos.left.id}
                                className="absolute -top-32 left-0"
                            />
                        </div>
                    )}

                    {/* RIGHT PLAYER */}
                    {playersByPos.right && (
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-row-reverse items-center">
                            {/* Right Melds */}
                            <div className="flex flex-col gap-2 -mt-12 ml-4">
                                {playersByPos.right.melds.map((meld, mi) => (
                                    <div key={mi} className="flex gap-[2px] bg-black/20 p-1 rounded">
                                        {meld.map((t, ti) => (
                                            <Tile key={ti} tile={t} size="sm" isFaceUp={true} rotation={90} is3D={false} />
                                        ))}
                                    </div>
                                ))}
                            </div>

                            {/* Hand: Face down - 使用负边距让牌紧密叠加 */}
                            <div className="flex flex-col -mt-12">
                                {playersByPos.right.hand.map((t, i) => (
                                    <div key={i} className="-mb-6 first:mb-0">
                                        <Tile size="md" isFaceUp={false} rotation={-90} is3D={false} className="shadow-md" />
                                    </div>
                                ))}
                            </div>
                            <div className="mr-8 grid grid-cols-6 gap-1 -rotate-90 opacity-90">
                                {playersByPos.right.discards.map((tile, i) => (
                                    <Tile key={i} tile={tile} size="sm" is3D={false} rotation={90} />
                                ))}
                            </div>
                            <PlayerAvatar
                                player={playersByPos.right}
                                isCurrentTurn={gameState.currentTurnPlayerId === playersByPos.right.id}
                                className="absolute -top-32 right-0 flex-row-reverse"
                            />
                        </div>
                    )}

                    {/* BOTTOM PLAYER (ME) */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center w-full max-w-4xl">

                        {/* Discards */}
                        <div className="mb-6 grid grid-cols-10 gap-1">
                            {myPlayer.discards.map((tile, i) => (
                                <Tile key={i} tile={tile} size="sm" is3D={false} />
                            ))}
                        </div>

                        {/* Hand */}
                        <div className="flex items-end justify-center gap-[2px] px-8 pb-4">
                            {/* Melds (Left side of hand) */}
                            <div className="flex gap-4 mr-8">
                                {myPlayer.melds.map((meld, mi) => (
                                    <div key={mi} className="flex gap-[1px]">
                                        {meld.map((t, ti) => <Tile key={ti} tile={t} size="lg" isFaceUp={true} />)}
                                    </div>
                                ))}
                            </div>

                            {myPlayer.hand.map((tile, index) => {
                                const isDingQue = myPlayer.dingQue === tile.suit;
                                // Separate the 14th tile if it's the new draw
                                const isNewDraw = index === myPlayer.hand.length - 1 && myPlayer.hand.length % 3 === 2;

                                return (
                                    <div key={tile.id} className={`${isNewDraw ? 'ml-6' : ''}`}>
                                        <Tile
                                            tile={tile}
                                            size="xl"
                                            dimmed={isDingQue}
                                            selected={selectedTileId === tile.id}
                                            onClick={() => {
                                                if (myPlayer.isHu) return;
                                                if (gameState.phase !== 'PLAYING' || gameState.currentTurnPlayerId !== gameState.myPlayerId) return;
                                                if (selectedTileId === tile.id) handleDiscard(tile);
                                                else setSelectedTileId(tile.id);
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Actions HUD */}
                        {gameState.phase === 'PLAYING' && (() => {
                            // If I have already Hu'd, I cannot do anything else
                            if (myPlayer.isHu) return null;

                            // 计算当前可用的操作
                            const isMyTurn = gameState.currentTurnPlayerId === myPlayer.id;
                            const lastDiscard = gameState.lastDiscard;

                            // 检查 lastDiscard 是否是自己打出的牌（在自己的弃牌堆中）
                            const isMyOwnDiscard = lastDiscard && myPlayer.discards.some(t => t.id === lastDiscard.id);
                            const isSkipped = lastDiscard && lastDiscard.id === skippedDiscardId;

                            // 别人打牌时的操作判断 - 确保不是自己打的牌，且没有被跳过
                            // 关键修复：即使轮到自己（系统自动摸牌了），如果上一张弃牌还在（说明是刚刚上家打出的），依然可以碰/杠/胡它（抢在自己出牌前）
                            const isInterruptedTurn = isMyTurn && lastDiscard && !isMyOwnDiscard;
                            const isDingQueTarget = myPlayer.dingQue && lastDiscard && lastDiscard.suit === myPlayer.dingQue;

                            const canDoPeng = (!isMyTurn || isInterruptedTurn) && lastDiscard && !isMyOwnDiscard && !isSkipped && !isDingQueTarget && canPeng(myPlayer.hand, lastDiscard);
                            const canDoMingGang = (!isMyTurn || isInterruptedTurn) && lastDiscard && !isMyOwnDiscard && !isSkipped && !isDingQueTarget && canGang(myPlayer.hand, lastDiscard);

                            // 关键修复：点炮胡检测
                            // 构造临时手牌：现有手牌 + 别人打出的这张牌
                            const canDoDianHu = (!isMyTurn || isInterruptedTurn) && lastDiscard && !isMyOwnDiscard && !isSkipped && (() => {
                                // 如果是 Interrupted Turn (手里有14张)，计算胡牌时应该排除掉刚摸的一张？
                                // 不，canHu 只是检查能否胡。如果手里14张，再加 discard 就是 15 张， logic 会失败。
                                // 所以如果是 Interrupted Turn，说明手里有一张是刚摸的。我们需要假设"没有摸那张牌"的情况。
                                // 简单做法：如果手牌 14 张，去掉最后一张（刚摸的）来检测胡 discard。
                                let baseHand = myPlayer.hand;
                                if (isInterruptedTurn && baseHand.length % 3 === 2) {
                                    // 移除最后一张（刚摸的）
                                    baseHand = baseHand.slice(0, baseHand.length - 1);
                                }
                                const tempHand = [...baseHand, lastDiscard];
                                return canHu(tempHand, myPlayer.dingQue || 'WAN');
                            })();

                            // 自己回合时的操作判断
                            // AN GANG / BU GANG: Cannot gang DingQue tiles
                            const canDoAnGang = isMyTurn && canGang(myPlayer.hand.filter(t => t.suit !== myPlayer.dingQue));
                            const canDoBuGang = isMyTurn && hasBuGang(myPlayer.hand.filter(t => t.suit !== myPlayer.dingQue), myPlayer.melds);
                            const canDoZiMoHu = isMyTurn && canHu(myPlayer.hand, myPlayer.dingQue || 'WAN');

                            // 智能按钮逻辑:
                            // 场景1: 别人打牌 - 只能碰(手牌2张) → 显示碰
                            // 场景2: 别人打牌 - 能碰也能杠(手牌3张) → 显示碰+杠
                            // 场景3: 别人打牌 - 能胡 → 显示胡
                            // 场景4: 自己回合 - 能暗杠/加杠/胡 → 显示对应按钮

                            const showClaimHint = (!isMyTurn || isInterruptedTurn) && lastDiscard && !isMyOwnDiscard && (canDoPeng || canDoMingGang || canDoDianHu);
                            // 能胡或者能碰杠时都显示“过”按钮
                            const showPassButton = (!isMyTurn || isInterruptedTurn) && lastDiscard && !isMyOwnDiscard && lastDiscard.id !== skippedDiscardId && (canDoPeng || canDoMingGang || canDoDianHu);

                            return (
                                <div className="absolute bottom-40 right-10 flex flex-col gap-2 items-center">
                                    {/* Claim Hint - 显示当前可操作的牌 */}
                                    {showClaimHint && (
                                        <div className="bg-black/40 text-white text-sm px-3 py-2 rounded-lg flex items-center gap-2 border border-white/20">
                                            <span className="font-semibold">
                                                {canDoDianHu ? '可胡：' : (canDoMingGang ? '可碰/杠：' : '可碰：')}
                                            </span>
                                            <Tile tile={lastDiscard} size="sm" is3D={false} highlight />
                                        </div>
                                    )}

                                    {/* === 自己回合的操作按钮 === */}

                                    {/* ZI MO HU Button - 自摸胡 (最高优先级) */}
                                    {canDoZiMoHu && (
                                        <button onClick={handleHu} className="bg-red-600 text-white font-black text-2xl w-20 h-20 rounded-full shadow-lg border-4 border-red-800 animate-bounce">
                                            胡
                                        </button>
                                    )}

                                    {/* AN GANG Section - 暗杠 (自己回合，手牌4张相同) */}
                                    {canDoAnGang && (
                                        <>
                                            {/* 暗杠提示 */}
                                            <div className="bg-black/40 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 text-center">
                                                <span>可暗杠 (4张相同)</span>
                                            </div>
                                            {/* 杠按钮 */}
                                            <button onClick={handleGang} className="bg-blue-600 text-white font-black text-xl w-16 h-16 rounded-full shadow-lg border-4 border-blue-800">
                                                杠
                                            </button>
                                            {/* 不杠按钮 - 留牌之后仍可杠 */}
                                            <button
                                                onClick={() => setSelectedTileId(null)}
                                                className="bg-gray-500 text-white font-bold text-sm w-16 h-16 rounded-full shadow-lg border-4 border-gray-700 hover:bg-gray-400"
                                            >
                                                <div className="flex flex-col items-center leading-tight">
                                                    <span className="text-xs">不杠</span>
                                                    <span className="text-10px text-gray-300">留牌</span>
                                                </div>
                                            </button>
                                        </>
                                    )}

                                    {/* BU GANG Section - 加杠 (自己回合，已碰+第四张) */}
                                    {canDoBuGang && (
                                        <>
                                            {/* 加杠提示 */}
                                            <div className="bg-black/40 text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 text-center">
                                                <span>可加杠 (已碰+摸到)</span>
                                            </div>
                                            {/* 加杠按钮 */}
                                            <button onClick={handleGang} className="bg-purple-600 text-white font-black text-lg w-16 h-16 rounded-full shadow-lg border-4 border-purple-800 animate-pulse">
                                                <div className="flex flex-col items-center leading-tight">
                                                    <span className="text-xs">加</span>
                                                    <span className="text-xl -mt-1">杠</span>
                                                </div>
                                            </button>
                                            {/* 不杠按钮 - 留牌之后仍可杠 */}
                                            <button
                                                onClick={() => setSelectedTileId(null)}
                                                className="bg-gray-500 text-white font-bold text-sm w-16 h-16 rounded-full shadow-lg border-4 border-gray-700 hover:bg-gray-400"
                                            >
                                                <div className="flex flex-col items-center leading-tight">
                                                    <span className="text-xs">不杠</span>
                                                    <span className="text-10px text-gray-300">留牌</span>
                                                </div>
                                            </button>
                                        </>
                                    )}

                                    {/* === 别人打牌时的操作按钮 === */}

                                    {/* DIAN HU Button - 点炮胡 */}
                                    {canDoDianHu && (
                                        <button onClick={handleHu} className="bg-red-600 text-white font-black text-2xl w-24 h-24 rounded-full shadow-lg border-4 border-red-800 animate-bounce z-50">
                                            胡
                                        </button>
                                    )}

                                    {/* 智能显示: 能碰也能杠时，显示两个按钮让玩家选择 */}
                                    {canDoMingGang && (
                                        <button onClick={handleGang} className="bg-blue-600 text-white font-black text-xl w-16 h-16 rounded-full shadow-lg border-4 border-blue-800">
                                            杠
                                        </button>
                                    )}

                                    {/* PENG Button - 碰 (无论能否杠，碰按钮都显示) */}
                                    {canDoPeng && (
                                        <button onClick={handlePeng} className="bg-emerald-600 text-white font-black text-xl w-16 h-16 rounded-full shadow-lg border-4 border-emerald-800">
                                            碰
                                        </button>
                                    )}

                                    {/* PASS Button - 过 */}
                                    {showPassButton && (
                                        <button onClick={handleSkip} className="bg-gray-500 text-white font-bold text-lg w-16 h-16 rounded-full shadow-lg border-4 border-gray-700 hover:bg-gray-400">
                                            过
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    <PlayerAvatar
                        player={myPlayer}
                        isCurrentTurn={gameState.currentTurnPlayerId === myPlayer.id}
                        className="absolute bottom-[30px] left-[30px]" // Moved to bottom-left corner of table
                    />
                </div>

                {/* DingQue Overlay */}
                {gameState.phase === 'DINGQUE' && (
                    <DingQuePanel
                        onSelect={handleDingQue}
                        recommended={getRecommendedDingQue(myPlayer.hand)}
                        hand={myPlayer.hand}
                    />
                )}

                {/* Game Over */}
                {gameState.phase === 'GAME_OVER' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 text-white">
                        <h1 className="text-5xl font-bold mb-8 text-yellow-400">本局结束</h1>
                        {gameState.isMultiplayer ? (
                            gameState.roomId === gameState.myPlayerId ? (
                                <button onClick={() => sendAction({ type: 'ACTION_RESTART' })} className="bg-emerald-600 px-6 py-2 rounded">
                                    再来一局
                                </button>
                            ) : (
                                <div className="text-gray-300 text-lg">等待房主开始下一局...</div>
                            )
                        ) : (
                            <div className="flex gap-4">
                                <button onClick={() => sendAction({ type: 'ACTION_RESTART' })} className="bg-emerald-600 px-6 py-2 rounded">
                                    再来一局
                                </button>
                                <button onClick={() => window.location.reload()} className="bg-gray-600 px-6 py-2 rounded">
                                    返回大厅
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return gameState.phase === 'LOBBY' ? renderLobby() : renderGame();
}

export default App;