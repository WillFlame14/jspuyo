'use strict';

import { ServerToClientEvents, ClientToServerEvents } from './@types/events';
import { Socket } from 'socket.io-client';

import { AudioPlayer } from './utils/AudioPlayer';
import { Board } from './Board';
import { Direction, Drop } from './Drop';
import { GameArea } from './draw/GameArea';
import { Settings, UserSettings } from './utils/Settings';
import { StatTracker } from './StatTracker';
import * as Utils from './utils/Utils';

import { ChainResolvingState } from './states/ChainResolvingState';
import { ChainSquishingState } from './states/ChainSquishingState';
import { NuisanceDroppingState } from './states/NuisanceDroppingState';
import { PuyoDroppingSplitState } from './states/PuyoDroppingSplitState';
import { PuyoDroppingState } from './states/PuyoDroppingState';
import { PuyoSquishingState } from './states/PuyoSquishingState';
import { QueueShiftingState } from './states/QueueShiftingState';

export enum MODE {
	QUEUE_SHIFTING,
	PUYO_DROPPING,
	PUYO_DROPPING_SPLIT,
	PUYO_SQUISHING,
	CHAIN_POPPING,
	CHAIN_DROPPING,
	CHAIN_SQUISHING,
	NUISANCE_DROPPING
}

export interface GameState {
	name: string;
	enter(...args: unknown[]): GameState;
	step(): GameUpdate;
}

export interface GameUpdate {
	boardHash: string;
	nuisanceSent?: number;
	activateNuisance?: boolean;
}

export type ScoreType = 'softDrop' | 'chain' | 'cosmetic';

export class Game {
	board: Board;
	gameId: string;
	opponentIds: string[];
	settings: Settings;
	userSettings: UserSettings;
	statTracker: StatTracker;
	audioPlayer: AudioPlayer;
	socket: Socket<ServerToClientEvents, ClientToServerEvents>;

	cellId: number;
	gameArea: GameArea;
	currentDrop: Drop;

	/** Final result of the game */
	endResult: string = null;

	/** Frames in which the soft drop button was held for this drop */
	softDrops = 0;

	/** Current drop number */
	dropNum = 0;

	/** Cumulative score from previous chains (without any new softdrop score) */
	preChainScore = 0;

	/** Current score (completely accurate) */
	currentScore = 0;

	allClear = false;

	/** Leftover nuisance (decimal between 0 and 1) */
	leftoverNuisance = 0;

	/** Dictionary of { gameId: amount } of received nuisance */
	visibleNuisance: Record<string, number> = {};

	/** Currently active nuisance (about to fall) */
	activeNuisance = 0;

	/** Timestamp of the last failed rotate attempt */
	lastRotateAttempt = {} as Record<Direction, number>;

	forceLock = false;
	currentMovements = [];

	gameState: GameState;
	states: Record<string, GameState>;

	constructor(
		gameId: string,
		opponentIds: string[],
		socket: Socket<ServerToClientEvents, ClientToServerEvents>,
		settings: Settings,
		userSettings: UserSettings,
		cellId: number = null,
		gameArea: GameArea = null
	) {
		this.board = new Board(settings);
		this.gameId = gameId;
		this.opponentIds = opponentIds;
		this.settings = settings;
		this.userSettings = userSettings;
		this.statTracker = new StatTracker();

		this.cellId = cellId;
		this.gameArea = gameArea || new GameArea(settings, userSettings.appearance, 1, true);
		this.socket = socket;

		for(const oppId of opponentIds) {
			this.visibleNuisance[oppId] = 0;
		}

		this.states = {
			ChainResolvingState: new ChainResolvingState(this),
			ChainSquishingState: new ChainSquishingState(this),
			NuisanceDroppingState: new NuisanceDroppingState(this),
			PuyoDroppingSplitState: new PuyoDroppingSplitState(this),
			PuyoDroppingState: new PuyoDroppingState(this),
			PuyoSquishingState: new PuyoSquishingState(this),
			QueueShiftingState: new QueueShiftingState(this)
		};
		this.gameState = this.states.QueueShiftingState.enter();
	}

	setStartingBoard(boardState: number[][]): void {
		this.board = new Board(this.settings, boardState);
	}

	/**
	 * Determines if the Game should be ended.
	 */
	end() {
		if(this.board.checkGameOver()) {
			if(this.gameState.name === 'PuyoDropping' && this.endResult === null) {
				this.endResult = 'Loss';
			}
		}
		if(this.endResult !== null && ['QueueShifting', 'PuyoDropping'].includes(this.gameState.name)) {
			switch(this.endResult) {
				case 'Win':
					setTimeout(() => this.audioPlayer.playAndEmitSfx('win'), 2000);
					this.statTracker.addResult('win');
					break;
				case 'Loss':
					this.audioPlayer.playAndEmitSfx('loss');
					this.statTracker.addResult('loss');
					break;
			}
			return this.endResult;
		}
		return null;
	}

	receiveNuisance(oppId: string, nuisance: number): void {
		if(this.visibleNuisance[oppId] === undefined) {
			this.visibleNuisance[oppId] = 0;
		}
		this.visibleNuisance[oppId] += nuisance;
	}

	activateNuisance(oppId: string): void {
		this.activeNuisance += this.visibleNuisance[oppId];
		this.visibleNuisance[oppId] = 0;
	}

	/**
	 * Increments the game.
	 * If a chain is resolving or a drop is split, the game will not update until the animations have completed.
	 * 		Each animation takes a certain number of frames to be completed, and every update increments
	 * 		that counter until all animations have been drawn.
	 * Otherwise, the game first checks that a Drop exists, then executes normal game functions (such as gravity
	 * and rotation) while accepting any queued events from InputManager. Next it determines if the drop will become
	 * locked, and if so, adds it to the board and checks for chains.
	 */
	step() {
		this.gameArea.updateNuisance(this.getTotalNuisance());
		const { boardHash, nuisanceSent = 0, activateNuisance = false } = this.gameState.step();

		return {
			currentBoardHash: boardHash,
			score: this.currentScore,
			nuisance: this.getTotalNuisance(),
			nuisanceSent,
			activateNuisance
		};
	}

	getInputs(): void {
		// Implemented by the child classes
		throw new Error('getInputs() must be implemented in the child class!');
	}

	/**
	 * Returns a boolean indicating whether this.currentDrop should be locked in place.
	 * A drop will lock if any of its puyos' y-coordinate is below the height of the stack in that column.
	 *
	 * For now, this function only supports Tsu drops.
	 *
	 * Underlying logic:
	 *     If the drop is rotating, the final position of the schezo puyo must be known.
	 *     This can be found from the schezo's position relative to the arle and the drop's rotate direction.
	 *     Then compare the y-coordinate of both puyos against the y-coordinate of the stack.
	 *     If the drop is (or will be) vertical, only the lower one needs to be compared.
	 */
	checkLock(currentDrop: Drop = this.currentDrop, boardState: number[][] = this.board.boardState): boolean {
		// Do not lock while rotating 180
		if(currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = currentDrop.arle;
		const schezo = Utils.getOtherPuyo(currentDrop);
		let lock: boolean;

		if(schezo.x > this.settings.cols - 1) {
			console.log('stoP SPAMMING YOUR KEYBOARDGTGHVDRY you non longer have the privilege of game physics');
			arle.x--;
			schezo.x--;
		}
		else if(schezo.x < 0) {
			console.log('stoP SPAMMING YOUR KEYBOARDGTGHVDRY you non longer have the privilege of game physics');
			arle.x++;
			schezo.x++;
		}

		if(currentDrop.rotating === Direction.CW) {
			if(schezo.x > arle.x) {
				if(schezo.y > arle.y) {		// quadrant 1
					lock = boardState[Math.ceil(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
				else {						// quadrant 2
					lock = boardState[arle.x].length > schezo.y;
				}
			}
			else {
				if(schezo.y < arle.y) {		// quadrant 3
					lock = boardState[Math.floor(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
				else {						// quadrant 4
					lock = boardState[arle.x].length > arle.y;
				}
			}
		}
		else if(currentDrop.rotating === Direction.CCW) {
			if(schezo.x > arle.x) {
				if(schezo.y > arle.y) {		// quadrant 1
					lock = boardState[arle.x].length > arle.y;
				}
				else {						// quadrant 2
					lock = boardState[Math.ceil(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
			}
			else {
				if(schezo.y < arle.y) {		// quadrant 3
					lock = boardState[arle.x].length > schezo.y;
				}
				else {						// quadrant 4
					lock = boardState[Math.floor(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
			}
		}
		else {		// not rotating
			if(arle.x === schezo.x) {		// vertical orientation
				lock = boardState[arle.x].length >= Math.min(arle.y, schezo.y);
			}
			else {		//horizontal orientation
				lock = boardState[arle.x].length >= arle.y || boardState[schezo.x].length >= schezo.y;
			}
		}
		return lock;
	}

	/**
	 * Optional function that can be implemented by a child class.
	 * Called when a drop is locked.
	 */
	dropLocked() {
		// Overridden by the subclass (otherwise, does nothing).
	}

	/**
	 * Updates the score displayed on the screen.
	 */
	updateVisibleScore(_pointsDisplayName: string, _currentScore: number): void {
		// Overridden by the subclass.
	}

	/**
	 * Updates the internal score (calling updateVisibleScore() to update the screen) and returns the amount of nuisance sent to opponents.
	 */
	updateScore(amount: number, type: ScoreType): number {
		this.currentScore += amount;
		this.updateVisibleScore(`pointsDisplay${this.cellId}`, this.currentScore);

		if (type === 'softDrop') {
			return 0;
		}

		this.statTracker.addScore(amount);

		// Update target points if margin time is in effect
		this.settings.checkMarginTime();

		const result = Utils.calculateNuisance(this.currentScore - this.preChainScore, this.settings.targetPoints, this.leftoverNuisance);
		let { nuisanceSent } = result;
		this.leftoverNuisance = result.leftoverNuisance;

		// Send an extra rock if all clear
		if(this.allClear) {
			nuisanceSent += 5 * this.settings.cols;
			this.allClear = false;
		}

		this.preChainScore = this.currentScore;

		// Do not send nuisance if chain is not long enough (or there is none to send)
		if(type === 'cosmetic') {
			return 0;
		}

		// Partially cancel the active nuisance
		if(this.activeNuisance > nuisanceSent) {
			this.activeNuisance -= nuisanceSent;
			nuisanceSent = 0;
		}
		// Fully cancel the active nuisance
		else {
			nuisanceSent -= this.activeNuisance;
			this.activeNuisance = 0;

			// Cancel the visible nuisance
			const opponents = Object.keys(this.visibleNuisance);
			for(let i = 0; i < opponents.length; i++) {
				// Partially cancel this opponent's nuisance
				if(this.visibleNuisance[opponents[i]] > nuisanceSent) {
					this.visibleNuisance[opponents[i]] -= nuisanceSent;
					// No nuisance left to send, so break
					break;
				}
				// Fully cancel this opponent's nuisance
				else {
					nuisanceSent -= this.visibleNuisance[opponents[i]];
					this.visibleNuisance[opponents[i]] = 0;
				}
			}
		}

		return nuisanceSent;
	}

	/**
	 * Called when a move event is emitted, and validates the event before performing it.
	 * Puyos may not move into the wall or into the stack.
	 */
	move(direction: Direction, das = false): boolean {
	// Do not move while rotating 180
		if(this.currentDrop.rotating180 > 0) {
			return false;
		}

		const arle = this.currentDrop.arle;
		const schezo = Utils.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;
		let leftest: Point, rightest: Point;

		if(arle.x < schezo.x) {
			leftest = arle;
			rightest = schezo;
		}
		else if (arle.x > schezo.x) {
			leftest = schezo;
			rightest = arle;
		}
		else {
			if(arle.y < schezo.y) {
				leftest = rightest = arle;
			}
			else {
				leftest = rightest = schezo;
			}
		}

		if(direction === Direction.LEFT) {
			if(leftest.x >= 1 && boardState[Math.floor(leftest.x) - 1].length <= leftest.y) {
				this.currentDrop.shift(Direction.LEFT);
				this.audioPlayer.playAndEmitSfx('move');
				this.currentMovements.push(`Left${das ? 'DAS': ''}`);
			}
		}
		else if(direction === Direction.RIGHT) {
			if(rightest.x <= this.settings.cols - 2 && boardState[Math.ceil(rightest.x) + 1].length <= rightest.y) {
				this.currentDrop.shift(Direction.RIGHT);
				this.audioPlayer.playAndEmitSfx('move');
				this.currentMovements.push(`Right${das ? 'DAS': ''}`);
			}
		}
		else if(direction === Direction.DOWN) {
			if(arle.y > boardState[arle.x].length && schezo.y > boardState[Math.round(schezo.x)].length) {
				this.currentDrop.shift(Direction.DOWN);
				this.softDrops += 1;
			}
			else {
				// Force lock delay if soft drop is being held
				this.forceLock = true;
			}
			const new_schezo = Utils.getOtherPuyo(this.currentDrop);
			if(new_schezo.y < 0) {
				this.currentDrop.shift(Direction.UP, -new_schezo.y);
			}
		}
		else {
			throw new Error('Attempted to move in an undefined direction.');
		}
	}

	/**
	 * Called when a rotate event is emitted from the InputManager, and validates the event before performing it.
	 * The drop cannot be rotated while it is already rotating, and kick/180 rotate checking must be performed.
	 */
	rotate(direction: Direction): void {
		if(this.currentDrop.rotating !== null) {
			return;
		}

		const newDrop = this.currentDrop.copy();

		if(direction === Direction.CW) {
			const newStandardAngle = this.currentDrop.standardAngle - Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			if(this.checkKick(newDrop, direction)) {
				this.currentDrop.rotate(Direction.CW);
				this.audioPlayer.playAndEmitSfx('rotate');
				this.currentMovements.push(Direction.CW);
			}
		}
		else {
			const newStandardAngle = this.currentDrop.standardAngle + Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			if(this.checkKick(newDrop, direction)) {
				this.currentDrop.rotate(Direction.CCW);
				this.audioPlayer.playAndEmitSfx('rotate');
				this.currentMovements.push(Direction.CCW);
			}
		}
	}

	/**
	 * Determines if a specified rotation is valid.
	 * If the drop encounters a wall, the ground or a stack during rotation, it attempts to kick away.
	 * If there is no space to kick away, the rotation will fail unless a 180 rotate is performed.
	 *
	 * @param  {Drop} 	 newDrop   	The "final state" of the drop after the rotation finishes
	 * @param  {string}  direction 	The direction of rotation
	 * @return {boolean} 			Whether rotating is a valid operation or not
	 */
	checkKick(newDrop: Drop, direction: Direction): boolean {
		const arle = this.currentDrop.arle;
		const schezo = Utils.getOtherPuyo(newDrop);
		const boardState = this.board.boardState;

		let kick = '';
		let doRotate = true;

		// Check board edges to determine kick diretion
		if(schezo.x > this.settings.cols - 1) {
			kick = Direction.LEFT;
		}
		else if(schezo.x < 0) {
			kick = Direction.RIGHT;
		}
		else {
			// Check the stacks to determine kick direction
			if(boardState[schezo.x].length >= schezo.y) {
				if(schezo.x > arle.x) {
					kick = Direction.LEFT;
				}
				else if(schezo.x < arle.x) {
					kick = Direction.RIGHT;
				}
				else {
					kick = Direction.UP;
				}
			}
		}

		// Determine if kicking is possible
		if(kick === Direction.LEFT) {
			if(arle.x >= 1 && boardState[arle.x - 1].length < arle.y) {
				this.currentDrop.shift(Direction.LEFT);
			}
			else {
				doRotate = false;
			}
		}
		else if(kick === Direction.RIGHT) {
			if(arle.x <= this.settings.cols - 2 && boardState[arle.x + 1].length < arle.y) {
				this.currentDrop.shift(Direction.RIGHT);
			}
			else {
				doRotate = false;
			}
		}
		else if(kick === Direction.UP) {
			this.currentDrop.shift(Direction.UP, boardState[schezo.x].length - schezo.y + 0.05);
		}

		// Cannot kick, but might be able to 180 rotate
		if(!doRotate) {
			if(Date.now() - this.lastRotateAttempt[direction] < this.settings.rotate180_time) {
				this.currentDrop.rotate(direction, 180);

				// Check case where schezo 180 rotates through the stack/ground
				if((schezo.x > arle.x && direction === Direction.CW) || (schezo.x < arle.x && direction === Direction.CCW)) {
					if(boardState[arle.x].length >= arle.y - 1) {
						// Only kick the remaining amount
						this.currentDrop.shift(Direction.UP, boardState[arle.x].length - arle.y + 1);
					}
				}
			}
			else {
				this.lastRotateAttempt[direction] = Date.now();
			}
		}

		return doRotate;
	}

	/**
	 * Returns the sum of all visible and active nuisance.
	 */
	getTotalNuisance(): number {
		const totalVisibleNuisance =
			Object.keys(this.visibleNuisance).reduce((nuisance, opp) => {
				nuisance += this.visibleNuisance[opp];
				return nuisance;
			}, 0);

		return this.activeNuisance + totalVisibleNuisance;
	}
}
