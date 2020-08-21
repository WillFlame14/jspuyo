'use strict';

const { Game } = require('./Game.js');
const { AudioPlayer, UserSettings } = require('./Utils.js');

const defaultUserSettings = new UserSettings();

class CpuGame extends Game {
	constructor(gameId, opponentIds, socket, ai, speed, settings) {
		super(gameId, opponentIds, socket, settings, defaultUserSettings, null, null);

		this.ai = ai;							// The algorithm used to determine the optimal move
		this.softDropSpeed = speed;				// Number of milliseconds to wait before soft dropping
		this.movementSpeed = speed / 8;			// Number of milliseconds to wait before performing a move
		this.currentMove = null;				// The current optimal move
		this.rotations = 0;						// Rotations performed on the current drop (between -2 and 2)
		this.lastArle = null;					// The location of the arle in the last frame (used to detect whether a drop is stuck)

		this.softDropTimer = Date.now();		// Timer to measure milliseconds before soft drop
		this.movementTimer = Date.now();		// Timer to measure milliseconds before movement

		// Disable certain classes
		this.audioPlayer = new AudioPlayer(socket, 'disable');
		this.audioPlayer.configure(gameId, this.userSettings.sfxVolume, this.userSettings.musicVolume);
	}

	/**
	 * @Override
	 * Apply an input for the CPU. Used to get the current drop to the optimal move position.
	 */
	getInputs() {
		if(this.currentMove === null) {
			this.currentMove = this.ai.getMove(this.board.boardState, this.currentDrop);
		}

		// Do not move/rotate if movement timer is not fulfilled
		if(Date.now() - this.movementTimer < this.movementSpeed + 250 - Math.random() * 500) {
			return;
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

		// If action was taken, reset the movement timer
		if(applied) {
			this.movementTimer = Date.now();
		}

		// If no action needs to be taken or the drop is stuck, soft drop
		if(!applied || (this.lastArle !== null && JSON.stringify(this.currentDrop.arle) === JSON.stringify(this.lastArle))) {
			// Must also meet speed threshold
			if(Date.now() - this.softDropTimer > this.softDropSpeed) {
				this.move('Down');
			}
		}

		this.lastArle = Object.assign(this.currentDrop.arle);
	}

	/**
	 * After locking a drop, also reset the currentMove and timer.
	 */
	lockDrop() {
		super.lockDrop();
		this.currentMove = null;
		this.rotations = 0;
		this.softDropTimer = Date.now();
	}
}

module.exports = { CpuGame };
