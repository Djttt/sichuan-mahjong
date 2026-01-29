import { describe, it, expect } from 'vitest';
import { handleDiscardLogic, handlePassLogic } from '../services/gameStateReducer';
import { GameState, Player, TileData } from '../types';

// Mock helper
const createTile = (id: string, suit: any, rank: number): TileData => ({ id, suit, rank });

describe('Turn Logic - Discard & Claim Flow', () => {
    // Setup initial state
    const playerA: Player = {
        id: 'A', name: 'A', position: 'bottom', hand: [], discards: [], melds: [], score: 0, dingQue: 'TONG', isHu: false, avatar: '1', gangScore: 0
    };
    const playerB: Player = {
        id: 'B', name: 'B', position: 'right', hand: [], discards: [], melds: [], score: 0, dingQue: 'TONG', isHu: false, avatar: '2', gangScore: 0
    };

    // Initial State Template
    const initialState: GameState = {
        roomId: 'test',
        isMultiplayer: false,
        phase: 'PLAYING',
        currentTurnPlayerId: 'A',
        remainingTiles: 10,
        deck: [createTile('d1', 'TIAO', 1), createTile('d2', 'TIAO', 2)],
        players: [playerA, playerB],
        lastDiscard: null,
        myPlayerId: 'A'
    };

    it('should auto-draw for next player if no one can claim', () => {
        // Player A discards Wan 1. Player B has Wan 2, Wan 3 (cannot Peng).
        const tileToDiscard = createTile('t1', 'WAN', 1);
        const pA = { ...playerA, hand: [tileToDiscard, createTile('t2', 'WAN', 9)] };
        // B has un-matching tiles
        const pB = { ...playerB, hand: [createTile('t3', 'WAN', 2), createTile('t4', 'WAN', 3)] };

        const state = { ...initialState, players: [pA, pB], currentTurnPlayerId: 'A', deck: [createTile('new', 'TIAO', 5)] };

        const newState = handleDiscardLogic(state, { type: 'ACTION_DISCARD', playerId: 'A', tileId: 't1' });

        // Expectation:
        // 1. lastDiscard is null (cleared immediately)
        // 2. Player B hand size increased by 1 (drew card)
        // 3. Current turn is B

        expect(newState.lastDiscard).toBeNull();
        expect(newState.currentTurnPlayerId).toBe('B');
        expect(newState.players[1].hand.length).toBe(3); // 2 + 1 drawn
        // Verify the drawn tile is actually added
        expect(newState.players[1].hand[2].id).toBe('new');
    });

    it('should NOT draw if next player can Peng', () => {
        // Player A discards Wan 1. Player B has Wan 1, Wan 1 (Can Peng).
        const tileToDiscard = createTile('t1', 'WAN', 1);
        const pA = { ...playerA, hand: [tileToDiscard] };
        // B has matching tiles (Pair of Wan 1)
        const pB = { ...playerB, hand: [createTile('t2', 'WAN', 1), createTile('t3', 'WAN', 1)] };

        const state = { ...initialState, players: [pA, pB], currentTurnPlayerId: 'A', deck: [createTile('new', 'TIAO', 5)] };

        const newState = handleDiscardLogic(state, { type: 'ACTION_DISCARD', playerId: 'A', tileId: 't1' });

        // Expectation:
        // 1. lastDiscard is NOT null (waiting for claim)
        // 2. Player B hand size is SAME (no draw yet)
        // 3. Current turn is B (but implicitly waiting because lastDiscard exists)

        expect(newState.lastDiscard).not.toBeNull();
        expect(newState.lastDiscard?.id).toBe('t1');
        expect(newState.players[1].hand.length).toBe(2); // No draw, still 2
        expect(newState.currentTurnPlayerId).toBe('B');
    });

    it('should draw after PASS if claim was possible', () => {
        // Continuation of previous case.
        // State where lastDiscard exists and B can Peng.
        const tileDiscarded = createTile('t1', 'WAN', 1);
        const pA = { ...playerA, discards: [tileDiscarded] };
        const pB = { ...playerB, hand: [createTile('t2', 'WAN', 1), createTile('t3', 'WAN', 1)] };

        const state: GameState = {
            ...initialState,
            players: [pA, pB],
            currentTurnPlayerId: 'B',
            lastDiscard: tileDiscarded,
            remainingTiles: 1,
            deck: [createTile('new', 'TIAO', 5)]
        };

        // Action: B passes
        // B needs to specify playerId: 'B'
        const newState = handlePassLogic(state, { type: 'ACTION_PASS', playerId: 'B' });

        // Expectation:
        // 1. lastDiscard cleared
        // 2. B draws a tile

        expect(newState.lastDiscard).toBeNull();
        expect(newState.players[1].hand.length).toBe(3); // Drawn
        expect(newState.players[1].hand[2].id).toBe('new');
    });
});
