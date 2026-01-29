import { describe, it, expect } from 'vitest';
import { handleGangLogic } from '../services/gangLogicReducer';
import { GameState, Player, TileData } from '../types';

const createTile = (id: string, suit: any, rank: number): TileData => ({ id, suit, rank });

describe('Gang Logic Test', () => {
    // Setup initial state
    const playerA: Player = {
        id: 'A', name: 'A', position: 'bottom', hand: [], discards: [], melds: [], score: 0, dingQue: 'TONG', isHu: false, avatar: '1', gangScore: 0
    };
    const playerB: Player = {
        id: 'B', name: 'B', position: 'right', hand: [], discards: [], melds: [], score: 0, dingQue: 'TONG', isHu: false, avatar: '2', gangScore: 0
    };

    // Scenario: Dian Gang (Ming Gang)
    // Player A discards Wan 1. Player B has 3 Wan 1s.
    it('should handle DIAN GANG properly', () => {
        const discard = createTile('d1', 'WAN', 1);
        const pB = { ...playerB, hand: [createTile('b1', 'WAN', 1), createTile('b2', 'WAN', 1), createTile('b3', 'WAN', 1)] };

        const state: GameState = {
            roomId: 'test', isMultiplayer: false, phase: 'PLAYING',
            currentTurnPlayerId: 'A', // A's turn (or A just played)
            remainingTiles: 10,
            deck: [createTile('new', 'TIAO', 5)],
            players: [playerA, pB],
            lastDiscard: discard,
            myPlayerId: 'A',
            lastAction: null
        };

        // Action: B Gangs on Discard
        const newState = handleGangLogic(state, { type: 'ACTION_GANG', playerId: 'B' });

        // Assert:
        // 1. B melds has 1 group of 4
        // 2. B hand size: 0 (3 used + 1 discard) + 1 replacement = 1 tile left
        // 3. Last discard is NULL (consumed)
        // 4. Replacement tile drawn

        expect(newState.players[1].melds.length).toBe(1);
        expect(newState.players[1].melds[0].length).toBe(4);
        expect(newState.lastDiscard).toBeNull();
        expect(newState.players[1].hand.length).toBe(1);
        expect(newState.players[1].hand[0].id).toBe('new');
    });

    // Scenario: Interrupted Turn Revert
    // If we are in "Wait" state, A just discarded. Next player (B) might have auto-drawn (in old logic) or not.
    // Our new logic prevents auto-draw if claim possible.
    // But let's say the turn pointer was technically on B (but B hasn't acted). 

    it('should NOT consume deck if Gang is invalid (Regression Test for Infinite Draw)', () => {
        const discard = createTile('d1', 'WAN', 1);
        // B only has 2 Wan 1s (Not enough for Dian Gang)
        const pB = { ...playerB, hand: [createTile('b1', 'WAN', 1), createTile('b2', 'WAN', 1)] };

        const initialDeck = [createTile('new', 'TIAO', 5), createTile('new2', 'TIAO', 6)];
        const state: GameState = {
            roomId: 'test', isMultiplayer: false, phase: 'PLAYING',
            currentTurnPlayerId: 'A',
            remainingTiles: 10,
            deck: [...initialDeck],
            players: [playerA, pB],
            lastDiscard: discard,
            myPlayerId: 'A',
            lastAction: null
        };

        // Action: B tries to Gang (Invalid)
        const newState = handleGangLogic(state, { type: 'ACTION_GANG', playerId: 'B' });

        // Assert:
        // 1. Deck should be UNCHANGED (Same length)
        // 2. Hand unchanged
        // 3. Last Discard still exists
        expect(newState.deck.length).toBe(initialDeck.length);
        expect(newState.remainingTiles).toBe(10);
        expect(newState.lastDiscard).not.toBeNull();
    });
});
