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

		const arle_x = Math.round(arle.x);
		const schezo_x = Math.round(schezo.x);

		if(arle_x == schezo_x) {
			return boardState[arle_x] >= Math.min(arle.y, schezo.y);
		}
		else {
			return boardState[arle_x] >= arle.y || boardState[schezo_x] >= schezo.y;
		}
	}

	startLockDelay(lockDelay) {
		// For now there is 0 lock delay
		const arleDrop = this.currentDrop;
		const schezo = getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;

		boardState[arleDrop.arle.x].push(arleDrop.colours[0]);
		boardState[schezo.x].push(arleDrop.colours[1]);
	}

	move(direction) {
		const arle = this.currentDrop.arle;
		const schezo = getOtherPuyo(this.currentDrop);

		if(direction == 'left' && Math.min(arle.x, schezo.x) > 0) {
			this.currentDrop.shiftLeft();
		}
		else if(direction == 'right' && Math.max(arle.x, schezo.x) < COLS) {
			this.currentDrop.shiftRight();
		}
	}

	rotate(direction) {
		if(direction === 'CW') {
			this.currentDrop.rotateCW();
		}
		else {
			this.currentDrop.rotateCCW();
		}
	}
}