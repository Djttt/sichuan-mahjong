import { GameState, NetworkAction, Player } from '../types';
import { canHu, canPeng, canGang } from './gameLogic';
import { sortHand } from '../constants';

export function handleDiscardLogic(prev: GameState, action: { type: 'ACTION_DISCARD'; playerId: string; tileId: string }): GameState {
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
    let nextLastDiscard: typeof tileToRemove | null = tileToRemove; // Default: keep discard

    // Check Claims FIRST
    const discarderId = action.playerId;
    const anyClaims = newPlayers.some(p => {
        if (p.id === discarderId) return false;
        if (p.isHu) return false; // Hu'd players cannot claim
        // If already skipped, ignore
        if (p.skippedDiscardId === tileToRemove.id) return false;

        // Check actions using current hand (13 tiles max, next player hasn't drawn yet)
        const canH = canHu([...p.hand, tileToRemove], p.dingQue || 'WAN');
        const canP = canPeng(p.hand, tileToRemove);
        const canG = canGang(p.hand, tileToRemove);

        return canH || canP || canG;
    });

    if (!anyClaims) {
        // No claims: Clear discard and Auto-Draw for next player
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
        lastDiscard: nextLastDiscard, // This might be null or tile
        currentTurnPlayerId: nextPlayerId,
        remainingTiles: currentDeck.length,
        phase: endingPhase
    };

    if (newState.remainingTiles === 0) newState.phase = 'GAME_OVER';

    return newState;
}

export function handlePassLogic(prev: GameState, action: { type: 'ACTION_PASS'; playerId: string }): GameState {
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
            // Note: Use ! to simulate "if I took it"
            return canHu([...p.hand, lastDiscard!], p.dingQue || 'WAN') ||
                canPeng(p.hand, lastDiscard!) ||
                canGang(p.hand, lastDiscard!);
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
        }
    }

    const newState: GameState = {
        ...prev,
        players: updatedPlayers,
        lastDiscard,
        deck: currentDeck,
        remainingTiles: currentDeck.length,
        phase: endingPhase
    };

    if (newState.remainingTiles === 0) newState.phase = 'GAME_OVER';

    return newState;
}
