import type { Game, GameState, GameUpdate } from '../Game';
import * as CONSTANTS from '../draw/DrawingConfig';

import { SquishType } from './PuyoSquishingState';

export class ChainSquishingState implements GameState {
	name = 'ChainSquishing';
	game: Game;

	squishingPuyos: { puyo: Puyo, squishType: SquishType }[];
	currentFrame: number;
	totalFrames: number;

	// Saved info to pass back to ChainResolvingState
	chain: number;
	resolvingChains: Puyo[][];

	constructor(game: Game) {
		this.game = game;
	}

	enter(squishingPuyos: { puyo: Puyo, squishType: SquishType }[], chain: number, resolvingChains: Puyo[][]) {
		this.squishingPuyos = squishingPuyos;

		this.currentFrame = 0;
		this.totalFrames = 0;

		for(const puyo of this.squishingPuyos) {
			const frames = CONSTANTS.SQUISH_FRAMES[puyo.squishType].length;
			if(frames > this.totalFrames) {
				this.totalFrames = frames;
			}
		}
		this.totalFrames += 4;

		this.chain = chain;
		this.resolvingChains = resolvingChains;

		return this;
	}

	step() {
		this.currentFrame++;

		const { audioPlayer, board, gameArea } = this.game;

		// Insert squishing puyos drawing here
		const boardHash = gameArea.squishPuyos(board.getConnections(), this.squishingPuyos, this.currentFrame);
		const update: GameUpdate = { boardHash };

		// Squishing over, determine next state
		if(this.currentFrame >= this.totalFrames) {
			// Add all unstable puyos to the stack
			for(const p of this.squishingPuyos) {
				const { puyo } = p;
				board.boardState[puyo.x][puyo.y] = puyo.colour;
			}

			// Chain finished
			if(this.chain === this.resolvingChains.length) {
				this.game.statTracker.finishChain(this.chain);

				// No pending nuisance, chain completed
				if(this.game.getTotalNuisance() === 0) {
					update.activateNuisance = true;
				}

				// Check for all clear
				if(board.boardState.every(col => col.length === 0)) {
					this.game.allClear = true;
					audioPlayer.playAndEmitSfx('all_clear');
				}

				const { nuisanceAmount, nuisanceArray } = board.dropNuisance(this.game.activeNuisance);

				if(nuisanceAmount !== 0) {
					this.game.gameState = this.game.states.NuisanceDroppingState.enter(nuisanceAmount, nuisanceArray);
				}
				else {
					this.game.gameState = this.game.states.QueueShiftingState.enter();
				}
			}
			// Chain continuing
			else {
				this.game.gameState = this.game.states.ChainResolvingState.enter(this.resolvingChains, this.chain + 1);
			}
		}

		return update;
	}
}
