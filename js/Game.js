'use strict';

window.Game = class Game {
	constructor(gamemode = 'Tsu', settings) {
		this.board = new window.Board();
		this.gamemode = gamemode;
		this.settings = new window.Settings(settings);
		this.lastRotateAttempt = {};
		this.resolvingChains = [];
		this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };

		this.boardDrawer = new window.BoardDrawer(this.settings);

		this.inputManager = new window.InputManager();
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));

		this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings);
	}

	gameOver() {
		return this.board.checkGameOver();
	}

	step() {
		// Currently resolving a chain
		if(this.resolvingChains.length !== 0) {
			const getTotalFrames = function getTotalFrames(puyoLocs, settings) {
				const height = Math.max(...puyoLocs.map(loc => loc.row)) - Math.min(...puyoLocs.map(loc => loc.row));
				return height * settings.cascadeFramesPerRow + settings.popFrames;
			};

			// Setting up the board state
			if(this.resolvingState.chain === 0) {
				const puyoLocs = this.resolvingChains[0];
				const totalFrames = getTotalFrames(puyoLocs, this.settings);
				this.resolvingState = { chain: 1, puyoLocs, currentFrame: 1, totalFrames: totalFrames };
			}
			else {
				this.resolvingState.currentFrame++;
			}

			// Update the board
			// this.boardDrawer.resolveChains(this.boardState, this.resolvingState);

			// Check if the chain is done resolving
			if(this.resolvingState.currentFrame === this.resolvingState.totalFrames) {

				// Temporary function to remove puyos
				const boardState = this.board.boardState;
				this.resolvingState.puyoLocs.forEach(location => boardState[location.col][location.row] = null);
				this.board.boardState = boardState.map(col => col.filter(row => row !== null));

				if(this.resolvingState.chain === this.resolvingChains.length) {		// Done resolving all chains
					this.resolvingChains = [];
					this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };
				}
				else {				// Still have more chains to resolve

					const puyoLocs = this.resolvingChains[this.resolvingState.chain];
					const totalFrames = getTotalFrames(puyoLocs, this.settings);

					this.resolvingState = { chain: this.resolvingState.chain + 1, puyoLocs, currentFrame: 1, totalFrames: totalFrames };
				}
			}
		}
		// Not resolving a chain; game has control
		else {
			if(this.currentDrop.shape === null) {
				this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings)
			}
			this.currentDrop.affectGravity(this.settings.gravity);
			this.currentDrop.affectRotation();
			this.inputManager.executeKeys();

			if(this.checkLock()) {
				this.currentDrop.finishRotation();
				this.startLockDelay(this.settings.lockDelay);
				this.resolvingChains = this.board.resolveChains();
				this.currentDrop.shape = null;
			}
		}
		// Update the board
		const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop };
		this.boardDrawer.updateBoard(currentBoardState);
	}

	checkLock() {
		// Do not lock while rotating 180
		if(this.currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;

		if(this.currentDrop.rotating === 'CW') {
			if(schezo.x > arle.x) {
				if(schezo.y > arle.y) {		// quadrant 1
					return boardState[Math.ceil(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
				else {						// quadrant 2
					return boardState[arle.x].length > schezo.y;
				}
			}
			else {
				if(schezo.y < arle.y) {		// quadrant 3
					return boardState[Math.floor(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
				else {						// quadrant 4
					return boardState[arle.x].length > arle.y;
				}
			}
		}
		else if(this.currentDrop.rotating === 'CCW') {
			if(schezo.x > arle.x) {
				if(schezo.y > arle.y) {		// quadrant 1
					return boardState[arle.x].length > arle.y;
				}
				else {						// quadrant 2
					return boardState[Math.ceil(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
			}
			else {
				if(schezo.y < arle.y) {		// quadrant 3
					return boardState[arle.x].length > schezo.y;
				}
				else {						// quadrant 4
					return boardState[Math.floor(schezo.x)].length >= schezo.y || boardState[arle.x].length >= arle.y;
				}
			}
		}
		else {		// not rotating
			if(arle.x === schezo.x) {		// vertical orientation
				return boardState[arle.x].length >= Math.min(arle.y, schezo.y);
			}
			else {		//horizontal orientation
				return boardState[arle.x].length >= arle.y || boardState[schezo.x].length >= schezo.y;
			}
		}
	}

	/* eslint-disable-next-line no-unused-vars */
	startLockDelay(lockDelay) {
		// For now there is 0 lock delay
		const arleDrop = this.currentDrop;
		const schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;
		schezo.x = Math.round(schezo.x);

		if(arleDrop.arle.x == schezo.x) {
			if(arleDrop.arle.y < schezo.y) {
				boardState[schezo.x].push(arleDrop.colours[0]);
				boardState[schezo.x].push(arleDrop.colours[1]);
			}
			else {
				boardState[schezo.x].push(arleDrop.colours[1]);
				boardState[schezo.x].push(arleDrop.colours[0]);
			}
		}
		else {
			boardState[arleDrop.arle.x].push(arleDrop.colours[0]);
			boardState[schezo.x].push(arleDrop.colours[1]);
		}
	}

	move(direction) {
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(this.currentDrop);

		if(direction === 'left') {
			const leftest = (arle.x < schezo.x) ? arle : schezo;
			if(leftest.x >= 1 && this.board.boardState[Math.floor(leftest.x) - 1].length <= leftest.y) {
				this.currentDrop.shift('Left');
			}
		}
		else if(direction === 'right') {
			const rightest = (arle.x > schezo.x) ? arle : schezo;
			if(rightest.x <= this.settings.cols - 2 && this.board.boardState[Math.ceil(rightest.x) + 1].length <= rightest.y) {
				this.currentDrop.shift('Right');
			}
		}
		else if(direction === 'down') {
			this.currentDrop.shift('Down');
		}
	}

	rotate(direction) {
		if(this.currentDrop.rotating !== 'not') {
			return;
		}

		const newDrop = this.currentDrop.copy();

		if(direction === 'CW') {
			const newStandardAngle = this.currentDrop.standardAngle - Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			if(this.checkKick(newDrop, direction)) {
				this.currentDrop.rotate('CW');
			}
		}
		else {
			const newStandardAngle = this.currentDrop.standardAngle + Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			if(this.checkKick(newDrop, direction)) {
				this.currentDrop.rotate('CCW');
			}
		}
	}

	checkKick(newDrop, direction) {
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(newDrop);

		let kick = '';
		let doRotate = true;

		// Check board edges
		if(schezo.x > this.settings.cols - 1) {
			kick += 'left';
		}
		else if(schezo.x < 0) {
			kick += 'right';
		}
		else {
			// Check the stacks
			if(this.board.boardState[schezo.x].length >= schezo.y) {
				if(schezo.x > arle.x) {
					kick += 'left';
				}
				else if(schezo.x < arle.x) {
					kick += 'right';
				}
			}
		}

		if(kick === 'left') {
			if(arle.x >= 1 && this.board.boardState[arle.x - 1].length < arle.y) {
				this.currentDrop.shift('Left');
			}
			else {
				doRotate = false;
			}
		}
		else if(kick === 'right') {
			if(arle.x <= this.settings.cols - 2 && this.board.boardState[arle.x + 1].length < arle.y) {
				this.currentDrop.shift('Right');
			}
			else {
				doRotate = false;
			}
		}

		// Failed to kick due to both sides being full, but might be able to 180 rotate
		if(!doRotate) {
			if(Date.now() - this.lastRotateAttempt[direction] < this.settings.rotate180_time) {
				this.currentDrop.rotate(direction, 180);
			}
			else {
				this.lastRotateAttempt[direction] = Date.now();
			}
		}


		return doRotate;
	}
}
