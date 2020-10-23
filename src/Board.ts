'use strict';

import { Gamemode, Settings } from './utils/Settings';

export class Board {
	settings: Settings;
	height: number;
	width: number;
	boardState: number[][];

	/**
	 * Creates a new board.
	 * @param {Settings}      settings 	 Settings for the board
	 * @param {number[][]}    boardState Optional parameter to use the provided boardState instead of an empty one.
	 */
	constructor(settings: Settings, boardState: number[][] = null) {
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
	checkGameOver(): boolean {
		switch(this.settings.gamemode) {
			case Gamemode.TSU:
				return this.boardState[2].length >= this.height;
			case Gamemode.FEVER:
				return this.boardState[2].length >= this.height || this.boardState[3].length >= this.height;
		}
	}

	/**
	 * Recursive function that searches the entire stack for any chains (recursively).
	 * The board state used is a copy of the game's board state. No puyos are removed from the game's board.
	 *
	 * @param  {Array}  puyos_chained  Array containing arrays of chained puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
	 * @param  {Board}  boardState     The "current" boardstate after previous chaining has been completed
	 * @return {array}                 The complete puyos_chained array
	 */
	resolveChains(puyos_chained: Puyo[][] = [], board = new Board(this.settings, this.boardState)): Puyo[][] {
		// Get all connections of length 4 or more, then delete them and the neighbouring nuisance from the board
		const current_chain_puyos: Puyo[] = board.getConnections(4).flat();
		if(current_chain_puyos.length > 0) {
			// Delete the chained puyos and neighbouring nuisance
			board.deletePuyos(current_chain_puyos.concat(board.findNuisancePopped(current_chain_puyos)));
			puyos_chained.push(current_chain_puyos);
			// Recurse with the new board state and list of chained puyos
			return this.resolveChains(puyos_chained, board);
		}

		// Implicit else: No chains were found in this recursion
		return puyos_chained;
	}

	/* Underlying logic:
	 * 	A visited array is kept of the current board state (as of this recursion).
	 * 	A non-visited puyo is selected as the start position.
	 * 	Only DFS to puyos with the same colour to find the extent of the chain (marking them as visited along the way).
	 * 	Upon reaching a "leaf puyo" (all unvisited neighbours are the wrong colour), the running chain length and location
	 * 		of contained puyos are returned. This is eventually caught by the most recent ancestor that is not a leaf puyo.
	 * 	That ancestor then updates its own running chain length and list of puyo locations and continues the DFS.
	 * 	Eventually, the DFS completes and returns the total chain length and list of puyo locations.
	 * 	A new non-visited puyo is selected as a start position, and repeat until no valid start positions exist.
	 */

	/**
	 * Finds all the connections in the board state. (e.g. [[{puyo}, {puyo}], [{puyo}, {puyo}, {puyo}, {puyo}]])
	 *
	 * 	@param 	{number}	minLength 	The minimum length of a chain
	 * 	@return {Puyo[][]}	    	   	All the connections on the board
	 */
	getConnections(minLength = 0): Puyo[][] {
		const visited: Location[] = [];		// List of visited locations
		const result: Puyo[][] = [];		// List of connections

		// Copy of the board
		const board = new Board(this.settings, this.boardState);

		/**
		 * Performs a DFS through the current board to find the extent of a colour, given a starting puyo.
		 *
		 * @param  {Puyo} 	puyo        	The current puyo
		 * @param  {Puyo[]} chain_puyos 	The running list of puyos contained in the chain.
		 * @return {Puyo[]} 				The final list of puyos.
		 */
		const dfs = function(puyo: Puyo, chain_puyos: Puyo[]): Puyo[] {
			visited.push(puyo);
			const { col, row, colour, connections } = puyo;

			// Search in all 4 cardinal directions
			for(let i = -1; i <= 1; i++) {
				for(let j = -1; j <= 1; j++) {
					const new_puyo = { col: col + i, row: row + j, colour: null, connections: [] } as Puyo;

					if(Math.abs(i) + Math.abs(j) === 1 && board.validLoc(new_puyo)) {
						new_puyo.colour = board.boardState[col + i][row + j];

						// Add connections if same colour puyo
						if(colour === new_puyo.colour) {
							// Do not add the same connection twice
							if(!connections.includes(getDirection(i, j))) {
								new_puyo.connections.push(getDirection(-i, -j));
								connections.push(getDirection(i, j));
							}

							// DFS from new puyo if unvisited
							if(notVisited(new_puyo)) {
								chain_puyos.push(new_puyo);

								// Update with the leaf puyo of this branch
								chain_puyos = dfs(new_puyo, chain_puyos);
							}
						}
					}
				}
			}
			// Done with all branches, return the findings
			return chain_puyos;
		};

		/**
		 * Determines if the visited array contains the passed location.
		 */
		const notVisited = function(location: Location) {
			const { col, row } = location;
			return visited.filter(loc => loc.col === col && loc.row === row).length === 0;
		};

		/**
		 * Determines the connected direction of puyos from x and y translation.
		 */
		const getDirection = function(x, y) {
			if(x === 0) {
				return y === -1 ? 'Down' : 'Up';
			}
			else if(y === 0) {
				return x === -1 ? 'Left' : 'Right';
			}
		};

		// Iterate through the entire board to find all starting points
		for(let i = 0; i < board.boardState.length; i++) {
			for(let j = 0; j < board.boardState[i].length; j++) {
				const puyo = { col: i, row: j, colour: board.boardState[i][j], connections: [] } as Puyo;

				if(notVisited(puyo)) {
					let chain_puyos: Puyo[];
					if(puyo.colour === 0) {
						// Force nuisance to only connect to itself
						chain_puyos = [puyo];
					}
					else {
						// Find the extent of this colour, starting here
						chain_puyos = dfs(puyo, [puyo]);
					}
					if(chain_puyos.length >= minLength) {
						result.push(chain_puyos);
					}
				}
			}
		}
		return result;
	}

	/**
	 * Determines if a potential location is valid.
	 * @param 	{Location}	loc 	The board location
	 */
	validLoc(loc: Location): boolean {
		const { col, row } = loc;
		return col >= 0 &&
			row >= 0 &&
			col < this.width &&
			row < this.height &&
			this.boardState[col][row] !== undefined;
	}

	/**
	 * Removes the puyos in the locations provided.
	 * @param 	{Puyo[]}	puyoLocs	The puyos to be removed
	 */
	deletePuyos(puyoLocs: Puyo[] = []): void {
		// First, set them all to null. Then filter out the null elements
		puyoLocs.forEach(location => this.boardState[location.col][location.row] = null);
		this.boardState = this.boardState.map(col => col.filter(row => row !== null));
	}

	/**
	 * Removes all puyos above row 12 (0-indexed).
	 */
	trim(): void {
		this.boardState = this.boardState.map(col => {
			if(col.length > this.height + 1) {
				col = col.slice(0, this.height + 1);
			}
			return col;
		});
	}

	/**
	 * Finds the nuisance puyos that were popped from the board.
	 * @param 	{Puyo[]}	chain_locs	The popped puyos
	 * @return 	{Puyo[]}				The newly popped nuisance
	 */
	findNuisancePopped(chain_locs: Puyo[]): Puyo[] {
		const poppedNuisance: Puyo[] = [];
		chain_locs.forEach(loc => {
			// Search in all four cardinal directions
			for(let i = -1; i <= 1; i++) {
				for(let j = -1; j <= 1; j++) {
					if(Math.abs(i) + Math.abs(j) !== 1 || !this.validLoc({ col: loc.col + i, row: loc.row + j } as Location)) {
						continue;
					}
					if(this.boardState[loc.col + i][loc.row + j] === 0) {
						poppedNuisance.push({ col: loc.col + i, row: loc.row + j, colour: 0 } as Puyo);
					}
				}
			}
		});
		return poppedNuisance;
	}

	/**
	 * Drops active nuisance onto the board.
	 * @param  {number}        nuisance 	Number of nuisance puyos to drop
	 * @return {NuisanceState}          	The nuisanceState of the dropped nuisance
	 */
	dropNuisance(nuisance: number): NuisanceState {
		let nuisanceAmount = 0;
		const nuisanceArray: number[][] = [];

		for(let i = 0; i < this.width; i++) {
			nuisanceArray.push([]);
		}

		// Drop one rock
		if(nuisance >= this.width * 5) {
			nuisanceArray.forEach(col => {
				for(let i = 0; i < 5; i++) {
					col.push(0);
				}
			});
			nuisanceAmount = 5 * this.width;
		}
		// Drop whatever is remaining
		else {
			const fullRows = Math.floor(nuisance / this.width);
			const remaining = nuisance % this.width;

			// Drop the full rows first
			nuisanceArray.forEach(col => {
				for(let i = 0; i < fullRows; i++) {
					col.push(0);
				}
			});

			const unusedColumns: number[] = [];
			for(let i = 0; i < this.width; i++) {
				unusedColumns.push(i);
			}

			// Randomly drop the remaining nuisance
			for(let i = 0; i < remaining; i++) {
				const column = unusedColumns[Math.floor(Math.random() * unusedColumns.length)];
				nuisanceArray[column].push(0);
				unusedColumns.splice(unusedColumns.indexOf(column), 1);
			}
			nuisanceAmount = nuisance;
		}

		// Remove the puyos that are too high
		this.trim();

		return { nuisanceAmount, nuisanceArray };
	}
}
