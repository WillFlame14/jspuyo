'use strict';

class Game {
	constructor(gamemode = 'Tsu', settings) {
		this.board = new Board();
		this.gamemode = gamemode;
		this.settings = new Settings();

		this.inputManager = new InputManager();
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));

		this.currentDrop = getNewDrop(this.gamemode, this.settings);
	}

	getBoardState() {
		return { boardState: this.board.boardState, currentDrop: this.currentDrop };
	}

	step(mainFrame) {
		this.currentDrop.affectGravity(this.settings.gravity);
		this.currentDrop.affectRotation();

		if(this.checkLock()) {
			this.currentDrop.finishRotation();
			this.startLockDelay(this.settings.lockDelay);
			if(this.board.checkGameOver()) {
				alert("Game over!");
				window.cancelAnimationFrame(mainFrame);
			}
			this.currentDrop = getNewDrop(this.gamemode, this.settings);
		}
	}

	checkLock() {
		const arle = this.currentDrop.arle;
		const schezo = getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;

		let arle_x = Math.round(arle.x);
		let schezo_x = Math.round(schezo.x);

		if(arle_x > COLS - 1) {
			arle_x = COLS - 1;
		}
		if(schezo_x > COLS - 1) {
			schezo_x = COLS - 1;
		}

		if(arle_x == schezo_x) {
			return boardState[arle_x].length >= Math.min(arle.y, schezo.y);
		}
		else {
			return boardState[arle_x].length >= arle.y || boardState[schezo_x] >= schezo.y;
		}
	}

	startLockDelay(lockDelay) {
		// For now there is 0 lock delay
		const arleDrop = this.currentDrop;
		const schezo = getOtherPuyo(this.currentDrop);
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
		const schezo = getOtherPuyo(this.currentDrop);

		if(direction == 'left') {
			const leftest = (arle.x < schezo.x) ? arle : schezo;
			if(leftest.x >= 1 && this.board.boardState[Math.ceil(leftest.x) - 1].length <= leftest.y) {
				this.currentDrop.shiftLeft();
			}
		}
		else if(direction == 'right') {
			const rightest = (arle.x > schezo.x) ? arle : schezo;
			if(rightest.x <= COLS - 2 && this.board.boardState[Math.floor(rightest.x) + 1].length <= rightest.y) {
				this.currentDrop.shiftRight();
			}
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

			this.checkKick(newDrop);
			this.currentDrop.rotateCW();
		}
		else {
			const newStandardAngle = this.currentDrop.standardAngle + Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			this.checkKick(newDrop);
			this.currentDrop.rotateCCW();
		}
	}

	checkKick(newDrop) {
		const schezo = getOtherPuyo(newDrop);

		if(schezo.x > COLS - 1) {
			this.currentDrop.shiftLeft();
		}
		else if(schezo.x < 0) {
			this.currentDrop.shiftRight();
		}
		else if(this.board.boardState[schezo.x].length >= schezo.y) {
			if(schezo.x > this.currentDrop.arle.x) {
				this.currentDrop.shiftLeft();
			}
			else if(schezo.x < this.currentDrop.arle.x) {
				this.currentDrop.shiftRight();
			}
		}
	}
}