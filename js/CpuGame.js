'use strict';

window.CpuGame = class CpuGame extends window.Game {
	constructor(gamemode, gameId, opponentIds, socket, boardDrawerId, dropGenerator, ai, settings) {
		super(gamemode, gameId, opponentIds, socket, boardDrawerId, dropGenerator, settings);

		this.ai = ai;					// The algorithm used to determine the optimal move
		this.ai.assignSettings(this.settings);
		this.currentMove = null;		// The current optimal move
		this.rotations = 0;				// Rotations performed on the current drop (between -2 and 2)
		this.lastArle = null;			// The location of the arle in the last frame (used to detect whether a drop is stuck)
		console.log('bye');
	}

	/**
	 * @Override
	 * Apply an input for the CPU. Used to get the current drop to the optimal move position.
	 */
	getInputs() {
		if(this.currentMove === null) {
			this.currentMove = this.ai.getMove(this.board.boardState, this.currentDrop);
		}

		let applied = false;
		const { col, rotations } = this.currentMove;

		// Move drop to correct column
		if(this.currentDrop.arle.x < col) {
			this.move('Right');
			applied = true;
		}
		else if(this.currentDrop.arle.x > col) {
			this.move('Left');
			applied = true;
		}

		// Perform correct amount of rotations
		if(this.currentDrop.rotating === 'not') {
			if(this.rotations < rotations) {
				this.rotate('CW');
				this.rotations++;
				applied = true;
			}
			else if(this.rotations > rotations) {
				this.rotate('CCW');
				this.rotations--;
				applied = true;
			}
		}

		// If no action needs to be taken or the drop is stuck, soft drop
		if(!applied || (this.lastArle !== null && JSON.stringify(this.currentDrop.arle) === JSON.stringify(this.lastArle))) {
			//this.move('Down');
		}

		this.lastArle = Object.assign(this.currentDrop.arle);
	}

	/**
	 * After locking a drop, also reset the currentMove.
	 */
	lockDrop() {
		super.lockDrop();
		this.currentMove = null;
		this.rotations = 0;
	}
}
