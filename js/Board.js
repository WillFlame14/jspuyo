'use strict';

window.Board = class Board {
	constructor(settings, boardState = null) {
		this.settings = settings;
		this.height = settings.rows;
		this.width = settings.cols;

		if(boardState === null) {
			this.boardState = [];

			// Prepare the board by filling it with empty arrays
			for(let i = 0; i < this.width; i++) {
				this.boardState.push([]);
			}
		}
		else {
			// Create a copy of the board state
			this.boardState = boardState.map(col => col.slice());
		}
	}

	/**
	 * Returns a boolean indicating if the board's X locations have been covered.
	 * This depends on the gamemode (future gamemodes may be supported).
	 */
	checkGameOver(gamemode) {
		switch(gamemode) {
			case 'Tsu':
				return this.boardState[2].length >= this.height;
			case 'Fever':
				return this.boardState[2].length >= this.height || this.boardState[3].length >= this.height;
		}
	}

	/**
	 * Recursive function that searches the entire stack for any chains (recursively).
	 * The board state used is a copy of the game's board state. No puyos are removed from the game's board.
	 *
	 * Underlying logic:
	 * 		A visited array is kept of the current board state (as of this recursion).
	 * 		A non-visited puyo is selected as the start position.
	 * 		Only DFS to puyos with the same colour to find the extent of the chain (marking them as visited along the way).
	 * 		Upon reaching a "leaf puyo" (all unvisited neighbours are the wrong colour), the running chain length and location
	 * 			of contained puyos are returned. This is eventually caught by the most recent ancestor that is not a leaf puyo.
	 * 		That ancestor then updates its own running chain length and list of puyo locations and continues the DFS.
	 * 		Eventually, the DFS completes and returns the total chain length and list of puyo locations.
	 * 		If the chain length is larger than 3, it counts as a chain and is added to the overall list of puyos chained.
	 * 			That means a future board state must be calculated after this chain (the 'chained' flag set to true).
	 * 		A new non-visited puyo is selected as a start position, and repeat until no valid start positions exist.
	 * 		If at least one chain of puyos was found, the board state will be updated by removing the chained puyos.
	 * 		This function is then called recursively with the new board state and list of puyos chained.
	 *
	 * @param  {Array}  puyos_chained  Array containing arrays of chained puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
	 * @param  {Board}  boardState     The "current" boardstate after previous chaining has been completed
	 * @return {array}                 The complete puyos_chained array
	 */
	resolveChains(puyos_chained = [], board = new Board(this.settings, this.boardState)) {
		let chained = false;			// Flag of whether at least one chain was found in this recursion
		let current_chain_puyos = [];	// List of puyos that will be chained in this recursion
		const visited = [];				// List of visited locations in this recursion

		/**
		 * Performs a DFS through the current board to find the extent of a colour, given a starting puyo.
		 *
		 * @param  {object} puyo        	The current puyo, given as {col: number, row: number, colour: rgba value}
		 * @param  {number} colour_length   The running length of the puyo chain.
		 * @param  {array}  chain_puyos 	The running list of puyos contained in the chain.
		 * @return {object}                 The branch's result, given as {length: colour_length, puyos: chain_puyos}.
		 */
		const dfs = function(puyo, colour_length, chain_puyos) {
			visited.push(puyo);
			const { col, row, colour } = puyo;

			// Search in all 4 cardinal directions
			for(let i = -1; i <= 1; i++) {
				for(let j = -1; j <= 1; j++) {
					const new_puyo = { col: col + i, row: row + j };

					if(Math.abs(i) + Math.abs(j) === 1 && board.validLoc(new_puyo)) {
						new_puyo.colour = board.boardState[col + i][row + j];

						// New location must be unvisited and have the same colour puyo
						if(notVisited(new_puyo) && colour === new_puyo.colour) {
							chain_puyos.push(new_puyo);

							// Update with the leaf puyo of this branch
							const { length, puyos } = dfs(new_puyo, colour_length + 1, chain_puyos);
							colour_length = length;
							chain_puyos = puyos;
						}
					}
				}
			}
			// Done with all branches, return the findings
			return { length: colour_length, puyos: chain_puyos };
		}

		/**
		 * Determines if the visited array contains the passed location.
		 */
		const notVisited = function(location) {
			const { col, row } = location;
			return visited.filter(loc => loc.col === col && loc.row === row).length === 0;
		}

		// Iterate through the entire board to find all starting points
		for(let i = 0; i < board.boardState.length; i++) {
			for(let j = 0; j < board.boardState[i].length; j++) {
				const puyo = { col: i, row: j, colour: board.boardState[i][j] };

				if(notVisited(puyo) && puyo.colour !== window.PUYO_COLOURS['Gray']) {
					// Find the extent of this colour, starting here
					const { length, puyos } = dfs(puyo, 1, [puyo]);
					if (length > 3) {
						current_chain_puyos = current_chain_puyos.concat(puyos);
						chained = true;
					}
				}
			}
		}

		// Delete all the puyos chained in this recursion from the board state
		board.deletePuyos(current_chain_puyos.concat(board.findNuisancePopped(current_chain_puyos)));

		// Recurse with the new board state and list of chained puyos
		if(chained) {
			puyos_chained.push(current_chain_puyos);
			return this.resolveChains(puyos_chained, board);
		}
		// Implicit else: No chains were found in this recursion
		return puyos_chained;
	}

	/**
	 * Determines if a potential location is valid.
	 */
	validLoc(puyo) {
		const { col, row } = puyo;
		return col >= 0 &&
			row >= 0 &&
			col < this.width &&
			row < this.height &&
			this.boardState[col][row] !== undefined;
	}

	/**
	 * Removes the puyos in the locations provided.
	 */
	deletePuyos(puyoLocs = []) {
		puyoLocs.forEach(location => this.boardState[location.col][location.row] = null);
		this.boardState = this.boardState.map(col => col.filter(row => row !== null));
	}

	/**
	 * Removes all puyos above row 12 (0-indexed).
	 */
	trim() {
		this.boardState = this.boardState.map(col => {
			if(col.length > 13) {
				col = col.slice(0, 13);
			}
			return col;
		});
	}

	/**
	 * Finds the nuisance puyos that were popped from the board and returns their locations in an array.
	 */
	findNuisancePopped(chain_locs) {
		const poppedNuisance = [];
		chain_locs.forEach(loc => {
			// Search in all four cardinal directions
			for(let i = -1; i <= 1; i++) {
				for(let j = -1; j <= 1; j++) {
					if(Math.abs(i) + Math.abs(j) !== 1 || !this.validLoc({ col: loc.col + i, row: loc.row + j })) {
						continue;
					}
					if(this.boardState[loc.col + i][loc.row + j] === window.PUYO_COLOURS['Gray']) {
						poppedNuisance.push({ col: loc.col + i, row: loc.row + j });
					}
				}
			}
		});
		return poppedNuisance;
	}

	/**
	 * Drops any active nuisance onto the board.
	 * Returns the number of nuisance puyo dropped.
	 */
	dropNuisance(nuisance) {
		let nuisanceDropped = 0, nuisanceArray = [];

		for(let i = 0; i < this.width; i++) {
			nuisanceArray.push([]);
		}

		// Drop one rock
		if(nuisance >= this.width * 5) {
			nuisanceArray.forEach(col => {
				for(let i = 0; i < 5; i++) {
					col.push(window.PUYO_COLOURS['Gray']);
				}
			});
			nuisanceDropped = 5 * this.width;
			console.log('Dropped a rock.');
		}
		// Drop whatever is remaining
		else {
			const fullRows = Math.floor(nuisance / this.width);
			const remaining = nuisance % this.width;

			// Drop the full rows first
			nuisanceArray.forEach(col => {
				for(let i = 0; i < fullRows; i++) {
					col.push(window.PUYO_COLOURS['Gray']);
				}
			});

			const unusedColumns = [];
			for(let i = 0; i < this.width; i++) {
				unusedColumns.push(i);
			}

			// Randomly drop the remaining nuisance
			for(let i = 0; i < remaining; i++) {
				let column = unusedColumns[Math.floor(Math.random() * unusedColumns.length)];
				nuisanceArray[column].push(window.PUYO_COLOURS['Gray']);
				unusedColumns.splice(unusedColumns.indexOf(column), 1);
			}
			nuisanceDropped = nuisance;
			if(nuisanceDropped > 0) {
				console.log('Dropped ' + nuisance + ' nuisance.');
			}
		}

		// Remove the puyos that are too high
		this.trim();

		return { nuisanceDropped, nuisanceArray };
	}
}
