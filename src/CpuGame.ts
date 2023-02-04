'use strict';

import { Cpu, CpuMove } from './cpu/Cpu';
import { Direction } from './Drop';
import { Game } from './Game';
import { AudioPlayer } from './utils/AudioPlayer';
import { Settings, UserSettings } from './utils/Settings';

import { ServerToClientEvents, ClientToServerEvents } from './@types/events';
import { Socket } from 'socket.io-client';

const defaultUserSettings = new UserSettings();

export class CpuGame extends Game {
	ai: Cpu;
	softDropSpeed: number;
	movementSpeed: number;
	currentMove: CpuMove;
	rotations: number;
	lastArle: Point;

	softDropTimer: number;
	movementTimer: number;

	constructor(gameId: string, opponentIds: string[], socket: Socket<ServerToClientEvents, ClientToServerEvents>, ai: Cpu, speed: number, settings: Settings) {
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
		this.audioPlayer.assignGameId(gameId);
	}

	/**
	 * @Override
	 * Apply an input for the CPU. Used to get the current drop to the optimal move position.
	 */
	getInputs(): void {
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
			this.move(Direction.RIGHT);
			applied = true;
		}
		else if(this.currentDrop.arle.x > col) {
			this.move(Direction.LEFT);
			applied = true;
		}

		// Perform correct amount of rotations
		if(this.currentDrop.rotating === null) {
			if(this.rotations < rotations) {
				this.rotate(Direction.CW);
				this.rotations++;
				applied = true;
			}
			else if(this.rotations > rotations) {
				this.rotate(Direction.CCW);
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
				this.move(Direction.DOWN);
			}
		}

		this.lastArle = Object.assign(this.currentDrop.arle) as Point;
	}

	/**
	 * After locking a drop, also reset the currentMove and timer.
	 */
	dropLocked(): void {
		this.currentMove = null;
		this.rotations = 0;
		this.softDropTimer = Date.now();
	}
}
