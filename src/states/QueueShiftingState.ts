import { Drop, DropGenerator } from '../Drop';
import type { Game, GameState } from '../Game';

export class QueueShiftingState implements GameState {
	name = 'QueueShifting';
	game: Game;

	dropGenerator: DropGenerator;
	dropQueue: Drop[];
	dropArray: Drop[] = [];
	currentFrame: number;

	constructor(game: Game) {
		this.game = game;

		this.dropGenerator = new DropGenerator(this.game.settings);
		this.dropQueue = this.dropGenerator.requestDrops().map(drop => drop.copy());
	}

	enter() {
		this.currentFrame = 0;

		// Almost out of drops, add new drops to the queue
		if(this.dropQueue.length <= 5) {
			this.dropQueue = this.dropQueue.concat(this.dropGenerator.requestDrops());
		}
		this.game.currentDrop = this.dropQueue.shift();
		this.game.dropNum++;

		return this;
	}

	step() {
		this.currentFrame++;

		const { gameArea, settings } = this.game;
		const boardHash = gameArea.updateQueue(this.dropQueue.slice(0, 2), this.currentFrame);

		if(this.currentFrame === settings.queueShiftFrames) {
			this.game.gameState = this.game.states.PuyoDroppingState.enter();
		}

		return { boardHash };
	}
}
