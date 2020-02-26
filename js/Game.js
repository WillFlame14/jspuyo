'use strict';

const DEFAULT_SETTINGS = new Settings(0.1, 0.5);

class Game {
	constructor(gamemode, settings = DEFAULT_SETTINGS) {
		this.board = new Board(12, 6);
		this.gamemode = gamemode;
		this.settings = settings;

		this.inputManager = new InputManager();
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));

		this.currentDrop = getNewDrop();
	}

	getBoardState() {
		const { droppingX, droppingY } = this.currentDrop.convert();
		const boardState = this.board.boardstate;
		const droppingColour = this.currentDrop.colours;
		return { boardState, droppingX, droppingY, droppingColour };
	}

	affectGravity() {
		this.currentDrop.affectGravity(this.settings.gravity);
		if(this.checkLock()) {
			this.startLockDelay(this.settings.lockDelay);
			this.currentDrop = getNewDrop();
		}
		if(this.board.checkGameOver()) {
			alert();
		}
	}

	checkLock() {
		const x = this.currentDrop.pos_x;
		const y = this.currentDrop.pos_y;
		const boardstate = this.board.boardstate;
		switch (this.currentDrop.orientation) {
			case 'Up':
			case 'Down':
				return boardstate[x].length >= (y - 0.5);
			case 'Left':
			case 'Right':
				const col_max_height = Math.max(boardstate[x - 0.5], boardstate[x + 0.5]);
				return boardstate[col_max_height] >= y;
		}
	}

	startLockDelay() {
		// For now there is 0 lock delay
		const x = this.currentDrop.pos_x;
		const y = this.currentDrop.pos_y;
		const boardstate = this.board.boardstate;
		switch (this.currentDrop.orientation) {
			case 'Up':
				boardstate[x].push(this.currentDrop.colours[0]);
				boardstate[x].push(this.currentDrop.colours[1]);
				break;
			case 'Down':
				boardstate[x].push(this.currentDrop.colours[1]);
				boardstate[x].push(this.currentDrop.colours[0]);
				break;
			case 'Left':
				boardstate[x - 0.5].push(this.currentDrop.colours[0]);
				boardstate[x + 0.5].push(this.currentDrop.colours[1]);
				break;
			case 'Right':
				boardstate[x - 0.5].push(this.currentDrop.colours[1]);
				boardstate[x + 0.5].push(this.currentDrop.colours[0]);
				break;
		}
	}

	move(direction) {
		if(direction === 'left') {
			this.currentDrop.shiftLeft();
		}
		else {
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