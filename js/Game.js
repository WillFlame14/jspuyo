'use strict';

window.Game = class Game {
	constructor(gamemode = 'Tsu', settings = new window.Settings()) {
		this.board = new window.Board(settings.rows, settings.cols);
		this.gamemode = gamemode;
		this.settings = settings;
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };

		this.boardDrawer = new window.BoardDrawer(this.settings, 1);
		this.inputManager = new window.InputManager(this.settings);
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));

		this.locking = 'not';			// State of lock delay: 'not', [time of lock start]
		this.forceLockDelay = 0;
		this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings);
	}

	/**
	 * Determines if a Game Over should be triggered.
	 */
	gameOver() {
		return this.board.checkGameOver(this.gamemode);
	}

	/**
	 * Increments the game.
	 * If a chain is resolving, the game will not update until the animations have completed.
	 * 		Each chain animation takes a certain number of frames to be completed, and every update increments
	 * 		that counter until all animations have been drawn.
	 * Otherwise, the game first checks that a Drop exists, then executes normal game functions (such as gravity
	 * and rotation) while accepting any queued events from InputManager. Next it determines if the drop will become
	 * locked, and if so, adds it to the board and checks for chains.
	 */
	step() {
		// Isolated puyo currently dropping
		if (this.currentDrop.schezo.y != null) {
			const arleDropped = this.currentDrop.arle.y <= this.board.boardState[this.currentDrop.arle.x].length;
			const schezoDropped = this.currentDrop.schezo.y <= this.board.boardState[this.currentDrop.schezo.x].length;
			if(this.resolvingState.chain === 0) {
				this.resolvingState = { chain: -1, puyoLocs: null, currentFrame: 0, totalFrames: 0 };
			} else {
				this.resolvingState.currentFrame++;
				if (!arleDropped) {
					this.currentDrop.arle.y -= 1 / this.settings.isoCascadeFramesPerRow;
					if (this.currentDrop.arle.y < this.board.boardState[this.currentDrop.arle.x].length) {
						this.currentDrop.arle.y = this.board.boardState[this.currentDrop.arle.x].length
					}
				}
				if (!schezoDropped) {
					this.currentDrop.schezo.y -= 1 / this.settings.isoCascadeFramesPerRow;
					if (this.currentDrop.schezo.y < this.board.boardState[this.currentDrop.schezo.x].length) {
						this.currentDrop.schezo.y = this.board.boardState[this.currentDrop.schezo.x].length
					}
				}
			}
			const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop};
			this.boardDrawer.updateBoard(currentBoardState);
			if (schezoDropped && arleDropped) {
				this.board.boardState[this.currentDrop.arle.x].push(this.currentDrop.colours[0]);
				this.board.boardState[this.currentDrop.schezo.x].push(this.currentDrop.colours[1]);
				this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };
				this.resolvingChains = this.board.resolveChains();
				this.currentDrop.schezo.x = null;
				this.currentDrop.schezo.y = null;
				this.currentDrop.shape = null;
			}
		}
		// Currently resolving a chain
		else if(this.resolvingChains.length !== 0) {
			// Finds the total number of frames required to display a chain animation
			const getTotalFrames = function getTotalFrames(puyoLocs, boardState, settings) {
				let poppingPuyos = [];
				for (let i = 0; i < settings.cols; i++) {
					poppingPuyos.push([]);
				}
				for (let i = 0; i < puyoLocs.length; i++) {
					poppingPuyos[puyoLocs[i].col][puyoLocs[i].row] = true;
				}
				let maxPoppingUnder = 0;
				let poppingUnder = 0;
				let wasLastNonPopping = false;
				for (let i = 0; i < settings.cols; i++) {
					poppingUnder = 0;
					wasLastNonPopping = false;
					for (let j = settings.rows - 1; j >= 0 && poppingUnder === 0; j--) {
						if (wasLastNonPopping && poppingPuyos[i][j]) {
							poppingUnder = 1;
							for (let j1 = j - 1; j1 >= 0; j1--) {
								if(poppingPuyos[i][j1]) {
									poppingUnder++;
								}
							}
						} else if (boardState[i][j] != null && !poppingPuyos[i][j]) {
							wasLastNonPopping = true;
						}
					}
					if (poppingUnder > maxPoppingUnder) {
						maxPoppingUnder = poppingUnder;
					}
				}
				return maxPoppingUnder * settings.cascadeFramesPerRow + settings.popFrames;
			};

			// Setting up the board state
			if(this.resolvingState.chain === 0) {
				const puyoLocs = this.resolvingChains[0];
				const totalFrames = getTotalFrames(puyoLocs, this.board.boardState, this.settings);
				this.resolvingState = { chain: 1, puyoLocs, currentFrame: 1, totalFrames: totalFrames };
			}
			else {
				this.resolvingState.currentFrame++;
			}

			// Update the board
			this.boardDrawer.resolveChains(this.board.boardState, this.resolvingState);

			// Check if the chain is done resolving
			if(this.resolvingState.currentFrame === this.resolvingState.totalFrames) {

				// Remove the null puyos
				this.resolvingState.puyoLocs.forEach(location => this.board.boardState[location.col][location.row] = null);
				this.board.boardState = this.board.boardState.map(col => col.filter(row => row !== null));

				// Done resolving all chains
				if(this.resolvingState.chain === this.resolvingChains.length) {
					this.resolvingChains = [];
					this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };
				}
				// Still have more chains to resolve
				else {
					const puyoLocs = this.resolvingChains[this.resolvingState.chain];
					const totalFrames = getTotalFrames(puyoLocs, this.board.boardState, this.settings);

					this.resolvingState = { chain: this.resolvingState.chain + 1, puyoLocs, currentFrame: 0, totalFrames: totalFrames };
				}
			}
		}
		// Not resolving a chain; game has control
		else {
			if(this.currentDrop.shape === null) {
				this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings)
			}
			this.inputManager.executeKeys();

			if(this.checkLock()) {
				if(this.locking !== 'not' && Date.now() - this.locking >= this.settings.lockDelay - this.forceLockDelay) {
					this.currentDrop.finishRotation();
					this.lockDrop();
					this.locking = 'not';
					this.forceLockDelay = 0;
				}
				else if(this.locking === 'not') {
					this.locking = Date.now();
					this.currentDrop.affectRotation();
				}
				else {
					this.currentDrop.affectRotation();
				}
			}
			else if(this.locking !== 'not') {
				this.locking = 'not';
				this.currentDrop.affectRotation();
			}
			else {
				this.currentDrop.affectGravity(this.settings.gravity);
				this.currentDrop.affectRotation();
			}

			// Update the board
			const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop };
			this.boardDrawer.updateBoard(currentBoardState);
		}
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
	checkLock() {
		// Do not lock while rotating 180
		if(this.currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;
		let lock;

		if(schezo.x > this.settings.cols - 1) {
			console.log('stoP SPAMMING YOUR KEYBOARDGTGHVDRY you non longer have the privilege of game physics');
			console.log('jk');
			arle.x--;
			schezo.x--;
		}
		else if(schezo.x < 0) {
			console.log('stoP SPAMMING YOUR KEYBOARDGTGHVDRY you non longer have the privilege of game physics');
			console.log('jk');
			arle.x++;
			schezo.x++;
		}

		// TODO: fix side lodging
		if(this.currentDrop.rotating === 'CW') {
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
		else if(this.currentDrop.rotating === 'CCW') {
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
	 * Locks the drop and adds the puyos to the stack.
	 */
	lockDrop() {
		this.currentDrop.schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;

		// Force round the schezo before it is put on the stack
		this.currentDrop.schezo.x = Math.round(this.currentDrop.schezo.x);

		if(this.currentDrop.arle.x == this.currentDrop.schezo.x) {		// vertical orientation
			if(this.currentDrop.arle.y < this.currentDrop.schezo.y) {
				boardState[this.currentDrop.schezo.x].push(this.currentDrop.colours[0]);
				boardState[this.currentDrop.schezo.x].push(this.currentDrop.colours[1]);
			}
			else {
				boardState[this.currentDrop.schezo.x].push(this.currentDrop.colours[1]);
				boardState[this.currentDrop.schezo.x].push(this.currentDrop.colours[0]);
			}
			this.resolvingChains = this.board.resolveChains();
			this.currentDrop.schezo.x = null;
			this.currentDrop.schezo.y = null;
			this.currentDrop.shape = null;
		}
		else {			// horizontal orientation
			this.currentDrop.arle.y = Math.max(boardState[this.currentDrop.arle.x].length, boardState[this.currentDrop.schezo.x].length);
			this.currentDrop.schezo.y = this.currentDrop.arle.y;
		}
	}

	/**
	 * Called when a move event is emitted from the InputManager, and validates the event before performing it.
	 * Puyos may not move into the wall or into the stack.
	 */
	move(direction) {
		// Do not move while rotating 180
		if(this.currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(this.currentDrop);
		let leftest, rightest;

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

		if(direction === 'left') {
			if(leftest.x >= 1 && this.board.boardState[Math.floor(leftest.x) - 1].length <= leftest.y) {
				this.currentDrop.shift('Left');
			}
		}
		else if(direction === 'right') {
			if(rightest.x <= this.settings.cols - 2 && this.board.boardState[Math.ceil(rightest.x) + 1].length <= rightest.y) {
				this.currentDrop.shift('Right');
			}
		}
		else if(direction === 'down') {
			if(arle.y > this.board.boardState[arle.x].length && schezo.y > this.board.boardState[Math.round(schezo.x)].length) {
				this.currentDrop.shift('Down');
			}
			else {
				this.forceLockDelay += 10;
			}
			const new_schezo = window.getOtherPuyo(this.currentDrop);
			if(new_schezo.y < 0) {
				this.currentDrop.shift('Up', -new_schezo.y);
			}
		}
	}

	/**
	 * Called when a rotate event is emitted from the InputManager, and validates the event before performing it.
	 * The drop may not be rotated while it is already rotating, and kick/180 rotate checking must be performed.
	 */
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

	/**
	 * Determines if a specified rotation is valid.
	 * If the drop encounters a wall, the ground or a stack during rotation, it attempts to kick away.
	 * If there is no space to kick away, the rotation will fail unless a 180 rotate is performed.
	 *
	 * @param  {Drop} 	 newDrop   	The "final state" of the drop after the rotation finishes
	 * @param  {string}  direction 	The direction of rotation
	 * @return {boolean} 			Whether rotating is a valid operation or not
	 */
	checkKick(newDrop, direction) {
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(newDrop);

		let kick = '';
		let doRotate = true;

		// Check board edges to determine kick diretion
		if(schezo.x > this.settings.cols - 1) {
			kick = 'left';
		}
		else if(schezo.x < 0) {
			kick = 'right';
		}
		else {
			// Check the stacks to determine kick direction
			if(this.board.boardState[schezo.x].length >= schezo.y) {
				if(schezo.x > arle.x) {
					kick = 'left';
				}
				else if(schezo.x < arle.x) {
					kick = 'right';
				}
				else {
					kick = 'up';
				}
			}
		}

		// Determine if kicking is possible
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
		else if(kick === 'up') {
			this.currentDrop.shift('Up', this.board.boardState[schezo.x].length - schezo.y + 0.05);
		}

		// Cannot kick, but might be able to 180 rotate
		if(!doRotate) {
			if(Date.now() - this.lastRotateAttempt[direction] < this.settings.rotate180_time) {
				this.currentDrop.rotate(direction, 180);

				// Check case where schezo 180 rotates through the stack/ground
				if((schezo.x > arle.x && direction === 'CW') || (schezo.x < arle.x && direction === 'CCW')) {
					if(this.board.boardState[arle.x].length >= arle.y - 1) {
						// Only kick the remaining amount
						this.currentDrop.shift('Up', this.board.boardState[arle.x].length - arle.y + 1);
					}
				}
			}
			else {
				this.lastRotateAttempt[direction] = Date.now();
			}
		}

		return doRotate;
	}
}
