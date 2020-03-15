'use strict';

window.Game = class Game {
	constructor(gamemode = 'Tsu', gameId, opponentIds, socket, firstDrop_colours, settings = new window.Settings()) {
		this.board = new window.Board(settings);
		this.gamemode = gamemode;
		this.gameId = gameId;
		this.opponentIds = opponentIds;
		this.settings = settings;

		this.leftoverNuisance = 0;
		this.visibleNuisance = {};
		this.activeNuisance = 0;
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };

		this.inputManager = new window.InputManager(this.settings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('move', this.move.bind(this));
		this.inputManager.on('rotate', this.rotate.bind(this));
		this.boardDrawer = new window.BoardDrawer(this.settings, 1);
		this.opponentBoardDrawers = {};

		// Add a HashedBoardDrawer for each opponent
		let opponentCounter = 2;
		this.opponentIds.forEach(id => {
			// this.opponentBoardDrawers[id] = new window.HashedBoardDrawer(opponentCounter);
			this.visibleNuisance[id] = 0;
			opponentCounter++;
		});

		this.socket = socket;
		this.socket.on('sendBoard', (gameId, boardHash) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			// this.opponentBoardDrawers[gameId].updateBoard(boardHash);
		});

		this.socket.on('sendNuisance', (gameId, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.visibleNuisance[gameId] += nuisance;
			console.log('Received ' + nuisance + " nuisance.");
		});

		this.socket.on('activateNuisance', gameId => {
			if(!opponentIds.includes(gameId)) {
				return;
			}
			this.activeNuisance += this.visibleNuisance[gameId];
			this.visibleNuisance[gameId] = 0;
			console.log('Activated ' + this.activeNuisance + ' nuisance.');
		});

		this.locking = 'not';			// State of lock delay: 'not', [time of lock start]
		this.forceLockDelay = 0;
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
		let currentBoardHash;
		// Isolated puyo currently dropping
		if (this.currentDrop.schezo.y != null) {
			const boardState = this.board.boardState;
			const currentDrop = this.currentDrop;
			const arleDropped = currentDrop.arle.y <= boardState[currentDrop.arle.x].length;
			const schezoDropped = currentDrop.schezo.y <= boardState[currentDrop.schezo.x].length;

			if(this.resolvingState.chain === 0) {
				this.resolvingState = { chain: -1, puyoLocs: null, currentFrame: 0, totalFrames: 0 };
			}
			else {
				this.resolvingState.currentFrame++;
				if (!arleDropped) {
					currentDrop.arle.y -= 1 / this.settings.isoCascadeFramesPerRow;
					if (currentDrop.arle.y < boardState[currentDrop.arle.x].length) {
						currentDrop.arle.y = boardState[currentDrop.arle.x].length
					}
				}
				if (!schezoDropped) {
					currentDrop.schezo.y -= 1 / this.settings.isoCascadeFramesPerRow;
					if (currentDrop.schezo.y < boardState[currentDrop.schezo.x].length) {
						currentDrop.schezo.y = boardState[currentDrop.schezo.x].length
					}
				}
			}
			const currentBoardState = { boardState, currentDrop };
			this.boardDrawer.updateBoard(currentBoardState);

			if (schezoDropped && arleDropped) {
				boardState[currentDrop.arle.x].push(currentDrop.colours[0]);
				boardState[currentDrop.schezo.x].push(currentDrop.colours[1]);
				this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };
				this.resolvingChains = this.board.resolveChains();
				currentDrop.schezo.x = null;
				currentDrop.schezo.y = null;
				currentDrop.shape = null;
			}
		}
		// Currently resolving a chain
		else if(this.resolvingChains.length !== 0) {
			// Setting up the board state
			if(this.resolvingState.chain === 0) {
				const puyoLocs = this.resolvingChains[0];
				const dropFrames = window.getDropFrames(puyoLocs, this.board.boardState, this.settings);
				this.resolvingState = { chain: 1, puyoLocs, currentFrame: 1, totalFrames: this.settings.popFrames + dropFrames };
			}
			else {
				this.resolvingState.currentFrame++;
			}

			// Update the board
			currentBoardHash = this.boardDrawer.resolveChains(this.board.boardState, this.resolvingState);

			// Check if the chain is done resolving
			if(this.resolvingState.currentFrame === this.resolvingState.totalFrames) {
				// Update the score displayed
				this.updateScore();

				// Remove the null puyos
				this.resolvingState.puyoLocs.forEach(location => this.board.boardState[location.col][location.row] = null);
				this.board.boardState = this.board.boardState.map(col => col.filter(row => row !== null));

				// Done resolving all chains
				if(this.resolvingState.chain === this.resolvingChains.length) {
					this.resolvingChains = [];
					this.resolvingState = { chain: 0, puyoLocs: [], currentFrame: 0, totalFrames: 0 };

					this.activeNuisance -= this.board.dropNuisance(this.activeNuisance);
					const totalVisibleNuisance = Object.keys(this.visibleNuisance).reduce((nuisance, opp) => {
						nuisance += this.visibleNuisance[opp];
						return nuisance;
					}, 0);

					// No pending nuisance, chain completed
					if(this.activeNuisance === 0 && totalVisibleNuisance === 0) {
						this.socket.emit('activateNuisance', this.gameId);
					}
				}
				// Still have more chains to resolve
				else {
					const puyoLocs = this.resolvingChains[this.resolvingState.chain];
					const dropFrames = window.getDropFrames(puyoLocs, this.board.boardState, this.settings);
					this.resolvingState = {
						chain: this.resolvingState.chain + 1,
						puyoLocs,
						currentFrame: 0,
						totalFrames: this.settings.popFrames + dropFrames
					};
				}
			}
		}
		// Not resolving a chain; game has control
		else {
			// Create a new drop if one does not exist
			if(this.currentDrop.shape === null) {
				this.currentDrop = window.Drop.getNewDrop(this.gamemode, this.settings);
			}

			this.inputManager.executeKeys();

			if(this.checkLock()) {
				// Lock delay is over, lock puyo in place
				if(this.locking !== 'not' && Date.now() - this.locking >= this.settings.lockDelay - this.forceLockDelay) {
					this.currentDrop.finishRotation();
					this.lockDrop();
					if(this.resolvingChains.length === 0) {
						this.activeNuisance -= this.board.dropNuisance(this.activeNuisance);
					}
					this.locking = 'not';
					this.forceLockDelay = 0;
				}
				else {
					// Start lock delay
					if(this.locking === 'not') {
						this.locking = Date.now();
					}
					// Continue lock delay
					this.currentDrop.affectRotation();
				}
			}
			// Was locking before, but not anymore so reset locking state
			else if(this.locking !== 'not') {
				this.locking = 'not';
				this.currentDrop.affectRotation();
			}
			// Not locking
			else {
				this.currentDrop.affectGravity(this.settings.gravity);
				this.currentDrop.affectRotation();
			}

			// Update the board
			const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop };
			currentBoardHash = this.boardDrawer.updateBoard(currentBoardState);
		}

		// Emit board state to all opponents
		this.socket.emit('sendBoard', this.gameId, currentBoardHash);
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
		const currentDrop = this.currentDrop;
		const boardState = this.board.boardState;
		currentDrop.schezo = window.getOtherPuyo(currentDrop);

		// Force round the schezo before it is put on the stack
		currentDrop.schezo.x = Math.round(currentDrop.schezo.x);

		if(currentDrop.arle.x == currentDrop.schezo.x) {		// vertical orientation
			if(currentDrop.arle.y < currentDrop.schezo.y) {
				boardState[currentDrop.schezo.x].push(currentDrop.colours[0]);
				boardState[currentDrop.schezo.x].push(currentDrop.colours[1]);
			}
			else {
				boardState[currentDrop.schezo.x].push(currentDrop.colours[1]);
				boardState[currentDrop.schezo.x].push(currentDrop.colours[0]);
			}
			this.resolvingChains = this.board.resolveChains();
			currentDrop.schezo.x = null;
			currentDrop.schezo.y = null;
			currentDrop.shape = null;
		}
		else {			// horizontal orientation
			currentDrop.arle.y = Math.max(boardState[currentDrop.arle.x].length, boardState[currentDrop.schezo.x].length);
			currentDrop.schezo.y = currentDrop.arle.y;
		}
	}

	/**
	 * Updates the displayed score and sends nuisance to opponents.
	 */
	updateScore() {
		const html = document.getElementById("pointsDisplay1").innerHTML;
		const current_score = parseInt(html.substring(6));
		const chain_score = window.calculateScore(this.resolvingState.puyoLocs, this.resolvingState.chain);
		document.getElementById("pointsDisplay1").innerHTML = "Score: " + (current_score + chain_score);

		let { nuisanceSent, leftoverNuisance } =
			window.calculateNuisance(chain_score, this.settings.pointsPerNuisance, this.leftoverNuisance);
		this.leftoverNuisance = leftoverNuisance;
		console.log("Sent: " + nuisanceSent + " Leftover: " + leftoverNuisance);

		if(nuisanceSent === 0) {
			return;
		}

		// Partially cancel the active nuisance
		if(this.activeNuisance > nuisanceSent) {
			this.activeNuisance -= nuisanceSent;
			console.log('Partially canceled ' + nuisanceSent + ' active nuisance.');
		}
		// Fully cancel the active nuisance
		else {
			if(this.activeNuisance !== 0) {
				console.log('Fully canceled ' + this.activeNuisance + ' active nuisance.');
			}
			nuisanceSent -= this.activeNuisance;
			this.activeNuisance = 0;

			// Cancel the visible nuisance
			const opponents = Object.keys(this.visibleNuisance);
			for(let i = 0; i < opponents.length; i++) {
				// Partially cancel this opponent's nuisance
				if(this.visibleNuisance[opponents[i]] > nuisanceSent) {
					this.visibleNuisance[opponents[i]] -= nuisanceSent;
					console.log('Could not fully cancel '
						+ this.visibleNuisance[opponents[i]] + ' visible nuisance from ' + opponents[i] + '.')
					// No nuisance left to send, so break
					break;
				}
				// Fully cancel this opponent's nuisance
				else {
					if(this.visibleNuisance[opponents[i]] !== 0) {
						console.log('Fully canceled '
							+ this.visibleNuisance[opponents[i]] + ' visible nuisance from ' + opponents[i] + '.');
					}
					nuisanceSent -= this.visibleNuisance[opponents[i]];
					this.visibleNuisance[opponents[i]] = 0;
				}
			}

			// Still nuisance left to send
			if(nuisanceSent > 0) {
				console.log('Canceled all pending nuisance and sending ' + nuisanceSent + ' nuisance.');
				this.socket.emit('sendNuisance', this.gameId, nuisanceSent);
			}
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
