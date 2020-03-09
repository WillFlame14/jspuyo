'use strict';

window.Game = class Game {
	constructor(gamemode = 'Tsu', player = true, gameId, opponentId, socket, firstDrop_colours, settings = new window.Settings()) {
		this.board = new window.Board(settings.rows, settings.cols);
		this.gamemode = gamemode;
		this.player = player;
		this.gameId = gameId;
		this.opponentId = opponentId;
		this.settings = settings;
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.opponentQueue = [];
		this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };

		this.socket = socket;
		if(!this.player) {
			this.socket.on('newDrop', (gameId, drop_colours) => {
				if(this.opponentId === gameId) {
					const newDrop = window.Drop.getNewDrop(this.gamemode, this.settings, drop_colours);
					this.opponentQueue.push(newDrop);
				}
				else {
					console.log("Mismatch between opponent:" + this.opponentId + " and game: " + gameId);
				}
			});
		}

		this.inputManager = new window.InputManager(this.settings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));
		this.boardDrawer = new window.BoardDrawer(this.settings, player ? 1 : 2);

		this.locking = 'not';			// State of lock delay: 'not', [time of lock start]
		this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings, firstDrop_colours);
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
		// Currently resolving a chain
		if(this.resolvingChains.length !== 0) {
			// Finds the total number of frames required to display a chain animation
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
					const totalFrames = getTotalFrames(puyoLocs, this.settings);

					this.resolvingState = { chain: this.resolvingState.chain + 1, puyoLocs, currentFrame: 0, totalFrames: totalFrames };
				}
			}
		}
		// Not resolving a chain; game has control
		else {
			if(this.currentDrop.shape === null) {
				if(this.player) {
					this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings);
					this.socket.emit('newDrop', this.gameId, this.currentDrop.colours);
				}
				else {
					if(this.opponentQueue.length > 0) {
						this.currentDrop = this.opponentQueue.pop();
					}
					else {
						console.log('Opponent queue is empty. You may be experiencing lag.');
						return;
					}
				}
			}

			if(this.player) {
				this.inputManager.executeKeys();
			}

			if(this.checkLock()) {
				if(this.locking !== 'not' && Date.now() - this.locking >= this.settings.lockDelay) {
					this.currentDrop.finishRotation();
					this.lockDrop();
					this.resolvingChains = this.board.resolveChains();
					this.currentDrop.shape = null;
					this.locking = 'not';
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

	/**
	 * Locks the drop and adds the puyos to the stack.
	 */
	lockDrop() {
		const arleDrop = this.currentDrop;
		const schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;

		// Force round the schezo before it is put on the stack
		schezo.x = Math.round(schezo.x);

		if(arleDrop.arle.x == schezo.x) {		// vertical orientation
			if(arleDrop.arle.y < schezo.y) {
				boardState[schezo.x].push(arleDrop.colours[0]);
				boardState[schezo.x].push(arleDrop.colours[1]);
			}
			else {
				boardState[schezo.x].push(arleDrop.colours[1]);
				boardState[schezo.x].push(arleDrop.colours[0]);
			}
		}
		else {			// horizontal orientation
			boardState[arleDrop.arle.x].push(arleDrop.colours[0]);
			boardState[schezo.x].push(arleDrop.colours[1]);
		}
	}

	/**
	 * Called when a move event is emitted from the InputManager, and validates the event before performing it.
	 * Puyos may not move into the wall or into the stack.
	 */
	move(direction, player) {
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
			}
			else {
				this.lastRotateAttempt[direction] = Date.now();
			}
		}

		return doRotate;
	}
}
