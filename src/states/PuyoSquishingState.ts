import type { Game, GameState } from '../Game';
import * as Utils from '../utils/Utils';
import * as CONSTANTS from '../draw/DrawingConfig';

export type SquishType = 'SPLIT' | 'VERTICAL' | 'VERTICAL_2';

export class PuyoSquishingState implements GameState {
	name = 'PuyoSquishing';
	game: Game;

	squishingPuyos: { puyo: Puyo, squishType: SquishType }[];
	currentFrame: number;
	totalFrames: number;

	constructor(game: Game) {
		this.game = game;
	}

	enter() {
		const { currentDrop } = this.game;
		const arle = Object.assign({ colour: currentDrop.colours[0] }, currentDrop.arle);
		const schezo = Object.assign({}, { colour: currentDrop.colours[1] }, currentDrop.schezo || Utils.getOtherPuyo(currentDrop));

		const squishType = arle.x !== schezo.x ? 'SPLIT' : (arle.y > schezo.y ? 'VERTICAL' : 'VERTICAL_2');

		this.squishingPuyos = [{ puyo: arle, squishType }, { puyo: schezo, squishType }];

		this.currentFrame = 0;
		this.totalFrames = 0;

		for(const puyo of this.squishingPuyos) {
			const frames = CONSTANTS.SQUISH_FRAMES[puyo.squishType].length;
			if(frames > this.totalFrames) {
				this.totalFrames = frames;
			}
		}
		this.totalFrames += 4;

		return this;
	}

	step() {
		this.currentFrame++;
		const { board, gameArea } = this.game;

		// Insert squishing puyos drawing here
		const boardHash = gameArea.squishPuyos(board.getConnections(), this.squishingPuyos, this.currentFrame);

		// Squishing over, determine next state
		if(this.currentFrame >= this.totalFrames) {
			this.lockDrop();
		}

		return { boardHash };
	}

	/**
	 * Locks the drop and adds the puyos to the stack.
	 */
	lockDrop() {
		const { board, currentDrop, currentMovements, dropNum, statTracker } = this.game;
		const { boardState } = board;

		const { arle, colours } = currentDrop;
		const schezo = currentDrop.schezo || Utils.getOtherPuyo(currentDrop);

		// Force round the schezo before it is put on the stack
		schezo.x = Math.round(schezo.x);

		if(arle.x === currentDrop.schezo.x) {		// vertical orientation
			if(arle.y < schezo.y) {
				boardState[schezo.x].push(colours[0]);
				boardState[schezo.x].push(colours[1]);
			}
			else {
				boardState[schezo.x].push(colours[1]);
				boardState[schezo.x].push(colours[0]);
			}

			statTracker.addDrop(dropNum, this.currentFrame, currentMovements, schezo.x, schezo.x);
		}
		else {			// horizontal orientation
			boardState[arle.x].push(colours[0]);
			boardState[schezo.x].push(colours[1]);

			statTracker.addDrop(
				dropNum,
				this.currentFrame,
				currentMovements,
				arle.x,
				schezo.x,
				boardState[arle.x].length !== boardState[schezo.x].length
			);
		}

		// Remove any puyos that are too high
		board.trim();

		const resolvingChains = board.resolveChains();
		// Chain was created
		if(resolvingChains.length !== 0) {
			this.game.gameState = this.game.states.ChainResolvingState.enter(resolvingChains);
		}
		// No chain was created
		else {
			// Determine if/how nuisance should fall
			const { nuisanceAmount, nuisanceArray } = board.dropNuisance(this.game.activeNuisance);

			if(nuisanceAmount !== 0) {
				this.game.gameState = this.game.states.NuisanceDroppingState.enter(nuisanceAmount, nuisanceArray);
			}
			else {
				this.game.gameState = this.game.states.QueueShiftingState.enter();
			}
		}

		currentDrop.schezo = null;
		currentDrop.shape = null;
		this.game.currentMovements = [];

		this.game.dropLocked();
	}
}
