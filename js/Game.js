'use strict';

window.Game = class Game {
	constructor(gamemode = 'Tsu', gameId, opponentIds, socket, boardDrawerId, dropGenerator, settings = new window.Settings()) {
		this.board = new window.Board(settings);
		this.gamemode = gamemode;
		this.gameId = gameId;
		this.opponentIds = opponentIds;
		this.settings = settings;
		this.endResult = null;			// Final result of the game
		this.softDrops = 0;				// Frames in which the soft drop button was held
		this.preChainScore = 0;			// Cumulative score from previous chains (without any new softdrop score)
		this.currentScore = 0;			// Current score (completely accurate)

		this.dropGenerator = dropGenerator;
		const req = this.dropGenerator.requestDrops(0).slice();
		console.log(req);
		this.dropQueue = req;
		this.dropQueueIndex = 1;

		this.leftoverNuisance = 0;		// Leftover nuisance (decimal between 0 and 1)
		this.visibleNuisance = {};		// Dictionary of { gameId: amount } of received nuisance
		this.activeNuisance = 0;		// Active nuisance
		this.totalNuisance = 0;			// Sum of all queued and active nuisance
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };

		this.boardDrawerId = boardDrawerId;
		this.boardDrawer = new window.BoardDrawer(this.settings, this.boardDrawerId);

		this.socket = socket;
		this.audioPlayer = new window.AudioPlayer(this.gameId, socket, this.settings.volume);
		if(this.boardDrawerId !== 1) {
			this.audioPlayer.disable();
		}

		this.socket.on('sendNuisance', (gameId, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.visibleNuisance[gameId] += nuisance;
			this.totalNuisance += nuisance;
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

		this.socket.on('gameOver', gameId => {
			if(!opponentIds.includes(gameId)) {
				return;
			}
			console.log('Player with id ' + gameId + ' has topped out.');
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'Win';
			}
		})

		this.opponentIds.forEach(id => {
			this.visibleNuisance[id] = 0;
		});

		this.locking = 'not';			// State of lock delay: 'not', [time of lock start]
		this.forceLockDelay = 0;
		this.currentDrop = this.dropQueue.shift();
	}

	/**
	 * Determines if the Game should be ended.
	 */
	end() {
		if(this.board.checkGameOver(this.gamemode) && this.resolvingChains.length === 0 && this.endResult === null) {
			this.endResult = 'Loss';
		}
		if(this.endResult !== null && this.boardDrawerId === 1) {
			switch(this.endResult) {
				case 'Win':
					this.audioPlayer.playSfx('win');
					break;
				case 'Loss':
					this.audioPlayer.playSfx('loss');
			}
		}
		return this.endResult;
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
		let currentBoardHash;
		// Isolated puyo currently dropping
		if (this.currentDrop.schezo.y != null) {
			currentBoardHash = this.dropIsolatedPuyo();
		}
		// Currently resolving a chain
		else if(this.resolvingChains.length !== 0) {
			currentBoardHash = this.resolveChains();
		}
		// Not resolving a chain; game has control
		else {
			// Create a new drop if one does not exist and game has not ended
			if(this.currentDrop.shape === null && this.endResult === null) {
				if(this.dropQueue.length <= 3) {
					this.dropQueue = this.dropQueue.concat(this.dropGenerator.requestDrops(this.dropQueueIndex));
					this.dropQueueIndex++;
				}
				this.currentDrop = this.dropQueue.shift();
			}

			this.getInputs();

			if(this.checkLock()) {
				// Lock delay is over, lock puyo in place
				if(this.locking !== 'not' && Date.now() - this.locking >= this.settings.lockDelay - this.forceLockDelay) {
					this.currentDrop.finishRotation();
					this.lockDrop();
					if(this.resolvingChains.length === 0 && this.currentDrop.schezo.y === null) {
						const droppedNuisance = this.board.dropNuisance(this.activeNuisance);
						if(droppedNuisance >= this.settings.cols * 2) {
							this.audioPlayer.playAndEmitSfx('nuisanceFall2');
						}
						else if(droppedNuisance > 0) {
							this.audioPlayer.playAndEmitSfx('nuisanceFall1');
						}
						this.activeNuisance -= droppedNuisance;
						this.totalNuisance -= droppedNuisance;
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
			currentBoardHash = this.boardDrawer.hashForUpdate(currentBoardState);
			this.boardDrawer.updateBoard(currentBoardState);
			this.updateScore();
		}

		// Emit board state to all opponents
		this.socket.emit('sendState', this.gameId, currentBoardHash, this.currentScore, this.totalNuisance);
	}

	/**
	 * Called every frame while a drop is being split. (Prevents inputs.)
	 */
	dropIsolatedPuyo() {
		const boardState = this.board.boardState;
		const currentDrop = this.currentDrop;
		const arleDropped = currentDrop.arle.y <= boardState[currentDrop.arle.x].length;
		const schezoDropped = currentDrop.schezo.y <= boardState[currentDrop.schezo.x].length;

		if(this.resolvingState.chain === 0) {
			this.resolvingState = { chain: -1, puyoLocs: null, nuisanceLocs: null, currentFrame: 0, totalFrames: 0 };
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
		const currentBoardHash = this.boardDrawer.hashForUpdate(currentBoardState);
		this.boardDrawer.updateBoard(currentBoardState);

		if (schezoDropped && arleDropped) {
			boardState[currentDrop.arle.x].push(currentDrop.colours[0]);
			boardState[currentDrop.schezo.x].push(currentDrop.colours[1]);
			this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };
			this.resolvingChains = this.board.resolveChains();
			// If there are no chains to resolve, drop nuisance before returning control to the board
			if(this.resolvingChains.length === 0) {
				const droppedNuisance = this.board.dropNuisance(this.activeNuisance);
				if(droppedNuisance >= this.settings.cols * 2) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall2');
				}
				else if(droppedNuisance > 0) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall1');
				}
				this.activeNuisance -= droppedNuisance;
				this.totalNuisance -= droppedNuisance;
			}
			currentDrop.schezo.x = null;
			currentDrop.schezo.y = null;
			currentDrop.shape = null;
		}
		return currentBoardHash;
	}

	/**
	 * Called every frame while chaining is occurring. (Prevents inputs.)
	 * Returns the current board hash.
	 */
	resolveChains() {
		// Setting up the board state
		if(this.resolvingState.chain === 0) {
			const puyoLocs = this.resolvingChains[0];
			const dropFrames = window.getDropFrames(puyoLocs, this.board.boardState, this.settings);
			const nuisanceLocs = this.board.findNuisancePopped(puyoLocs);
			this.resolvingState = { chain: 1, puyoLocs, nuisanceLocs, currentFrame: 1, totalFrames: this.settings.popFrames + dropFrames };
		}
		else {
			this.resolvingState.currentFrame++;
		}

		// Update the board
		const currentBoardHash = this.boardDrawer.hashForResolving(this.board.boardState, this.resolvingState);
		this.boardDrawer.resolveChains(this.board.boardState, this.resolvingState);

		// Check if the chain is done resolving
		if(this.resolvingState.currentFrame === this.resolvingState.totalFrames) {
			// Update the score displayed
			this.updateScore();

			// Play chain sfx
			if(this.resolvingState.chain > 7) {
				this.audioPlayer.playAndEmitSfx('chain', 7);
			}
			else {
				this.audioPlayer.playAndEmitSfx('chain', this.resolvingState.chain);
			}

			// Play nuisance sfx
			if(this.resolvingState.chain > 5) {
				this.audioPlayer.playAndEmitSfx('nuisanceSend', 5);
			}
			else if(this.resolvingState.chain > 1) {
				this.audioPlayer.playAndEmitSfx('nuisanceSend', this.resolvingState.chain);
			}

			// Remove the chained puyos and popped nuisance puyos
			this.board.deletePuyos(this.resolvingState.puyoLocs.concat(this.board.findNuisancePopped(this.resolvingState.puyoLocs)));

			// Done resolving all chains
			if(this.resolvingState.chain === this.resolvingChains.length) {
				this.resolvingChains = [];
				this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };

				const droppedNuisance = this.board.dropNuisance(this.activeNuisance);
				if(droppedNuisance >= this.settings.cols * 2) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall2');
				}
				else if(droppedNuisance > 0) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall1');
				}
				this.activeNuisance -= droppedNuisance;
				this.totalNuisance -= droppedNuisance;

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
				const nuisanceLocs = this.board.findNuisancePopped(puyoLocs);
				const dropFrames = window.getDropFrames(puyoLocs, this.board.boardState, this.settings);
				this.resolvingState = {
					chain: this.resolvingState.chain + 1,
					puyoLocs,
					nuisanceLocs,
					currentFrame: 0,
					totalFrames: this.settings.popFrames + dropFrames
				};
			}
		}
		return currentBoardHash;
	}

	getInputs() {
		// Implemented by the child classes
		throw new Error('getInput() must be implemented in the child class!');
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
	checkLock(currentDrop = this.currentDrop, boardState = this.board.boardState) {
		// Do not lock while rotating 180
		if(currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = currentDrop.arle;
		const schezo = window.getOtherPuyo(currentDrop);
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

		if(currentDrop.rotating === 'CW') {
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
		else if(currentDrop.rotating === 'CCW') {
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
		const pointsDisplayName = 'pointsDisplay' + this.boardDrawerId;
		const html = document.getElementById(pointsDisplayName).innerHTML;
		const last_score = parseInt(html.substring(6));

		if(this.resolvingState.chain === 0) {
			// Score from soft dropping (will not send nuisance)
			if(this.softDrops > 5) {
				this.currentScore = last_score + Math.floor(this.softDrops / 5);
				document.getElementById(pointsDisplayName).innerHTML = "Score: " + this.currentScore;
				this.softDrops %= 5;
			}
			return;
		}

		this.currentScore = last_score + window.calculateScore(this.resolvingState.puyoLocs, this.resolvingState.chain);
		document.getElementById(pointsDisplayName).innerHTML = "Score: " + this.currentScore;

		let { nuisanceSent, leftoverNuisance } =
			window.calculateNuisance(this.currentScore - this.preChainScore, this.settings.pointsPerNuisance, this.leftoverNuisance);
		this.leftoverNuisance = leftoverNuisance;
		console.log("Sent: " + nuisanceSent + " Leftover: " + leftoverNuisance);

		this.preChainScore = this.currentScore;

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
				console.log('Sending ' + nuisanceSent + ' nuisance.');
				this.socket.emit('sendNuisance', this.gameId, nuisanceSent);
			}
		}
	}

	/**
	 * Called when a move event is emitted, and validates the event before performing it.
	 * Puyos may not move into the wall or into the stack.
	 */
	move(direction) {
    // Do not move while rotating 180
		if(this.currentDrop.rotating180 > 0) {
			return false;
		}
		const arle = this.currentDrop.arle;
		const schezo = window.getOtherPuyo(this.currentDrop);
		const boardState = this.board.boardState;
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

		if(direction === 'Left') {
			if(leftest.x >= 1 && boardState[Math.floor(leftest.x) - 1].length <= leftest.y) {
				this.currentDrop.shift('Left');
				this.audioPlayer.playAndEmitSfx('move');
			}
		}
		else if(direction === 'Right') {
			if(rightest.x <= this.settings.cols - 2 && boardState[Math.ceil(rightest.x) + 1].length <= rightest.y) {
				this.currentDrop.shift('Right');
				this.audioPlayer.playAndEmitSfx('move');
			}
		}
		else if(direction === 'Down') {
			if(arle.y > boardState[arle.x].length && schezo.y > boardState[Math.round(schezo.x)].length) {
				this.currentDrop.shift('Down');
				this.softDrops += 1;
			}
			else {
				this.forceLockDelay += 20;
			}
			const new_schezo = window.getOtherPuyo(this.currentDrop);
			if(new_schezo.y < 0) {
				this.currentDrop.shift('Up', -new_schezo.y);
			}
		}
		else {
			throw new Error('Attempted to move in an undefined direction');
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
				this.audioPlayer.playAndEmitSfx('rotate');
			}
		}
		else {
			const newStandardAngle = this.currentDrop.standardAngle + Math.PI / 2;
			newDrop.standardAngle = newStandardAngle;

			if(this.checkKick(newDrop, direction)) {
				this.currentDrop.rotate('CCW');
				this.audioPlayer.playAndEmitSfx('rotate');
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
		const boardState = this.board.boardState;

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
			if(boardState[schezo.x].length >= schezo.y) {
				if(schezo.x > arle.x) {
					kick = 'Left';
				}
				else if(schezo.x < arle.x) {
					kick = 'Right';
				}
				else {
					kick = 'Up';
				}
			}
		}

		// Determine if kicking is possible
		if(kick === 'Left') {
			if(arle.x >= 1 && boardState[arle.x - 1].length < arle.y) {
				this.currentDrop.shift('Left');
			}
			else {
				doRotate = false;
			}
		}
		else if(kick === 'Right') {
			if(arle.x <= this.settings.cols - 2 && boardState[arle.x + 1].length < arle.y) {
				this.currentDrop.shift('Right');
			}
			else {
				doRotate = false;
			}
		}
		else if(kick === 'Up') {
			this.currentDrop.shift('Up', boardState[schezo.x].length - schezo.y + 0.05);
		}

		// Cannot kick, but might be able to 180 rotate
		if(!doRotate) {
			if(Date.now() - this.lastRotateAttempt[direction] < this.settings.rotate180_time) {
				this.currentDrop.rotate(direction, 180);

				// Check case where schezo 180 rotates through the stack/ground
				if((schezo.x > arle.x && direction === 'CW') || (schezo.x < arle.x && direction === 'CCW')) {
					if(boardState[arle.x].length >= arle.y - 1) {
						// Only kick the remaining amount
						this.currentDrop.shift('Up', boardState[arle.x].length - arle.y + 1);
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
