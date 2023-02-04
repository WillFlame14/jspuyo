import type { Game, GameState } from '../Game';
import * as Utils from '../utils/Utils';

export class PuyoDroppingState implements GameState {
	name = 'PuyoDropping';
	game: Game;

	/** Frames spent being locked for the current drop */
	currentDropLockFrames: number;

	constructor(game: Game) {
		this.game = game;
	}

	enter() {
		this.currentDropLockFrames = 0;
		return this;
	}

	step() {
		const { currentDrop, gameArea, settings } = this.game;
		this.game.getInputs();

		if(this.game.checkLock()) {
			// Lock puyo in place if frames are up or lock is forced
			if(this.currentDropLockFrames > settings.lockDelayFrames || this.game.forceLock) {
				currentDrop.finishRotation();
				currentDrop.schezo = Utils.getOtherPuyo(currentDrop);

				// Vertical orientation
				if(currentDrop.arle.x === currentDrop.schezo.x) {
					this.game.gameState = this.game.states.PuyoSquishingState.enter();
				}
				// Horizontal orientation
				else {
					this.game.gameState = this.game.states.PuyoDroppingSplitState.enter();
				}
				this.game.forceLock = false;
			}
			else {
				// Start lock delay
				this.currentDropLockFrames++;
				currentDrop.affectRotation();
			}
		}
		// Not locking
		else {
			currentDrop.affectGravity();
			currentDrop.affectRotation();
		}

		const currentBoardState = { connections: this.game.board.getConnections(), currentDrop };
		const boardHash = gameArea.updateBoard(currentBoardState);

		const scoreIncrease = Math.floor(this.game.softDrops / 5);
		this.game.updateScore(scoreIncrease, 'softDrop');
		this.game.softDrops %= 5;

		return { boardHash };
	}
}
