'use strict';

window.CpuGame = class CpuGame extends window.Game {
	constructor(gamemode, gameId, opponentIds, socket, boardDrawerId, ai, settings) {
		super(gamemode, gameId, opponentIds, socket, boardDrawerId, settings);

		this.ai = ai;
		this.ai.assignSettings(this.settings);
		this.currentMove = null;
	}

	/**
	 * @Override
	 * Apply an input for the CPU.
	 */
	getInputs() {
		if(this.currentMove === null) {
			this.currentMove = this.ai.getMove(this.board.boardState);
		}

		let applied = false;
		const { col, rotations } = this.currentMove;
		if(this.currentDrop.arle.x < col) {
			this.move('Right');
			applied = true;
		}
		else if(this.currentDrop.arle.x > col) {
			this.move('Left');
			applied = true;
		}

		if(this.currentDrop.rotating === 'not') {
			if(this.rotations < rotations) {
				this.rotate('CW');
				applied = true;
			}
			else if(this.rotations > rotations) {
				this.rotate('CCW');
				applied = true;
			}
		}

		if(!applied) {
			this.move('Down');
		}
	}

	/**
	 * After locking a drop, also reset the currentMove.
	 */
	lockDrop() {
		super.lockDrop();
		this.currentMove = null;
	}
}