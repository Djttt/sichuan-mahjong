import { GameState, Player, TileData } from '../types';
import { canGang, hasBuGang } from './gameLogic';

export function handleGangLogic(prev: GameState, action: { type: 'ACTION_GANG', playerId: string, isWanGang?: boolean, targetTileId?: string }): GameState {
    const actor = prev.players.find(p => p.id === action.playerId);
    if (!actor) return prev;

    // Gang requires drawing a replacement tile
    let currentDeck = [...prev.deck];
    if (currentDeck.length === 0) {
        return { ...prev, phase: 'GAME_OVER' };
    }
    const replacementTile = currentDeck.pop()!;

    let newPlayers = [...prev.players];
    let targetTile = prev.lastDiscard;

    // Detect Gang Type

    // Explicit logic for Ming Gang vs An Gang/Bu Gang:
    // If it is NOT my turn, it MUST be a Ming Gang (Dian Gang) from discard.
    // If it IS my turn, it is An Gang or Bu Gang.
    const isMyTurn = action.playerId === prev.currentTurnPlayerId;
    const isDianGang = !isMyTurn && !!prev.lastDiscard; // If not my turn and lastDiscard exists, it's Dian Gang.

    if (isDianGang && targetTile) {
        // DIAN GANG: Claim discard

        // 1. Revert Interrupted Draw (if any next player had auto-drawn, though our new logic prevents this, safety check)
        const interruptedPlayerId = prev.currentTurnPlayerId;
        newPlayers = newPlayers.map(p => {
            // If the turn player has 14 tiles (modulo 3 === 2), they drew. Revert.
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

        // 3. Move 3 from hand + 1 discard
        newPlayers = newPlayers.map(p => {
            if (p.id === actor.id) {
                const handMatches = p.hand.filter(t => t.suit === targetTile!.suit && t.rank === targetTile!.rank);
                const keptHand = p.hand.filter(t => t.suit !== targetTile!.suit || t.rank !== targetTile!.rank);
                // Meld 4
                const meld = [...handMatches.slice(0, 3), targetTile!];
                return {
                    ...p,
                    hand: [...keptHand, replacementTile], // Add replacement
                    melds: [...p.melds, meld]
                };
            }
            return p;
        });

        targetTile = null; // Consumed

    } else {
        // AN GANG (Dark) or BU GANG (Add)
        // Check Bu Gang first (User logic or auto-detect)

        // Logic: Try to find a Bu Gang candidate using helper
        const buGangCandidate = actor.hand.find(h => actor.melds.some(m => m[0].suit === h.suit && m[0].rank === h.rank && m.length === 3));

        // Or try An Gang
        // Find 4 matches
        const counts: Record<string, number> = {};
        actor.hand.forEach(t => counts[`${t.suit}-${t.rank}`] = (counts[`${t.suit}-${t.rank}`] || 0) + 1);
        const gangKey = Object.keys(counts).find(k => counts[k] === 4);

        newPlayers = newPlayers.map(p => {
            if (p.id === actor.id) {
                if (buGangCandidate) {
                    // Execute Bu Gang
                    const newHand = p.hand.filter(t => t.id !== buGangCandidate.id);
                    const newMelds = p.melds.map(m => {
                        if (m[0].suit === buGangCandidate.suit && m[0].rank === buGangCandidate.rank) {
                            return [...m, buGangCandidate];
                        }
                        return m;
                    });
                    return { ...p, hand: [...newHand, replacementTile], melds: newMelds };
                }

                if (gangKey) {
                    // Execute An Gang
                    const [s, r] = gangKey.split('-');
                    const gangTiles = p.hand.filter(t => t.suit === s && t.rank === parseInt(r));
                    const newHand = p.hand.filter(t => t.suit !== s || t.rank !== parseInt(r));
                    return { ...p, hand: [...newHand, replacementTile], melds: [...p.melds, gangTiles] };
                }
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

    // Check if new replacement tile allows for another action? 
    // Usually Gang continues turn.

    if (newState.remainingTiles === 0) newState.phase = 'GAME_OVER';

    return newState;
}
