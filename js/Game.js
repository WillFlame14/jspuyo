'use strict';

const { Board } = require('./Board.js');
const { BoardDrawer } = require('./BoardDrawer.js');
const { DropGenerator } = require('./Drop.js');
const { Utils, AudioPlayer } = require('./Utils.js');

class Game {
	constructor(gameId, opponentIds, socket, boardDrawerId, settings, userSettings) {
		this.board = new Board(settings);
		this.gameId = gameId;
		this.opponentIds = opponentIds;
		this.settings = settings;
		this.userSettings = userSettings;
		this.endResult = null;			// Final result of the game
		this.softDrops = 0;				// Frames in which the soft drop button was held
		this.preChainScore = 0;			// Cumulative score from previous chains (without any new softdrop score)
		this.currentScore = 0;			// Current score (completely accurate)
		this.allClear = false;
		this.paused = false;

		this.dropGenerator = new DropGenerator(this.settings);
		this.dropQueue = this.dropGenerator.requestDrops(0).map(drop => drop.copy());
		this.dropQueueIndex = 1;
		this.dropQueueSetIndex = 1;

		this.leftoverNuisance = 0;		// Leftover nuisance (decimal between 0 and 1)
		this.visibleNuisance = {};		// Dictionary of { gameId: amount } of received nuisance
		this.activeNuisance = 0;		// Active nuisance
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.resolvingState = { chain: 0, connections: [], poppedConnections: [], puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };
		this.nuisanceState = { nuisanceArray: [], nuisanceAmount: 0, currentFrame: 0, totalFrames: 0 };
		this.squishState = { currentFrame: -1 };
		this.currentFrame = 0;

		this.boardDrawerId = boardDrawerId;
		this.boardDrawer = new BoardDrawer(this.settings, this.userSettings.appearance, this.boardDrawerId);
		this.lastBoardHash = null;

		this.socket = socket;
		this.audioPlayer = new AudioPlayer(this.gameId, socket, this.userSettings.sfxVolume, this.userSettings.musicVolume);

		this.socket.on('sendNuisance', (gameId, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.visibleNuisance[gameId] += nuisance;
		});

		this.socket.on('activateNuisance', gameId => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.activeNuisance += this.visibleNuisance[gameId];
			this.visibleNuisance[gameId] = 0;
		});

		this.socket.on('gameOver', gameId => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			// Do not log to console for CPUs
			if(this.gameId > 0) {
				console.log('Player with id ' + gameId + ' has topped out.');
			}
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'Win';
			}
		});

		this.socket.on('playerDisconnect', gameId => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			// Do not log to console for CPUs
			if(this.gameId > 0) {
				console.log('Player with id ' + gameId + ' has disconnected.');
			}
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'OppDisconnect';
			}
		});

		this.socket.on('pause', () => {
			this.paused = true;
		});

		this.socket.on('play', () => {
			this.paused = false;
		});

		this.socket.on('timeout', () => {
			this.endResult = 'Timeout';
		});

		this.socket.on('timeoutDisconnect', gameId => {
			// Do not log to console for CPUs
			if(this.gameId > 0) {
				console.log('Player with id ' + gameId + ' has timed out.');
			}
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'Win';
			}
		});

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
		if(this.board.checkGameOver(this.settings.gamemode)
			&& this.resolvingChains.length === 0
			&& this.nuisanceDroppingFrame == null
			&& this.endResult === null) {
				this.endResult = 'Loss';
		}
		if(this.endResult !== null) {
			switch(this.endResult) {
				case 'Win':
					setTimeout(() => this.audioPlayer.playAndEmitSfx('win'), 2000);
					break;
				case 'Loss':
					this.audioPlayer.playAndEmitSfx('loss');
					setTimeout(() => this.audioPlayer.playAndEmitSfx('win'), 2000);
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
		// Do not step if game paused
		if(this.paused) {
			return;
		}

		let currentBoardHash = null;

		// Isolated puyo currently dropping
		if (this.currentDrop.schezo.y != null) {
			currentBoardHash = this.dropIsolatedPuyo();
		}
		// Currently squishing puyos into the stack
		else if(this.squishState.currentFrame !== -1) {
			currentBoardHash = this.squishPuyos();
		}
		// Currently dropping nuisance
		else if (this.nuisanceState.nuisanceAmount !== 0) {
			currentBoardHash = this.dropNuisance();
		}
		// Currently resolving a chain
		else if(this.resolvingChains.length !== 0) {
			currentBoardHash = this.resolveChains();
		}
		// Not resolving a chain; game has control
		else {
			// Create a new drop if one does not exist and game has not ended
			if(this.currentDrop.shape === null && this.endResult === null) {
				if(this.dropQueue.length <= 5) {
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
					
					// Only do not start squishing puyos if drop was split
					if(this.currentDrop.schezo.y === null) {
						this.squishState.currentFrame = 0;
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

			const currentBoardState = { connections: this.board.getConnections(), currentDrop: this.currentDrop };
			// Update the board for player (CPUs if enough frames have passed)
			if(this.boardDrawerId === 1 || this.currentFrame === 0) {
				currentBoardHash = this.boardDrawer.updateBoard(currentBoardState);
				this.currentFrame = this.userSettings.skipFrames;
			}
			else {
				this.currentFrame--;
			}
			this.updateScore();
		}

		// Emit board state to all opponents
		if(currentBoardHash !== null) {
			this.socket.emit('sendState', this.gameId, currentBoardHash, this.currentScore, this.getTotalNuisance());
		}
	}

	/**
	 * Called every frame while a drop is being split. (Prevents inputs.)
	 */
	dropIsolatedPuyo() {
		const boardState = this.board.boardState;
		const currentDrop = this.currentDrop;
		const arleDropped = currentDrop.arle.y <= boardState[currentDrop.arle.x].length;
		const schezoDropped = currentDrop.schezo.y <= boardState[currentDrop.schezo.x].length;

		let currentBoardHash = null;

		if(this.resolvingState.chain === 0) {
			this.resolvingState = { chain: -1, puyoLocs: null, nuisanceLocs: null, currentFrame: 0, totalFrames: 0 };
		}
		else {
			this.resolvingState.currentFrame++;
			if (!arleDropped) {
				currentDrop.arle.y -= 1 / this.settings.isoCascadeFramesPerRow;
				if (currentDrop.arle.y < boardState[currentDrop.arle.x].length) {
					currentDrop.arle.y = boardState[currentDrop.arle.x].length;
				}
			}
			if (!schezoDropped) {
				currentDrop.schezo.y -= 1 / this.settings.isoCascadeFramesPerRow;
				if (currentDrop.schezo.y < boardState[currentDrop.schezo.x].length) {
					currentDrop.schezo.y = boardState[currentDrop.schezo.x].length;
				}
			}
		}

		const currentBoardState = { connections: this.board.getConnections(), currentDrop };

		// Update the board for player (CPUs if enough frames have passed)
		if(this.boardDrawerId === 1 || this.currentFrame === 0) {
			currentBoardHash = this.boardDrawer.updateBoard(currentBoardState);
			this.currentFrame = this.userSettings.skipFrames;
		}
		else {
			this.currentFrame--;
		}

		if (schezoDropped && arleDropped) {
			boardState[currentDrop.arle.x].push(currentDrop.colours[0]);
			boardState[currentDrop.schezo.x].push(currentDrop.colours[1]);

			// Delete any puyos if they were placed on an overstacked column
			this.board.trim();

			this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };
			this.resolvingChains = this.board.resolveChains();

			// Pass control over to squishPuyos()
			this.squishState.currentFrame = 0;

			currentDrop.schezo.x = null;
			currentDrop.schezo.y = null;
			currentDrop.shape = null;
		}
		return currentBoardHash;
	}

	/**
	 * Called every frame while nuisance is dropping.
	 */
	dropNuisance() {
		let hash = null;
		// Initialize the nuisance state
		if (this.nuisanceState.currentFrame === 0) {
			this.nuisanceState.currentFrame = 1;

			let maxFrames = 0;
			let nuisanceCascadeFPR = [];

			for (let i = 0; i < this.settings.cols; i++) {
				// Generate a semi-random value for "frames per row"
				nuisanceCascadeFPR.push(
					this.settings.meanNuisanceCascadeFPR - this.settings.varNuisanceCascadeFPR +
					Math.random() * this.settings.varNuisanceCascadeFPR * 2
				);

				// Calculate the number of frames required
				const colMaxFrames = (this.settings.nuisanceSpawnRow - this.board.boardState[i].length) * nuisanceCascadeFPR[i];
				if (colMaxFrames > maxFrames) {
					maxFrames = colMaxFrames;
				}
			}
			this.nuisanceState.totalFrames = Math.ceil(maxFrames + this.settings.nuisanceLandFrames);
			this.boardDrawer.initNuisanceDrop(nuisanceCascadeFPR);
		}
		// Already initialized
		else {
			// Update the board for player (CPUs if enough frames have passed)
			if(this.boardDrawerId === 1 || this.currentFrame === 0) {
				hash = this.boardDrawer.dropNuisance(this.board.boardState, this.nuisanceState);
				this.currentFrame = this.userSettings.skipFrames;
			}
			else {
				this.currentFrame--;
			}
			this.nuisanceState.currentFrame++;
		}

		// Once done falling, play SFX
		if(this.nuisanceState.currentFrame === this.nuisanceState.totalFrames - this.settings.nuisanceLandFrames) {
			if(this.nuisanceState.nuisanceAmount >= this.settings.cols * 2) {
				this.audioPlayer.playAndEmitSfx('nuisanceFall2');
			}
			else {
				if(this.nuisanceState.nuisanceAmount > this.settings.cols) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall1');
				}
				if(this.nuisanceState.nuisanceAmount > 0) {
					this.audioPlayer.playAndEmitSfx('nuisanceFall1');
				}
			}
		}

		// Finished dropping nuisance
		if (this.nuisanceState.currentFrame >= this.nuisanceState.totalFrames) {
			this.activeNuisance -= this.nuisanceState.nuisanceAmount;

			// Add the nuisance to the stack
			for(let i = 0; i < this.settings.cols; i++) {
				this.board.boardState[i] = this.board.boardState[i].concat(this.nuisanceState.nuisanceArray[i]);
			}
			// Reset the nuisance state
			this.nuisanceState = { nuisanceArray: [], nuisanceAmount: 0, currentFrame: 0, totalFrames: 0 };
		}

		return hash;
	}

	/**
	 * Called every frame while chaining is occurring. (Prevents inputs.)
	 * Returns the current board hash.
	 */
	resolveChains() {
		let currentBoardHash = null;

		// Setting up the board state
		if(this.resolvingState.currentFrame === 0) {
			if(this.resolvingState.chain === 0) {
				this.resolvingState.chain++;
			}
			const puyoLocs = this.resolvingChains[this.resolvingState.chain - 1];
			const nuisanceLocs = this.board.findNuisancePopped(puyoLocs);
			const poppedLocs = puyoLocs.concat(nuisanceLocs);
			const dropFrames = Utils.getDropFrames(poppedLocs, this.board.boardState, this.settings);

			const lowestUnstablePos = {};
			poppedLocs.forEach(puyo => {
				if(lowestUnstablePos[puyo.col] === undefined || lowestUnstablePos[puyo.col] > puyo.row) {
					lowestUnstablePos[puyo.col] = puyo.row;
				}
            });

			const unstablePuyos = [];
			const stableBoardAfterPop = new Board(this.settings, this.board.boardState);
            stableBoardAfterPop.boardState.forEach((column, colIndex) => {
                if(lowestUnstablePos[colIndex] === undefined) {
                    return;
                }
                // Move all unstable puyos
                const removed_puyo_colours = column.splice(lowestUnstablePos[colIndex]);
				let nonPoppedPuyos = 0;
				removed_puyo_colours.forEach((colour, index) => {
					const row = index + lowestUnstablePos[colIndex];
					if(!poppedLocs.some(puyo => puyo.col === colIndex && puyo.row === row)) {
						unstablePuyos.push({ col: colIndex, row, colour, above: lowestUnstablePos[colIndex] + nonPoppedPuyos });
						nonPoppedPuyos++;
					}
                });
            });

			this.resolvingState = {
				chain: this.resolvingState.chain,
				connections: this.board.getConnections(),
				puyoLocs,
				poppedLocs,
				connectionsAfterPop: stableBoardAfterPop.getConnections(),
				unstablePuyos,
				currentFrame: 1,
				totalFrames: this.settings.popFrames + dropFrames
			};
		}
		else {
			this.resolvingState.currentFrame++;
		}

		// Update the board for player (CPUs if enough frames have passed)
		if(this.boardDrawerId === 1 || this.currentFrame === 0) {
			currentBoardHash = this.boardDrawer.resolveChains(this.resolvingState);
			this.currentFrame = this.userSettings.skipFrames;
		}
		else {
			this.currentFrame--;
		}

		// Once done popping, play SFX
		if(this.resolvingState.currentFrame === this.settings.popFrames) {
			// Play sfx
			if(this.resolvingState.chain === this.resolvingChains.length && this.resolvingState.chain > 2) {
				this.audioPlayer.playAndEmitSfx('akari_spell', this.resolvingState.chain > 7 ? 5 : this.resolvingState.chain - 2);
			}
			else {
				this.audioPlayer.playAndEmitSfx('akari_chain', this.resolvingState.chain);
			}
			this.audioPlayer.playAndEmitSfx('chain', this.resolvingState.chain > 7 ? 7 : this.resolvingState.chain);
			if(this.resolvingState.chain > 1) {
				this.audioPlayer.playAndEmitSfx('nuisanceSend', this.resolvingState.chain > 5 ? 5 : this.resolvingState.chain);
			}
		}

		// Check if the chain is done resolving
		if(this.resolvingState.currentFrame === this.resolvingState.totalFrames) {
			// Update the score displayed
			this.updateScore();

			// Remove the chained puyos and popped nuisance puyos
			this.board.deletePuyos(this.resolvingState.puyoLocs.concat(this.board.findNuisancePopped(this.resolvingState.puyoLocs)));

			// Squish puyos into the stack
			this.squishState.currentFrame = 0;

			// Done resolving all chains
			if(this.resolvingState.chain === this.resolvingChains.length) {
				this.resolvingChains = [];
				this.resolvingState = { chain: 0, connections: [], puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };

				// No pending nuisance, chain completed
				if(this.getTotalNuisance() === 0) {
					this.socket.emit('activateNuisance', this.gameId);
				}

				// Check for all clear
				if(this.board.boardState.every(col => col.length === 0)) {
					this.allClear = true;
					this.audioPlayer.playAndEmitSfx('allClear');
				}
			}
			// Still have more chains to resolve
			else {
				this.resolvingState.currentFrame = 0;
				this.resolvingState.chain++;
			}
		}
		return currentBoardHash;
	}

	/**
	 * Squishes the puyos into the stack after lock delay finishes.
	 */
	squishPuyos() {
		this.squishState.currentFrame++;

		// Insert squishing puyos drawing here
		const currentBoardState = { connections: this.board.getConnections(), currentDrop: this.currentDrop };
		const currentBoardHash = this.boardDrawer.updateBoard(currentBoardState);

		if(this.squishState.currentFrame === this.settings.squishFrames) {
			// Chain was not started
			if(this.resolvingChains.length === 0) {
				const { nuisanceDropped, nuisanceArray } = this.board.dropNuisance(this.activeNuisance);
				this.nuisanceState.nuisanceAmount = nuisanceDropped;
				this.nuisanceState.nuisanceArray = nuisanceArray;
			}
			this.squishState.currentFrame = -1;
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
		const schezo = Utils.getOtherPuyo(currentDrop);
		let lock;

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
		currentDrop.schezo = Utils.getOtherPuyo(currentDrop);

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

			// Remove any puyos that are too high
			this.board.trim();

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

		if(this.resolvingState.chain === 0) {
			// Score from soft dropping (will not send nuisance)
			if(this.softDrops > 5) {
				this.currentScore += Math.floor(this.softDrops / 5);
				document.getElementById(pointsDisplayName).innerHTML = `${this.currentScore}`.padStart(8, '0');
				this.softDrops %= 5;
			}
			return;
		}

		this.currentScore += Utils.calculateScore(this.resolvingState.puyoLocs, this.resolvingState.chain);
		document.getElementById(pointsDisplayName).innerHTML = `${this.currentScore}`.padStart(8, '0');

		// Update target points if margin time is in effect
		this.settings.checkMarginTime();

		let { nuisanceSent, leftoverNuisance } =
			Utils.calculateNuisance(this.currentScore - this.preChainScore, this.settings.targetPoints, this.leftoverNuisance);
		this.leftoverNuisance = leftoverNuisance;

		// Send an extra rock if all clear
		if(this.allClear) {
			nuisanceSent += 5 * this.settings.cols;
			this.allClear = false;
		}

		this.preChainScore = this.currentScore;

		// Do not send nuisance if chain is not long enough (or there is none to send)
		if(nuisanceSent === 0 || this.resolvingState.chain < this.settings.minChain) {
			return;
		}

		// Partially cancel the active nuisance
		if(this.activeNuisance > nuisanceSent) {
			this.activeNuisance -= nuisanceSent;
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

			// Still nuisance left to send
			if(nuisanceSent > 0) {
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
		const schezo = Utils.getOtherPuyo(this.currentDrop);
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
				// Force lock delay to come earlier while soft drop is being held
				this.forceLockDelay += 15;
			}
			const new_schezo = Utils.getOtherPuyo(this.currentDrop);
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
	 * The drop cannot be rotated while it is already rotating, and kick/180 rotate checking must be performed.
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
		const schezo = Utils.getOtherPuyo(newDrop);
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

	/**
	 * Returns the sum of all visible and active nuisance.
	 */
	getTotalNuisance() {
		const totalVisibleNuisance =
			Object.keys(this.visibleNuisance).reduce((nuisance, opp) => {
				nuisance += this.visibleNuisance[opp];
				return nuisance;
			}, 0);

		return this.activeNuisance + totalVisibleNuisance;
	}
}

module.exports = { Game };
