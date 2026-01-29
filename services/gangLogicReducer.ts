import { GameState, Player, TileData } from '../types';
import { canGang, hasBuGang } from './gameLogic';

export function handleGangLogic(prev: GameState, action: { type: 'ACTION_GANG', playerId: string, isWanGang?: boolean, targetTileId?: string }): GameState {
    const actor = prev.players.find(p => p.id === action.playerId);
    if (!actor) return prev;

    let newPlayers = [...prev.players];
    let targetTile = prev.lastDiscard;
    let currentDeck = [...prev.deck];

    // SCORING: "Gua Feng Xia Yu"
    const BASE_SCORE = 10;
    let type: 'DIAN' | 'BU' | 'AN' | null = null;
    let scoreDelta = 0; // Per person
    let targets: Player[] = [];
    let replacementTile: TileData | null = null;
    let isGangExecuted = false;

    // DETECT GANG TYPE
    // Priority: Dian Gang (Msg from discard) > Bu/An Gang (Self).
    // Usually checking canGang(hand, lastDiscard) determines Dian Gang.
    const isDianGang = !!targetTile && canGang(actor.hand, targetTile);

    if (isDianGang && targetTile) {
        // DIAN GANG EXECUTION
        if (currentDeck.length === 0) return { ...prev, phase: 'GAME_OVER' };
        replacementTile = currentDeck.pop()!;
        isGangExecuted = true;

        type = 'DIAN';
        scoreDelta = 1 * BASE_SCORE;

        // 1. Revert Interrupted Draw
        const interruptedPlayerId = prev.currentTurnPlayerId;
        newPlayers = newPlayers.map(p => {
            if (p.id === interruptedPlayerId && p.hand.length % 3 === 2) {
                const poppedHand = [...p.hand];
                poppedHand.pop();
                return { ...p, hand: poppedHand };
            }
            return p;
        });

        // 2. Remove Discard
        newPlayers = newPlayers.map(p => ({
            ...p,
            discards: p.discards.filter(t => t.id !== targetTile!.id)
        }));

        // Scoring Target: Original Discarder
        const originalDiscarder = prev.players.find(p => p.discards.some(t => t.id === prev.lastDiscard?.id));
        if (originalDiscarder) {
            targets = [originalDiscarder];
        }

        // 3. Move 3 from hand + 1 discard + replacement
        newPlayers = newPlayers.map(p => {
            if (p.id === actor.id) {
                const handMatches = p.hand.filter(t => t.suit === targetTile!.suit && t.rank === targetTile!.rank);
                const keptHand = p.hand.filter(t => t.suit !== targetTile!.suit || t.rank !== targetTile!.rank);
                // Meld 4
                const meld = [...handMatches.slice(0, 3), targetTile!];
                return {
                    ...p,
                    hand: [...keptHand, replacementTile!], // Add replacement
                    melds: [...p.melds, meld]
                };
            }
            return p;
        });

        targetTile = null; // Consumed

    } else {
        // AN GANG / BU GANG EXECUTION
        // Check local potential
        const buGangCandidate = actor.hand.find(h => actor.melds.some(m => m[0].suit === h.suit && m[0].rank === h.rank && m.length === 3));

        const counts: Record<string, number> = {};
        actor.hand.forEach(t => counts[`${t.suit}-${t.rank}`] = (counts[`${t.suit}-${t.rank}`] || 0) + 1);
        const gangKey = Object.keys(counts).find(k => counts[k] === 4);

        if (buGangCandidate || gangKey) {
            if (currentDeck.length === 0) return { ...prev, phase: 'GAME_OVER' };
            replacementTile = currentDeck.pop()!;
            isGangExecuted = true;

            if (buGangCandidate) {
                type = 'BU';
                scoreDelta = 1 * BASE_SCORE;
                targets = prev.players.filter(p => p.id !== actor.id && !p.isHu);

                newPlayers = newPlayers.map(p => {
                    if (p.id === actor.id) {
                        const newHand = p.hand.filter(t => t.id !== buGangCandidate.id);
                        const newMelds = p.melds.map(m => {
                            if (m[0].suit === buGangCandidate.suit && m[0].rank === buGangCandidate.rank) {
                                return [...m, buGangCandidate];
                            }
                            return m;
                        });
                        return { ...p, hand: [...newHand, replacementTile!], melds: newMelds };
                    }
                    return p;
                });
            } else if (gangKey) {
                type = 'AN';
                scoreDelta = 2 * BASE_SCORE;
                targets = prev.players.filter(p => p.id !== actor.id && !p.isHu);

                newPlayers = newPlayers.map(p => {
                    if (p.id === actor.id) {
                        const [s, r] = gangKey!.split('-');
                        const gangTiles = p.hand.filter(t => t.suit === s && t.rank === parseInt(r));
                        const newHand = p.hand.filter(t => t.suit !== s || t.rank !== parseInt(r));
                        return { ...p, hand: [...newHand, replacementTile!], melds: [...p.melds, gangTiles] };
                    }
                    return p;
                });
            }
        }
    }

    if (!isGangExecuted) {
        // Invalid Gang Action (Clicking button when no valid Gang available)
        // Prevent deck drain
        return prev;
    }

    // APPLY SCORES
    if (type && targets.length > 0) {
        const totalGain = scoreDelta * targets.length;

        newPlayers = newPlayers.map(p => {
            if (p.id === actor.id) {
                return {
                    ...p,
                    score: p.score + totalGain,
                    gangScore: (p.gangScore || 0) + totalGain
                };
            }
            if (targets.some(t => t.id === p.id)) {
                return {
                    ...p,
                    score: p.score - scoreDelta,
                    gangScore: (p.gangScore || 0) - scoreDelta
                };
            }
            return p;
        });
    }

    const newState: GameState = {
        ...prev,
        players: newPlayers,
        lastDiscard: targetTile,
        currentTurnPlayerId: actor.id,
        deck: currentDeck,
        remainingTiles: currentDeck.length
    };

    if (newState.remainingTiles === 0) newState.phase = 'GAME_OVER';

    return newState;
}
