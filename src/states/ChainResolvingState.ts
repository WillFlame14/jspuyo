import { Board } from '../Board';
import type { Game, GameState, GameUpdate } from '../Game';
import * as Utils from '../utils/Utils';

import type { SquishType } from './PuyoSquishingState';

export class ChainResolvingState implements GameState {
	name = 'ChainResolving';
	game: Game;

	/** Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...] */
	resolvingChains: Puyo[][];

	connections: Puyo[][];
	connectionsAfterPop: Puyo[][];
	puyoLocs: Puyo[];
	nuisanceLocs: Puyo[];
	poppedLocs: Puyo[];
	unstablePuyos: Puyo[];
	dropFrames: number;

	currentFrame: number;
	totalFrames: number;
	chain: number;

	constructor(game: Game) {
		this.game = game;
	}

	enter(resolvingChains: Puyo[][], chain = 1) {
		const { board, settings } = this.game;
		this.resolvingChains = resolvingChains;
		this.chain = chain;
		this.currentFrame = 0;

		this.puyoLocs = this.resolvingChains[this.chain - 1];
		this.nuisanceLocs = board.findNuisancePopped(this.puyoLocs);
		this.poppedLocs = this.puyoLocs.concat(this.nuisanceLocs);

		// Find the lowest height of a puyo that is popping in each column (will be undefined if no puyos are popped in that column)
		const lowestUnstablePos: Record<number, number> = {};
		this.poppedLocs.forEach(puyo => {
			if(lowestUnstablePos[puyo.x] === undefined || lowestUnstablePos[puyo.x] > puyo.y) {
				lowestUnstablePos[puyo.x] = puyo.y;
			}
		});

		this.unstablePuyos = [];
		/** The board, minus all popping/unstable puyos. */
		const stableBoardAfterPop = new Board(settings, board.boardState);
		stableBoardAfterPop.boardState.forEach((column, colIndex) => {
			// No puyos popped in this column
			if(lowestUnstablePos[colIndex] === undefined) {
				return;
			}
			// Remove all popping/unstable puyos
			const removed_puyo_colours = column.splice(lowestUnstablePos[colIndex]);
			let nonPoppedPuyos = 0;		// The number of non-popped but unstable puyos in this column so far
			removed_puyo_colours.forEach((colour, index) => {
				const row = index + lowestUnstablePos[colIndex];
				// Find all unstable puyos that are not popped (i.e. a puyo was popped below it)
				if(!this.poppedLocs.some(puyo => puyo.x === colIndex && puyo.y === row)) {
					this.unstablePuyos.push({ x: colIndex, y: row, colour, above: lowestUnstablePos[colIndex] + nonPoppedPuyos });
					nonPoppedPuyos++;
				}
			});
		});

		this.connections = board.getConnections();
		this.connectionsAfterPop = stableBoardAfterPop.getConnections();

		// This state includes both popping and dropping the chained puyos.
		this.totalFrames = settings.popFrames + Utils.getDropFrames(this.poppedLocs, board.boardState, settings);

		return this;
	}

	step() {
		this.currentFrame++;
		const { audioPlayer, board, gameArea, settings, userSettings } = this.game;

		const boardHash = gameArea.resolveChains(this.connections, this.poppedLocs, this.connectionsAfterPop, this.unstablePuyos, this.currentFrame);
		const update: GameUpdate = { boardHash };

		// Once done popping, play SFX
		if(this.currentFrame === settings.popFrames) {
			// Play sfx
			if(this.chain === this.resolvingChains.length && this.chain > 2) {
				audioPlayer.playAndEmitVoice(userSettings.voice, 'spell', Math.min(this.chain - 2, 5));
			}
			else {
				audioPlayer.playAndEmitVoice(userSettings.voice, 'chain', this.chain);
			}
			audioPlayer.playAndEmitSfx('chain', Math.min(this.chain, 7));

			if(this.chain > 1) {
				audioPlayer.playAndEmitSfx('nuisance_send', Math.min(this.chain, 5));
			}
		}

		// Check if the chain is done resolving
		if(this.currentFrame === this.totalFrames) {
			// Update the score displayed
			const scoreType = this.chain < settings.minChain ? 'cosmetic' : 'chain';
			update.nuisanceSent = this.game.updateScore(Utils.calculateScore(this.puyoLocs, this.chain), scoreType);

			// Remove all popped and unstable puyos
			board.deletePuyos(this.poppedLocs.concat(this.unstablePuyos));

			// Squish puyos into the stack
			const squishingPuyos = this.unstablePuyos.map(puyo => {
				// Move all unstable puyos to their final position
				puyo.y = puyo.above;
				return { puyo, squishType: 'VERTICAL' as SquishType };
			});

			this.game.gameState = this.game.states.ChainSquishingState.enter(squishingPuyos, this.chain, this.resolvingChains);
		}

		return update;
	}
}
