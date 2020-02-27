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
		const boardState = this.board.boardState;
		const droppingColour = this.currentDrop.colours;
		return { boardState, droppingX, droppingY, droppingColour };
	}

	affectGravity() {
		this.currentDrop.affectGravity(this.settings.gravity);
		if(this.checkLock()) {
			this.startLockDelay(this.settings.lockDelay);
			if(this.board.checkGameOver()) {
				alert("Game over!");
			}
			this.currentDrop = getNewDrop();
		}
	}

	checkLock() {
		const x = this.currentDrop.pos_x;
		const y = this.currentDrop.pos_y;
		const boardState = this.board.boardState;
		switch (this.currentDrop.orientation) {
			case 'Up':
			case 'Down':
				return boardState[x].length >= (y - 0.5);
			case 'Left':
			case 'Right':
				const col_max_height = Math.max(boardState[x - 0.5], boardState[x + 0.5]);
				return boardState[col_max_height] >= y;
		}
	}

	startLockDelay() {
		// For now there is 0 lock delay
		const x = this.currentDrop.pos_x;
		const y = this.currentDrop.pos_y;
		const boardState = this.board.boardState;
		switch (this.currentDrop.orientation) {
			case 'Up':
				boardState[x].push(this.currentDrop.colours[0]);
				boardState[x].push(this.currentDrop.colours[1]);
				break;
			case 'Down':
				boardState[x].push(this.currentDrop.colours[1]);
				boardState[x].push(this.currentDrop.colours[0]);
				break;
			case 'Left':
				boardState[x - 0.5].push(this.currentDrop.colours[0]);
				boardState[x + 0.5].push(this.currentDrop.colours[1]);
				break;
			case 'Right':
				boardState[x - 0.5].push(this.currentDrop.colours[1]);
				boardState[x + 0.5].push(this.currentDrop.colours[0]);
				break;
		}
	}

	move(direction) {
		const x = this.currentDrop.pos_x;
		const y = this.currentDrop.pos_y;
		switch(this.currentDrop.orientation) {
			case 'Up':
			case 'Down':
				if(direction === 'left') {
					if(x > 0 && this.board.boardState[x - 1].length <= (y - 0.5)) {
						this.currentDrop.shiftLeft();
					}
				}
				else {
					if(x < (COLS - 1) && this.board.boardState[x + 1].length <= (y - 0.5)) {
						this.currentDrop.shiftRight();
					}
				}
				break;
			case 'Left':
			case 'Right':
				if(direction === 'left') {
					if(x > 0.5 && this.board.boardState[x - 0.5].length <= y) {
						this.currentDrop.shiftLeft();
					}
				}
				else {
					if(x < (COLS - 0.5) && this.board.boardState[x + 0.5].length <= y) {
						this.currentDrop.shiftRight();
					}
				}
				break;
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