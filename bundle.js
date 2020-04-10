(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

const { PUYO_COLOURS } = require('./Utils.js');

class Board {
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

				if(notVisited(puyo) && puyo.colour !== PUYO_COLOURS['Gray']) {
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
					if(this.boardState[loc.col + i][loc.row + j] === PUYO_COLOURS['Gray']) {
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
					col.push(PUYO_COLOURS['Gray']);
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
					col.push(PUYO_COLOURS['Gray']);
				}
			});

			const unusedColumns = [];
			for(let i = 0; i < this.width; i++) {
				unusedColumns.push(i);
			}

			// Randomly drop the remaining nuisance
			for(let i = 0; i < remaining; i++) {
				let column = unusedColumns[Math.floor(Math.random() * unusedColumns.length)];
				nuisanceArray[column].push(PUYO_COLOURS['Gray']);
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

module.exports = { Board };

},{"./Utils.js":9}],2:[function(require,module,exports){
'use strict';

const { Drop } = require('./Drop.js');
const { PUYO_COLOURS, COLOUR_LIST, PUYO_EYES_COLOUR } = require('./Utils.js');

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
    constructor() {
    }
    drawPuyo(colour, size) {
        let ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.translate(- size / 5, - size / 10);
        ctx.beginPath();
        ctx.arc(0, 0, size / 5, 0, 2 * Math.PI);
        ctx.translate(2 * size / 5, 0);
        ctx.arc(0, 0, size / 5, 0, 2 * Math.PI);
        ctx.fillStyle = PUYO_EYES_COLOUR;
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(- size / 6, - size / 13);
        ctx.beginPath();
        ctx.arc(0, 0, size / 8, 0, 2 * Math.PI);
        ctx.translate(2 * size / 6, 0);
        ctx.arc(0, 0, size / 8, 0, 2 * Math.PI);
        ctx.fillStyle = colour;
        ctx.fill();
        ctx.restore();
    }
    drawDrop(drop, size) {
        if ("IhLHO".includes(drop.shape)) {
            this["draw_" + drop.shape](drop, size);
        }
    }
    draw_I(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_h(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_L(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        this.drawPuyo(drop.colours[0], size);
        ctx.translate(size * Math.cos(drop.standardAngle + Math.PI / 2), - size * Math.sin(drop.standardAngle + Math.PI / 2));
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(size * Math.cos(drop.standardAngle), - size * Math.sin(drop.standardAngle));
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
    }

    draw_H(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
        let yChange = size / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);
        ctx.translate(- xChange, - yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        this.drawPuyo(drop.colours[1], size);
        ctx.restore();
    }

    draw_O(drop, size) {
        let ctx = this.ctx;
        ctx.save();
        let xChange = size / 2;
        let yChange = size / 2;
        ctx.translate(- xChange, - yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(- yChange, xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(xChange, yChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
        ctx.save();
        ctx.translate(yChange, - xChange);
        this.drawPuyo(drop.colours[0], size);
        ctx.restore();
    }
}

/**
 * The drawer for the main area of the game.
 */
class BoardDrawer extends DrawerWithPuyo {
    constructor(settings, boardNum) {
        super();
        this.board = document.getElementById("board" + boardNum);
        this.ctx = this.board.getContext("2d");
        this.settings = settings;
        this.poppingPuyos = [];
        this.colourArray = [];
        for (let i = 0; i < COLOUR_LIST.length; i++) {
            this.colourArray.push(PUYO_COLOURS[COLOUR_LIST[i]]);
        }
        this.nuisanceCascadeFPR = [];
    }

    drawPopping(colour, size, frame, totalFrames) {
        this.drawPuyo(colour, size * (1 - frame / totalFrames));
    }

    updateBoard(currentBoardState) {
        // Get current information about what to draw and get current width and height in case of resizing
        const {boardState, currentDrop} = currentBoardState;
        const {width, height} = this.board;
        const {cols, rows} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                if (boardState[i][j]) {
                    ctx.save();
                    ctx.translate(unitW * i, - unitH * j);
                    this.drawPuyo(boardState[i][j], unitW);
                    ctx.restore();
                }
            }
        }

        if (currentDrop.schezo.y != null) {
            ctx.save();
            ctx.translate(unitW * currentDrop.arle.x, - unitH * currentDrop.arle.y);
            this.drawPuyo(currentDrop.colours[0], unitW);
            ctx.restore();
            ctx.translate(unitW * currentDrop.schezo.x, - unitH * currentDrop.schezo.y);
            this.drawPuyo(currentDrop.colours[1], unitW);
        } else {
            ctx.translate(unitW * currentDrop.arle.x, - unitH * currentDrop.arle.y);
            this.drawDrop(currentDrop, unitW);
        }

        // Restore origin to top left
        ctx.restore();
    }
    resolveChains(boardState, resolvingState) {
        // Get current information and assign it to convenient variables
        const {width, height} = this.board;
        const {cols, rows, popFrames, dropFrames} = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        if (resolvingState.currentFrame == 1) {
            this.poppingPuyos = [];
            for (let i = 0; i < cols; i++) {
                this.poppingPuyos.push([]);
            }
            for (let i = resolvingState.puyoLocs.length - 1; i >= 0; i--) {
                this.poppingPuyos[resolvingState.puyoLocs[i].col][resolvingState.puyoLocs[i].row] = true;
            }
            for (let i = resolvingState.nuisanceLocs.length - 1; i >= 0; i--) {
                this.poppingPuyos[resolvingState.nuisanceLocs[i].col][resolvingState.nuisanceLocs[i].row] = true;
            }
        }

        ctx.clearRect(0, 0, width, height);

        ctx.save();

        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);
        // Draw the stack in the pre-pop positions, with some puyo mid pop
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows + 1; j++) {
                    if (boardState[i][j] != null && this.poppingPuyos[i][j] == null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                    }
                }
            }
        }
        if (resolvingState.currentFrame <= this.settings.popFrames) {
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows + 1; j++) {
                    if (this.poppingPuyos[i][j] != null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * j);
                        this.drawPopping(boardState[i][j], unitW, resolvingState.currentFrame, popFrames);
                        ctx.restore();
                    }
                }
            }
        }
        // Draw the stack dropping with the popped puyos gone
        else {
            for (let i = 0; i < cols; i++) {
                let numUnder = 0;
                while (boardState[i][numUnder] != null && this.poppingPuyos[i][numUnder] == null) {
                    ctx.save();
                    ctx.translate(unitW * i, - unitH * numUnder);
                    this.drawPuyo(boardState[i][numUnder], unitW);
                    ctx.restore();
                    numUnder++;
                }
                for (let j = numUnder + 1; j < boardState[i].length; j++) {
                    if (boardState[i][j] != null && this.poppingPuyos[i][j] == null) {
                        ctx.save();
                        ctx.translate(unitW * i, - unitH * (Math.max(j - (j - numUnder) * (resolvingState.currentFrame - popFrames) / dropFrames, numUnder)));
                        this.drawPuyo(boardState[i][j], unitW);
                        ctx.restore();
                        numUnder++;
                    }
                }
            }
        }
        ctx.restore();
    }

    initNuisanceDrop(nuisanceCascadeFPR) {
        this.nuisanceCascadeFPR = nuisanceCascadeFPR;
    }

    dropNuisance(boardState, nuisanceState) {
        const { nuisanceArray, currentFrame } = nuisanceState;
        const { width, height } = this.board;
        const { cols, rows } = this.settings;
        const unitW = width / cols;
        const unitH = height / rows;
        let ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        // Save a canvas with the origin at the top left (every save coupled with a restore)
        ctx.save();

        // Move the canvas with the origin at the middle of the bottom left square
        ctx.translate(0.5 * unitW, (rows - 0.5) * unitH);

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                ctx.save();
                ctx.translate(unitW * i, - unitH * j);
                this.drawPuyo(boardState[i][j], unitW);
                ctx.restore();
            }
            const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
            const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
            for (let j = 0; j < nuisanceArray[i].length; j++) {
                ctx.save();
                ctx.translate(unitW * i, - unitH * (this.settings.nuisanceSpawnRow - rowsDropped + j));
                this.drawPuyo(PUYO_COLOURS['Gray'], unitW);
                ctx.restore();
            }
        }

        // Restore origin to top left
        ctx.restore();
    }

    drawFromHash(hash) {
        let splitHash = hash.split(":");
        switch (splitHash[0]) {
            case "0": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                let dropArray = splitHash[2].split(",");
                let arle = { x: dropArray[3], y: dropArray[4] };
                let schezo = { x: dropArray[5] == "n" ? null : dropArray[5], y: dropArray[6] == "n" ? null : dropArray[6] };
                let currentDrop = new Drop(
                    dropArray[0],
                    [this.colourArray[dropArray[1]], this.colourArray[dropArray[2]]],
                    null,
                    arle,
                    schezo,
                    dropArray[7] * 2 * Math.PI,
                    dropArray[8]);
                return this.updateBoard({ boardState, currentDrop });
            }
            case "1": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                let resolvingStateArray = splitHash[2].split(",")
                let puyoLocs = [];
                let puyoLocCols = resolvingStateArray[1].split(">");
                let puyoLocRows = resolvingStateArray[2].split(">");
                for (let i = 0; i < puyoLocCols.length - 1; i++) { // excess delimiter in hash causes off-by-one error due to a tailing ">" creating an undefined last element
                    puyoLocs.push({ col: puyoLocCols[i], row: puyoLocRows[i] });
                }
                let nuisanceLocs = [];
                let nuisanceLocCols = resolvingStateArray[3].split(">");
                let nuisanceLocRows = resolvingStateArray[4].split(">");
                for (let i = 0; i < nuisanceLocCols.length - 1; i++) { // excess delimiter in hash causes off-by-one error due to a tailing ">" creating an undefined last element
                    nuisanceLocs.push({ col: nuisanceLocCols[i], row: nuisanceLocRows[i] });
                }

                return this.resolveChains(boardState,
                    {
                        chain: resolvingStateArray[0],
                        puyoLocs,
                        nuisanceLocs,
                        currentFrame: resolvingStateArray[5],
                        totalFrames: resolvingStateArray[6]
                    }
                );
            }
            case "2": {
                return this.initNuisanceDrop(splitHash[1].split(","));
            }
            case "3": {
                let boardState = [];
                let boardStateCols = splitHash[1].split(",");
                for (let i = 0; i < this.settings.cols; i++) {
                    boardState.push([]);
                    for (let j = 0; j < boardStateCols[i].length; j++) {
                        boardState[i].push(this.colourArray[boardStateCols[i][j]]);
                    }
                }
                const nuisanceState = {
                    nuisanceArray: splitHash[2].split(",").map(col => col ? col.split(">").map(num => this.colourArray[num]) : []),
                    nuisanceAmount: Number(splitHash[3]),
                    currentFrame: Number(splitHash[4]),
                    totalFrames: Number(splitHash[5])
                };
                return this.dropNuisance(boardState, nuisanceState);
            }
            default:
        }
    }

    hashForUpdate(currentBoardState) {
        const {boardState, currentDrop} = currentBoardState;

        let hash = "0:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += currentDrop.shape + ","; // 0: shape
        hash += this.colourArray.indexOf(currentDrop.colours[0]) + ","; // 1: colour 1
        hash += this.colourArray.indexOf(currentDrop.colours[1]) + ","; // 2: colour 2
        hash += currentDrop.arle.x + ","; // 3: arle x
        hash += Math.round(currentDrop.arle.y * this.settings.hashSnapFactor) / this.settings.hashSnapFactor + ","; // 4: arle y (rounded)
        // 5 and 6: schezo x and rounded y
        if (currentDrop.schezo.y == null) {
            hash += "n,n,"
        } else {
            hash += currentDrop.schezo.x + ",";
            hash += Math.round(currentDrop.schezo.y * this.settings.hashSnapFactor) / this.settings.hashSnapFactor + ",";
        }
        hash += Math.round(currentDrop.standardAngle / Math.PI / 2 * this.settings.hashRotFactor) / this.settings.hashRotFactor + ","; // 7: angle in rev rounded to nearest gradian
        hash += currentDrop.rotating; // 8: rotating
        return hash;
    }
    hashForResolving(boardState, resolvingState) {
        let hash = "1:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += resolvingState.chain + ","; // 0: chain
        // 1: puyoLoc cols
        for (let i = 0; i < resolvingState.puyoLocs.length; i++) {
            hash += resolvingState.puyoLocs[i].col + ">";
        }
        hash += ",";
        // 2: puyoLoc rows
        for (let i = 0; i < resolvingState.puyoLocs.length; i++) {
            hash += resolvingState.puyoLocs[i].row + ">";
        }
        hash += ",";
        // 3: nuisanceLoc cols
        for (let i = 0; i < resolvingState.nuisanceLocs.length; i++) {
            hash += resolvingState.nuisanceLocs[i].col + ">";
        }
        hash += ",";
        // 4: nuisanceLoc rows
        for (let i = 0; i < resolvingState.nuisanceLocs.length; i++) {
            hash += resolvingState.nuisanceLocs[i].row + ">";
        }
        hash += ",";
        hash += resolvingState.currentFrame + ","; // 5: current frame
        hash += resolvingState.totalFrames; // 6: total frames
        return hash;
    }

    hashForNuisanceInit(nuisanceCascadeFPR) {
        return "2:" + nuisanceCascadeFPR.join(",");
    }

    hashForNuisance(boardState, nuisanceState) {
        let hash = "3:";
        for (let i = 0; i < boardState.length; i++) {
            for (let j = 0; j < boardState[i].length; j++) {
                hash += this.colourArray.indexOf(boardState[i][j]);
            }
            hash += ",";
        }
        hash += ":";
        hash += nuisanceState.nuisanceArray.map(col => col.map(puyo => this.colourArray.indexOf(puyo)).join(">")).join(",") + ":";
        hash += nuisanceState.nuisanceAmount + ":";
        hash += nuisanceState.currentFrame + ":";
        hash += nuisanceState.totalFrames;
        return hash;
    }
}

module.exports = { BoardDrawer };

},{"./Drop.js":5,"./Utils.js":9}],3:[function(require,module,exports){
'use strict';

const { Board } = require('./Board.js');
const { PUYO_COLOURS } = require('./Utils.js');

class Cpu {
	constructor(settings) {
		if(this.constructor === Cpu) {
			throw new Error('Abstract class cannot be instatiated.');
		}
		this.settings = settings;
	}

	assignSettings(settings) {
		this.settings = settings;
	}

	/**
	 * Returns the optimal move according to the AI.
	 */
	/* eslint-disable-next-line no-unused-vars*/
	getMove(boardState, currentDrop) {
		throw new Error('getMove(boardState, currentDrop) must be implemented by the subclass.');
	}

	getAverageHeight(boardState) {
		return boardState.reduce((sum, col) => sum += col.length, 0) / this.settings.cols;
	}

	/**
	 * Returns the best column placement with either 0 or 2 rotations that makes a chain longer than minChain.
	 * If none exist, returns -1.
	 */
	checkForSimpleChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let col = -1;
		for(let i = 0; i < this.settings.cols * 2; i++) {
			const currCol = Math.floor(i / 2);
			const board = new Board(this.settings, boardState);
			if(i % 2 === 0) {
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
			}
			else {
				board.boardState[currCol].push(currentDrop.colours[1]);
				board.boardState[currCol].push(currentDrop.colours[0]);
			}

			const chains = board.resolveChains();
			if(chains.length > runningMaxChain) {
				runningMaxChain = chains.length;
				col = currCol;
			}
		}
		return col;
	}

	/**
	 * Returns the move that results in the best chain longer than minChain.
	 * If none exist, returns { col: -1, rotations: -1 };
	 */
	checkForAllChains(boardState, currentDrop, minChain) {
		let runningMaxChain = minChain;
		let col = -1;
		let rotations = -1;
		for(let i = 0; i < this.settings.cols * 4; i++) {
			const currCol = i % this.settings.cols;
			const board = new Board(this.settings, boardState);
			let tempRotations;
			if(i < this.settings.cols) {
				board.boardState[currCol].push(currentDrop.colours[1]);
				board.boardState[currCol].push(currentDrop.colours[0]);
				tempRotations = 2;
			}
			else if(i < this.settings.cols * 2) {
				if(currCol === 0) {
					continue;
				}
				board.boardState[currCol - 1].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
				tempRotations = -1;
			}
			else if(i < this.settings.cols * 3) {
				if(currCol === this.settings.cols - 1) {
					continue;
				}
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol + 1].push(currentDrop.colours[1]);
				tempRotations = 1;
			}
			else {
				board.boardState[currCol].push(currentDrop.colours[0]);
				board.boardState[currCol].push(currentDrop.colours[1]);
				tempRotations = 0;
			}

			const chains = board.resolveChains();
			if(chains.length > runningMaxChain) {
				runningMaxChain = chains.length;
				col = currCol;
				rotations = tempRotations;
			}
		}
		return { col, rotations };
	}

	static fromString(ai, settings) {
		switch(ai) {
			case 'Random':
				return new RandomCpu(settings);
			case 'Flat':
				return new FlatCpu(settings);
			case 'Tall':
				return new TallCpu(settings);
			case 'Chain':
				return new ChainCpu(settings);
			default:
				return new TestCpu(settings);
		}
	}
}


/**
 * RandomCpu: Completely random moves.
 */
class RandomCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	// eslint-disable-next-line no-unused-vars
	getMove(boardState, currentDrop) {
		let col = Math.floor(Math.random() * this.settings.cols);
		let rotations = Math.floor(Math.random() * 4) - 2;
		return { col, rotations };
	}
}

/**
 * FlatCpu: stacks horizontally
 */
class FlatCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	getMove(boardState, currentDrop) {
		let col = 0;
		let rotations = 0;
		let minHeight = -1;
		for(let i = 0; i < this.settings.cols - 1; i++) {
			if(boardState[i].length < minHeight) {
				minHeight = boardState[i].length;
				col = i;
			}
		}

		col = super.checkForSimpleChains(boardState, currentDrop, 0);

		return { col, rotations };
	}
}

/**
 * TallCpu: stacks the right side, then the left side
 */
class TallCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	getMove(boardState, currentDrop) {
		let col = this.settings.cols - 1;
		let rotations = 0;
		// Attempt to place on the right side of the board
		while(boardState[col].length >= this.settings.rows - 1 && col > 2) {
			col--;
		}
		// Attempt to place on the left side of the board
		if(col === 2) {
			col = 0;
			while(boardState[col].length >= this.settings.rows - 1 && col < 2) {
				col++;
			}
		}

		// Only column 2 left
		if(col === 2) {
			const noRotationBoard = new Board(this.settings, boardState);
			noRotationBoard.boardState[2].push(currentDrop.colours[0]);
			noRotationBoard.boardState[2].push(currentDrop.colours[1]);
			const noRotationChains = noRotationBoard.resolveChains();

			const yesRotationBoard = new Board(this.settings, boardState);
			yesRotationBoard.boardState[2].push(currentDrop.colours[1]);
			yesRotationBoard.boardState[2].push(currentDrop.colours[0]);
			const yesRotationChains = yesRotationBoard.resolveChains();

			if(yesRotationChains.length > noRotationChains.length) {
				rotations = 2;
			}
		}

		return { col, rotations };
	}
}

/**
 * ChainCpu: Goes for the longest possible chain result given the current drop.
 * Otherwise, places randomly.
 */
class ChainCpu extends Cpu {
	constructor(settings) {
		super(settings);
	}

	getMove(boardState, currentDrop) {
		let col = Math.floor(Math.random() * this.settings.cols);
		let rotations = 0;

		// Deter against random placements in column 2 (when 0-indexed)
		while(col === 2) {
			col = Math.floor(Math.random() * this.settings.cols);
		}

		col = super.checkForSimpleChains(boardState, currentDrop, 1);

		return { col, rotations };
	}
}

/**
 * TestCpu: ChainCPU, but instead of placing randomly it attempts to connect a colour.
 */
class TestCpu extends Cpu {
	constructor(settings, speed) {
		super(settings, speed);
	}

	getMove(boardState, currentDrop) {
		const averageHeight = super.getAverageHeight(boardState);
		let minChain = (averageHeight > this.settings.rows * 3 / 4) ? 0 :
							(averageHeight > this.settings.rows / 2) ? 2 :
							(averageHeight > this.settings.rows / 2) ? 3 : 4;

		let { col, rotations} = super.checkForAllChains(boardState, currentDrop, minChain);

		// Unable to find an appropriate chain
		if(col === -1) {
			let maxValue = -1;

			for(let i = 0; i < this.settings.cols * 4; i++) {
				const currCol = i % this.settings.cols;
				const board = new Board(this.settings, boardState);
				let tempRotations;
				if(i < this.settings.cols) {
					board.boardState[currCol].push(currentDrop.colours[1]);
					board.boardState[currCol].push(currentDrop.colours[0]);
					tempRotations = 2;
				}
				else if(i < this.settings.cols * 2) {
					if(currCol === 0) {
						continue;
					}
					board.boardState[currCol - 1].push(currentDrop.colours[1]);
					board.boardState[currCol].push(currentDrop.colours[0]);
					tempRotations = -1;
				}
				else if(i < this.settings.cols * 3) {
					if(currCol === this.settings.cols - 1) {
						continue;
					}
					board.boardState[currCol].push(currentDrop.colours[0]);
					board.boardState[currCol + 1].push(currentDrop.colours[1]);
					tempRotations = 1;
				}
				else {
					board.boardState[currCol].push(currentDrop.colours[0]);
					board.boardState[currCol].push(currentDrop.colours[1]);
					tempRotations = 0;
				}

				let deterrent = (currCol === 2) ? boardState[2].length : this.getSkyScraperValue(board, currCol);

				const value = this.evaluateBoard(board) - deterrent;

				if(value > maxValue) {
					col = currCol;
					maxValue = value;
					rotations = tempRotations;
				}
			}
		}

		// Still cannot find an appropriate placement, so place semi-randomly
		if(col === -1)  {
			const allowedCols = [0, 5];
			for(let i = 0; i < this.settings.cols; i++) {
				if(i !== 0 && i !== this.settings.cols - 1) {
					if((boardState[i].length - boardState[i-1].length) + (boardState[i].length - boardState[i+1].length) < 3) {
						allowedCols.push(i);
					}
				}
			}

			col = allowedCols[Math.floor(Math.random() * allowedCols.length)];

			// Deter against random placements in column 2 (when 0-indexed)
			if(col === 2) {
				col = Math.floor(Math.random() * this.settings.cols);
			}
		}

		return { col, rotations };
	}

	getSkyScraperValue(board, col) {
		const boardState = board.boardState;
		let value = 2 * boardState[col].length;
		if(col !== 0) {
			value -= boardState[col - 1].length;
		}
		if(col !== this.settings.cols - 1) {
			value -= boardState[col + 1].length;
		}
		return value / 2;
	}

	evaluateBoard(board) {
		const visited = [];				// List of visited locations
		let value = 0;

		/**
		 * Performs a DFS through the current board to find the extent of a colour, given a starting puyo.
		 *
		 * @param  {object} puyo        	The current puyo, given as {col: number, row: number, colour: rgba value}
		 * @param  {number} colour_length   The running length of the puyo chain.
		 * @return {object}                 The branch's result, given as {length: colour_length, puyos: chain_puyos}.
		 */
		const dfs = function(puyo, colour_length) {
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
							// Update with the leaf puyo of this branch
							const length = dfs(new_puyo, colour_length + 1);
							colour_length = length;
						}
					}
				}
			}
			// Done with all branches, return the findings
			return colour_length;
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

				if(notVisited(puyo) && puyo.colour !== PUYO_COLOURS['Gray']) {
					// Find the extent of this colour, starting here
					const length = dfs(puyo, 1, [puyo]);
					if(length < 4) {
						value += length * length;
					}
				}
			}
		}
		return value;
	}
}

module.exports = {
	RandomCpu,
	TallCpu,
	FlatCpu,
	ChainCpu,
	TestCpu
}

},{"./Board.js":1,"./Utils.js":9}],4:[function(require,module,exports){
'use strict';

const { Game } = require('./Game.js');
const { UserSettings } = require('./Utils.js');

class CpuGame extends Game {
	constructor(gameId, opponentIds, socket, boardDrawerId, ai, speed, settings) {
		super(gameId, opponentIds, socket, boardDrawerId, settings, new UserSettings());

		this.ai = ai;					// The algorithm used to determine the optimal move
		this.ai.assignSettings(this.settings);
		this.softDropSpeed = speed;				// Number of milliseconds to wait before soft dropping
		this.movementSpeed = speed / 8;		// Number of milliseconds to wait before performing a move
		this.currentMove = null;		// The current optimal move
		this.rotations = 0;				// Rotations performed on the current drop (between -2 and 2)
		this.lastArle = null;			// The location of the arle in the last frame (used to detect whether a drop is stuck)

		this.softDropTimer = Date.now();		// Timer to measure milliseconds before soft drop
		this.movementTimer = Date.now();		// Timer to measure milliseconds before movement
	}

	/**
	 * @Override
	 * Apply an input for the CPU. Used to get the current drop to the optimal move position.
	 */
	getInputs() {
		if(this.currentMove === null) {
			this.currentMove = this.ai.getMove(this.board.boardState, this.currentDrop);
		}

		// Do not move/rotate if movement timer is not fulfilled
		if(Date.now() - this.movementTimer < this.movementSpeed) {
			return;
		}

		let applied = false;
		const { col, rotations } = this.currentMove;

		// Move drop to correct column
		if(this.currentDrop.arle.x < col) {
			this.move('Right');
			applied = true;
		}
		else if(this.currentDrop.arle.x > col) {
			this.move('Left');
			applied = true;
		}

		// Perform correct amount of rotations
		if(this.currentDrop.rotating === 'not') {
			if(this.rotations < rotations) {
				this.rotate('CW');
				this.rotations++;
				applied = true;
			}
			else if(this.rotations > rotations) {
				this.rotate('CCW');
				this.rotations--;
				applied = true;
			}
		}

		// If action was taken, reset the movement timer
		if(applied) {
			this.movementTimer = Date.now();
		}

		// If no action needs to be taken or the drop is stuck, soft drop
		if(!applied || (this.lastArle !== null && JSON.stringify(this.currentDrop.arle) === JSON.stringify(this.lastArle))) {
			// Must also meet speed threshold
			if(Date.now() - this.softDropTimer > this.softDropSpeed) {
				this.move('Down');
			}
		}

		this.lastArle = Object.assign(this.currentDrop.arle);
	}

	/**
	 * After locking a drop, also reset the currentMove and timer.
	 */
	lockDrop() {
		super.lockDrop();
		this.currentMove = null;
		this.rotations = 0;
		this.softDropTimer = Date.now();
	}
}

module.exports = { CpuGame };

},{"./Game.js":6,"./Utils.js":9}],5:[function(require,module,exports){
'use strict';

const { Utils } = require('./Utils.js');

class Drop {
	constructor (shape, colours, settings, arle = { x: 2, y: 11.5 }, schezo = { x: null, y: null }, standardAngle = 0, rotating = 'not') {
		this.shape = shape;
		this.colours = colours;
		this.settings = settings;
		this.arle = arle;
		this.schezo = schezo;
		this.standardAngle = standardAngle;
		this.rotating = rotating;

		// Special counter to determine the stage of 180 rotation. 2 is 'first half', 1 is 'second half', 0 is 'not'.
		this.rotating180 = 0;
	}

	/**
	 * Returns a new, random drop determined by the gamemode and the player's dropset.
	 */
	static getNewDrop(settings, colours) {
		let shape;
		if(settings.gamemode === 'Tsu') {
			shape = 'I';
		}
		else {
			// Get the shape from the dropset
			shape = settings.dropset[settings.dropset_position];
			settings.dropset_position++;

			// Check if the end of the dropset has been reached
			if(settings.dropset_position == 17) {
				settings.dropset_position = 1;
			}
		}

		// Returns an array of colours based on the shape of the drop
		const getPuyosFromShape = function (shape) {
			const first_col = (colours && colours[0]) || Utils.getRandomColour(settings.numColours);
			const second_col = (colours && colours[1]) || Utils.getRandomColour(settings.numColours);
			switch(shape) {
				case 'I':
					return [first_col, second_col];
				case 'h':
					return [first_col, first_col, second_col];
				case 'L':
					return [first_col, second_col, second_col];
				case 'H':
					return [first_col, first_col, second_col, second_col];
				case 'O':
					return [first_col, first_col, first_col, first_col];
			}
		}
		return new Drop(shape, getPuyosFromShape(shape), settings);
	}

	/**
	 * Returns a new, identical Drop.
	 *
	 * NOTE: The settings object only uses a shallow copy.
	 * However, it should not be able to be modified during a game.
	 */
	copy() {
		return new Drop(
			this.shape,
			this.colours.slice(),
			this.settings,
			Utils.objectCopy(this.arle),
			Utils.objectCopy(this.schezo),
			this.standardAngle,
			this.rotating);
	}

	/**
	 * Moves a Drop. Validation is done before calling this method.
	 */
	shift(direction, amount = 1) {
		switch(direction) {
			case 'Left':
				this.arle.x -= amount;
				break;
			case 'Right':
				this.arle.x += amount;
				break;
			case 'Down':
				this.arle.y -= this.settings.softDrop;
				if(this.arle.y < 0) {
					this.arle.y = 0;
				}
				break;
			case 'Up':
				this.arle.y += amount;
		}
	}

	/**
	 * Rotates a Drop. Validation is done before calling this method.
	 */
	rotate(direction, angle) {
		if(angle === 180) {
			this.rotating180 = 2;
		}
		this.rotating = direction;
	}

	/**
	 * Applies the effect of gravity to the Drop. Validation is done before calling this method.
	 */
	affectGravity() {
		this.arle.y -= this.settings.gravity;
	}

	/**
	 * Applies rotation, which is done on a frame-by-frame basis. Validation is done before calling this method.
	 * The arle's standard angle must be between 0 and 2*PI.
	 * The drop will stop rotating once its standard angle reaches an integer multiple of PI/2 radians (unless it is 180 rotating).
	 */
	affectRotation() {
		let angleToRotate;
		if(this.rotating == 'CW') {
			angleToRotate = -Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else if(this.rotating == 'CCW') {
			angleToRotate = Math.PI / (2 * this.settings.frames_per_rotation);
		}
		else {
			// not rotating
			return;
		}

		if(this.rotating180 > 0) {
			angleToRotate *= 2;
		}

		this.standardAngle += angleToRotate;

		// Remain within domain
		if(this.standardAngle >= 2 * Math.PI) {
			this.standardAngle -= 2 * Math.PI;
		}
		else if(this.standardAngle < 0) {
			this.standardAngle += 2 * Math.PI;
		}

		// Check if reached a right angle
		if(Math.round(this.standardAngle * 10000) % Math.round(Math.PI  * 5000) < 0.01) {
			if(this.rotating180 === 2) {
				// Begin rotating the second set of PI/2 radians
				this.rotating180 = 1;
				return;
			}
			// Rotation has finished
			this.rotating = 'not';
			this.rotating180 = 0;
		}
	}

	/**
	 * Immediately finishes the rotation of a drop (if needed), instead of waiting the required number of frames.
	 * Called when the Drop is locked into place, as due to rotation it may be misaligned.
	 * This function snaps the Drop to the grid (if needed), making it easy to lock and add to the stack.
	 */
	finishRotation() {
		if(this.rotating === 'not') {
			return;
		}
		const cw = (this.rotating === 'CW');
		if(this.standardAngle < Math.PI / 2) {			// quadrant 1
			this.standardAngle = cw ? 0 : Math.PI/2;
		}
		else if(this.standardAngle < Math.PI) {			// quadrant 2
			this.standardAngle = cw ? Math.PI/2 : Math.PI;
		}
		else if(this.standardAngle < 3/2 * Math.PI) {	// quadrant 3
			this.standardAngle = cw ? Math.PI : 3/2 * Math.PI;
		}
		else {											// quadrant 4
			this.standardAngle = cw ? 3/2 * Math.PI : 0;
		}
	}
}

module.exports = { Drop };

},{"./Utils.js":9}],6:[function(require,module,exports){
'use strict';

const { Board } = require('./Board.js');
const { BoardDrawer } = require('./BoardDrawer.js');
const { Utils, AudioPlayer, DropGenerator } = require('./Utils.js');

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

		this.dropGenerator = new DropGenerator(this.settings);
		this.dropQueue = this.dropGenerator.requestDrops(0).map(drop => drop.copy());
		this.dropQueueIndex = 1;
		this.dropQueueSetIndex = 1;

		this.leftoverNuisance = 0;		// Leftover nuisance (decimal between 0 and 1)
		this.visibleNuisance = {};		// Dictionary of { gameId: amount } of received nuisance
		this.activeNuisance = 0;		// Active nuisance
		this.lastRotateAttempt = {};	// Timestamp of the last failed rotate attempt
		this.resolvingChains = [];		// Array containing arrays of chaining puyos [[puyos_in_chain_1], [puyos_in_chain_2], ...]
		this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };
		this.nuisanceState = { nuisanceArray: [], nuisanceAmount: 0, currentFrame: 0, totalFrames: 0 };
		this.squishState = { currentFrame: -1 };

		this.boardDrawerId = boardDrawerId;
		this.boardDrawer = new BoardDrawer(this.settings, this.boardDrawerId);

		this.socket = socket;
		this.audioPlayer = new AudioPlayer(this.gameId, socket, this.userSettings.volume);
		if(this.boardDrawerId !== 1) {
			this.audioPlayer.disable();
		}

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

		this.socket.on('gameOver', gameId => {
			if(!opponentIds.includes(gameId)) {
				return;
			}
			console.log('Player with id ' + gameId + ' has topped out.');
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'Win';
			}
		});

		this.socket.on('playerDisconnect', gameId => {
			if(!opponentIds.includes(gameId)) {
				return;
			}
			console.log('Player with id ' + gameId + ' has disconnected.');
			this.opponentIds.splice(this.opponentIds.indexOf(gameId), 1);
			if(this.opponentIds.length === 0) {
				this.endResult = 'OppDisconnect';
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

			// Update the board
			const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop };
			currentBoardHash = this.boardDrawer.hashForUpdate(currentBoardState);
			this.boardDrawer.updateBoard(currentBoardState);
			this.updateScore();
		}

		// Emit board state to all opponents
		this.socket.emit('sendState', this.gameId, currentBoardHash, this.currentScore, this.getTotalNuisance());
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
		let hash;
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
			hash = this.boardDrawer.hashForNuisanceInit(nuisanceCascadeFPR);
		}
		// Already initialized
		else {
			this.boardDrawer.dropNuisance(this.board.boardState, this.nuisanceState);
			hash = this.boardDrawer.hashForNuisance(this.board.boardState, this.nuisanceState);
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
		// Setting up the board state
		if(this.resolvingState.chain === 0) {
			const puyoLocs = this.resolvingChains[0];
			const nuisanceLocs = this.board.findNuisancePopped(puyoLocs);
			const dropFrames = Utils.getDropFrames(puyoLocs.concat(nuisanceLocs), this.board.boardState, this.settings);
			this.resolvingState = { chain: 1, puyoLocs, nuisanceLocs, currentFrame: 1, totalFrames: this.settings.popFrames + dropFrames };
		}
		else {
			this.resolvingState.currentFrame++;
		}

		// Update the board
		const currentBoardHash = this.boardDrawer.hashForResolving(this.board.boardState, this.resolvingState);
		this.boardDrawer.resolveChains(this.board.boardState, this.resolvingState);

		// Once done popping, play SFX
		if(this.resolvingState.currentFrame === this.settings.popFrames) {
			// Play sfx
			this.audioPlayer.playAndEmitSfx('chain_voiced_jpn', this.resolvingState.chain);
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
				this.resolvingState = { chain: 0, puyoLocs: [], nuisanceLocs: [], currentFrame: 0, totalFrames: 0 };

				// No pending nuisance, chain completed
				if(this.getTotalNuisance() === 0) {
					this.socket.emit('activateNuisance', this.gameId);
				}

				// Check for all clear
				if(this.board.boardState.every(col => col.length === 0)) {
					this.allClear = true;
					this.audioPlayer.playAndEmitSfx('allClear');
					console.log("All clear by player with id " + this.gameId);
				}
			}
			// Still have more chains to resolve
			else {
				const puyoLocs = this.resolvingChains[this.resolvingState.chain];
				const nuisanceLocs = this.board.findNuisancePopped(puyoLocs);
				const dropFrames = Utils.getDropFrames(puyoLocs, this.board.boardState, this.settings);
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

	squishPuyos() {
		this.squishState.currentFrame++;
		if(this.squishState.currentFrame === this.settings.squishFrames) {
			// Chain was not started
			if(this.resolvingChains.length === 0) {
				const { nuisanceDropped, nuisanceArray } = this.board.dropNuisance(this.activeNuisance);
				this.nuisanceState.nuisanceAmount = nuisanceDropped;
				this.nuisanceState.nuisanceArray = nuisanceArray;
			}
			this.squishState.currentFrame = -1;
		}

		const currentBoardState = { boardState: this.board.boardState, currentDrop: this.currentDrop };
		const currentBoardHash = this.boardDrawer.hashForUpdate(currentBoardState);
		this.boardDrawer.updateBoard(currentBoardState);

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

			// Remove any puyos above row 13
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
				document.getElementById(pointsDisplayName).innerHTML = "Score: " + this.currentScore;
				this.softDrops %= 5;
			}
			return;
		}

		this.currentScore += Utils.calculateScore(this.resolvingState.puyoLocs, this.resolvingState.chain);
		document.getElementById(pointsDisplayName).innerHTML = "Score: " + this.currentScore;

		let { nuisanceSent, leftoverNuisance } =
			Utils.calculateNuisance(this.currentScore - this.preChainScore, this.settings.targetPoints, this.leftoverNuisance);
		this.leftoverNuisance = leftoverNuisance;

		// Send an extra rock if all clear
		if(this.allClear) {
			nuisanceSent += 5 * this.settings.cols;
			this.allClear = false;
		}
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

},{"./Board.js":1,"./BoardDrawer.js":2,"./Utils.js":9}],7:[function(require,module,exports){
'use strict';

class InputManager{
	constructor(userSettings) {
		this.events = [];				// Array of callback functions, indexed at their triggering event
		this.keysPressed = {};			// Object containing keys with whether they are pressed or not
		this.lastPressed = undefined;	// Last pressed Left/Right key. Becomes undefined if the key is released.
		this.dasTimer = {};				// Object containing DAS timers for each key
		this.arrTimer = {};				// Object containing ARR timers for each key
		this.userSettings = userSettings;

		document.addEventListener("keydown", event => {
			this.keysPressed[event.key] = true;
			if(event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				this.lastPressed = event.key;
			}
		});

		document.addEventListener("keyup", event => {
			this.keysPressed[event.key] = undefined;
			this.dasTimer[event.key] = undefined;
			if(this.arrTimer[event.key] !== undefined) {
				this.arrTimer[event.key] = undefined;
			}
			if(event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				this.lastPressed = undefined;
			}
		});
	}

	/**
	 * The 'update' method for InputManager; called once every frame.
	 * Determines whether conditions such as DAS and ARR should be applied.
	 * All 'successful' events will be emitted and caught by the game's validation functions before being executed.
	 * Soft dropping will always be executed.
	 */
	executeKeys() {
		// First, take all the keys currently pressed
		Object.keys(this.keysPressed).filter(key => this.keysPressed[key] !== undefined).forEach(key => {

			// If this key is newly pressed OR the DAS timer has completed
			if(this.dasTimer[key] === undefined || (Date.now() - this.dasTimer[key]) >= this.userSettings.das || key === 'ArrowDown') {
				// If the puyo is undergoing ARR AND the ARR timer has not completed
				if(this.arrTimer[key] !== undefined && (Date.now() - this.arrTimer[key]) < this.userSettings.arr && key !== 'ArrowDown') {
					return;
				}

				// If the puyo is rotating and the rotate button is still held
				if(this.dasTimer[key] !== undefined && (key === 'z' || key === 'x')) {
					return;
				}

				// Perform key action
				switch(key) {
					case 'ArrowLeft':
						// Special case for holding both directions down
						if(this.lastPressed !== 'ArrowRight') {
							this.emit('Move', 'Left', true);
						}
						break;
					case 'ArrowRight':
						// Special case for holding both directions down
						if(this.lastPressed !== 'ArrowLeft') {
							this.emit('Move', 'Right', true);
						}
						break;
					case 'ArrowDown':
						this.emit('Move', 'Down', true);
						break;
					case 'z':
						this.emit('Rotate', 'CCW', true);
						break;
					case 'x':
						this.emit('Rotate', 'CW', true);
						break;
				}

				// If took an action and DAS timer exists, that must mean entering ARR
				if(this.dasTimer[key] !== undefined) {
					this.arrTimer[key] = Date.now();
				}
				// Otherwise, this is a new press and must undergo DAS
				else {
					this.dasTimer[key] = Date.now();
				}
			}
		});
	}

	/**
	 * Sets up a function to be called when a particular event fires.
	 *
	 * @param  {string}   event    The name of the event that will be fired
	 * @param  {Function} callback The function that will be executed when the event fires
	 */
	on(event, callback) {
		this.events[event] = callback;
	}

	/**
	 * Executes the appropriate callback function when an event fires.
	 *
	 * @param  {string} event  The name of the event that was fired
	 * @param  {[type]} data   Any parameters that need to be passed to the callback
	 */
	emit(event, data, player) {
		const callback = this.events[event];
		callback(data, player);
	}
}

module.exports = { InputManager };

},{}],8:[function(require,module,exports){
'use strict';

const { BoardDrawer } = require('./BoardDrawer');
const { Game } = require('./Game.js');
const { InputManager } = require('./InputManager.js');

class PlayerGame extends Game {
	constructor(gameId, opponentIds, socket, settings, userSettings) {
		super(gameId, opponentIds, socket, 1, settings, userSettings);

		// Accepts inputs from player
		this.inputManager = new InputManager(this.userSettings, this.player, this.gameId, this.opponentId, this.socket);
		this.inputManager.on('Move', this.move.bind(this));
		this.inputManager.on('Rotate', this.rotate.bind(this));
		this.opponentBoardDrawers = {};

		// Add a BoardDrawer for each opponent. CPU boards will draw themselves
		let opponentCounter = 1;
		this.opponentIds.forEach(id => {
			if(id > 0) {
				this.opponentBoardDrawers[id] = new BoardDrawer(this.settings, opponentCounter + 1);
			}
			opponentCounter++;
		});

		// eslint-disable-next-line no-unused-vars
		this.socket.on('sendState', (gameId, boardHash, score, nuisance) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			if(gameId > 0) {
				this.opponentBoardDrawers[gameId].drawFromHash(boardHash);
			}
			this.updateOpponentScore(gameId, score);
		});

		this.socket.on('sendSound', (gameId, sfx_name, index) => {
			if(!this.opponentIds.includes(gameId)) {
				return;
			}
			this.audioPlayer.playSfx(sfx_name, index);
		});
	}

	/**
	 * @Override
	 * Executes the InputManager for the game.
	 */
	getInputs() {
		this.inputManager.executeKeys();
	}

	/**
	 * Updates the score for opponents.
	 */
	updateOpponentScore(gameId, score) {
		const pointsDisplayName = 'pointsDisplay' + '2';
		document.getElementById(pointsDisplayName).innerHTML = "Score: " + score;
	}
}

module.exports = { PlayerGame };

},{"./BoardDrawer":2,"./Game.js":6,"./InputManager.js":7}],9:[function(require,module,exports){
'use strict';

const { Drop } = require('./Drop.js');

const COLOUR_LIST = [ 'Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Gray'];
const PUYO_COLOURS = { 'Red': 'rgba(200, 20, 20, 0.9)',
						'Green': 'rgba(20, 200, 20, 0.9)',
						'Blue': 'rgba(20, 20, 200, 0.9)',
						'Purple': 'rgba(150, 20, 150, 0.9)',
						'Yellow': 'rgba(150, 150, 20, 0.9)',
						'Gray': 'rgba(100, 100, 100, 0.9)' };
const PUYO_EYES_COLOUR = 'rgba(255, 255, 255, 0.7)';

class Settings {
	constructor(gamemode = 'Tsu', gravity = 0.036, rows = 12, cols = 6, softDrop = 0.27, numColours = 4, targetPoints = 70, seed = Math.random()) {
		this.gamemode = gamemode;			// Type of game that is being played
		this.gravity = gravity;				// Vertical distance the drop falls every frame naturally (without soft dropping)
		this.rows = rows;					// Number of rows in the game board
		this.cols = cols;					// Number of columns in the game board
		this.softDrop = softDrop;			// Additional vertical distance the drop falls when soft dropping
		this.numColours = numColours;		// Number of unique puyo colours being used
		this.targetPoints = targetPoints;	// Points required to send one nuisance puyo
		this.seed = seed;

		// Constants that cannot be modified
		this.lockDelay = 200;				// Milliseconds of time before a drop locks into place
		this.frames_per_rotation = 8;		// Number of frames used to animate 90 degrees of rotation
		this.rotate180_time = 200;			// Max milliseconds after a rotate attempt that a second rotate attempt will trigger 180 rotation
		this.squishFrames = 8;				// Number of frames used for squishing a drop into the stack
		this.dropFrames = 10;				// Number of frames used for all the puyo to drop
		this.popFrames = 65;				// Number of frames used to pop any amount of puyos
		this.isoCascadeFramesPerRow	= 3.25;	// Number of frames used for an isolated puyo to fall one row
		this.meanNuisanceCascadeFPR = 3;	// Average frames used for nuisance to drop one row
		this.varNuisanceCascadeFPR = 0.3; 	// Max positive or negative difference in frames used for nuisance to drop one row
		this.nuisanceLandFrames = 4;		// Number of frames taken for the nuisance landing animation
		this.hashSnapFactor = 100;			// Fraction of a row rounded to when hashing
		this.hashRotFactor = 50;			// Fraction of a rev rounded to when hashing
		this.nuisanceSpawnRow = rows + 2;	// Row of nuisance spawn
	}

	toString() {
		return this.gamemode + ' '
			+ this.gravity + ' '
			+ this.rows + ' '
			+ this.cols + ' '
			+ this.softDrop + ' '
			+ this.numColours + ' '
			+ this.targetPoints + ' '
			+ this.seed;
	}

	static fromString(str) {
		const parts = str.split(' ');
		const gamemode = parts.splice(0, 1)[0];
		const parsedParts = parts.map(part => Number(part));
		return new Settings(gamemode, ...parsedParts);
	}
}

class UserSettings {
	constructor(das = 200, arr = 20, volume = 0.1) {
		this.das = das;						// Milliseconds before holding a key repeatedly triggers the event
		this.arr = arr;						// Milliseconds between event triggers after the DAS timer is complete
		this.volume = volume;				// Volume (varies between 0 and 1)
	}
}

class AudioPlayer {
	constructor(gameId, socket, volume) {
		this.gameId = gameId;
		this.socket = socket;
		this.volume = volume;
		this.cancel = false;

		this.sfx = {
			'move': new Audio('../sounds/SE_T07_move.wav'),
			'rotate': new Audio('../sounds/SE_T08_rotate.wav'),
			'win': new Audio('../sounds/SE_T19_win.wav'),
			'loss': new Audio('../sounds/se_puy20_lose.wav'),
			'chain': [
				null,
				new Audio('../sounds/SE_T00_ren1.wav'),
				new Audio('../sounds/SE_T01_ren2.wav'),
				new Audio('../sounds/SE_T02_ren3.wav'),
				new Audio('../sounds/SE_T03_ren4.wav'),
				new Audio('../sounds/SE_T04_ren5.wav'),
				new Audio('../sounds/SE_T05_ren6.wav'),
				new Audio('../sounds/SE_T06_ren7.wav')
			],
			'chain_voiced': [
				null
			],
			'chain_voiced_jpn': [
				null,
				new Audio('../sounds/voices/chain_1_jpn.wav'),
				new Audio('../sounds/voices/chain_2_jpn.wav'),
				new Audio('../sounds/voices/chain_3_jpn.wav'),
				new Audio('../sounds/voices/chain_4_jpn.wav'),
				new Audio('../sounds/voices/chain_5_jpn.wav'),
				new Audio('../sounds/voices/chain_6_jpn.wav'),
				new Audio('../sounds/voices/chain_7_jpn.wav'),
				new Audio('../sounds/voices/chain_8_jpn.wav'),
				new Audio('../sounds/voices/chain_9_jpn.wav'),
				new Audio('../sounds/voices/chain_10_jpn.wav'),
				new Audio('../sounds/voices/chain_11_jpn.wav'),
				new Audio('../sounds/voices/chain_12_jpn.wav'),
			],
			'nuisanceSend': [
				null,
				null,
				new Audio('../sounds/SE_T14_oj_okuri1.wav'),
				new Audio('../sounds/SE_T15_oj_okuri2.wav'),
				new Audio('../sounds/SE_T16_oj_okuri3.wav'),
				new Audio('../sounds/SE_T17_oj_okuri4.wav')
			],
			'nuisanceFall1': new Audio('../sounds/SE_T12_ojama1.wav'),
			'nuisanceFall2': new Audio('../sounds/SE_T13_ojama2.wav'),
			'allClear': new Audio('../sounds/SE_T22_zenkesi.wav')
		};

		// Set volume for each sound
		Object.keys(this.sfx).forEach(key => {
			const sounds = this.sfx[key];
			if(key.includes('voiced')) {
				sounds.filter(sound => sound !== null).forEach(sound => sound.volume = 0.4);
				return;
			}
			if(Array.isArray(sounds)) {
				sounds.filter(sound => sound !== null).forEach(sound => sound.volume = this.volume);
			}
			else if(sounds !== null) {
				// Win/Lose SFX are especially loud
				if(key === 'win' || key === 'lose') {
					sounds.volume = this.volume * 0.6;
				}
				else {
					sounds.volume = this.volume;
				}
			}
		});
	}

	/**
	 * Plays a sound effect. An 1-based index parameter is provided for more detailed selection.
	 */
	playSfx(sfx_name, index = null) {
		if(this.cancel) {
			return;
		}
		if(index !== null) {
			this.sfx[sfx_name][index].play();
		}
		else {
			this.sfx[sfx_name].play();
		}
	}

	/**
	 * Plays a sound effect, and emits the sound to the server.
	 * Used so that other players can hear the appropriate sound.
	 */
	playAndEmitSfx(sfx_name, index = null) {
		this.playSfx(sfx_name, index);
		this.socket.emit('sendSound', this.gameId, sfx_name, index);
	}

	disable() {
		this.cancel = true;
	}
}

class DropGenerator {
	constructor(settings) {
		this.settings = settings;
		this.seed = this.settings.seed;
		this.drops = [];
		this.colourList = Object.keys(PUYO_COLOURS).slice(0, this.settings.numColours).map(colour_name => PUYO_COLOURS[colour_name]);
		this.colourBuckets = {};
		this.drops[0] = [];

		// Set up colourBuckets for the first batch of 128
		this.colourList.forEach(colour => {
			// Ceiling instead of flooring so that there will be leftover amounts instead of not enough
			this.colourBuckets[colour] = Math.ceil(128 / this.settings.numColours);
		});

		// Generate the 3 colours that will be used for the first 3 drops
		const firstColours = [];
		while(firstColours.length < 3) {
			let colour = this.colourList[Math.floor(this.randomNumber() * this.colourList.length)];
			if(!firstColours.includes(colour)) {
				firstColours.push(colour);
			}
		}

		// Only use the previously determined 3 colours for the first 3 drops
		for(let i = 0; i < 3; i++) {
			const colours = [
				firstColours[Math.floor(this.randomNumber() * 3)],
				firstColours[Math.floor(this.randomNumber() * 3)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;
			this.drops[0].push(Drop.getNewDrop(this.settings, colours));
		}

		for(let i = 3; i < 128; i++) {
			// Filter out colours that have been completely used up
			const tempColourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
			const colours = [
				tempColourList[Math.floor(this.randomNumber() * tempColourList.length)],
				tempColourList[Math.floor(this.randomNumber() * tempColourList.length)]
			];
			this.colourBuckets[colours[0]]--;
			this.colourBuckets[colours[1]]--;

			this.drops[0].push(Drop.getNewDrop(this.settings, colours));
		}
	}

	requestDrops(index) {
		if(this.drops[index + 1] === undefined) {
			this.drops[index + 1] = [];

			// Reset colourBuckets for the next batch of 128
			this.colourList.forEach(colour => {
				// Ceiling instead of flooring so that there will be leftover amounts instead of not enough
				this.colourBuckets[colour] = Math.ceil(128 / this.settings.numColours);
			});

			for(let i = 0; i < 128; i++) {
				// Filter out colours that have been completely used up
				const colourList = Object.keys(this.colourBuckets).filter(colour => this.colourBuckets[colour] > 0);
				const colours = [
					colourList[Math.floor(this.randomNumber() * colourList.length)],
					colourList[Math.floor(this.randomNumber() * colourList.length)]
				];
				this.colourBuckets[colours[0]]--;
				this.colourBuckets[colours[1]]--;

				this.drops[index + 1].push(Drop.getNewDrop(this.settings, colours));
			}
		}
		return this.drops[index];
	}

	randomNumber() {
		const x = Math.sin(this.seed++) * 10000;
		return x - Math.floor(x);
	}
}

/**
 * Returns a random puyo colour, given the size of the colour pool.
 */
function getRandomColour (numColours) {
	const colours = COLOUR_LIST.slice(0, numColours);

	return PUYO_COLOURS[colours[Math.floor(Math.random() * numColours)]];
}

/**
 * Returns the location(s) of the schezo puyo(s).
 *
 * Currently only works for I-shaped Drops (Tsu).
 */
function getOtherPuyo (drop) {
	let x = drop.arle.x + Math.cos(drop.standardAngle + Math.PI / 2);
	let y = drop.arle.y + Math.sin(drop.standardAngle + Math.PI / 2);

	// Perform integer rounding
	if(Math.abs(x - Math.round(x)) < 0.001) {
		x = Math.round(x);
	}
	if(Math.abs(y - Math.round(y)) < 0.001) {
		y = Math.round(y);
	}
	return { x, y };
}

/**
 * Gets the frames needed for the animation (accounts for falling time).
 */
function getDropFrames(poppingLocs, boardState, settings) {
	return poppingLocs.some(loc => {
		return boardState[loc.col][loc.row + 1] !== undefined && !poppingLocs.includes({ col: loc.col, row: loc.row + 1});
	}) ? settings.dropFrames : 0;
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
function calculateScore (puyoLocs, chain_length) {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [null, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [null, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [null, null, null, null, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyoLocs.length;

	// Find the different colours
	const containedColours = {};

	puyoLocs.forEach(puyo => {
		if(containedColours[puyo.colour] === undefined) {
			containedColours[puyo.colour] = 1;
		}
		else {
			containedColours[puyo.colour]++;
		}
	});

	// Chain power based on length of chain
	const chain_power = CHAIN_POWER[chain_length];

	// Colour bonus based on number of colours used
	const colour_bonus = COLOUR_BONUS[Object.keys(containedColours).length];

	// Group bonus based on number of puyos in each group
	const group_bonus = Object.keys(containedColours).reduce((bonus, colour) => bonus += GROUP_BONUS[containedColours[colour]], 0);

	return (10 * puyos_cleared) * (chain_power + colour_bonus + group_bonus);
}

function calculateNuisance(chain_score, targetPoints, leftoverNuisance) {
	const nuisancePoints = chain_score / targetPoints + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}

/**
 * Deep copies an object where all values are primitype types.
 * Call this function recursively to deep copy more nested objects.
 */
function objectCopy(obj) {
	return JSON.parse(JSON.stringify(obj));
}

const Utils = {
	getRandomColour,
	getOtherPuyo,
	getDropFrames,
	calculateScore,
	calculateNuisance,
	objectCopy
}

module.exports = {
	COLOUR_LIST,
	PUYO_COLOURS,
	PUYO_EYES_COLOUR,
	Settings,
	UserSettings,
	DropGenerator,
	AudioPlayer,
	Utils
}

},{"./Drop.js":5}],10:[function(require,module,exports){
'use strict';

const { Cpu } = require('./Cpu.js');
const { CpuGame } = require('./CpuGame.js');
const { PlayerGame } = require('./PlayerGame.js');
const { Settings, UserSettings } = require('./Utils.js');

(function () {
	const socket = window.io();
	let game, gameId;
	let cpuGames = [];

	// Dictionary of all URL query parameters
	const urlParams = new URLSearchParams(window.location.search);

	const cpu = urlParams.get('cpu') === 'true';	// Flag to play against a CPU
	const ai = urlParams.get('ai') || 'Test';		// AI of the CPU
	const speed = urlParams.get('speed');			// Speed of the CPU

	const createRoom = urlParams.get('createRoom') === 'true';	// Flag to create a room
	const roomSize = urlParams.get('size') || 2;				// Size of the room

	const ranked = urlParams.get('ranked') === 'true';		// Flag to join ranked queue
	const joinId = urlParams.get('joinRoom');				// Id of room to join

	let gameInfo = { gameId: null, settingsString: new Settings().toString(), joinId };

	// Send a registration request to the server to receive a gameId
	socket.emit('register');

	socket.on('getGameId', id => {
		gameId = id;
		gameInfo.gameId = id;

		// CPU overrides all other options
		if(cpu) {
			socket.emit('cpuMatch', gameInfo);
			console.log('Starting CPU match...');
		}
		else if(createRoom) {
			// TODO: Allow changing of room settings
			gameInfo.roomSize = Number(roomSize) || 2;

			socket.emit('createRoom', gameInfo);
			console.log('Creating a room...');
		}
		else if(joinId !== null) {
			socket.emit('joinRoom', gameInfo);
			console.log('Joining a room...');
		}
		else if(ranked) {
			socket.emit('ranked', gameInfo);
			console.log('Finding a match...')
		}
		else {
			socket.emit('quickPlay', gameInfo);
			console.log('Awaiting match...');
		}
	});

	socket.on('giveRoomId', id => {
		console.log('Other players can join this room by appending ?joinRoom=' + id);
	});

	socket.on('joinFailure', () => {
		console.log('ERROR: Unable to join room as this room id is not currently in use.');
	});

	socket.on('roomUpdate', (allIds, roomSize, settingsString) => {
		console.log('Current players: ' + JSON.stringify(allIds));
		if(roomSize > allIds.length) {
			console.log('Waiting for ' + (roomSize - allIds.length) + ' more players.');
		}
		console.log('Settings: ' + Settings.fromString(settingsString));
	});

	socket.on('start', (opponentIds, cpuIds, settingsString) => {
		console.log('Opponents: ' + JSON.stringify(opponentIds) + ' CPUs: ' + JSON.stringify(cpuIds));

		const allOpponentIds = opponentIds.concat(cpuIds);

		// Set up the player's game
		game = new PlayerGame(
			gameId,
			allOpponentIds,
			socket,
			Settings.fromString(settingsString),
			new UserSettings()
		);

		let boardDrawerCounter = 2;
		const allIds = allOpponentIds.concat(gameId);

		let settings = Settings.fromString(settingsString);
		let cpuSpeed = Number(speed) || 10;
		let cpuAI = Cpu.fromString(ai, settings);

		// Create the CPU games
		cpuGames = cpuIds.map(id => {
			const thisSocket = window.io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new CpuGame(
				id,
				thisOppIds,
				thisSocket,
				boardDrawerCounter,
				cpuAI,
				cpuSpeed,
				settings
			);

			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, id };
		});
		main();
	});

	let finalMessage = null;		// The message to be displayed

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		cpuGames.forEach(cpuGame => cpuGame.game.step());
		if(finalMessage !== null) {
			window.cancelAnimationFrame(mainFrame);
			console.log(finalMessage);
			return;
		}
		const endResult = game.end();
		if(endResult !== null) {
			switch(endResult) {
				case 'Win':
					finalMessage = 'You win!';
					socket.emit('gameEnd', gameId);
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}

		cpuGames.forEach(cpuGame => {
			const cpuEndResult = cpuGame.game.end();
			if(cpuEndResult !== null) {
				switch(cpuEndResult) {
					case 'Win':
						// finalMessage = 'You win!';
						cpuGame.socket.emit('gameEnd', cpuGame.id);
						break;
					case 'Loss':
						// finalMessage = 'You lose...';
						cpuGame.socket.emit('gameOver', cpuGame.id);
						break;
					case 'OppDisconnect':
						// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
						break;
				}
			}
		});
	}
})();

},{"./Cpu.js":3,"./CpuGame.js":4,"./PlayerGame.js":8,"./Utils.js":9}]},{},[10])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9Cb2FyZC5qcyIsImpzL0JvYXJkRHJhd2VyLmpzIiwianMvQ3B1LmpzIiwianMvQ3B1R2FtZS5qcyIsImpzL0Ryb3AuanMiLCJqcy9HYW1lLmpzIiwianMvSW5wdXRNYW5hZ2VyLmpzIiwianMvUGxheWVyR2FtZS5qcyIsImpzL1V0aWxzLmpzIiwianMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0ZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeHhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBQVVlPX0NPTE9VUlMgfSA9IHJlcXVpcmUoJy4vVXRpbHMuanMnKTtcclxuXHJcbmNsYXNzIEJvYXJkIHtcclxuXHRjb25zdHJ1Y3RvcihzZXR0aW5ncywgYm9hcmRTdGF0ZSA9IG51bGwpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHRcdHRoaXMuaGVpZ2h0ID0gc2V0dGluZ3Mucm93cztcclxuXHRcdHRoaXMud2lkdGggPSBzZXR0aW5ncy5jb2xzO1xyXG5cclxuXHRcdGlmKGJvYXJkU3RhdGUgPT09IG51bGwpIHtcclxuXHRcdFx0dGhpcy5ib2FyZFN0YXRlID0gW107XHJcblxyXG5cdFx0XHQvLyBQcmVwYXJlIHRoZSBib2FyZCBieSBmaWxsaW5nIGl0IHdpdGggZW1wdHkgYXJyYXlzXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCB0aGlzLndpZHRoOyBpKyspIHtcclxuXHRcdFx0XHR0aGlzLmJvYXJkU3RhdGUucHVzaChbXSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHQvLyBDcmVhdGUgYSBjb3B5IG9mIHRoZSBib2FyZCBzdGF0ZVxyXG5cdFx0XHR0aGlzLmJvYXJkU3RhdGUgPSBib2FyZFN0YXRlLm1hcChjb2wgPT4gY29sLnNsaWNlKCkpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyBpZiB0aGUgYm9hcmQncyBYIGxvY2F0aW9ucyBoYXZlIGJlZW4gY292ZXJlZC5cclxuXHQgKiBUaGlzIGRlcGVuZHMgb24gdGhlIGdhbWVtb2RlIChmdXR1cmUgZ2FtZW1vZGVzIG1heSBiZSBzdXBwb3J0ZWQpLlxyXG5cdCAqL1xyXG5cdGNoZWNrR2FtZU92ZXIoZ2FtZW1vZGUpIHtcclxuXHRcdHN3aXRjaChnYW1lbW9kZSkge1xyXG5cdFx0XHRjYXNlICdUc3UnOlxyXG5cdFx0XHRcdHJldHVybiB0aGlzLmJvYXJkU3RhdGVbMl0ubGVuZ3RoID49IHRoaXMuaGVpZ2h0O1xyXG5cdFx0XHRjYXNlICdGZXZlcic6XHJcblx0XHRcdFx0cmV0dXJuIHRoaXMuYm9hcmRTdGF0ZVsyXS5sZW5ndGggPj0gdGhpcy5oZWlnaHQgfHwgdGhpcy5ib2FyZFN0YXRlWzNdLmxlbmd0aCA+PSB0aGlzLmhlaWdodDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlY3Vyc2l2ZSBmdW5jdGlvbiB0aGF0IHNlYXJjaGVzIHRoZSBlbnRpcmUgc3RhY2sgZm9yIGFueSBjaGFpbnMgKHJlY3Vyc2l2ZWx5KS5cclxuXHQgKiBUaGUgYm9hcmQgc3RhdGUgdXNlZCBpcyBhIGNvcHkgb2YgdGhlIGdhbWUncyBib2FyZCBzdGF0ZS4gTm8gcHV5b3MgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZ2FtZSdzIGJvYXJkLlxyXG5cdCAqXHJcblx0ICogVW5kZXJseWluZyBsb2dpYzpcclxuXHQgKiBcdFx0QSB2aXNpdGVkIGFycmF5IGlzIGtlcHQgb2YgdGhlIGN1cnJlbnQgYm9hcmQgc3RhdGUgKGFzIG9mIHRoaXMgcmVjdXJzaW9uKS5cclxuXHQgKiBcdFx0QSBub24tdmlzaXRlZCBwdXlvIGlzIHNlbGVjdGVkIGFzIHRoZSBzdGFydCBwb3NpdGlvbi5cclxuXHQgKiBcdFx0T25seSBERlMgdG8gcHV5b3Mgd2l0aCB0aGUgc2FtZSBjb2xvdXIgdG8gZmluZCB0aGUgZXh0ZW50IG9mIHRoZSBjaGFpbiAobWFya2luZyB0aGVtIGFzIHZpc2l0ZWQgYWxvbmcgdGhlIHdheSkuXHJcblx0ICogXHRcdFVwb24gcmVhY2hpbmcgYSBcImxlYWYgcHV5b1wiIChhbGwgdW52aXNpdGVkIG5laWdoYm91cnMgYXJlIHRoZSB3cm9uZyBjb2xvdXIpLCB0aGUgcnVubmluZyBjaGFpbiBsZW5ndGggYW5kIGxvY2F0aW9uXHJcblx0ICogXHRcdFx0b2YgY29udGFpbmVkIHB1eW9zIGFyZSByZXR1cm5lZC4gVGhpcyBpcyBldmVudHVhbGx5IGNhdWdodCBieSB0aGUgbW9zdCByZWNlbnQgYW5jZXN0b3IgdGhhdCBpcyBub3QgYSBsZWFmIHB1eW8uXHJcblx0ICogXHRcdFRoYXQgYW5jZXN0b3IgdGhlbiB1cGRhdGVzIGl0cyBvd24gcnVubmluZyBjaGFpbiBsZW5ndGggYW5kIGxpc3Qgb2YgcHV5byBsb2NhdGlvbnMgYW5kIGNvbnRpbnVlcyB0aGUgREZTLlxyXG5cdCAqIFx0XHRFdmVudHVhbGx5LCB0aGUgREZTIGNvbXBsZXRlcyBhbmQgcmV0dXJucyB0aGUgdG90YWwgY2hhaW4gbGVuZ3RoIGFuZCBsaXN0IG9mIHB1eW8gbG9jYXRpb25zLlxyXG5cdCAqIFx0XHRJZiB0aGUgY2hhaW4gbGVuZ3RoIGlzIGxhcmdlciB0aGFuIDMsIGl0IGNvdW50cyBhcyBhIGNoYWluIGFuZCBpcyBhZGRlZCB0byB0aGUgb3ZlcmFsbCBsaXN0IG9mIHB1eW9zIGNoYWluZWQuXHJcblx0ICogXHRcdFx0VGhhdCBtZWFucyBhIGZ1dHVyZSBib2FyZCBzdGF0ZSBtdXN0IGJlIGNhbGN1bGF0ZWQgYWZ0ZXIgdGhpcyBjaGFpbiAodGhlICdjaGFpbmVkJyBmbGFnIHNldCB0byB0cnVlKS5cclxuXHQgKiBcdFx0QSBuZXcgbm9uLXZpc2l0ZWQgcHV5byBpcyBzZWxlY3RlZCBhcyBhIHN0YXJ0IHBvc2l0aW9uLCBhbmQgcmVwZWF0IHVudGlsIG5vIHZhbGlkIHN0YXJ0IHBvc2l0aW9ucyBleGlzdC5cclxuXHQgKiBcdFx0SWYgYXQgbGVhc3Qgb25lIGNoYWluIG9mIHB1eW9zIHdhcyBmb3VuZCwgdGhlIGJvYXJkIHN0YXRlIHdpbGwgYmUgdXBkYXRlZCBieSByZW1vdmluZyB0aGUgY2hhaW5lZCBwdXlvcy5cclxuXHQgKiBcdFx0VGhpcyBmdW5jdGlvbiBpcyB0aGVuIGNhbGxlZCByZWN1cnNpdmVseSB3aXRoIHRoZSBuZXcgYm9hcmQgc3RhdGUgYW5kIGxpc3Qgb2YgcHV5b3MgY2hhaW5lZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSAge0FycmF5fSAgcHV5b3NfY2hhaW5lZCAgQXJyYXkgY29udGFpbmluZyBhcnJheXMgb2YgY2hhaW5lZCBwdXlvcyBbW3B1eW9zX2luX2NoYWluXzFdLCBbcHV5b3NfaW5fY2hhaW5fMl0sIC4uLl1cclxuXHQgKiBAcGFyYW0gIHtCb2FyZH0gIGJvYXJkU3RhdGUgICAgIFRoZSBcImN1cnJlbnRcIiBib2FyZHN0YXRlIGFmdGVyIHByZXZpb3VzIGNoYWluaW5nIGhhcyBiZWVuIGNvbXBsZXRlZFxyXG5cdCAqIEByZXR1cm4ge2FycmF5fSAgICAgICAgICAgICAgICAgVGhlIGNvbXBsZXRlIHB1eW9zX2NoYWluZWQgYXJyYXlcclxuXHQgKi9cclxuXHRyZXNvbHZlQ2hhaW5zKHB1eW9zX2NoYWluZWQgPSBbXSwgYm9hcmQgPSBuZXcgQm9hcmQodGhpcy5zZXR0aW5ncywgdGhpcy5ib2FyZFN0YXRlKSkge1xyXG5cdFx0bGV0IGNoYWluZWQgPSBmYWxzZTtcdFx0XHQvLyBGbGFnIG9mIHdoZXRoZXIgYXQgbGVhc3Qgb25lIGNoYWluIHdhcyBmb3VuZCBpbiB0aGlzIHJlY3Vyc2lvblxyXG5cdFx0bGV0IGN1cnJlbnRfY2hhaW5fcHV5b3MgPSBbXTtcdC8vIExpc3Qgb2YgcHV5b3MgdGhhdCB3aWxsIGJlIGNoYWluZWQgaW4gdGhpcyByZWN1cnNpb25cclxuXHRcdGNvbnN0IHZpc2l0ZWQgPSBbXTtcdFx0XHRcdC8vIExpc3Qgb2YgdmlzaXRlZCBsb2NhdGlvbnMgaW4gdGhpcyByZWN1cnNpb25cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFBlcmZvcm1zIGEgREZTIHRocm91Z2ggdGhlIGN1cnJlbnQgYm9hcmQgdG8gZmluZCB0aGUgZXh0ZW50IG9mIGEgY29sb3VyLCBnaXZlbiBhIHN0YXJ0aW5nIHB1eW8uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtICB7b2JqZWN0fSBwdXlvICAgICAgICBcdFRoZSBjdXJyZW50IHB1eW8sIGdpdmVuIGFzIHtjb2w6IG51bWJlciwgcm93OiBudW1iZXIsIGNvbG91cjogcmdiYSB2YWx1ZX1cclxuXHRcdCAqIEBwYXJhbSAge251bWJlcn0gY29sb3VyX2xlbmd0aCAgIFRoZSBydW5uaW5nIGxlbmd0aCBvZiB0aGUgcHV5byBjaGFpbi5cclxuXHRcdCAqIEBwYXJhbSAge2FycmF5fSAgY2hhaW5fcHV5b3MgXHRUaGUgcnVubmluZyBsaXN0IG9mIHB1eW9zIGNvbnRhaW5lZCBpbiB0aGUgY2hhaW4uXHJcblx0XHQgKiBAcmV0dXJuIHtvYmplY3R9ICAgICAgICAgICAgICAgICBUaGUgYnJhbmNoJ3MgcmVzdWx0LCBnaXZlbiBhcyB7bGVuZ3RoOiBjb2xvdXJfbGVuZ3RoLCBwdXlvczogY2hhaW5fcHV5b3N9LlxyXG5cdFx0ICovXHJcblx0XHRjb25zdCBkZnMgPSBmdW5jdGlvbihwdXlvLCBjb2xvdXJfbGVuZ3RoLCBjaGFpbl9wdXlvcykge1xyXG5cdFx0XHR2aXNpdGVkLnB1c2gocHV5byk7XHJcblx0XHRcdGNvbnN0IHsgY29sLCByb3csIGNvbG91ciB9ID0gcHV5bztcclxuXHJcblx0XHRcdC8vIFNlYXJjaCBpbiBhbGwgNCBjYXJkaW5hbCBkaXJlY3Rpb25zXHJcblx0XHRcdGZvcihsZXQgaSA9IC0xOyBpIDw9IDE7IGkrKykge1xyXG5cdFx0XHRcdGZvcihsZXQgaiA9IC0xOyBqIDw9IDE7IGorKykge1xyXG5cdFx0XHRcdFx0Y29uc3QgbmV3X3B1eW8gPSB7IGNvbDogY29sICsgaSwgcm93OiByb3cgKyBqIH07XHJcblxyXG5cdFx0XHRcdFx0aWYoTWF0aC5hYnMoaSkgKyBNYXRoLmFicyhqKSA9PT0gMSAmJiBib2FyZC52YWxpZExvYyhuZXdfcHV5bykpIHtcclxuXHRcdFx0XHRcdFx0bmV3X3B1eW8uY29sb3VyID0gYm9hcmQuYm9hcmRTdGF0ZVtjb2wgKyBpXVtyb3cgKyBqXTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIE5ldyBsb2NhdGlvbiBtdXN0IGJlIHVudmlzaXRlZCBhbmQgaGF2ZSB0aGUgc2FtZSBjb2xvdXIgcHV5b1xyXG5cdFx0XHRcdFx0XHRpZihub3RWaXNpdGVkKG5ld19wdXlvKSAmJiBjb2xvdXIgPT09IG5ld19wdXlvLmNvbG91cikge1xyXG5cdFx0XHRcdFx0XHRcdGNoYWluX3B1eW9zLnB1c2gobmV3X3B1eW8pO1xyXG5cclxuXHRcdFx0XHRcdFx0XHQvLyBVcGRhdGUgd2l0aCB0aGUgbGVhZiBwdXlvIG9mIHRoaXMgYnJhbmNoXHJcblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBsZW5ndGgsIHB1eW9zIH0gPSBkZnMobmV3X3B1eW8sIGNvbG91cl9sZW5ndGggKyAxLCBjaGFpbl9wdXlvcyk7XHJcblx0XHRcdFx0XHRcdFx0Y29sb3VyX2xlbmd0aCA9IGxlbmd0aDtcclxuXHRcdFx0XHRcdFx0XHRjaGFpbl9wdXlvcyA9IHB1eW9zO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdC8vIERvbmUgd2l0aCBhbGwgYnJhbmNoZXMsIHJldHVybiB0aGUgZmluZGluZ3NcclxuXHRcdFx0cmV0dXJuIHsgbGVuZ3RoOiBjb2xvdXJfbGVuZ3RoLCBwdXlvczogY2hhaW5fcHV5b3MgfTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERldGVybWluZXMgaWYgdGhlIHZpc2l0ZWQgYXJyYXkgY29udGFpbnMgdGhlIHBhc3NlZCBsb2NhdGlvbi5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3Qgbm90VmlzaXRlZCA9IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XHJcblx0XHRcdGNvbnN0IHsgY29sLCByb3cgfSA9IGxvY2F0aW9uO1xyXG5cdFx0XHRyZXR1cm4gdmlzaXRlZC5maWx0ZXIobG9jID0+IGxvYy5jb2wgPT09IGNvbCAmJiBsb2Mucm93ID09PSByb3cpLmxlbmd0aCA9PT0gMDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJdGVyYXRlIHRocm91Z2ggdGhlIGVudGlyZSBib2FyZCB0byBmaW5kIGFsbCBzdGFydGluZyBwb2ludHNcclxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBib2FyZC5ib2FyZFN0YXRlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGZvcihsZXQgaiA9IDA7IGogPCBib2FyZC5ib2FyZFN0YXRlW2ldLmxlbmd0aDsgaisrKSB7XHJcblx0XHRcdFx0Y29uc3QgcHV5byA9IHsgY29sOiBpLCByb3c6IGosIGNvbG91cjogYm9hcmQuYm9hcmRTdGF0ZVtpXVtqXSB9O1xyXG5cclxuXHRcdFx0XHRpZihub3RWaXNpdGVkKHB1eW8pICYmIHB1eW8uY29sb3VyICE9PSBQVVlPX0NPTE9VUlNbJ0dyYXknXSkge1xyXG5cdFx0XHRcdFx0Ly8gRmluZCB0aGUgZXh0ZW50IG9mIHRoaXMgY29sb3VyLCBzdGFydGluZyBoZXJlXHJcblx0XHRcdFx0XHRjb25zdCB7IGxlbmd0aCwgcHV5b3MgfSA9IGRmcyhwdXlvLCAxLCBbcHV5b10pO1xyXG5cdFx0XHRcdFx0aWYgKGxlbmd0aCA+IDMpIHtcclxuXHRcdFx0XHRcdFx0Y3VycmVudF9jaGFpbl9wdXlvcyA9IGN1cnJlbnRfY2hhaW5fcHV5b3MuY29uY2F0KHB1eW9zKTtcclxuXHRcdFx0XHRcdFx0Y2hhaW5lZCA9IHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGVsZXRlIGFsbCB0aGUgcHV5b3MgY2hhaW5lZCBpbiB0aGlzIHJlY3Vyc2lvbiBmcm9tIHRoZSBib2FyZCBzdGF0ZVxyXG5cdFx0Ym9hcmQuZGVsZXRlUHV5b3MoY3VycmVudF9jaGFpbl9wdXlvcy5jb25jYXQoYm9hcmQuZmluZE51aXNhbmNlUG9wcGVkKGN1cnJlbnRfY2hhaW5fcHV5b3MpKSk7XHJcblxyXG5cdFx0Ly8gUmVjdXJzZSB3aXRoIHRoZSBuZXcgYm9hcmQgc3RhdGUgYW5kIGxpc3Qgb2YgY2hhaW5lZCBwdXlvc1xyXG5cdFx0aWYoY2hhaW5lZCkge1xyXG5cdFx0XHRwdXlvc19jaGFpbmVkLnB1c2goY3VycmVudF9jaGFpbl9wdXlvcyk7XHJcblx0XHRcdHJldHVybiB0aGlzLnJlc29sdmVDaGFpbnMocHV5b3NfY2hhaW5lZCwgYm9hcmQpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gSW1wbGljaXQgZWxzZTogTm8gY2hhaW5zIHdlcmUgZm91bmQgaW4gdGhpcyByZWN1cnNpb25cclxuXHRcdHJldHVybiBwdXlvc19jaGFpbmVkO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRGV0ZXJtaW5lcyBpZiBhIHBvdGVudGlhbCBsb2NhdGlvbiBpcyB2YWxpZC5cclxuXHQgKi9cclxuXHR2YWxpZExvYyhwdXlvKSB7XHJcblx0XHRjb25zdCB7IGNvbCwgcm93IH0gPSBwdXlvO1xyXG5cdFx0cmV0dXJuIGNvbCA+PSAwICYmXHJcblx0XHRcdHJvdyA+PSAwICYmXHJcblx0XHRcdGNvbCA8IHRoaXMud2lkdGggJiZcclxuXHRcdFx0cm93IDwgdGhpcy5oZWlnaHQgJiZcclxuXHRcdFx0dGhpcy5ib2FyZFN0YXRlW2NvbF1bcm93XSAhPT0gdW5kZWZpbmVkO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlcyB0aGUgcHV5b3MgaW4gdGhlIGxvY2F0aW9ucyBwcm92aWRlZC5cclxuXHQgKi9cclxuXHRkZWxldGVQdXlvcyhwdXlvTG9jcyA9IFtdKSB7XHJcblx0XHRwdXlvTG9jcy5mb3JFYWNoKGxvY2F0aW9uID0+IHRoaXMuYm9hcmRTdGF0ZVtsb2NhdGlvbi5jb2xdW2xvY2F0aW9uLnJvd10gPSBudWxsKTtcclxuXHRcdHRoaXMuYm9hcmRTdGF0ZSA9IHRoaXMuYm9hcmRTdGF0ZS5tYXAoY29sID0+IGNvbC5maWx0ZXIocm93ID0+IHJvdyAhPT0gbnVsbCkpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlcyBhbGwgcHV5b3MgYWJvdmUgcm93IDEyICgwLWluZGV4ZWQpLlxyXG5cdCAqL1xyXG5cdHRyaW0oKSB7XHJcblx0XHR0aGlzLmJvYXJkU3RhdGUgPSB0aGlzLmJvYXJkU3RhdGUubWFwKGNvbCA9PiB7XHJcblx0XHRcdGlmKGNvbC5sZW5ndGggPiAxMykge1xyXG5cdFx0XHRcdGNvbCA9IGNvbC5zbGljZSgwLCAxMyk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGNvbDtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogRmluZHMgdGhlIG51aXNhbmNlIHB1eW9zIHRoYXQgd2VyZSBwb3BwZWQgZnJvbSB0aGUgYm9hcmQgYW5kIHJldHVybnMgdGhlaXIgbG9jYXRpb25zIGluIGFuIGFycmF5LlxyXG5cdCAqL1xyXG5cdGZpbmROdWlzYW5jZVBvcHBlZChjaGFpbl9sb2NzKSB7XHJcblx0XHRjb25zdCBwb3BwZWROdWlzYW5jZSA9IFtdO1xyXG5cdFx0Y2hhaW5fbG9jcy5mb3JFYWNoKGxvYyA9PiB7XHJcblx0XHRcdC8vIFNlYXJjaCBpbiBhbGwgZm91ciBjYXJkaW5hbCBkaXJlY3Rpb25zXHJcblx0XHRcdGZvcihsZXQgaSA9IC0xOyBpIDw9IDE7IGkrKykge1xyXG5cdFx0XHRcdGZvcihsZXQgaiA9IC0xOyBqIDw9IDE7IGorKykge1xyXG5cdFx0XHRcdFx0aWYoTWF0aC5hYnMoaSkgKyBNYXRoLmFicyhqKSAhPT0gMSB8fCAhdGhpcy52YWxpZExvYyh7IGNvbDogbG9jLmNvbCArIGksIHJvdzogbG9jLnJvdyArIGogfSkpIHtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZih0aGlzLmJvYXJkU3RhdGVbbG9jLmNvbCArIGldW2xvYy5yb3cgKyBqXSA9PT0gUFVZT19DT0xPVVJTWydHcmF5J10pIHtcclxuXHRcdFx0XHRcdFx0cG9wcGVkTnVpc2FuY2UucHVzaCh7IGNvbDogbG9jLmNvbCArIGksIHJvdzogbG9jLnJvdyArIGogfSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHRcdHJldHVybiBwb3BwZWROdWlzYW5jZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERyb3BzIGFueSBhY3RpdmUgbnVpc2FuY2Ugb250byB0aGUgYm9hcmQuXHJcblx0ICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIG51aXNhbmNlIHB1eW8gZHJvcHBlZC5cclxuXHQgKi9cclxuXHRkcm9wTnVpc2FuY2UobnVpc2FuY2UpIHtcclxuXHRcdGxldCBudWlzYW5jZURyb3BwZWQgPSAwLCBudWlzYW5jZUFycmF5ID0gW107XHJcblxyXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IHRoaXMud2lkdGg7IGkrKykge1xyXG5cdFx0XHRudWlzYW5jZUFycmF5LnB1c2goW10pO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIERyb3Agb25lIHJvY2tcclxuXHRcdGlmKG51aXNhbmNlID49IHRoaXMud2lkdGggKiA1KSB7XHJcblx0XHRcdG51aXNhbmNlQXJyYXkuZm9yRWFjaChjb2wgPT4ge1xyXG5cdFx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCA1OyBpKyspIHtcclxuXHRcdFx0XHRcdGNvbC5wdXNoKFBVWU9fQ09MT1VSU1snR3JheSddKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRudWlzYW5jZURyb3BwZWQgPSA1ICogdGhpcy53aWR0aDtcclxuXHRcdFx0Y29uc29sZS5sb2coJ0Ryb3BwZWQgYSByb2NrLicpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gRHJvcCB3aGF0ZXZlciBpcyByZW1haW5pbmdcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRjb25zdCBmdWxsUm93cyA9IE1hdGguZmxvb3IobnVpc2FuY2UgLyB0aGlzLndpZHRoKTtcclxuXHRcdFx0Y29uc3QgcmVtYWluaW5nID0gbnVpc2FuY2UgJSB0aGlzLndpZHRoO1xyXG5cclxuXHRcdFx0Ly8gRHJvcCB0aGUgZnVsbCByb3dzIGZpcnN0XHJcblx0XHRcdG51aXNhbmNlQXJyYXkuZm9yRWFjaChjb2wgPT4ge1xyXG5cdFx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCBmdWxsUm93czsgaSsrKSB7XHJcblx0XHRcdFx0XHRjb2wucHVzaChQVVlPX0NPTE9VUlNbJ0dyYXknXSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGNvbnN0IHVudXNlZENvbHVtbnMgPSBbXTtcclxuXHRcdFx0Zm9yKGxldCBpID0gMDsgaSA8IHRoaXMud2lkdGg7IGkrKykge1xyXG5cdFx0XHRcdHVudXNlZENvbHVtbnMucHVzaChpKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gUmFuZG9tbHkgZHJvcCB0aGUgcmVtYWluaW5nIG51aXNhbmNlXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCByZW1haW5pbmc7IGkrKykge1xyXG5cdFx0XHRcdGxldCBjb2x1bW4gPSB1bnVzZWRDb2x1bW5zW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHVudXNlZENvbHVtbnMubGVuZ3RoKV07XHJcblx0XHRcdFx0bnVpc2FuY2VBcnJheVtjb2x1bW5dLnB1c2goUFVZT19DT0xPVVJTWydHcmF5J10pO1xyXG5cdFx0XHRcdHVudXNlZENvbHVtbnMuc3BsaWNlKHVudXNlZENvbHVtbnMuaW5kZXhPZihjb2x1bW4pLCAxKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRudWlzYW5jZURyb3BwZWQgPSBudWlzYW5jZTtcclxuXHRcdFx0aWYobnVpc2FuY2VEcm9wcGVkID4gMCkge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCdEcm9wcGVkICcgKyBudWlzYW5jZSArICcgbnVpc2FuY2UuJyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBSZW1vdmUgdGhlIHB1eW9zIHRoYXQgYXJlIHRvbyBoaWdoXHJcblx0XHR0aGlzLnRyaW0oKTtcclxuXHJcblx0XHRyZXR1cm4geyBudWlzYW5jZURyb3BwZWQsIG51aXNhbmNlQXJyYXkgfTtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0geyBCb2FyZCB9O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5jb25zdCB7IERyb3AgfSA9IHJlcXVpcmUoJy4vRHJvcC5qcycpO1xyXG5jb25zdCB7IFBVWU9fQ09MT1VSUywgQ09MT1VSX0xJU1QsIFBVWU9fRVlFU19DT0xPVVIgfSA9IHJlcXVpcmUoJy4vVXRpbHMuanMnKTtcclxuXHJcbi8qKlxyXG4gKiBDbGFzcyB0byBtYW5hZ2UgdXBkYXRpbmcgZm9yIGFueSBjYW52YXMgdGhhdCBkcmF3cyBQdXlvICh0aGUgbWFpbiBib2FyZCBvciB0aGUgcXVldWUpLlxyXG4gKiBUaGUgc2V0dGluZ3Mgc2hvdWxkIG5vdCBjaGFuZ2Ugb3ZlciB0aGUgc3BhbiBvZiB0aGUgZHJhd2VyIGJlaW5nIHVzZWRcclxuICogYnV0IHRoZSB1cGRhdGUgZnVuY3Rpb24gd2lsbCBuZWVkIGdhbWUgc3RhdGUgaW5mby5cclxuICovXHJcbmNsYXNzIERyYXdlcldpdGhQdXlvIHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgfVxyXG4gICAgZHJhd1B1eW8oY29sb3VyLCBzaXplKSB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICAgIGN0eC5hcmMoMCwgMCwgc2l6ZSAvIDIsIDAsIDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gY29sb3VyO1xyXG4gICAgICAgIGN0eC5maWxsKCk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgtIHNpemUgLyA1LCAtIHNpemUgLyAxMCk7XHJcbiAgICAgICAgY3R4LmJlZ2luUGF0aCgpO1xyXG4gICAgICAgIGN0eC5hcmMoMCwgMCwgc2l6ZSAvIDUsIDAsIDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBjdHgudHJhbnNsYXRlKDIgKiBzaXplIC8gNSwgMCk7XHJcbiAgICAgICAgY3R4LmFyYygwLCAwLCBzaXplIC8gNSwgMCwgMiAqIE1hdGguUEkpO1xyXG4gICAgICAgIGN0eC5maWxsU3R5bGUgPSBQVVlPX0VZRVNfQ09MT1VSO1xyXG4gICAgICAgIGN0eC5maWxsKCk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoLSBzaXplIC8gNiwgLSBzaXplIC8gMTMpO1xyXG4gICAgICAgIGN0eC5iZWdpblBhdGgoKTtcclxuICAgICAgICBjdHguYXJjKDAsIDAsIHNpemUgLyA4LCAwLCAyICogTWF0aC5QSSk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgyICogc2l6ZSAvIDYsIDApO1xyXG4gICAgICAgIGN0eC5hcmMoMCwgMCwgc2l6ZSAvIDgsIDAsIDIgKiBNYXRoLlBJKTtcclxuICAgICAgICBjdHguZmlsbFN0eWxlID0gY29sb3VyO1xyXG4gICAgICAgIGN0eC5maWxsKCk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgIH1cclxuICAgIGRyYXdEcm9wKGRyb3AsIHNpemUpIHtcclxuICAgICAgICBpZiAoXCJJaExIT1wiLmluY2x1ZGVzKGRyb3Auc2hhcGUpKSB7XHJcbiAgICAgICAgICAgIHRoaXNbXCJkcmF3X1wiICsgZHJvcC5zaGFwZV0oZHJvcCwgc2l6ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgZHJhd19JKGRyb3AsIHNpemUpIHtcclxuICAgICAgICBsZXQgY3R4ID0gdGhpcy5jdHg7XHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICB0aGlzLmRyYXdQdXlvKGRyb3AuY29sb3Vyc1swXSwgc2l6ZSk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZShzaXplICogTWF0aC5jb3MoZHJvcC5zdGFuZGFyZEFuZ2xlICsgTWF0aC5QSSAvIDIpLCAtIHNpemUgKiBNYXRoLnNpbihkcm9wLnN0YW5kYXJkQW5nbGUgKyBNYXRoLlBJIC8gMikpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzFdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdfaChkcm9wLCBzaXplKSB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgdGhpcy5kcmF3UHV5byhkcm9wLmNvbG91cnNbMF0sIHNpemUpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoc2l6ZSAqIE1hdGguY29zKGRyb3Auc3RhbmRhcmRBbmdsZSArIE1hdGguUEkgLyAyKSwgLSBzaXplICogTWF0aC5zaW4oZHJvcC5zdGFuZGFyZEFuZ2xlICsgTWF0aC5QSSAvIDIpKTtcclxuICAgICAgICB0aGlzLmRyYXdQdXlvKGRyb3AuY29sb3Vyc1swXSwgc2l6ZSk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoc2l6ZSAqIE1hdGguY29zKGRyb3Auc3RhbmRhcmRBbmdsZSksIC0gc2l6ZSAqIE1hdGguc2luKGRyb3Auc3RhbmRhcmRBbmdsZSkpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzFdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdfTChkcm9wLCBzaXplKSB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgdGhpcy5kcmF3UHV5byhkcm9wLmNvbG91cnNbMF0sIHNpemUpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoc2l6ZSAqIE1hdGguY29zKGRyb3Auc3RhbmRhcmRBbmdsZSArIE1hdGguUEkgLyAyKSwgLSBzaXplICogTWF0aC5zaW4oZHJvcC5zdGFuZGFyZEFuZ2xlICsgTWF0aC5QSSAvIDIpKTtcclxuICAgICAgICB0aGlzLmRyYXdQdXlvKGRyb3AuY29sb3Vyc1sxXSwgc2l6ZSk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoc2l6ZSAqIE1hdGguY29zKGRyb3Auc3RhbmRhcmRBbmdsZSksIC0gc2l6ZSAqIE1hdGguc2luKGRyb3Auc3RhbmRhcmRBbmdsZSkpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzBdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdfSChkcm9wLCBzaXplKSB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgbGV0IHhDaGFuZ2UgPSBzaXplIC8gTWF0aC5zcXJ0KDIpICogTWF0aC5jb3MoLSBkcm9wLnN0YW5kYXJkQW5nbGUgKyBNYXRoLlBJIC8gNCk7XHJcbiAgICAgICAgbGV0IHlDaGFuZ2UgPSBzaXplIC8gTWF0aC5zcXJ0KDIpICogTWF0aC5zaW4oLSBkcm9wLnN0YW5kYXJkQW5nbGUgKyBNYXRoLlBJIC8gNCk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgtIHhDaGFuZ2UsIC0geUNoYW5nZSk7XHJcbiAgICAgICAgdGhpcy5kcmF3UHV5byhkcm9wLmNvbG91cnNbMF0sIHNpemUpO1xyXG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICBjdHgudHJhbnNsYXRlKC0geUNoYW5nZSwgeENoYW5nZSk7XHJcbiAgICAgICAgdGhpcy5kcmF3UHV5byhkcm9wLmNvbG91cnNbMF0sIHNpemUpO1xyXG4gICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICBjdHgudHJhbnNsYXRlKHhDaGFuZ2UsIHlDaGFuZ2UpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzFdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSh5Q2hhbmdlLCAtIHhDaGFuZ2UpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzFdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdfTyhkcm9wLCBzaXplKSB7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgbGV0IHhDaGFuZ2UgPSBzaXplIC8gMjtcclxuICAgICAgICBsZXQgeUNoYW5nZSA9IHNpemUgLyAyO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoLSB4Q2hhbmdlLCAtIHlDaGFuZ2UpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzBdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSgtIHlDaGFuZ2UsIHhDaGFuZ2UpO1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oZHJvcC5jb2xvdXJzWzBdLCBzaXplKTtcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgY3R4LnRyYW5zbGF0ZSh4Q2hhbmdlLCB5Q2hhbmdlKTtcclxuICAgICAgICB0aGlzLmRyYXdQdXlvKGRyb3AuY29sb3Vyc1swXSwgc2l6ZSk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoeUNoYW5nZSwgLSB4Q2hhbmdlKTtcclxuICAgICAgICB0aGlzLmRyYXdQdXlvKGRyb3AuY29sb3Vyc1swXSwgc2l6ZSk7XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFRoZSBkcmF3ZXIgZm9yIHRoZSBtYWluIGFyZWEgb2YgdGhlIGdhbWUuXHJcbiAqL1xyXG5jbGFzcyBCb2FyZERyYXdlciBleHRlbmRzIERyYXdlcldpdGhQdXlvIHtcclxuICAgIGNvbnN0cnVjdG9yKHNldHRpbmdzLCBib2FyZE51bSkge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICAgICAgdGhpcy5ib2FyZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYm9hcmRcIiArIGJvYXJkTnVtKTtcclxuICAgICAgICB0aGlzLmN0eCA9IHRoaXMuYm9hcmQuZ2V0Q29udGV4dChcIjJkXCIpO1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgICAgICB0aGlzLnBvcHBpbmdQdXlvcyA9IFtdO1xyXG4gICAgICAgIHRoaXMuY29sb3VyQXJyYXkgPSBbXTtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IENPTE9VUl9MSVNULmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29sb3VyQXJyYXkucHVzaChQVVlPX0NPTE9VUlNbQ09MT1VSX0xJU1RbaV1dKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5udWlzYW5jZUNhc2NhZGVGUFIgPSBbXTtcclxuICAgIH1cclxuXHJcbiAgICBkcmF3UG9wcGluZyhjb2xvdXIsIHNpemUsIGZyYW1lLCB0b3RhbEZyYW1lcykge1xyXG4gICAgICAgIHRoaXMuZHJhd1B1eW8oY29sb3VyLCBzaXplICogKDEgLSBmcmFtZSAvIHRvdGFsRnJhbWVzKSk7XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlQm9hcmQoY3VycmVudEJvYXJkU3RhdGUpIHtcclxuICAgICAgICAvLyBHZXQgY3VycmVudCBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IHRvIGRyYXcgYW5kIGdldCBjdXJyZW50IHdpZHRoIGFuZCBoZWlnaHQgaW4gY2FzZSBvZiByZXNpemluZ1xyXG4gICAgICAgIGNvbnN0IHtib2FyZFN0YXRlLCBjdXJyZW50RHJvcH0gPSBjdXJyZW50Qm9hcmRTdGF0ZTtcclxuICAgICAgICBjb25zdCB7d2lkdGgsIGhlaWdodH0gPSB0aGlzLmJvYXJkO1xyXG4gICAgICAgIGNvbnN0IHtjb2xzLCByb3dzfSA9IHRoaXMuc2V0dGluZ3M7XHJcbiAgICAgICAgY29uc3QgdW5pdFcgPSB3aWR0aCAvIGNvbHM7XHJcbiAgICAgICAgY29uc3QgdW5pdEggPSBoZWlnaHQgLyByb3dzO1xyXG4gICAgICAgIGxldCBjdHggPSB0aGlzLmN0eDtcclxuXHJcbiAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgLy8gU2F2ZSBhIGNhbnZhcyB3aXRoIHRoZSBvcmlnaW4gYXQgdGhlIHRvcCBsZWZ0IChldmVyeSBzYXZlIGNvdXBsZWQgd2l0aCBhIHJlc3RvcmUpXHJcbiAgICAgICAgY3R4LnNhdmUoKTtcclxuXHJcbiAgICAgICAgLy8gTW92ZSB0aGUgY2FudmFzIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgbWlkZGxlIG9mIHRoZSBib3R0b20gbGVmdCBzcXVhcmVcclxuICAgICAgICBjdHgudHJhbnNsYXRlKDAuNSAqIHVuaXRXLCAocm93cyAtIDAuNSkgKiB1bml0SCk7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sczsgaSsrKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcm93czsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYm9hcmRTdGF0ZVtpXVtqXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh1bml0VyAqIGksIC0gdW5pdEggKiBqKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdQdXlvKGJvYXJkU3RhdGVbaV1bal0sIHVuaXRXKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY3VycmVudERyb3Auc2NoZXpvLnkgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICBjdHgudHJhbnNsYXRlKHVuaXRXICogY3VycmVudERyb3AuYXJsZS54LCAtIHVuaXRIICogY3VycmVudERyb3AuYXJsZS55KTtcclxuICAgICAgICAgICAgdGhpcy5kcmF3UHV5byhjdXJyZW50RHJvcC5jb2xvdXJzWzBdLCB1bml0Vyk7XHJcbiAgICAgICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodW5pdFcgKiBjdXJyZW50RHJvcC5zY2hlem8ueCwgLSB1bml0SCAqIGN1cnJlbnREcm9wLnNjaGV6by55KTtcclxuICAgICAgICAgICAgdGhpcy5kcmF3UHV5byhjdXJyZW50RHJvcC5jb2xvdXJzWzFdLCB1bml0Vyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh1bml0VyAqIGN1cnJlbnREcm9wLmFybGUueCwgLSB1bml0SCAqIGN1cnJlbnREcm9wLmFybGUueSk7XHJcbiAgICAgICAgICAgIHRoaXMuZHJhd0Ryb3AoY3VycmVudERyb3AsIHVuaXRXKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFJlc3RvcmUgb3JpZ2luIHRvIHRvcCBsZWZ0XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgIH1cclxuICAgIHJlc29sdmVDaGFpbnMoYm9hcmRTdGF0ZSwgcmVzb2x2aW5nU3RhdGUpIHtcclxuICAgICAgICAvLyBHZXQgY3VycmVudCBpbmZvcm1hdGlvbiBhbmQgYXNzaWduIGl0IHRvIGNvbnZlbmllbnQgdmFyaWFibGVzXHJcbiAgICAgICAgY29uc3Qge3dpZHRoLCBoZWlnaHR9ID0gdGhpcy5ib2FyZDtcclxuICAgICAgICBjb25zdCB7Y29scywgcm93cywgcG9wRnJhbWVzLCBkcm9wRnJhbWVzfSA9IHRoaXMuc2V0dGluZ3M7XHJcbiAgICAgICAgY29uc3QgdW5pdFcgPSB3aWR0aCAvIGNvbHM7XHJcbiAgICAgICAgY29uc3QgdW5pdEggPSBoZWlnaHQgLyByb3dzO1xyXG4gICAgICAgIGxldCBjdHggPSB0aGlzLmN0eDtcclxuXHJcbiAgICAgICAgaWYgKHJlc29sdmluZ1N0YXRlLmN1cnJlbnRGcmFtZSA9PSAxKSB7XHJcbiAgICAgICAgICAgIHRoaXMucG9wcGluZ1B1eW9zID0gW107XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sczsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBvcHBpbmdQdXlvcy5wdXNoKFtdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcmVzb2x2aW5nU3RhdGUucHV5b0xvY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucG9wcGluZ1B1eW9zW3Jlc29sdmluZ1N0YXRlLnB1eW9Mb2NzW2ldLmNvbF1bcmVzb2x2aW5nU3RhdGUucHV5b0xvY3NbaV0ucm93XSA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHJlc29sdmluZ1N0YXRlLm51aXNhbmNlTG9jcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wb3BwaW5nUHV5b3NbcmVzb2x2aW5nU3RhdGUubnVpc2FuY2VMb2NzW2ldLmNvbF1bcmVzb2x2aW5nU3RhdGUubnVpc2FuY2VMb2NzW2ldLnJvd10gPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG5cclxuICAgICAgICBjdHgudHJhbnNsYXRlKDAuNSAqIHVuaXRXLCAocm93cyAtIDAuNSkgKiB1bml0SCk7XHJcbiAgICAgICAgLy8gRHJhdyB0aGUgc3RhY2sgaW4gdGhlIHByZS1wb3AgcG9zaXRpb25zLCB3aXRoIHNvbWUgcHV5byBtaWQgcG9wXHJcbiAgICAgICAgaWYgKHJlc29sdmluZ1N0YXRlLmN1cnJlbnRGcmFtZSA8PSB0aGlzLnNldHRpbmdzLnBvcEZyYW1lcykge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbHM7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByb3dzICsgMTsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJvYXJkU3RhdGVbaV1bal0gIT0gbnVsbCAmJiB0aGlzLnBvcHBpbmdQdXlvc1tpXVtqXSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5zYXZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodW5pdFcgKiBpLCAtIHVuaXRIICogaik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd1B1eW8oYm9hcmRTdGF0ZVtpXVtqXSwgdW5pdFcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmVzb2x2aW5nU3RhdGUuY3VycmVudEZyYW1lIDw9IHRoaXMuc2V0dGluZ3MucG9wRnJhbWVzKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sczsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJvd3MgKyAxOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wb3BwaW5nUHV5b3NbaV1bal0gIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKHVuaXRXICogaSwgLSB1bml0SCAqIGopO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdQb3BwaW5nKGJvYXJkU3RhdGVbaV1bal0sIHVuaXRXLCByZXNvbHZpbmdTdGF0ZS5jdXJyZW50RnJhbWUsIHBvcEZyYW1lcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN0eC5yZXN0b3JlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIERyYXcgdGhlIHN0YWNrIGRyb3BwaW5nIHdpdGggdGhlIHBvcHBlZCBwdXlvcyBnb25lXHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sczsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBsZXQgbnVtVW5kZXIgPSAwO1xyXG4gICAgICAgICAgICAgICAgd2hpbGUgKGJvYXJkU3RhdGVbaV1bbnVtVW5kZXJdICE9IG51bGwgJiYgdGhpcy5wb3BwaW5nUHV5b3NbaV1bbnVtVW5kZXJdID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodW5pdFcgKiBpLCAtIHVuaXRIICogbnVtVW5kZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZHJhd1B1eW8oYm9hcmRTdGF0ZVtpXVtudW1VbmRlcl0sIHVuaXRXKTtcclxuICAgICAgICAgICAgICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIG51bVVuZGVyKys7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gbnVtVW5kZXIgKyAxOyBqIDwgYm9hcmRTdGF0ZVtpXS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChib2FyZFN0YXRlW2ldW2pdICE9IG51bGwgJiYgdGhpcy5wb3BwaW5nUHV5b3NbaV1bal0gPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjdHgudHJhbnNsYXRlKHVuaXRXICogaSwgLSB1bml0SCAqIChNYXRoLm1heChqIC0gKGogLSBudW1VbmRlcikgKiAocmVzb2x2aW5nU3RhdGUuY3VycmVudEZyYW1lIC0gcG9wRnJhbWVzKSAvIGRyb3BGcmFtZXMsIG51bVVuZGVyKSkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRyYXdQdXlvKGJvYXJkU3RhdGVbaV1bal0sIHVuaXRXKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtVW5kZXIrKztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBpbml0TnVpc2FuY2VEcm9wKG51aXNhbmNlQ2FzY2FkZUZQUikge1xyXG4gICAgICAgIHRoaXMubnVpc2FuY2VDYXNjYWRlRlBSID0gbnVpc2FuY2VDYXNjYWRlRlBSO1xyXG4gICAgfVxyXG5cclxuICAgIGRyb3BOdWlzYW5jZShib2FyZFN0YXRlLCBudWlzYW5jZVN0YXRlKSB7XHJcbiAgICAgICAgY29uc3QgeyBudWlzYW5jZUFycmF5LCBjdXJyZW50RnJhbWUgfSA9IG51aXNhbmNlU3RhdGU7XHJcbiAgICAgICAgY29uc3QgeyB3aWR0aCwgaGVpZ2h0IH0gPSB0aGlzLmJvYXJkO1xyXG4gICAgICAgIGNvbnN0IHsgY29scywgcm93cyB9ID0gdGhpcy5zZXR0aW5ncztcclxuICAgICAgICBjb25zdCB1bml0VyA9IHdpZHRoIC8gY29scztcclxuICAgICAgICBjb25zdCB1bml0SCA9IGhlaWdodCAvIHJvd3M7XHJcbiAgICAgICAgbGV0IGN0eCA9IHRoaXMuY3R4O1xyXG5cclxuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuICAgICAgICAvLyBTYXZlIGEgY2FudmFzIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdG9wIGxlZnQgKGV2ZXJ5IHNhdmUgY291cGxlZCB3aXRoIGEgcmVzdG9yZSlcclxuICAgICAgICBjdHguc2F2ZSgpO1xyXG5cclxuICAgICAgICAvLyBNb3ZlIHRoZSBjYW52YXMgd2l0aCB0aGUgb3JpZ2luIGF0IHRoZSBtaWRkbGUgb2YgdGhlIGJvdHRvbSBsZWZ0IHNxdWFyZVxyXG4gICAgICAgIGN0eC50cmFuc2xhdGUoMC41ICogdW5pdFcsIChyb3dzIC0gMC41KSAqIHVuaXRIKTtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb2xzOyBpKyspIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBib2FyZFN0YXRlW2ldLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBjdHguc2F2ZSgpO1xyXG4gICAgICAgICAgICAgICAgY3R4LnRyYW5zbGF0ZSh1bml0VyAqIGksIC0gdW5pdEggKiBqKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJhd1B1eW8oYm9hcmRTdGF0ZVtpXVtqXSwgdW5pdFcpO1xyXG4gICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBzdGFydGluZ1Jvd3NBYm92ZSA9IHRoaXMuc2V0dGluZ3MubnVpc2FuY2VTcGF3blJvdyAtIGJvYXJkU3RhdGVbaV0ubGVuZ3RoO1xyXG4gICAgICAgICAgICBjb25zdCByb3dzRHJvcHBlZCA9IE1hdGgubWluKGN1cnJlbnRGcmFtZSAvIHRoaXMubnVpc2FuY2VDYXNjYWRlRlBSW2ldLCBzdGFydGluZ1Jvd3NBYm92ZSk7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVpc2FuY2VBcnJheVtpXS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgY3R4LnNhdmUoKTtcclxuICAgICAgICAgICAgICAgIGN0eC50cmFuc2xhdGUodW5pdFcgKiBpLCAtIHVuaXRIICogKHRoaXMuc2V0dGluZ3MubnVpc2FuY2VTcGF3blJvdyAtIHJvd3NEcm9wcGVkICsgaikpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3UHV5byhQVVlPX0NPTE9VUlNbJ0dyYXknXSwgdW5pdFcpO1xyXG4gICAgICAgICAgICAgICAgY3R4LnJlc3RvcmUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gUmVzdG9yZSBvcmlnaW4gdG8gdG9wIGxlZnRcclxuICAgICAgICBjdHgucmVzdG9yZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGRyYXdGcm9tSGFzaChoYXNoKSB7XHJcbiAgICAgICAgbGV0IHNwbGl0SGFzaCA9IGhhc2guc3BsaXQoXCI6XCIpO1xyXG4gICAgICAgIHN3aXRjaCAoc3BsaXRIYXNoWzBdKSB7XHJcbiAgICAgICAgICAgIGNhc2UgXCIwXCI6IHtcclxuICAgICAgICAgICAgICAgIGxldCBib2FyZFN0YXRlID0gW107XHJcbiAgICAgICAgICAgICAgICBsZXQgYm9hcmRTdGF0ZUNvbHMgPSBzcGxpdEhhc2hbMV0uc3BsaXQoXCIsXCIpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNldHRpbmdzLmNvbHM7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGJvYXJkU3RhdGUucHVzaChbXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBib2FyZFN0YXRlQ29sc1tpXS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBib2FyZFN0YXRlW2ldLnB1c2godGhpcy5jb2xvdXJBcnJheVtib2FyZFN0YXRlQ29sc1tpXVtqXV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxldCBkcm9wQXJyYXkgPSBzcGxpdEhhc2hbMl0uc3BsaXQoXCIsXCIpO1xyXG4gICAgICAgICAgICAgICAgbGV0IGFybGUgPSB7IHg6IGRyb3BBcnJheVszXSwgeTogZHJvcEFycmF5WzRdIH07XHJcbiAgICAgICAgICAgICAgICBsZXQgc2NoZXpvID0geyB4OiBkcm9wQXJyYXlbNV0gPT0gXCJuXCIgPyBudWxsIDogZHJvcEFycmF5WzVdLCB5OiBkcm9wQXJyYXlbNl0gPT0gXCJuXCIgPyBudWxsIDogZHJvcEFycmF5WzZdIH07XHJcbiAgICAgICAgICAgICAgICBsZXQgY3VycmVudERyb3AgPSBuZXcgRHJvcChcclxuICAgICAgICAgICAgICAgICAgICBkcm9wQXJyYXlbMF0sXHJcbiAgICAgICAgICAgICAgICAgICAgW3RoaXMuY29sb3VyQXJyYXlbZHJvcEFycmF5WzFdXSwgdGhpcy5jb2xvdXJBcnJheVtkcm9wQXJyYXlbMl1dXSxcclxuICAgICAgICAgICAgICAgICAgICBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgIGFybGUsXHJcbiAgICAgICAgICAgICAgICAgICAgc2NoZXpvLFxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3BBcnJheVs3XSAqIDIgKiBNYXRoLlBJLFxyXG4gICAgICAgICAgICAgICAgICAgIGRyb3BBcnJheVs4XSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy51cGRhdGVCb2FyZCh7IGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhc2UgXCIxXCI6IHtcclxuICAgICAgICAgICAgICAgIGxldCBib2FyZFN0YXRlID0gW107XHJcbiAgICAgICAgICAgICAgICBsZXQgYm9hcmRTdGF0ZUNvbHMgPSBzcGxpdEhhc2hbMV0uc3BsaXQoXCIsXCIpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNldHRpbmdzLmNvbHM7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGJvYXJkU3RhdGUucHVzaChbXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBib2FyZFN0YXRlQ29sc1tpXS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBib2FyZFN0YXRlW2ldLnB1c2godGhpcy5jb2xvdXJBcnJheVtib2FyZFN0YXRlQ29sc1tpXVtqXV0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGxldCByZXNvbHZpbmdTdGF0ZUFycmF5ID0gc3BsaXRIYXNoWzJdLnNwbGl0KFwiLFwiKVxyXG4gICAgICAgICAgICAgICAgbGV0IHB1eW9Mb2NzID0gW107XHJcbiAgICAgICAgICAgICAgICBsZXQgcHV5b0xvY0NvbHMgPSByZXNvbHZpbmdTdGF0ZUFycmF5WzFdLnNwbGl0KFwiPlwiKTtcclxuICAgICAgICAgICAgICAgIGxldCBwdXlvTG9jUm93cyA9IHJlc29sdmluZ1N0YXRlQXJyYXlbMl0uc3BsaXQoXCI+XCIpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwdXlvTG9jQ29scy5sZW5ndGggLSAxOyBpKyspIHsgLy8gZXhjZXNzIGRlbGltaXRlciBpbiBoYXNoIGNhdXNlcyBvZmYtYnktb25lIGVycm9yIGR1ZSB0byBhIHRhaWxpbmcgXCI+XCIgY3JlYXRpbmcgYW4gdW5kZWZpbmVkIGxhc3QgZWxlbWVudFxyXG4gICAgICAgICAgICAgICAgICAgIHB1eW9Mb2NzLnB1c2goeyBjb2w6IHB1eW9Mb2NDb2xzW2ldLCByb3c6IHB1eW9Mb2NSb3dzW2ldIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGV0IG51aXNhbmNlTG9jcyA9IFtdO1xyXG4gICAgICAgICAgICAgICAgbGV0IG51aXNhbmNlTG9jQ29scyA9IHJlc29sdmluZ1N0YXRlQXJyYXlbM10uc3BsaXQoXCI+XCIpO1xyXG4gICAgICAgICAgICAgICAgbGV0IG51aXNhbmNlTG9jUm93cyA9IHJlc29sdmluZ1N0YXRlQXJyYXlbNF0uc3BsaXQoXCI+XCIpO1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudWlzYW5jZUxvY0NvbHMubGVuZ3RoIC0gMTsgaSsrKSB7IC8vIGV4Y2VzcyBkZWxpbWl0ZXIgaW4gaGFzaCBjYXVzZXMgb2ZmLWJ5LW9uZSBlcnJvciBkdWUgdG8gYSB0YWlsaW5nIFwiPlwiIGNyZWF0aW5nIGFuIHVuZGVmaW5lZCBsYXN0IGVsZW1lbnRcclxuICAgICAgICAgICAgICAgICAgICBudWlzYW5jZUxvY3MucHVzaCh7IGNvbDogbnVpc2FuY2VMb2NDb2xzW2ldLCByb3c6IG51aXNhbmNlTG9jUm93c1tpXSB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlQ2hhaW5zKGJvYXJkU3RhdGUsXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFpbjogcmVzb2x2aW5nU3RhdGVBcnJheVswXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHV5b0xvY3MsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG51aXNhbmNlTG9jcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudEZyYW1lOiByZXNvbHZpbmdTdGF0ZUFycmF5WzVdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3RhbEZyYW1lczogcmVzb2x2aW5nU3RhdGVBcnJheVs2XVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY2FzZSBcIjJcIjoge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5pdE51aXNhbmNlRHJvcChzcGxpdEhhc2hbMV0uc3BsaXQoXCIsXCIpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYXNlIFwiM1wiOiB7XHJcbiAgICAgICAgICAgICAgICBsZXQgYm9hcmRTdGF0ZSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgbGV0IGJvYXJkU3RhdGVDb2xzID0gc3BsaXRIYXNoWzFdLnNwbGl0KFwiLFwiKTtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXR0aW5ncy5jb2xzOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBib2FyZFN0YXRlLnB1c2goW10pO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYm9hcmRTdGF0ZUNvbHNbaV0ubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYm9hcmRTdGF0ZVtpXS5wdXNoKHRoaXMuY29sb3VyQXJyYXlbYm9hcmRTdGF0ZUNvbHNbaV1bal1dKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCBudWlzYW5jZVN0YXRlID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIG51aXNhbmNlQXJyYXk6IHNwbGl0SGFzaFsyXS5zcGxpdChcIixcIikubWFwKGNvbCA9PiBjb2wgPyBjb2wuc3BsaXQoXCI+XCIpLm1hcChudW0gPT4gdGhpcy5jb2xvdXJBcnJheVtudW1dKSA6IFtdKSxcclxuICAgICAgICAgICAgICAgICAgICBudWlzYW5jZUFtb3VudDogTnVtYmVyKHNwbGl0SGFzaFszXSksXHJcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudEZyYW1lOiBOdW1iZXIoc3BsaXRIYXNoWzRdKSxcclxuICAgICAgICAgICAgICAgICAgICB0b3RhbEZyYW1lczogTnVtYmVyKHNwbGl0SGFzaFs1XSlcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kcm9wTnVpc2FuY2UoYm9hcmRTdGF0ZSwgbnVpc2FuY2VTdGF0ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaGFzaEZvclVwZGF0ZShjdXJyZW50Qm9hcmRTdGF0ZSkge1xyXG4gICAgICAgIGNvbnN0IHtib2FyZFN0YXRlLCBjdXJyZW50RHJvcH0gPSBjdXJyZW50Qm9hcmRTdGF0ZTtcclxuXHJcbiAgICAgICAgbGV0IGhhc2ggPSBcIjA6XCI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBib2FyZFN0YXRlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYm9hcmRTdGF0ZVtpXS5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgaGFzaCArPSB0aGlzLmNvbG91ckFycmF5LmluZGV4T2YoYm9hcmRTdGF0ZVtpXVtqXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaGFzaCArPSBcIixcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFzaCArPSBcIjpcIjtcclxuICAgICAgICBoYXNoICs9IGN1cnJlbnREcm9wLnNoYXBlICsgXCIsXCI7IC8vIDA6IHNoYXBlXHJcbiAgICAgICAgaGFzaCArPSB0aGlzLmNvbG91ckFycmF5LmluZGV4T2YoY3VycmVudERyb3AuY29sb3Vyc1swXSkgKyBcIixcIjsgLy8gMTogY29sb3VyIDFcclxuICAgICAgICBoYXNoICs9IHRoaXMuY29sb3VyQXJyYXkuaW5kZXhPZihjdXJyZW50RHJvcC5jb2xvdXJzWzFdKSArIFwiLFwiOyAvLyAyOiBjb2xvdXIgMlxyXG4gICAgICAgIGhhc2ggKz0gY3VycmVudERyb3AuYXJsZS54ICsgXCIsXCI7IC8vIDM6IGFybGUgeFxyXG4gICAgICAgIGhhc2ggKz0gTWF0aC5yb3VuZChjdXJyZW50RHJvcC5hcmxlLnkgKiB0aGlzLnNldHRpbmdzLmhhc2hTbmFwRmFjdG9yKSAvIHRoaXMuc2V0dGluZ3MuaGFzaFNuYXBGYWN0b3IgKyBcIixcIjsgLy8gNDogYXJsZSB5IChyb3VuZGVkKVxyXG4gICAgICAgIC8vIDUgYW5kIDY6IHNjaGV6byB4IGFuZCByb3VuZGVkIHlcclxuICAgICAgICBpZiAoY3VycmVudERyb3Auc2NoZXpvLnkgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBoYXNoICs9IFwibixuLFwiXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgaGFzaCArPSBjdXJyZW50RHJvcC5zY2hlem8ueCArIFwiLFwiO1xyXG4gICAgICAgICAgICBoYXNoICs9IE1hdGgucm91bmQoY3VycmVudERyb3Auc2NoZXpvLnkgKiB0aGlzLnNldHRpbmdzLmhhc2hTbmFwRmFjdG9yKSAvIHRoaXMuc2V0dGluZ3MuaGFzaFNuYXBGYWN0b3IgKyBcIixcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFzaCArPSBNYXRoLnJvdW5kKGN1cnJlbnREcm9wLnN0YW5kYXJkQW5nbGUgLyBNYXRoLlBJIC8gMiAqIHRoaXMuc2V0dGluZ3MuaGFzaFJvdEZhY3RvcikgLyB0aGlzLnNldHRpbmdzLmhhc2hSb3RGYWN0b3IgKyBcIixcIjsgLy8gNzogYW5nbGUgaW4gcmV2IHJvdW5kZWQgdG8gbmVhcmVzdCBncmFkaWFuXHJcbiAgICAgICAgaGFzaCArPSBjdXJyZW50RHJvcC5yb3RhdGluZzsgLy8gODogcm90YXRpbmdcclxuICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgIH1cclxuICAgIGhhc2hGb3JSZXNvbHZpbmcoYm9hcmRTdGF0ZSwgcmVzb2x2aW5nU3RhdGUpIHtcclxuICAgICAgICBsZXQgaGFzaCA9IFwiMTpcIjtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJvYXJkU3RhdGUubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBib2FyZFN0YXRlW2ldLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICBoYXNoICs9IHRoaXMuY29sb3VyQXJyYXkuaW5kZXhPZihib2FyZFN0YXRlW2ldW2pdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBoYXNoICs9IFwiLFwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYXNoICs9IFwiOlwiO1xyXG4gICAgICAgIGhhc2ggKz0gcmVzb2x2aW5nU3RhdGUuY2hhaW4gKyBcIixcIjsgLy8gMDogY2hhaW5cclxuICAgICAgICAvLyAxOiBwdXlvTG9jIGNvbHNcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc29sdmluZ1N0YXRlLnB1eW9Mb2NzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGhhc2ggKz0gcmVzb2x2aW5nU3RhdGUucHV5b0xvY3NbaV0uY29sICsgXCI+XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhc2ggKz0gXCIsXCI7XHJcbiAgICAgICAgLy8gMjogcHV5b0xvYyByb3dzXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXNvbHZpbmdTdGF0ZS5wdXlvTG9jcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBoYXNoICs9IHJlc29sdmluZ1N0YXRlLnB1eW9Mb2NzW2ldLnJvdyArIFwiPlwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBoYXNoICs9IFwiLFwiO1xyXG4gICAgICAgIC8vIDM6IG51aXNhbmNlTG9jIGNvbHNcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc29sdmluZ1N0YXRlLm51aXNhbmNlTG9jcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBoYXNoICs9IHJlc29sdmluZ1N0YXRlLm51aXNhbmNlTG9jc1tpXS5jb2wgKyBcIj5cIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaGFzaCArPSBcIixcIjtcclxuICAgICAgICAvLyA0OiBudWlzYW5jZUxvYyByb3dzXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXNvbHZpbmdTdGF0ZS5udWlzYW5jZUxvY3MubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaGFzaCArPSByZXNvbHZpbmdTdGF0ZS5udWlzYW5jZUxvY3NbaV0ucm93ICsgXCI+XCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhc2ggKz0gXCIsXCI7XHJcbiAgICAgICAgaGFzaCArPSByZXNvbHZpbmdTdGF0ZS5jdXJyZW50RnJhbWUgKyBcIixcIjsgLy8gNTogY3VycmVudCBmcmFtZVxyXG4gICAgICAgIGhhc2ggKz0gcmVzb2x2aW5nU3RhdGUudG90YWxGcmFtZXM7IC8vIDY6IHRvdGFsIGZyYW1lc1xyXG4gICAgICAgIHJldHVybiBoYXNoO1xyXG4gICAgfVxyXG5cclxuICAgIGhhc2hGb3JOdWlzYW5jZUluaXQobnVpc2FuY2VDYXNjYWRlRlBSKSB7XHJcbiAgICAgICAgcmV0dXJuIFwiMjpcIiArIG51aXNhbmNlQ2FzY2FkZUZQUi5qb2luKFwiLFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBoYXNoRm9yTnVpc2FuY2UoYm9hcmRTdGF0ZSwgbnVpc2FuY2VTdGF0ZSkge1xyXG4gICAgICAgIGxldCBoYXNoID0gXCIzOlwiO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYm9hcmRTdGF0ZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJvYXJkU3RhdGVbaV0ubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgICAgIGhhc2ggKz0gdGhpcy5jb2xvdXJBcnJheS5pbmRleE9mKGJvYXJkU3RhdGVbaV1bal0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGhhc2ggKz0gXCIsXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGhhc2ggKz0gXCI6XCI7XHJcbiAgICAgICAgaGFzaCArPSBudWlzYW5jZVN0YXRlLm51aXNhbmNlQXJyYXkubWFwKGNvbCA9PiBjb2wubWFwKHB1eW8gPT4gdGhpcy5jb2xvdXJBcnJheS5pbmRleE9mKHB1eW8pKS5qb2luKFwiPlwiKSkuam9pbihcIixcIikgKyBcIjpcIjtcclxuICAgICAgICBoYXNoICs9IG51aXNhbmNlU3RhdGUubnVpc2FuY2VBbW91bnQgKyBcIjpcIjtcclxuICAgICAgICBoYXNoICs9IG51aXNhbmNlU3RhdGUuY3VycmVudEZyYW1lICsgXCI6XCI7XHJcbiAgICAgICAgaGFzaCArPSBudWlzYW5jZVN0YXRlLnRvdGFsRnJhbWVzO1xyXG4gICAgICAgIHJldHVybiBoYXNoO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgQm9hcmREcmF3ZXIgfTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBCb2FyZCB9ID0gcmVxdWlyZSgnLi9Cb2FyZC5qcycpO1xyXG5jb25zdCB7IFBVWU9fQ09MT1VSUyB9ID0gcmVxdWlyZSgnLi9VdGlscy5qcycpO1xyXG5cclxuY2xhc3MgQ3B1IHtcclxuXHRjb25zdHJ1Y3RvcihzZXR0aW5ncykge1xyXG5cdFx0aWYodGhpcy5jb25zdHJ1Y3RvciA9PT0gQ3B1KSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignQWJzdHJhY3QgY2xhc3MgY2Fubm90IGJlIGluc3RhdGlhdGVkLicpO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xyXG5cdH1cclxuXHJcblx0YXNzaWduU2V0dGluZ3Moc2V0dGluZ3MpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJldHVybnMgdGhlIG9wdGltYWwgbW92ZSBhY2NvcmRpbmcgdG8gdGhlIEFJLlxyXG5cdCAqL1xyXG5cdC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFycyovXHJcblx0Z2V0TW92ZShib2FyZFN0YXRlLCBjdXJyZW50RHJvcCkge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdnZXRNb3ZlKGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wKSBtdXN0IGJlIGltcGxlbWVudGVkIGJ5IHRoZSBzdWJjbGFzcy4nKTtcclxuXHR9XHJcblxyXG5cdGdldEF2ZXJhZ2VIZWlnaHQoYm9hcmRTdGF0ZSkge1xyXG5cdFx0cmV0dXJuIGJvYXJkU3RhdGUucmVkdWNlKChzdW0sIGNvbCkgPT4gc3VtICs9IGNvbC5sZW5ndGgsIDApIC8gdGhpcy5zZXR0aW5ncy5jb2xzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmV0dXJucyB0aGUgYmVzdCBjb2x1bW4gcGxhY2VtZW50IHdpdGggZWl0aGVyIDAgb3IgMiByb3RhdGlvbnMgdGhhdCBtYWtlcyBhIGNoYWluIGxvbmdlciB0aGFuIG1pbkNoYWluLlxyXG5cdCAqIElmIG5vbmUgZXhpc3QsIHJldHVybnMgLTEuXHJcblx0ICovXHJcblx0Y2hlY2tGb3JTaW1wbGVDaGFpbnMoYm9hcmRTdGF0ZSwgY3VycmVudERyb3AsIG1pbkNoYWluKSB7XHJcblx0XHRsZXQgcnVubmluZ01heENoYWluID0gbWluQ2hhaW47XHJcblx0XHRsZXQgY29sID0gLTE7XHJcblx0XHRmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXR0aW5ncy5jb2xzICogMjsgaSsrKSB7XHJcblx0XHRcdGNvbnN0IGN1cnJDb2wgPSBNYXRoLmZsb29yKGkgLyAyKTtcclxuXHRcdFx0Y29uc3QgYm9hcmQgPSBuZXcgQm9hcmQodGhpcy5zZXR0aW5ncywgYm9hcmRTdGF0ZSk7XHJcblx0XHRcdGlmKGkgJSAyID09PSAwKSB7XHJcblx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzFdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRib2FyZC5ib2FyZFN0YXRlW2N1cnJDb2xdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1sxXSk7XHJcblx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjaGFpbnMgPSBib2FyZC5yZXNvbHZlQ2hhaW5zKCk7XHJcblx0XHRcdGlmKGNoYWlucy5sZW5ndGggPiBydW5uaW5nTWF4Q2hhaW4pIHtcclxuXHRcdFx0XHRydW5uaW5nTWF4Q2hhaW4gPSBjaGFpbnMubGVuZ3RoO1xyXG5cdFx0XHRcdGNvbCA9IGN1cnJDb2w7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBjb2w7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZXR1cm5zIHRoZSBtb3ZlIHRoYXQgcmVzdWx0cyBpbiB0aGUgYmVzdCBjaGFpbiBsb25nZXIgdGhhbiBtaW5DaGFpbi5cclxuXHQgKiBJZiBub25lIGV4aXN0LCByZXR1cm5zIHsgY29sOiAtMSwgcm90YXRpb25zOiAtMSB9O1xyXG5cdCAqL1xyXG5cdGNoZWNrRm9yQWxsQ2hhaW5zKGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wLCBtaW5DaGFpbikge1xyXG5cdFx0bGV0IHJ1bm5pbmdNYXhDaGFpbiA9IG1pbkNoYWluO1xyXG5cdFx0bGV0IGNvbCA9IC0xO1xyXG5cdFx0bGV0IHJvdGF0aW9ucyA9IC0xO1xyXG5cdFx0Zm9yKGxldCBpID0gMDsgaSA8IHRoaXMuc2V0dGluZ3MuY29scyAqIDQ7IGkrKykge1xyXG5cdFx0XHRjb25zdCBjdXJyQ29sID0gaSAlIHRoaXMuc2V0dGluZ3MuY29scztcclxuXHRcdFx0Y29uc3QgYm9hcmQgPSBuZXcgQm9hcmQodGhpcy5zZXR0aW5ncywgYm9hcmRTdGF0ZSk7XHJcblx0XHRcdGxldCB0ZW1wUm90YXRpb25zO1xyXG5cdFx0XHRpZihpIDwgdGhpcy5zZXR0aW5ncy5jb2xzKSB7XHJcblx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzBdKTtcclxuXHRcdFx0XHR0ZW1wUm90YXRpb25zID0gMjtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmKGkgPCB0aGlzLnNldHRpbmdzLmNvbHMgKiAyKSB7XHJcblx0XHRcdFx0aWYoY3VyckNvbCA9PT0gMCkge1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbCAtIDFdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1swXSk7XHJcblx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdHRlbXBSb3RhdGlvbnMgPSAtMTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmKGkgPCB0aGlzLnNldHRpbmdzLmNvbHMgKiAzKSB7XHJcblx0XHRcdFx0aWYoY3VyckNvbCA9PT0gdGhpcy5zZXR0aW5ncy5jb2xzIC0gMSkge1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzBdKTtcclxuXHRcdFx0XHRib2FyZC5ib2FyZFN0YXRlW2N1cnJDb2wgKyAxXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdHRlbXBSb3RhdGlvbnMgPSAxO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzBdKTtcclxuXHRcdFx0XHRib2FyZC5ib2FyZFN0YXRlW2N1cnJDb2xdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1sxXSk7XHJcblx0XHRcdFx0dGVtcFJvdGF0aW9ucyA9IDA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNoYWlucyA9IGJvYXJkLnJlc29sdmVDaGFpbnMoKTtcclxuXHRcdFx0aWYoY2hhaW5zLmxlbmd0aCA+IHJ1bm5pbmdNYXhDaGFpbikge1xyXG5cdFx0XHRcdHJ1bm5pbmdNYXhDaGFpbiA9IGNoYWlucy5sZW5ndGg7XHJcblx0XHRcdFx0Y29sID0gY3VyckNvbDtcclxuXHRcdFx0XHRyb3RhdGlvbnMgPSB0ZW1wUm90YXRpb25zO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4geyBjb2wsIHJvdGF0aW9ucyB9O1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGZyb21TdHJpbmcoYWksIHNldHRpbmdzKSB7XHJcblx0XHRzd2l0Y2goYWkpIHtcclxuXHRcdFx0Y2FzZSAnUmFuZG9tJzpcclxuXHRcdFx0XHRyZXR1cm4gbmV3IFJhbmRvbUNwdShzZXR0aW5ncyk7XHJcblx0XHRcdGNhc2UgJ0ZsYXQnOlxyXG5cdFx0XHRcdHJldHVybiBuZXcgRmxhdENwdShzZXR0aW5ncyk7XHJcblx0XHRcdGNhc2UgJ1RhbGwnOlxyXG5cdFx0XHRcdHJldHVybiBuZXcgVGFsbENwdShzZXR0aW5ncyk7XHJcblx0XHRcdGNhc2UgJ0NoYWluJzpcclxuXHRcdFx0XHRyZXR1cm4gbmV3IENoYWluQ3B1KHNldHRpbmdzKTtcclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRyZXR1cm4gbmV3IFRlc3RDcHUoc2V0dGluZ3MpO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSYW5kb21DcHU6IENvbXBsZXRlbHkgcmFuZG9tIG1vdmVzLlxyXG4gKi9cclxuY2xhc3MgUmFuZG9tQ3B1IGV4dGVuZHMgQ3B1IHtcclxuXHRjb25zdHJ1Y3RvcihzZXR0aW5ncykge1xyXG5cdFx0c3VwZXIoc2V0dGluZ3MpO1xyXG5cdH1cclxuXHJcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXHJcblx0Z2V0TW92ZShib2FyZFN0YXRlLCBjdXJyZW50RHJvcCkge1xyXG5cdFx0bGV0IGNvbCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMuc2V0dGluZ3MuY29scyk7XHJcblx0XHRsZXQgcm90YXRpb25zID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogNCkgLSAyO1xyXG5cdFx0cmV0dXJuIHsgY29sLCByb3RhdGlvbnMgfTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGbGF0Q3B1OiBzdGFja3MgaG9yaXpvbnRhbGx5XHJcbiAqL1xyXG5jbGFzcyBGbGF0Q3B1IGV4dGVuZHMgQ3B1IHtcclxuXHRjb25zdHJ1Y3RvcihzZXR0aW5ncykge1xyXG5cdFx0c3VwZXIoc2V0dGluZ3MpO1xyXG5cdH1cclxuXHJcblx0Z2V0TW92ZShib2FyZFN0YXRlLCBjdXJyZW50RHJvcCkge1xyXG5cdFx0bGV0IGNvbCA9IDA7XHJcblx0XHRsZXQgcm90YXRpb25zID0gMDtcclxuXHRcdGxldCBtaW5IZWlnaHQgPSAtMTtcclxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCB0aGlzLnNldHRpbmdzLmNvbHMgLSAxOyBpKyspIHtcclxuXHRcdFx0aWYoYm9hcmRTdGF0ZVtpXS5sZW5ndGggPCBtaW5IZWlnaHQpIHtcclxuXHRcdFx0XHRtaW5IZWlnaHQgPSBib2FyZFN0YXRlW2ldLmxlbmd0aDtcclxuXHRcdFx0XHRjb2wgPSBpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Y29sID0gc3VwZXIuY2hlY2tGb3JTaW1wbGVDaGFpbnMoYm9hcmRTdGF0ZSwgY3VycmVudERyb3AsIDApO1xyXG5cclxuXHRcdHJldHVybiB7IGNvbCwgcm90YXRpb25zIH07XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogVGFsbENwdTogc3RhY2tzIHRoZSByaWdodCBzaWRlLCB0aGVuIHRoZSBsZWZ0IHNpZGVcclxuICovXHJcbmNsYXNzIFRhbGxDcHUgZXh0ZW5kcyBDcHUge1xyXG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzKSB7XHJcblx0XHRzdXBlcihzZXR0aW5ncyk7XHJcblx0fVxyXG5cclxuXHRnZXRNb3ZlKGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wKSB7XHJcblx0XHRsZXQgY29sID0gdGhpcy5zZXR0aW5ncy5jb2xzIC0gMTtcclxuXHRcdGxldCByb3RhdGlvbnMgPSAwO1xyXG5cdFx0Ly8gQXR0ZW1wdCB0byBwbGFjZSBvbiB0aGUgcmlnaHQgc2lkZSBvZiB0aGUgYm9hcmRcclxuXHRcdHdoaWxlKGJvYXJkU3RhdGVbY29sXS5sZW5ndGggPj0gdGhpcy5zZXR0aW5ncy5yb3dzIC0gMSAmJiBjb2wgPiAyKSB7XHJcblx0XHRcdGNvbC0tO1xyXG5cdFx0fVxyXG5cdFx0Ly8gQXR0ZW1wdCB0byBwbGFjZSBvbiB0aGUgbGVmdCBzaWRlIG9mIHRoZSBib2FyZFxyXG5cdFx0aWYoY29sID09PSAyKSB7XHJcblx0XHRcdGNvbCA9IDA7XHJcblx0XHRcdHdoaWxlKGJvYXJkU3RhdGVbY29sXS5sZW5ndGggPj0gdGhpcy5zZXR0aW5ncy5yb3dzIC0gMSAmJiBjb2wgPCAyKSB7XHJcblx0XHRcdFx0Y29sKys7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBPbmx5IGNvbHVtbiAyIGxlZnRcclxuXHRcdGlmKGNvbCA9PT0gMikge1xyXG5cdFx0XHRjb25zdCBub1JvdGF0aW9uQm9hcmQgPSBuZXcgQm9hcmQodGhpcy5zZXR0aW5ncywgYm9hcmRTdGF0ZSk7XHJcblx0XHRcdG5vUm90YXRpb25Cb2FyZC5ib2FyZFN0YXRlWzJdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1swXSk7XHJcblx0XHRcdG5vUm90YXRpb25Cb2FyZC5ib2FyZFN0YXRlWzJdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1sxXSk7XHJcblx0XHRcdGNvbnN0IG5vUm90YXRpb25DaGFpbnMgPSBub1JvdGF0aW9uQm9hcmQucmVzb2x2ZUNoYWlucygpO1xyXG5cclxuXHRcdFx0Y29uc3QgeWVzUm90YXRpb25Cb2FyZCA9IG5ldyBCb2FyZCh0aGlzLnNldHRpbmdzLCBib2FyZFN0YXRlKTtcclxuXHRcdFx0eWVzUm90YXRpb25Cb2FyZC5ib2FyZFN0YXRlWzJdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1sxXSk7XHJcblx0XHRcdHllc1JvdGF0aW9uQm9hcmQuYm9hcmRTdGF0ZVsyXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHRjb25zdCB5ZXNSb3RhdGlvbkNoYWlucyA9IHllc1JvdGF0aW9uQm9hcmQucmVzb2x2ZUNoYWlucygpO1xyXG5cclxuXHRcdFx0aWYoeWVzUm90YXRpb25DaGFpbnMubGVuZ3RoID4gbm9Sb3RhdGlvbkNoYWlucy5sZW5ndGgpIHtcclxuXHRcdFx0XHRyb3RhdGlvbnMgPSAyO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsgY29sLCByb3RhdGlvbnMgfTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGFpbkNwdTogR29lcyBmb3IgdGhlIGxvbmdlc3QgcG9zc2libGUgY2hhaW4gcmVzdWx0IGdpdmVuIHRoZSBjdXJyZW50IGRyb3AuXHJcbiAqIE90aGVyd2lzZSwgcGxhY2VzIHJhbmRvbWx5LlxyXG4gKi9cclxuY2xhc3MgQ2hhaW5DcHUgZXh0ZW5kcyBDcHUge1xyXG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzKSB7XHJcblx0XHRzdXBlcihzZXR0aW5ncyk7XHJcblx0fVxyXG5cclxuXHRnZXRNb3ZlKGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wKSB7XHJcblx0XHRsZXQgY29sID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5zZXR0aW5ncy5jb2xzKTtcclxuXHRcdGxldCByb3RhdGlvbnMgPSAwO1xyXG5cclxuXHRcdC8vIERldGVyIGFnYWluc3QgcmFuZG9tIHBsYWNlbWVudHMgaW4gY29sdW1uIDIgKHdoZW4gMC1pbmRleGVkKVxyXG5cdFx0d2hpbGUoY29sID09PSAyKSB7XHJcblx0XHRcdGNvbCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIHRoaXMuc2V0dGluZ3MuY29scyk7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29sID0gc3VwZXIuY2hlY2tGb3JTaW1wbGVDaGFpbnMoYm9hcmRTdGF0ZSwgY3VycmVudERyb3AsIDEpO1xyXG5cclxuXHRcdHJldHVybiB7IGNvbCwgcm90YXRpb25zIH07XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogVGVzdENwdTogQ2hhaW5DUFUsIGJ1dCBpbnN0ZWFkIG9mIHBsYWNpbmcgcmFuZG9tbHkgaXQgYXR0ZW1wdHMgdG8gY29ubmVjdCBhIGNvbG91ci5cclxuICovXHJcbmNsYXNzIFRlc3RDcHUgZXh0ZW5kcyBDcHUge1xyXG5cdGNvbnN0cnVjdG9yKHNldHRpbmdzLCBzcGVlZCkge1xyXG5cdFx0c3VwZXIoc2V0dGluZ3MsIHNwZWVkKTtcclxuXHR9XHJcblxyXG5cdGdldE1vdmUoYm9hcmRTdGF0ZSwgY3VycmVudERyb3ApIHtcclxuXHRcdGNvbnN0IGF2ZXJhZ2VIZWlnaHQgPSBzdXBlci5nZXRBdmVyYWdlSGVpZ2h0KGJvYXJkU3RhdGUpO1xyXG5cdFx0bGV0IG1pbkNoYWluID0gKGF2ZXJhZ2VIZWlnaHQgPiB0aGlzLnNldHRpbmdzLnJvd3MgKiAzIC8gNCkgPyAwIDpcclxuXHRcdFx0XHRcdFx0XHQoYXZlcmFnZUhlaWdodCA+IHRoaXMuc2V0dGluZ3Mucm93cyAvIDIpID8gMiA6XHJcblx0XHRcdFx0XHRcdFx0KGF2ZXJhZ2VIZWlnaHQgPiB0aGlzLnNldHRpbmdzLnJvd3MgLyAyKSA/IDMgOiA0O1xyXG5cclxuXHRcdGxldCB7IGNvbCwgcm90YXRpb25zfSA9IHN1cGVyLmNoZWNrRm9yQWxsQ2hhaW5zKGJvYXJkU3RhdGUsIGN1cnJlbnREcm9wLCBtaW5DaGFpbik7XHJcblxyXG5cdFx0Ly8gVW5hYmxlIHRvIGZpbmQgYW4gYXBwcm9wcmlhdGUgY2hhaW5cclxuXHRcdGlmKGNvbCA9PT0gLTEpIHtcclxuXHRcdFx0bGV0IG1heFZhbHVlID0gLTE7XHJcblxyXG5cdFx0XHRmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXR0aW5ncy5jb2xzICogNDsgaSsrKSB7XHJcblx0XHRcdFx0Y29uc3QgY3VyckNvbCA9IGkgJSB0aGlzLnNldHRpbmdzLmNvbHM7XHJcblx0XHRcdFx0Y29uc3QgYm9hcmQgPSBuZXcgQm9hcmQodGhpcy5zZXR0aW5ncywgYm9hcmRTdGF0ZSk7XHJcblx0XHRcdFx0bGV0IHRlbXBSb3RhdGlvbnM7XHJcblx0XHRcdFx0aWYoaSA8IHRoaXMuc2V0dGluZ3MuY29scykge1xyXG5cdFx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHRcdFx0dGVtcFJvdGF0aW9ucyA9IDI7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2UgaWYoaSA8IHRoaXMuc2V0dGluZ3MuY29scyAqIDIpIHtcclxuXHRcdFx0XHRcdGlmKGN1cnJDb2wgPT09IDApIHtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRib2FyZC5ib2FyZFN0YXRlW2N1cnJDb2wgLSAxXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHRcdFx0dGVtcFJvdGF0aW9ucyA9IC0xO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlIGlmKGkgPCB0aGlzLnNldHRpbmdzLmNvbHMgKiAzKSB7XHJcblx0XHRcdFx0XHRpZihjdXJyQ29sID09PSB0aGlzLnNldHRpbmdzLmNvbHMgLSAxKSB7XHJcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sXS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMF0pO1xyXG5cdFx0XHRcdFx0Ym9hcmQuYm9hcmRTdGF0ZVtjdXJyQ29sICsgMV0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzFdKTtcclxuXHRcdFx0XHRcdHRlbXBSb3RhdGlvbnMgPSAxO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzBdKTtcclxuXHRcdFx0XHRcdGJvYXJkLmJvYXJkU3RhdGVbY3VyckNvbF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzFdKTtcclxuXHRcdFx0XHRcdHRlbXBSb3RhdGlvbnMgPSAwO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0bGV0IGRldGVycmVudCA9IChjdXJyQ29sID09PSAyKSA/IGJvYXJkU3RhdGVbMl0ubGVuZ3RoIDogdGhpcy5nZXRTa3lTY3JhcGVyVmFsdWUoYm9hcmQsIGN1cnJDb2wpO1xyXG5cclxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuZXZhbHVhdGVCb2FyZChib2FyZCkgLSBkZXRlcnJlbnQ7XHJcblxyXG5cdFx0XHRcdGlmKHZhbHVlID4gbWF4VmFsdWUpIHtcclxuXHRcdFx0XHRcdGNvbCA9IGN1cnJDb2w7XHJcblx0XHRcdFx0XHRtYXhWYWx1ZSA9IHZhbHVlO1xyXG5cdFx0XHRcdFx0cm90YXRpb25zID0gdGVtcFJvdGF0aW9ucztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBTdGlsbCBjYW5ub3QgZmluZCBhbiBhcHByb3ByaWF0ZSBwbGFjZW1lbnQsIHNvIHBsYWNlIHNlbWktcmFuZG9tbHlcclxuXHRcdGlmKGNvbCA9PT0gLTEpICB7XHJcblx0XHRcdGNvbnN0IGFsbG93ZWRDb2xzID0gWzAsIDVdO1xyXG5cdFx0XHRmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXR0aW5ncy5jb2xzOyBpKyspIHtcclxuXHRcdFx0XHRpZihpICE9PSAwICYmIGkgIT09IHRoaXMuc2V0dGluZ3MuY29scyAtIDEpIHtcclxuXHRcdFx0XHRcdGlmKChib2FyZFN0YXRlW2ldLmxlbmd0aCAtIGJvYXJkU3RhdGVbaS0xXS5sZW5ndGgpICsgKGJvYXJkU3RhdGVbaV0ubGVuZ3RoIC0gYm9hcmRTdGF0ZVtpKzFdLmxlbmd0aCkgPCAzKSB7XHJcblx0XHRcdFx0XHRcdGFsbG93ZWRDb2xzLnB1c2goaSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb2wgPSBhbGxvd2VkQ29sc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhbGxvd2VkQ29scy5sZW5ndGgpXTtcclxuXHJcblx0XHRcdC8vIERldGVyIGFnYWluc3QgcmFuZG9tIHBsYWNlbWVudHMgaW4gY29sdW1uIDIgKHdoZW4gMC1pbmRleGVkKVxyXG5cdFx0XHRpZihjb2wgPT09IDIpIHtcclxuXHRcdFx0XHRjb2wgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLnNldHRpbmdzLmNvbHMpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsgY29sLCByb3RhdGlvbnMgfTtcclxuXHR9XHJcblxyXG5cdGdldFNreVNjcmFwZXJWYWx1ZShib2FyZCwgY29sKSB7XHJcblx0XHRjb25zdCBib2FyZFN0YXRlID0gYm9hcmQuYm9hcmRTdGF0ZTtcclxuXHRcdGxldCB2YWx1ZSA9IDIgKiBib2FyZFN0YXRlW2NvbF0ubGVuZ3RoO1xyXG5cdFx0aWYoY29sICE9PSAwKSB7XHJcblx0XHRcdHZhbHVlIC09IGJvYXJkU3RhdGVbY29sIC0gMV0ubGVuZ3RoO1xyXG5cdFx0fVxyXG5cdFx0aWYoY29sICE9PSB0aGlzLnNldHRpbmdzLmNvbHMgLSAxKSB7XHJcblx0XHRcdHZhbHVlIC09IGJvYXJkU3RhdGVbY29sICsgMV0ubGVuZ3RoO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHZhbHVlIC8gMjtcclxuXHR9XHJcblxyXG5cdGV2YWx1YXRlQm9hcmQoYm9hcmQpIHtcclxuXHRcdGNvbnN0IHZpc2l0ZWQgPSBbXTtcdFx0XHRcdC8vIExpc3Qgb2YgdmlzaXRlZCBsb2NhdGlvbnNcclxuXHRcdGxldCB2YWx1ZSA9IDA7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQZXJmb3JtcyBhIERGUyB0aHJvdWdoIHRoZSBjdXJyZW50IGJvYXJkIHRvIGZpbmQgdGhlIGV4dGVudCBvZiBhIGNvbG91ciwgZ2l2ZW4gYSBzdGFydGluZyBwdXlvLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSAge29iamVjdH0gcHV5byAgICAgICAgXHRUaGUgY3VycmVudCBwdXlvLCBnaXZlbiBhcyB7Y29sOiBudW1iZXIsIHJvdzogbnVtYmVyLCBjb2xvdXI6IHJnYmEgdmFsdWV9XHJcblx0XHQgKiBAcGFyYW0gIHtudW1iZXJ9IGNvbG91cl9sZW5ndGggICBUaGUgcnVubmluZyBsZW5ndGggb2YgdGhlIHB1eW8gY2hhaW4uXHJcblx0XHQgKiBAcmV0dXJuIHtvYmplY3R9ICAgICAgICAgICAgICAgICBUaGUgYnJhbmNoJ3MgcmVzdWx0LCBnaXZlbiBhcyB7bGVuZ3RoOiBjb2xvdXJfbGVuZ3RoLCBwdXlvczogY2hhaW5fcHV5b3N9LlxyXG5cdFx0ICovXHJcblx0XHRjb25zdCBkZnMgPSBmdW5jdGlvbihwdXlvLCBjb2xvdXJfbGVuZ3RoKSB7XHJcblx0XHRcdHZpc2l0ZWQucHVzaChwdXlvKTtcclxuXHRcdFx0Y29uc3QgeyBjb2wsIHJvdywgY29sb3VyIH0gPSBwdXlvO1xyXG5cclxuXHRcdFx0Ly8gU2VhcmNoIGluIGFsbCA0IGNhcmRpbmFsIGRpcmVjdGlvbnNcclxuXHRcdFx0Zm9yKGxldCBpID0gLTE7IGkgPD0gMTsgaSsrKSB7XHJcblx0XHRcdFx0Zm9yKGxldCBqID0gLTE7IGogPD0gMTsgaisrKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuZXdfcHV5byA9IHsgY29sOiBjb2wgKyBpLCByb3c6IHJvdyArIGogfTtcclxuXHJcblx0XHRcdFx0XHRpZihNYXRoLmFicyhpKSArIE1hdGguYWJzKGopID09PSAxICYmIGJvYXJkLnZhbGlkTG9jKG5ld19wdXlvKSkge1xyXG5cdFx0XHRcdFx0XHRuZXdfcHV5by5jb2xvdXIgPSBib2FyZC5ib2FyZFN0YXRlW2NvbCArIGldW3JvdyArIGpdO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gTmV3IGxvY2F0aW9uIG11c3QgYmUgdW52aXNpdGVkIGFuZCBoYXZlIHRoZSBzYW1lIGNvbG91ciBwdXlvXHJcblx0XHRcdFx0XHRcdGlmKG5vdFZpc2l0ZWQobmV3X3B1eW8pICYmIGNvbG91ciA9PT0gbmV3X3B1eW8uY29sb3VyKSB7XHJcblx0XHRcdFx0XHRcdFx0Ly8gVXBkYXRlIHdpdGggdGhlIGxlYWYgcHV5byBvZiB0aGlzIGJyYW5jaFxyXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxlbmd0aCA9IGRmcyhuZXdfcHV5bywgY29sb3VyX2xlbmd0aCArIDEpO1xyXG5cdFx0XHRcdFx0XHRcdGNvbG91cl9sZW5ndGggPSBsZW5ndGg7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gRG9uZSB3aXRoIGFsbCBicmFuY2hlcywgcmV0dXJuIHRoZSBmaW5kaW5nc1xyXG5cdFx0XHRyZXR1cm4gY29sb3VyX2xlbmd0aDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERldGVybWluZXMgaWYgdGhlIHZpc2l0ZWQgYXJyYXkgY29udGFpbnMgdGhlIHBhc3NlZCBsb2NhdGlvbi5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3Qgbm90VmlzaXRlZCA9IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XHJcblx0XHRcdGNvbnN0IHsgY29sLCByb3cgfSA9IGxvY2F0aW9uO1xyXG5cdFx0XHRyZXR1cm4gdmlzaXRlZC5maWx0ZXIobG9jID0+IGxvYy5jb2wgPT09IGNvbCAmJiBsb2Mucm93ID09PSByb3cpLmxlbmd0aCA9PT0gMDtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJdGVyYXRlIHRocm91Z2ggdGhlIGVudGlyZSBib2FyZCB0byBmaW5kIGFsbCBzdGFydGluZyBwb2ludHNcclxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCBib2FyZC5ib2FyZFN0YXRlLmxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdGZvcihsZXQgaiA9IDA7IGogPCBib2FyZC5ib2FyZFN0YXRlW2ldLmxlbmd0aDsgaisrKSB7XHJcblx0XHRcdFx0Y29uc3QgcHV5byA9IHsgY29sOiBpLCByb3c6IGosIGNvbG91cjogYm9hcmQuYm9hcmRTdGF0ZVtpXVtqXSB9O1xyXG5cclxuXHRcdFx0XHRpZihub3RWaXNpdGVkKHB1eW8pICYmIHB1eW8uY29sb3VyICE9PSBQVVlPX0NPTE9VUlNbJ0dyYXknXSkge1xyXG5cdFx0XHRcdFx0Ly8gRmluZCB0aGUgZXh0ZW50IG9mIHRoaXMgY29sb3VyLCBzdGFydGluZyBoZXJlXHJcblx0XHRcdFx0XHRjb25zdCBsZW5ndGggPSBkZnMocHV5bywgMSwgW3B1eW9dKTtcclxuXHRcdFx0XHRcdGlmKGxlbmd0aCA8IDQpIHtcclxuXHRcdFx0XHRcdFx0dmFsdWUgKz0gbGVuZ3RoICogbGVuZ3RoO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHZhbHVlO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0UmFuZG9tQ3B1LFxyXG5cdFRhbGxDcHUsXHJcblx0RmxhdENwdSxcclxuXHRDaGFpbkNwdSxcclxuXHRUZXN0Q3B1XHJcbn1cclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBHYW1lIH0gPSByZXF1aXJlKCcuL0dhbWUuanMnKTtcclxuY29uc3QgeyBVc2VyU2V0dGluZ3MgfSA9IHJlcXVpcmUoJy4vVXRpbHMuanMnKTtcclxuXHJcbmNsYXNzIENwdUdhbWUgZXh0ZW5kcyBHYW1lIHtcclxuXHRjb25zdHJ1Y3RvcihnYW1lSWQsIG9wcG9uZW50SWRzLCBzb2NrZXQsIGJvYXJkRHJhd2VySWQsIGFpLCBzcGVlZCwgc2V0dGluZ3MpIHtcclxuXHRcdHN1cGVyKGdhbWVJZCwgb3Bwb25lbnRJZHMsIHNvY2tldCwgYm9hcmREcmF3ZXJJZCwgc2V0dGluZ3MsIG5ldyBVc2VyU2V0dGluZ3MoKSk7XHJcblxyXG5cdFx0dGhpcy5haSA9IGFpO1x0XHRcdFx0XHQvLyBUaGUgYWxnb3JpdGhtIHVzZWQgdG8gZGV0ZXJtaW5lIHRoZSBvcHRpbWFsIG1vdmVcclxuXHRcdHRoaXMuYWkuYXNzaWduU2V0dGluZ3ModGhpcy5zZXR0aW5ncyk7XHJcblx0XHR0aGlzLnNvZnREcm9wU3BlZWQgPSBzcGVlZDtcdFx0XHRcdC8vIE51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gd2FpdCBiZWZvcmUgc29mdCBkcm9wcGluZ1xyXG5cdFx0dGhpcy5tb3ZlbWVudFNwZWVkID0gc3BlZWQgLyA4O1x0XHQvLyBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHdhaXQgYmVmb3JlIHBlcmZvcm1pbmcgYSBtb3ZlXHJcblx0XHR0aGlzLmN1cnJlbnRNb3ZlID0gbnVsbDtcdFx0Ly8gVGhlIGN1cnJlbnQgb3B0aW1hbCBtb3ZlXHJcblx0XHR0aGlzLnJvdGF0aW9ucyA9IDA7XHRcdFx0XHQvLyBSb3RhdGlvbnMgcGVyZm9ybWVkIG9uIHRoZSBjdXJyZW50IGRyb3AgKGJldHdlZW4gLTIgYW5kIDIpXHJcblx0XHR0aGlzLmxhc3RBcmxlID0gbnVsbDtcdFx0XHQvLyBUaGUgbG9jYXRpb24gb2YgdGhlIGFybGUgaW4gdGhlIGxhc3QgZnJhbWUgKHVzZWQgdG8gZGV0ZWN0IHdoZXRoZXIgYSBkcm9wIGlzIHN0dWNrKVxyXG5cclxuXHRcdHRoaXMuc29mdERyb3BUaW1lciA9IERhdGUubm93KCk7XHRcdC8vIFRpbWVyIHRvIG1lYXN1cmUgbWlsbGlzZWNvbmRzIGJlZm9yZSBzb2Z0IGRyb3BcclxuXHRcdHRoaXMubW92ZW1lbnRUaW1lciA9IERhdGUubm93KCk7XHRcdC8vIFRpbWVyIHRvIG1lYXN1cmUgbWlsbGlzZWNvbmRzIGJlZm9yZSBtb3ZlbWVudFxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQE92ZXJyaWRlXHJcblx0ICogQXBwbHkgYW4gaW5wdXQgZm9yIHRoZSBDUFUuIFVzZWQgdG8gZ2V0IHRoZSBjdXJyZW50IGRyb3AgdG8gdGhlIG9wdGltYWwgbW92ZSBwb3NpdGlvbi5cclxuXHQgKi9cclxuXHRnZXRJbnB1dHMoKSB7XHJcblx0XHRpZih0aGlzLmN1cnJlbnRNb3ZlID09PSBudWxsKSB7XHJcblx0XHRcdHRoaXMuY3VycmVudE1vdmUgPSB0aGlzLmFpLmdldE1vdmUodGhpcy5ib2FyZC5ib2FyZFN0YXRlLCB0aGlzLmN1cnJlbnREcm9wKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBEbyBub3QgbW92ZS9yb3RhdGUgaWYgbW92ZW1lbnQgdGltZXIgaXMgbm90IGZ1bGZpbGxlZFxyXG5cdFx0aWYoRGF0ZS5ub3coKSAtIHRoaXMubW92ZW1lbnRUaW1lciA8IHRoaXMubW92ZW1lbnRTcGVlZCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IGFwcGxpZWQgPSBmYWxzZTtcclxuXHRcdGNvbnN0IHsgY29sLCByb3RhdGlvbnMgfSA9IHRoaXMuY3VycmVudE1vdmU7XHJcblxyXG5cdFx0Ly8gTW92ZSBkcm9wIHRvIGNvcnJlY3QgY29sdW1uXHJcblx0XHRpZih0aGlzLmN1cnJlbnREcm9wLmFybGUueCA8IGNvbCkge1xyXG5cdFx0XHR0aGlzLm1vdmUoJ1JpZ2h0Jyk7XHJcblx0XHRcdGFwcGxpZWQgPSB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZih0aGlzLmN1cnJlbnREcm9wLmFybGUueCA+IGNvbCkge1xyXG5cdFx0XHR0aGlzLm1vdmUoJ0xlZnQnKTtcclxuXHRcdFx0YXBwbGllZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUGVyZm9ybSBjb3JyZWN0IGFtb3VudCBvZiByb3RhdGlvbnNcclxuXHRcdGlmKHRoaXMuY3VycmVudERyb3Aucm90YXRpbmcgPT09ICdub3QnKSB7XHJcblx0XHRcdGlmKHRoaXMucm90YXRpb25zIDwgcm90YXRpb25zKSB7XHJcblx0XHRcdFx0dGhpcy5yb3RhdGUoJ0NXJyk7XHJcblx0XHRcdFx0dGhpcy5yb3RhdGlvbnMrKztcclxuXHRcdFx0XHRhcHBsaWVkID0gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIGlmKHRoaXMucm90YXRpb25zID4gcm90YXRpb25zKSB7XHJcblx0XHRcdFx0dGhpcy5yb3RhdGUoJ0NDVycpO1xyXG5cdFx0XHRcdHRoaXMucm90YXRpb25zLS07XHJcblx0XHRcdFx0YXBwbGllZCA9IHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBJZiBhY3Rpb24gd2FzIHRha2VuLCByZXNldCB0aGUgbW92ZW1lbnQgdGltZXJcclxuXHRcdGlmKGFwcGxpZWQpIHtcclxuXHRcdFx0dGhpcy5tb3ZlbWVudFRpbWVyID0gRGF0ZS5ub3coKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJZiBubyBhY3Rpb24gbmVlZHMgdG8gYmUgdGFrZW4gb3IgdGhlIGRyb3AgaXMgc3R1Y2ssIHNvZnQgZHJvcFxyXG5cdFx0aWYoIWFwcGxpZWQgfHwgKHRoaXMubGFzdEFybGUgIT09IG51bGwgJiYgSlNPTi5zdHJpbmdpZnkodGhpcy5jdXJyZW50RHJvcC5hcmxlKSA9PT0gSlNPTi5zdHJpbmdpZnkodGhpcy5sYXN0QXJsZSkpKSB7XHJcblx0XHRcdC8vIE11c3QgYWxzbyBtZWV0IHNwZWVkIHRocmVzaG9sZFxyXG5cdFx0XHRpZihEYXRlLm5vdygpIC0gdGhpcy5zb2Z0RHJvcFRpbWVyID4gdGhpcy5zb2Z0RHJvcFNwZWVkKSB7XHJcblx0XHRcdFx0dGhpcy5tb3ZlKCdEb3duJyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLmxhc3RBcmxlID0gT2JqZWN0LmFzc2lnbih0aGlzLmN1cnJlbnREcm9wLmFybGUpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWZ0ZXIgbG9ja2luZyBhIGRyb3AsIGFsc28gcmVzZXQgdGhlIGN1cnJlbnRNb3ZlIGFuZCB0aW1lci5cclxuXHQgKi9cclxuXHRsb2NrRHJvcCgpIHtcclxuXHRcdHN1cGVyLmxvY2tEcm9wKCk7XHJcblx0XHR0aGlzLmN1cnJlbnRNb3ZlID0gbnVsbDtcclxuXHRcdHRoaXMucm90YXRpb25zID0gMDtcclxuXHRcdHRoaXMuc29mdERyb3BUaW1lciA9IERhdGUubm93KCk7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgQ3B1R2FtZSB9O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5jb25zdCB7IFV0aWxzIH0gPSByZXF1aXJlKCcuL1V0aWxzLmpzJyk7XHJcblxyXG5jbGFzcyBEcm9wIHtcclxuXHRjb25zdHJ1Y3RvciAoc2hhcGUsIGNvbG91cnMsIHNldHRpbmdzLCBhcmxlID0geyB4OiAyLCB5OiAxMS41IH0sIHNjaGV6byA9IHsgeDogbnVsbCwgeTogbnVsbCB9LCBzdGFuZGFyZEFuZ2xlID0gMCwgcm90YXRpbmcgPSAnbm90Jykge1xyXG5cdFx0dGhpcy5zaGFwZSA9IHNoYXBlO1xyXG5cdFx0dGhpcy5jb2xvdXJzID0gY29sb3VycztcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHRcdHRoaXMuYXJsZSA9IGFybGU7XHJcblx0XHR0aGlzLnNjaGV6byA9IHNjaGV6bztcclxuXHRcdHRoaXMuc3RhbmRhcmRBbmdsZSA9IHN0YW5kYXJkQW5nbGU7XHJcblx0XHR0aGlzLnJvdGF0aW5nID0gcm90YXRpbmc7XHJcblxyXG5cdFx0Ly8gU3BlY2lhbCBjb3VudGVyIHRvIGRldGVybWluZSB0aGUgc3RhZ2Ugb2YgMTgwIHJvdGF0aW9uLiAyIGlzICdmaXJzdCBoYWxmJywgMSBpcyAnc2Vjb25kIGhhbGYnLCAwIGlzICdub3QnLlxyXG5cdFx0dGhpcy5yb3RhdGluZzE4MCA9IDA7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZXR1cm5zIGEgbmV3LCByYW5kb20gZHJvcCBkZXRlcm1pbmVkIGJ5IHRoZSBnYW1lbW9kZSBhbmQgdGhlIHBsYXllcidzIGRyb3BzZXQuXHJcblx0ICovXHJcblx0c3RhdGljIGdldE5ld0Ryb3Aoc2V0dGluZ3MsIGNvbG91cnMpIHtcclxuXHRcdGxldCBzaGFwZTtcclxuXHRcdGlmKHNldHRpbmdzLmdhbWVtb2RlID09PSAnVHN1Jykge1xyXG5cdFx0XHRzaGFwZSA9ICdJJztcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHQvLyBHZXQgdGhlIHNoYXBlIGZyb20gdGhlIGRyb3BzZXRcclxuXHRcdFx0c2hhcGUgPSBzZXR0aW5ncy5kcm9wc2V0W3NldHRpbmdzLmRyb3BzZXRfcG9zaXRpb25dO1xyXG5cdFx0XHRzZXR0aW5ncy5kcm9wc2V0X3Bvc2l0aW9uKys7XHJcblxyXG5cdFx0XHQvLyBDaGVjayBpZiB0aGUgZW5kIG9mIHRoZSBkcm9wc2V0IGhhcyBiZWVuIHJlYWNoZWRcclxuXHRcdFx0aWYoc2V0dGluZ3MuZHJvcHNldF9wb3NpdGlvbiA9PSAxNykge1xyXG5cdFx0XHRcdHNldHRpbmdzLmRyb3BzZXRfcG9zaXRpb24gPSAxO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmV0dXJucyBhbiBhcnJheSBvZiBjb2xvdXJzIGJhc2VkIG9uIHRoZSBzaGFwZSBvZiB0aGUgZHJvcFxyXG5cdFx0Y29uc3QgZ2V0UHV5b3NGcm9tU2hhcGUgPSBmdW5jdGlvbiAoc2hhcGUpIHtcclxuXHRcdFx0Y29uc3QgZmlyc3RfY29sID0gKGNvbG91cnMgJiYgY29sb3Vyc1swXSkgfHwgVXRpbHMuZ2V0UmFuZG9tQ29sb3VyKHNldHRpbmdzLm51bUNvbG91cnMpO1xyXG5cdFx0XHRjb25zdCBzZWNvbmRfY29sID0gKGNvbG91cnMgJiYgY29sb3Vyc1sxXSkgfHwgVXRpbHMuZ2V0UmFuZG9tQ29sb3VyKHNldHRpbmdzLm51bUNvbG91cnMpO1xyXG5cdFx0XHRzd2l0Y2goc2hhcGUpIHtcclxuXHRcdFx0XHRjYXNlICdJJzpcclxuXHRcdFx0XHRcdHJldHVybiBbZmlyc3RfY29sLCBzZWNvbmRfY29sXTtcclxuXHRcdFx0XHRjYXNlICdoJzpcclxuXHRcdFx0XHRcdHJldHVybiBbZmlyc3RfY29sLCBmaXJzdF9jb2wsIHNlY29uZF9jb2xdO1xyXG5cdFx0XHRcdGNhc2UgJ0wnOlxyXG5cdFx0XHRcdFx0cmV0dXJuIFtmaXJzdF9jb2wsIHNlY29uZF9jb2wsIHNlY29uZF9jb2xdO1xyXG5cdFx0XHRcdGNhc2UgJ0gnOlxyXG5cdFx0XHRcdFx0cmV0dXJuIFtmaXJzdF9jb2wsIGZpcnN0X2NvbCwgc2Vjb25kX2NvbCwgc2Vjb25kX2NvbF07XHJcblx0XHRcdFx0Y2FzZSAnTyc6XHJcblx0XHRcdFx0XHRyZXR1cm4gW2ZpcnN0X2NvbCwgZmlyc3RfY29sLCBmaXJzdF9jb2wsIGZpcnN0X2NvbF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiBuZXcgRHJvcChzaGFwZSwgZ2V0UHV5b3NGcm9tU2hhcGUoc2hhcGUpLCBzZXR0aW5ncyk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSZXR1cm5zIGEgbmV3LCBpZGVudGljYWwgRHJvcC5cclxuXHQgKlxyXG5cdCAqIE5PVEU6IFRoZSBzZXR0aW5ncyBvYmplY3Qgb25seSB1c2VzIGEgc2hhbGxvdyBjb3B5LlxyXG5cdCAqIEhvd2V2ZXIsIGl0IHNob3VsZCBub3QgYmUgYWJsZSB0byBiZSBtb2RpZmllZCBkdXJpbmcgYSBnYW1lLlxyXG5cdCAqL1xyXG5cdGNvcHkoKSB7XHJcblx0XHRyZXR1cm4gbmV3IERyb3AoXHJcblx0XHRcdHRoaXMuc2hhcGUsXHJcblx0XHRcdHRoaXMuY29sb3Vycy5zbGljZSgpLFxyXG5cdFx0XHR0aGlzLnNldHRpbmdzLFxyXG5cdFx0XHRVdGlscy5vYmplY3RDb3B5KHRoaXMuYXJsZSksXHJcblx0XHRcdFV0aWxzLm9iamVjdENvcHkodGhpcy5zY2hlem8pLFxyXG5cdFx0XHR0aGlzLnN0YW5kYXJkQW5nbGUsXHJcblx0XHRcdHRoaXMucm90YXRpbmcpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTW92ZXMgYSBEcm9wLiBWYWxpZGF0aW9uIGlzIGRvbmUgYmVmb3JlIGNhbGxpbmcgdGhpcyBtZXRob2QuXHJcblx0ICovXHJcblx0c2hpZnQoZGlyZWN0aW9uLCBhbW91bnQgPSAxKSB7XHJcblx0XHRzd2l0Y2goZGlyZWN0aW9uKSB7XHJcblx0XHRcdGNhc2UgJ0xlZnQnOlxyXG5cdFx0XHRcdHRoaXMuYXJsZS54IC09IGFtb3VudDtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnUmlnaHQnOlxyXG5cdFx0XHRcdHRoaXMuYXJsZS54ICs9IGFtb3VudDtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0Y2FzZSAnRG93bic6XHJcblx0XHRcdFx0dGhpcy5hcmxlLnkgLT0gdGhpcy5zZXR0aW5ncy5zb2Z0RHJvcDtcclxuXHRcdFx0XHRpZih0aGlzLmFybGUueSA8IDApIHtcclxuXHRcdFx0XHRcdHRoaXMuYXJsZS55ID0gMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdGNhc2UgJ1VwJzpcclxuXHRcdFx0XHR0aGlzLmFybGUueSArPSBhbW91bnQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBSb3RhdGVzIGEgRHJvcC4gVmFsaWRhdGlvbiBpcyBkb25lIGJlZm9yZSBjYWxsaW5nIHRoaXMgbWV0aG9kLlxyXG5cdCAqL1xyXG5cdHJvdGF0ZShkaXJlY3Rpb24sIGFuZ2xlKSB7XHJcblx0XHRpZihhbmdsZSA9PT0gMTgwKSB7XHJcblx0XHRcdHRoaXMucm90YXRpbmcxODAgPSAyO1xyXG5cdFx0fVxyXG5cdFx0dGhpcy5yb3RhdGluZyA9IGRpcmVjdGlvbjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGxpZXMgdGhlIGVmZmVjdCBvZiBncmF2aXR5IHRvIHRoZSBEcm9wLiBWYWxpZGF0aW9uIGlzIGRvbmUgYmVmb3JlIGNhbGxpbmcgdGhpcyBtZXRob2QuXHJcblx0ICovXHJcblx0YWZmZWN0R3Jhdml0eSgpIHtcclxuXHRcdHRoaXMuYXJsZS55IC09IHRoaXMuc2V0dGluZ3MuZ3Jhdml0eTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGxpZXMgcm90YXRpb24sIHdoaWNoIGlzIGRvbmUgb24gYSBmcmFtZS1ieS1mcmFtZSBiYXNpcy4gVmFsaWRhdGlvbiBpcyBkb25lIGJlZm9yZSBjYWxsaW5nIHRoaXMgbWV0aG9kLlxyXG5cdCAqIFRoZSBhcmxlJ3Mgc3RhbmRhcmQgYW5nbGUgbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDIqUEkuXHJcblx0ICogVGhlIGRyb3Agd2lsbCBzdG9wIHJvdGF0aW5nIG9uY2UgaXRzIHN0YW5kYXJkIGFuZ2xlIHJlYWNoZXMgYW4gaW50ZWdlciBtdWx0aXBsZSBvZiBQSS8yIHJhZGlhbnMgKHVubGVzcyBpdCBpcyAxODAgcm90YXRpbmcpLlxyXG5cdCAqL1xyXG5cdGFmZmVjdFJvdGF0aW9uKCkge1xyXG5cdFx0bGV0IGFuZ2xlVG9Sb3RhdGU7XHJcblx0XHRpZih0aGlzLnJvdGF0aW5nID09ICdDVycpIHtcclxuXHRcdFx0YW5nbGVUb1JvdGF0ZSA9IC1NYXRoLlBJIC8gKDIgKiB0aGlzLnNldHRpbmdzLmZyYW1lc19wZXJfcm90YXRpb24pO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZih0aGlzLnJvdGF0aW5nID09ICdDQ1cnKSB7XHJcblx0XHRcdGFuZ2xlVG9Sb3RhdGUgPSBNYXRoLlBJIC8gKDIgKiB0aGlzLnNldHRpbmdzLmZyYW1lc19wZXJfcm90YXRpb24pO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdC8vIG5vdCByb3RhdGluZ1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYodGhpcy5yb3RhdGluZzE4MCA+IDApIHtcclxuXHRcdFx0YW5nbGVUb1JvdGF0ZSAqPSAyO1xyXG5cdFx0fVxyXG5cclxuXHRcdHRoaXMuc3RhbmRhcmRBbmdsZSArPSBhbmdsZVRvUm90YXRlO1xyXG5cclxuXHRcdC8vIFJlbWFpbiB3aXRoaW4gZG9tYWluXHJcblx0XHRpZih0aGlzLnN0YW5kYXJkQW5nbGUgPj0gMiAqIE1hdGguUEkpIHtcclxuXHRcdFx0dGhpcy5zdGFuZGFyZEFuZ2xlIC09IDIgKiBNYXRoLlBJO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZih0aGlzLnN0YW5kYXJkQW5nbGUgPCAwKSB7XHJcblx0XHRcdHRoaXMuc3RhbmRhcmRBbmdsZSArPSAyICogTWF0aC5QSTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDaGVjayBpZiByZWFjaGVkIGEgcmlnaHQgYW5nbGVcclxuXHRcdGlmKE1hdGgucm91bmQodGhpcy5zdGFuZGFyZEFuZ2xlICogMTAwMDApICUgTWF0aC5yb3VuZChNYXRoLlBJICAqIDUwMDApIDwgMC4wMSkge1xyXG5cdFx0XHRpZih0aGlzLnJvdGF0aW5nMTgwID09PSAyKSB7XHJcblx0XHRcdFx0Ly8gQmVnaW4gcm90YXRpbmcgdGhlIHNlY29uZCBzZXQgb2YgUEkvMiByYWRpYW5zXHJcblx0XHRcdFx0dGhpcy5yb3RhdGluZzE4MCA9IDE7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdC8vIFJvdGF0aW9uIGhhcyBmaW5pc2hlZFxyXG5cdFx0XHR0aGlzLnJvdGF0aW5nID0gJ25vdCc7XHJcblx0XHRcdHRoaXMucm90YXRpbmcxODAgPSAwO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSW1tZWRpYXRlbHkgZmluaXNoZXMgdGhlIHJvdGF0aW9uIG9mIGEgZHJvcCAoaWYgbmVlZGVkKSwgaW5zdGVhZCBvZiB3YWl0aW5nIHRoZSByZXF1aXJlZCBudW1iZXIgb2YgZnJhbWVzLlxyXG5cdCAqIENhbGxlZCB3aGVuIHRoZSBEcm9wIGlzIGxvY2tlZCBpbnRvIHBsYWNlLCBhcyBkdWUgdG8gcm90YXRpb24gaXQgbWF5IGJlIG1pc2FsaWduZWQuXHJcblx0ICogVGhpcyBmdW5jdGlvbiBzbmFwcyB0aGUgRHJvcCB0byB0aGUgZ3JpZCAoaWYgbmVlZGVkKSwgbWFraW5nIGl0IGVhc3kgdG8gbG9jayBhbmQgYWRkIHRvIHRoZSBzdGFjay5cclxuXHQgKi9cclxuXHRmaW5pc2hSb3RhdGlvbigpIHtcclxuXHRcdGlmKHRoaXMucm90YXRpbmcgPT09ICdub3QnKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGNvbnN0IGN3ID0gKHRoaXMucm90YXRpbmcgPT09ICdDVycpO1xyXG5cdFx0aWYodGhpcy5zdGFuZGFyZEFuZ2xlIDwgTWF0aC5QSSAvIDIpIHtcdFx0XHQvLyBxdWFkcmFudCAxXHJcblx0XHRcdHRoaXMuc3RhbmRhcmRBbmdsZSA9IGN3ID8gMCA6IE1hdGguUEkvMjtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYodGhpcy5zdGFuZGFyZEFuZ2xlIDwgTWF0aC5QSSkge1x0XHRcdC8vIHF1YWRyYW50IDJcclxuXHRcdFx0dGhpcy5zdGFuZGFyZEFuZ2xlID0gY3cgPyBNYXRoLlBJLzIgOiBNYXRoLlBJO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZih0aGlzLnN0YW5kYXJkQW5nbGUgPCAzLzIgKiBNYXRoLlBJKSB7XHQvLyBxdWFkcmFudCAzXHJcblx0XHRcdHRoaXMuc3RhbmRhcmRBbmdsZSA9IGN3ID8gTWF0aC5QSSA6IDMvMiAqIE1hdGguUEk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcXVhZHJhbnQgNFxyXG5cdFx0XHR0aGlzLnN0YW5kYXJkQW5nbGUgPSBjdyA/IDMvMiAqIE1hdGguUEkgOiAwO1xyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7IERyb3AgfTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBCb2FyZCB9ID0gcmVxdWlyZSgnLi9Cb2FyZC5qcycpO1xyXG5jb25zdCB7IEJvYXJkRHJhd2VyIH0gPSByZXF1aXJlKCcuL0JvYXJkRHJhd2VyLmpzJyk7XHJcbmNvbnN0IHsgVXRpbHMsIEF1ZGlvUGxheWVyLCBEcm9wR2VuZXJhdG9yIH0gPSByZXF1aXJlKCcuL1V0aWxzLmpzJyk7XHJcblxyXG5jbGFzcyBHYW1lIHtcclxuXHRjb25zdHJ1Y3RvcihnYW1lSWQsIG9wcG9uZW50SWRzLCBzb2NrZXQsIGJvYXJkRHJhd2VySWQsIHNldHRpbmdzLCB1c2VyU2V0dGluZ3MpIHtcclxuXHRcdHRoaXMuYm9hcmQgPSBuZXcgQm9hcmQoc2V0dGluZ3MpO1xyXG5cdFx0dGhpcy5nYW1lSWQgPSBnYW1lSWQ7XHJcblx0XHR0aGlzLm9wcG9uZW50SWRzID0gb3Bwb25lbnRJZHM7XHJcblx0XHR0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XHJcblx0XHR0aGlzLnVzZXJTZXR0aW5ncyA9IHVzZXJTZXR0aW5ncztcclxuXHRcdHRoaXMuZW5kUmVzdWx0ID0gbnVsbDtcdFx0XHQvLyBGaW5hbCByZXN1bHQgb2YgdGhlIGdhbWVcclxuXHRcdHRoaXMuc29mdERyb3BzID0gMDtcdFx0XHRcdC8vIEZyYW1lcyBpbiB3aGljaCB0aGUgc29mdCBkcm9wIGJ1dHRvbiB3YXMgaGVsZFxyXG5cdFx0dGhpcy5wcmVDaGFpblNjb3JlID0gMDtcdFx0XHQvLyBDdW11bGF0aXZlIHNjb3JlIGZyb20gcHJldmlvdXMgY2hhaW5zICh3aXRob3V0IGFueSBuZXcgc29mdGRyb3Agc2NvcmUpXHJcblx0XHR0aGlzLmN1cnJlbnRTY29yZSA9IDA7XHRcdFx0Ly8gQ3VycmVudCBzY29yZSAoY29tcGxldGVseSBhY2N1cmF0ZSlcclxuXHRcdHRoaXMuYWxsQ2xlYXIgPSBmYWxzZTtcclxuXHJcblx0XHR0aGlzLmRyb3BHZW5lcmF0b3IgPSBuZXcgRHJvcEdlbmVyYXRvcih0aGlzLnNldHRpbmdzKTtcclxuXHRcdHRoaXMuZHJvcFF1ZXVlID0gdGhpcy5kcm9wR2VuZXJhdG9yLnJlcXVlc3REcm9wcygwKS5tYXAoZHJvcCA9PiBkcm9wLmNvcHkoKSk7XHJcblx0XHR0aGlzLmRyb3BRdWV1ZUluZGV4ID0gMTtcclxuXHRcdHRoaXMuZHJvcFF1ZXVlU2V0SW5kZXggPSAxO1xyXG5cclxuXHRcdHRoaXMubGVmdG92ZXJOdWlzYW5jZSA9IDA7XHRcdC8vIExlZnRvdmVyIG51aXNhbmNlIChkZWNpbWFsIGJldHdlZW4gMCBhbmQgMSlcclxuXHRcdHRoaXMudmlzaWJsZU51aXNhbmNlID0ge307XHRcdC8vIERpY3Rpb25hcnkgb2YgeyBnYW1lSWQ6IGFtb3VudCB9IG9mIHJlY2VpdmVkIG51aXNhbmNlXHJcblx0XHR0aGlzLmFjdGl2ZU51aXNhbmNlID0gMDtcdFx0Ly8gQWN0aXZlIG51aXNhbmNlXHJcblx0XHR0aGlzLmxhc3RSb3RhdGVBdHRlbXB0ID0ge307XHQvLyBUaW1lc3RhbXAgb2YgdGhlIGxhc3QgZmFpbGVkIHJvdGF0ZSBhdHRlbXB0XHJcblx0XHR0aGlzLnJlc29sdmluZ0NoYWlucyA9IFtdO1x0XHQvLyBBcnJheSBjb250YWluaW5nIGFycmF5cyBvZiBjaGFpbmluZyBwdXlvcyBbW3B1eW9zX2luX2NoYWluXzFdLCBbcHV5b3NfaW5fY2hhaW5fMl0sIC4uLl1cclxuXHRcdHRoaXMucmVzb2x2aW5nU3RhdGUgPSB7IGNoYWluOiAwLCBwdXlvTG9jczogW10sIG51aXNhbmNlTG9jczogW10sIGN1cnJlbnRGcmFtZTogMCwgdG90YWxGcmFtZXM6IDAgfTtcclxuXHRcdHRoaXMubnVpc2FuY2VTdGF0ZSA9IHsgbnVpc2FuY2VBcnJheTogW10sIG51aXNhbmNlQW1vdW50OiAwLCBjdXJyZW50RnJhbWU6IDAsIHRvdGFsRnJhbWVzOiAwIH07XHJcblx0XHR0aGlzLnNxdWlzaFN0YXRlID0geyBjdXJyZW50RnJhbWU6IC0xIH07XHJcblxyXG5cdFx0dGhpcy5ib2FyZERyYXdlcklkID0gYm9hcmREcmF3ZXJJZDtcclxuXHRcdHRoaXMuYm9hcmREcmF3ZXIgPSBuZXcgQm9hcmREcmF3ZXIodGhpcy5zZXR0aW5ncywgdGhpcy5ib2FyZERyYXdlcklkKTtcclxuXHJcblx0XHR0aGlzLnNvY2tldCA9IHNvY2tldDtcclxuXHRcdHRoaXMuYXVkaW9QbGF5ZXIgPSBuZXcgQXVkaW9QbGF5ZXIodGhpcy5nYW1lSWQsIHNvY2tldCwgdGhpcy51c2VyU2V0dGluZ3Mudm9sdW1lKTtcclxuXHRcdGlmKHRoaXMuYm9hcmREcmF3ZXJJZCAhPT0gMSkge1xyXG5cdFx0XHR0aGlzLmF1ZGlvUGxheWVyLmRpc2FibGUoKTtcclxuXHRcdH1cclxuXHJcblx0XHR0aGlzLnNvY2tldC5vbignc2VuZE51aXNhbmNlJywgKGdhbWVJZCwgbnVpc2FuY2UpID0+IHtcclxuXHRcdFx0aWYoIXRoaXMub3Bwb25lbnRJZHMuaW5jbHVkZXMoZ2FtZUlkKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnZpc2libGVOdWlzYW5jZVtnYW1lSWRdICs9IG51aXNhbmNlO1xyXG5cdFx0XHRjb25zb2xlLmxvZygnUmVjZWl2ZWQgJyArIG51aXNhbmNlICsgXCIgbnVpc2FuY2UuXCIpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5zb2NrZXQub24oJ2FjdGl2YXRlTnVpc2FuY2UnLCBnYW1lSWQgPT4ge1xyXG5cdFx0XHRpZighb3Bwb25lbnRJZHMuaW5jbHVkZXMoZ2FtZUlkKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLmFjdGl2ZU51aXNhbmNlICs9IHRoaXMudmlzaWJsZU51aXNhbmNlW2dhbWVJZF07XHJcblx0XHRcdHRoaXMudmlzaWJsZU51aXNhbmNlW2dhbWVJZF0gPSAwO1xyXG5cdFx0XHRjb25zb2xlLmxvZygnQWN0aXZhdGVkICcgKyB0aGlzLmFjdGl2ZU51aXNhbmNlICsgJyBudWlzYW5jZS4nKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc29ja2V0Lm9uKCdnYW1lT3ZlcicsIGdhbWVJZCA9PiB7XHJcblx0XHRcdGlmKCFvcHBvbmVudElkcy5pbmNsdWRlcyhnYW1lSWQpKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnNvbGUubG9nKCdQbGF5ZXIgd2l0aCBpZCAnICsgZ2FtZUlkICsgJyBoYXMgdG9wcGVkIG91dC4nKTtcclxuXHRcdFx0dGhpcy5vcHBvbmVudElkcy5zcGxpY2UodGhpcy5vcHBvbmVudElkcy5pbmRleE9mKGdhbWVJZCksIDEpO1xyXG5cdFx0XHRpZih0aGlzLm9wcG9uZW50SWRzLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRcdHRoaXMuZW5kUmVzdWx0ID0gJ1dpbic7XHJcblx0XHRcdH1cclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc29ja2V0Lm9uKCdwbGF5ZXJEaXNjb25uZWN0JywgZ2FtZUlkID0+IHtcclxuXHRcdFx0aWYoIW9wcG9uZW50SWRzLmluY2x1ZGVzKGdhbWVJZCkpIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc29sZS5sb2coJ1BsYXllciB3aXRoIGlkICcgKyBnYW1lSWQgKyAnIGhhcyBkaXNjb25uZWN0ZWQuJyk7XHJcblx0XHRcdHRoaXMub3Bwb25lbnRJZHMuc3BsaWNlKHRoaXMub3Bwb25lbnRJZHMuaW5kZXhPZihnYW1lSWQpLCAxKTtcclxuXHRcdFx0aWYodGhpcy5vcHBvbmVudElkcy5sZW5ndGggPT09IDApIHtcclxuXHRcdFx0XHR0aGlzLmVuZFJlc3VsdCA9ICdPcHBEaXNjb25uZWN0JztcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0dGhpcy5vcHBvbmVudElkcy5mb3JFYWNoKGlkID0+IHtcclxuXHRcdFx0dGhpcy52aXNpYmxlTnVpc2FuY2VbaWRdID0gMDtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMubG9ja2luZyA9ICdub3QnO1x0XHRcdC8vIFN0YXRlIG9mIGxvY2sgZGVsYXk6ICdub3QnLCBbdGltZSBvZiBsb2NrIHN0YXJ0XVxyXG5cdFx0dGhpcy5mb3JjZUxvY2tEZWxheSA9IDA7XHJcblx0XHR0aGlzLmN1cnJlbnREcm9wID0gdGhpcy5kcm9wUXVldWUuc2hpZnQoKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZXMgaWYgdGhlIEdhbWUgc2hvdWxkIGJlIGVuZGVkLlxyXG5cdCAqL1xyXG5cdGVuZCgpIHtcclxuXHRcdGlmKHRoaXMuYm9hcmQuY2hlY2tHYW1lT3Zlcih0aGlzLnNldHRpbmdzLmdhbWVtb2RlKVxyXG5cdFx0XHQmJiB0aGlzLnJlc29sdmluZ0NoYWlucy5sZW5ndGggPT09IDBcclxuXHRcdFx0JiYgdGhpcy5udWlzYW5jZURyb3BwaW5nRnJhbWUgPT0gbnVsbFxyXG5cdFx0XHQmJiB0aGlzLmVuZFJlc3VsdCA9PT0gbnVsbCkge1xyXG5cdFx0XHRcdHRoaXMuZW5kUmVzdWx0ID0gJ0xvc3MnO1xyXG5cdFx0fVxyXG5cdFx0aWYodGhpcy5lbmRSZXN1bHQgIT09IG51bGwgJiYgdGhpcy5ib2FyZERyYXdlcklkID09PSAxKSB7XHJcblx0XHRcdHN3aXRjaCh0aGlzLmVuZFJlc3VsdCkge1xyXG5cdFx0XHRcdGNhc2UgJ1dpbic6XHJcblx0XHRcdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlTZngoJ3dpbicpO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnTG9zcyc6XHJcblx0XHRcdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlTZngoJ2xvc3MnKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHRoaXMuZW5kUmVzdWx0O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSW5jcmVtZW50cyB0aGUgZ2FtZS5cclxuXHQgKiBJZiBhIGNoYWluIGlzIHJlc29sdmluZyBvciBhIGRyb3AgaXMgc3BsaXQsIHRoZSBnYW1lIHdpbGwgbm90IHVwZGF0ZSB1bnRpbCB0aGUgYW5pbWF0aW9ucyBoYXZlIGNvbXBsZXRlZC5cclxuXHQgKiBcdFx0RWFjaCBhbmltYXRpb24gdGFrZXMgYSBjZXJ0YWluIG51bWJlciBvZiBmcmFtZXMgdG8gYmUgY29tcGxldGVkLCBhbmQgZXZlcnkgdXBkYXRlIGluY3JlbWVudHNcclxuXHQgKiBcdFx0dGhhdCBjb3VudGVyIHVudGlsIGFsbCBhbmltYXRpb25zIGhhdmUgYmVlbiBkcmF3bi5cclxuXHQgKiBPdGhlcndpc2UsIHRoZSBnYW1lIGZpcnN0IGNoZWNrcyB0aGF0IGEgRHJvcCBleGlzdHMsIHRoZW4gZXhlY3V0ZXMgbm9ybWFsIGdhbWUgZnVuY3Rpb25zIChzdWNoIGFzIGdyYXZpdHlcclxuXHQgKiBhbmQgcm90YXRpb24pIHdoaWxlIGFjY2VwdGluZyBhbnkgcXVldWVkIGV2ZW50cyBmcm9tIElucHV0TWFuYWdlci4gTmV4dCBpdCBkZXRlcm1pbmVzIGlmIHRoZSBkcm9wIHdpbGwgYmVjb21lXHJcblx0ICogbG9ja2VkLCBhbmQgaWYgc28sIGFkZHMgaXQgdG8gdGhlIGJvYXJkIGFuZCBjaGVja3MgZm9yIGNoYWlucy5cclxuXHQgKi9cclxuXHRzdGVwKCkge1xyXG5cdFx0bGV0IGN1cnJlbnRCb2FyZEhhc2g7XHJcblxyXG5cdFx0Ly8gSXNvbGF0ZWQgcHV5byBjdXJyZW50bHkgZHJvcHBpbmdcclxuXHRcdGlmICh0aGlzLmN1cnJlbnREcm9wLnNjaGV6by55ICE9IG51bGwpIHtcclxuXHRcdFx0Y3VycmVudEJvYXJkSGFzaCA9IHRoaXMuZHJvcElzb2xhdGVkUHV5bygpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gQ3VycmVudGx5IHNxdWlzaGluZyBwdXlvcyBpbnRvIHRoZSBzdGFja1xyXG5cdFx0ZWxzZSBpZih0aGlzLnNxdWlzaFN0YXRlLmN1cnJlbnRGcmFtZSAhPT0gLTEpIHtcclxuXHRcdFx0Y3VycmVudEJvYXJkSGFzaCA9IHRoaXMuc3F1aXNoUHV5b3MoKTtcclxuXHRcdH1cclxuXHRcdC8vIEN1cnJlbnRseSBkcm9wcGluZyBudWlzYW5jZVxyXG5cdFx0ZWxzZSBpZiAodGhpcy5udWlzYW5jZVN0YXRlLm51aXNhbmNlQW1vdW50ICE9PSAwKSB7XHJcblx0XHRcdGN1cnJlbnRCb2FyZEhhc2ggPSB0aGlzLmRyb3BOdWlzYW5jZSgpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gQ3VycmVudGx5IHJlc29sdmluZyBhIGNoYWluXHJcblx0XHRlbHNlIGlmKHRoaXMucmVzb2x2aW5nQ2hhaW5zLmxlbmd0aCAhPT0gMCkge1xyXG5cdFx0XHRjdXJyZW50Qm9hcmRIYXNoID0gdGhpcy5yZXNvbHZlQ2hhaW5zKCk7XHJcblx0XHR9XHJcblx0XHQvLyBOb3QgcmVzb2x2aW5nIGEgY2hhaW47IGdhbWUgaGFzIGNvbnRyb2xcclxuXHRcdGVsc2Uge1xyXG5cdFx0XHQvLyBDcmVhdGUgYSBuZXcgZHJvcCBpZiBvbmUgZG9lcyBub3QgZXhpc3QgYW5kIGdhbWUgaGFzIG5vdCBlbmRlZFxyXG5cdFx0XHRpZih0aGlzLmN1cnJlbnREcm9wLnNoYXBlID09PSBudWxsICYmIHRoaXMuZW5kUmVzdWx0ID09PSBudWxsKSB7XHJcblx0XHRcdFx0aWYodGhpcy5kcm9wUXVldWUubGVuZ3RoIDw9IDMpIHtcclxuXHRcdFx0XHRcdHRoaXMuZHJvcFF1ZXVlID0gdGhpcy5kcm9wUXVldWUuY29uY2F0KHRoaXMuZHJvcEdlbmVyYXRvci5yZXF1ZXN0RHJvcHModGhpcy5kcm9wUXVldWVJbmRleCkpO1xyXG5cdFx0XHRcdFx0dGhpcy5kcm9wUXVldWVJbmRleCsrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wID0gdGhpcy5kcm9wUXVldWUuc2hpZnQoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5nZXRJbnB1dHMoKTtcclxuXHJcblx0XHRcdGlmKHRoaXMuY2hlY2tMb2NrKCkpIHtcclxuXHRcdFx0XHQvLyBMb2NrIGRlbGF5IGlzIG92ZXIsIGxvY2sgcHV5byBpbiBwbGFjZVxyXG5cdFx0XHRcdGlmKHRoaXMubG9ja2luZyAhPT0gJ25vdCcgJiYgRGF0ZS5ub3coKSAtIHRoaXMubG9ja2luZyA+PSB0aGlzLnNldHRpbmdzLmxvY2tEZWxheSAtIHRoaXMuZm9yY2VMb2NrRGVsYXkpIHtcclxuXHRcdFx0XHRcdHRoaXMuY3VycmVudERyb3AuZmluaXNoUm90YXRpb24oKTtcclxuXHRcdFx0XHRcdHRoaXMubG9ja0Ryb3AoKTtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0Ly8gT25seSBkbyBub3Qgc3RhcnQgc3F1aXNoaW5nIHB1eW9zIGlmIGRyb3Agd2FzIHNwbGl0XHJcblx0XHRcdFx0XHRpZih0aGlzLmN1cnJlbnREcm9wLnNjaGV6by55ID09PSBudWxsKSB7XHJcblx0XHRcdFx0XHRcdHRoaXMuc3F1aXNoU3RhdGUuY3VycmVudEZyYW1lID0gMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHRoaXMubG9ja2luZyA9ICdub3QnO1xyXG5cdFx0XHRcdFx0dGhpcy5mb3JjZUxvY2tEZWxheSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0Ly8gU3RhcnQgbG9jayBkZWxheVxyXG5cdFx0XHRcdFx0aWYodGhpcy5sb2NraW5nID09PSAnbm90Jykge1xyXG5cdFx0XHRcdFx0XHR0aGlzLmxvY2tpbmcgPSBEYXRlLm5vdygpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gQ29udGludWUgbG9jayBkZWxheVxyXG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5hZmZlY3RSb3RhdGlvbigpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBXYXMgbG9ja2luZyBiZWZvcmUsIGJ1dCBub3QgYW55bW9yZSBzbyByZXNldCBsb2NraW5nIHN0YXRlXHJcblx0XHRcdGVsc2UgaWYodGhpcy5sb2NraW5nICE9PSAnbm90Jykge1xyXG5cdFx0XHRcdHRoaXMubG9ja2luZyA9ICdub3QnO1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudERyb3AuYWZmZWN0Um90YXRpb24oKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBOb3QgbG9ja2luZ1xyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wLmFmZmVjdEdyYXZpdHkodGhpcy5zZXR0aW5ncy5ncmF2aXR5KTtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wLmFmZmVjdFJvdGF0aW9uKCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFVwZGF0ZSB0aGUgYm9hcmRcclxuXHRcdFx0Y29uc3QgY3VycmVudEJvYXJkU3RhdGUgPSB7IGJvYXJkU3RhdGU6IHRoaXMuYm9hcmQuYm9hcmRTdGF0ZSwgY3VycmVudERyb3A6IHRoaXMuY3VycmVudERyb3AgfTtcclxuXHRcdFx0Y3VycmVudEJvYXJkSGFzaCA9IHRoaXMuYm9hcmREcmF3ZXIuaGFzaEZvclVwZGF0ZShjdXJyZW50Qm9hcmRTdGF0ZSk7XHJcblx0XHRcdHRoaXMuYm9hcmREcmF3ZXIudXBkYXRlQm9hcmQoY3VycmVudEJvYXJkU3RhdGUpO1xyXG5cdFx0XHR0aGlzLnVwZGF0ZVNjb3JlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRW1pdCBib2FyZCBzdGF0ZSB0byBhbGwgb3Bwb25lbnRzXHJcblx0XHR0aGlzLnNvY2tldC5lbWl0KCdzZW5kU3RhdGUnLCB0aGlzLmdhbWVJZCwgY3VycmVudEJvYXJkSGFzaCwgdGhpcy5jdXJyZW50U2NvcmUsIHRoaXMuZ2V0VG90YWxOdWlzYW5jZSgpKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENhbGxlZCBldmVyeSBmcmFtZSB3aGlsZSBhIGRyb3AgaXMgYmVpbmcgc3BsaXQuIChQcmV2ZW50cyBpbnB1dHMuKVxyXG5cdCAqL1xyXG5cdGRyb3BJc29sYXRlZFB1eW8oKSB7XHJcblx0XHRjb25zdCBib2FyZFN0YXRlID0gdGhpcy5ib2FyZC5ib2FyZFN0YXRlO1xyXG5cdFx0Y29uc3QgY3VycmVudERyb3AgPSB0aGlzLmN1cnJlbnREcm9wO1xyXG5cdFx0Y29uc3QgYXJsZURyb3BwZWQgPSBjdXJyZW50RHJvcC5hcmxlLnkgPD0gYm9hcmRTdGF0ZVtjdXJyZW50RHJvcC5hcmxlLnhdLmxlbmd0aDtcclxuXHRcdGNvbnN0IHNjaGV6b0Ryb3BwZWQgPSBjdXJyZW50RHJvcC5zY2hlem8ueSA8PSBib2FyZFN0YXRlW2N1cnJlbnREcm9wLnNjaGV6by54XS5sZW5ndGg7XHJcblxyXG5cdFx0aWYodGhpcy5yZXNvbHZpbmdTdGF0ZS5jaGFpbiA9PT0gMCkge1xyXG5cdFx0XHR0aGlzLnJlc29sdmluZ1N0YXRlID0geyBjaGFpbjogLTEsIHB1eW9Mb2NzOiBudWxsLCBudWlzYW5jZUxvY3M6IG51bGwsIGN1cnJlbnRGcmFtZTogMCwgdG90YWxGcmFtZXM6IDAgfTtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHR0aGlzLnJlc29sdmluZ1N0YXRlLmN1cnJlbnRGcmFtZSsrO1xyXG5cdFx0XHRpZiAoIWFybGVEcm9wcGVkKSB7XHJcblx0XHRcdFx0Y3VycmVudERyb3AuYXJsZS55IC09IDEgLyB0aGlzLnNldHRpbmdzLmlzb0Nhc2NhZGVGcmFtZXNQZXJSb3c7XHJcblx0XHRcdFx0aWYgKGN1cnJlbnREcm9wLmFybGUueSA8IGJvYXJkU3RhdGVbY3VycmVudERyb3AuYXJsZS54XS5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdGN1cnJlbnREcm9wLmFybGUueSA9IGJvYXJkU3RhdGVbY3VycmVudERyb3AuYXJsZS54XS5sZW5ndGhcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCFzY2hlem9Ecm9wcGVkKSB7XHJcblx0XHRcdFx0Y3VycmVudERyb3Auc2NoZXpvLnkgLT0gMSAvIHRoaXMuc2V0dGluZ3MuaXNvQ2FzY2FkZUZyYW1lc1BlclJvdztcclxuXHRcdFx0XHRpZiAoY3VycmVudERyb3Auc2NoZXpvLnkgPCBib2FyZFN0YXRlW2N1cnJlbnREcm9wLnNjaGV6by54XS5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdGN1cnJlbnREcm9wLnNjaGV6by55ID0gYm9hcmRTdGF0ZVtjdXJyZW50RHJvcC5zY2hlem8ueF0ubGVuZ3RoXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRjb25zdCBjdXJyZW50Qm9hcmRTdGF0ZSA9IHsgYm9hcmRTdGF0ZSwgY3VycmVudERyb3AgfTtcclxuXHRcdGNvbnN0IGN1cnJlbnRCb2FyZEhhc2ggPSB0aGlzLmJvYXJkRHJhd2VyLmhhc2hGb3JVcGRhdGUoY3VycmVudEJvYXJkU3RhdGUpO1xyXG5cdFx0dGhpcy5ib2FyZERyYXdlci51cGRhdGVCb2FyZChjdXJyZW50Qm9hcmRTdGF0ZSk7XHJcblxyXG5cdFx0aWYgKHNjaGV6b0Ryb3BwZWQgJiYgYXJsZURyb3BwZWQpIHtcclxuXHRcdFx0Ym9hcmRTdGF0ZVtjdXJyZW50RHJvcC5hcmxlLnhdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1swXSk7XHJcblx0XHRcdGJvYXJkU3RhdGVbY3VycmVudERyb3Auc2NoZXpvLnhdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1sxXSk7XHJcblxyXG5cdFx0XHQvLyBEZWxldGUgYW55IHB1eW9zIGlmIHRoZXkgd2VyZSBwbGFjZWQgb24gYW4gb3ZlcnN0YWNrZWQgY29sdW1uXHJcblx0XHRcdHRoaXMuYm9hcmQudHJpbSgpO1xyXG5cclxuXHRcdFx0dGhpcy5yZXNvbHZpbmdTdGF0ZSA9IHsgY2hhaW46IDAsIHB1eW9Mb2NzOiBbXSwgbnVpc2FuY2VMb2NzOiBbXSwgY3VycmVudEZyYW1lOiAwLCB0b3RhbEZyYW1lczogMCB9O1xyXG5cdFx0XHR0aGlzLnJlc29sdmluZ0NoYWlucyA9IHRoaXMuYm9hcmQucmVzb2x2ZUNoYWlucygpO1xyXG5cclxuXHRcdFx0Ly8gUGFzcyBjb250cm9sIG92ZXIgdG8gc3F1aXNoUHV5b3MoKVxyXG5cdFx0XHR0aGlzLnNxdWlzaFN0YXRlLmN1cnJlbnRGcmFtZSA9IDA7XHJcblxyXG5cdFx0XHRjdXJyZW50RHJvcC5zY2hlem8ueCA9IG51bGw7XHJcblx0XHRcdGN1cnJlbnREcm9wLnNjaGV6by55ID0gbnVsbDtcclxuXHRcdFx0Y3VycmVudERyb3Auc2hhcGUgPSBudWxsO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGN1cnJlbnRCb2FyZEhhc2g7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDYWxsZWQgZXZlcnkgZnJhbWUgd2hpbGUgbnVpc2FuY2UgaXMgZHJvcHBpbmcuXHJcblx0ICovXHJcblx0ZHJvcE51aXNhbmNlKCkge1xyXG5cdFx0bGV0IGhhc2g7XHJcblx0XHQvLyBJbml0aWFsaXplIHRoZSBudWlzYW5jZSBzdGF0ZVxyXG5cdFx0aWYgKHRoaXMubnVpc2FuY2VTdGF0ZS5jdXJyZW50RnJhbWUgPT09IDApIHtcclxuXHRcdFx0dGhpcy5udWlzYW5jZVN0YXRlLmN1cnJlbnRGcmFtZSA9IDE7XHJcblxyXG5cdFx0XHRsZXQgbWF4RnJhbWVzID0gMDtcclxuXHRcdFx0bGV0IG51aXNhbmNlQ2FzY2FkZUZQUiA9IFtdO1xyXG5cclxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNldHRpbmdzLmNvbHM7IGkrKykge1xyXG5cdFx0XHRcdC8vIEdlbmVyYXRlIGEgc2VtaS1yYW5kb20gdmFsdWUgZm9yIFwiZnJhbWVzIHBlciByb3dcIlxyXG5cdFx0XHRcdG51aXNhbmNlQ2FzY2FkZUZQUi5wdXNoKFxyXG5cdFx0XHRcdFx0dGhpcy5zZXR0aW5ncy5tZWFuTnVpc2FuY2VDYXNjYWRlRlBSIC0gdGhpcy5zZXR0aW5ncy52YXJOdWlzYW5jZUNhc2NhZGVGUFIgK1xyXG5cdFx0XHRcdFx0TWF0aC5yYW5kb20oKSAqIHRoaXMuc2V0dGluZ3MudmFyTnVpc2FuY2VDYXNjYWRlRlBSICogMlxyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdC8vIENhbGN1bGF0ZSB0aGUgbnVtYmVyIG9mIGZyYW1lcyByZXF1aXJlZFxyXG5cdFx0XHRcdGNvbnN0IGNvbE1heEZyYW1lcyA9ICh0aGlzLnNldHRpbmdzLm51aXNhbmNlU3Bhd25Sb3cgLSB0aGlzLmJvYXJkLmJvYXJkU3RhdGVbaV0ubGVuZ3RoKSAqIG51aXNhbmNlQ2FzY2FkZUZQUltpXTtcclxuXHRcdFx0XHRpZiAoY29sTWF4RnJhbWVzID4gbWF4RnJhbWVzKSB7XHJcblx0XHRcdFx0XHRtYXhGcmFtZXMgPSBjb2xNYXhGcmFtZXM7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMubnVpc2FuY2VTdGF0ZS50b3RhbEZyYW1lcyA9IE1hdGguY2VpbChtYXhGcmFtZXMgKyB0aGlzLnNldHRpbmdzLm51aXNhbmNlTGFuZEZyYW1lcyk7XHJcblx0XHRcdHRoaXMuYm9hcmREcmF3ZXIuaW5pdE51aXNhbmNlRHJvcChudWlzYW5jZUNhc2NhZGVGUFIpO1xyXG5cdFx0XHRoYXNoID0gdGhpcy5ib2FyZERyYXdlci5oYXNoRm9yTnVpc2FuY2VJbml0KG51aXNhbmNlQ2FzY2FkZUZQUik7XHJcblx0XHR9XHJcblx0XHQvLyBBbHJlYWR5IGluaXRpYWxpemVkXHJcblx0XHRlbHNlIHtcclxuXHRcdFx0dGhpcy5ib2FyZERyYXdlci5kcm9wTnVpc2FuY2UodGhpcy5ib2FyZC5ib2FyZFN0YXRlLCB0aGlzLm51aXNhbmNlU3RhdGUpO1xyXG5cdFx0XHRoYXNoID0gdGhpcy5ib2FyZERyYXdlci5oYXNoRm9yTnVpc2FuY2UodGhpcy5ib2FyZC5ib2FyZFN0YXRlLCB0aGlzLm51aXNhbmNlU3RhdGUpO1xyXG5cdFx0XHR0aGlzLm51aXNhbmNlU3RhdGUuY3VycmVudEZyYW1lKys7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gT25jZSBkb25lIGZhbGxpbmcsIHBsYXkgU0ZYXHJcblx0XHRpZih0aGlzLm51aXNhbmNlU3RhdGUuY3VycmVudEZyYW1lID09PSB0aGlzLm51aXNhbmNlU3RhdGUudG90YWxGcmFtZXMgLSB0aGlzLnNldHRpbmdzLm51aXNhbmNlTGFuZEZyYW1lcykge1xyXG5cdFx0XHRpZih0aGlzLm51aXNhbmNlU3RhdGUubnVpc2FuY2VBbW91bnQgPj0gdGhpcy5zZXR0aW5ncy5jb2xzICogMikge1xyXG5cdFx0XHRcdHRoaXMuYXVkaW9QbGF5ZXIucGxheUFuZEVtaXRTZngoJ251aXNhbmNlRmFsbDInKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRpZih0aGlzLm51aXNhbmNlU3RhdGUubnVpc2FuY2VBbW91bnQgPiB0aGlzLnNldHRpbmdzLmNvbHMpIHtcclxuXHRcdFx0XHRcdHRoaXMuYXVkaW9QbGF5ZXIucGxheUFuZEVtaXRTZngoJ251aXNhbmNlRmFsbDEnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYodGhpcy5udWlzYW5jZVN0YXRlLm51aXNhbmNlQW1vdW50ID4gMCkge1xyXG5cdFx0XHRcdFx0dGhpcy5hdWRpb1BsYXllci5wbGF5QW5kRW1pdFNmeCgnbnVpc2FuY2VGYWxsMScpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZpbmlzaGVkIGRyb3BwaW5nIG51aXNhbmNlXHJcblx0XHRpZiAodGhpcy5udWlzYW5jZVN0YXRlLmN1cnJlbnRGcmFtZSA+PSB0aGlzLm51aXNhbmNlU3RhdGUudG90YWxGcmFtZXMpIHtcclxuXHRcdFx0dGhpcy5hY3RpdmVOdWlzYW5jZSAtPSB0aGlzLm51aXNhbmNlU3RhdGUubnVpc2FuY2VBbW91bnQ7XHJcblxyXG5cdFx0XHQvLyBBZGQgdGhlIG51aXNhbmNlIHRvIHRoZSBzdGFja1xyXG5cdFx0XHRmb3IobGV0IGkgPSAwOyBpIDwgdGhpcy5zZXR0aW5ncy5jb2xzOyBpKyspIHtcclxuXHRcdFx0XHR0aGlzLmJvYXJkLmJvYXJkU3RhdGVbaV0gPSB0aGlzLmJvYXJkLmJvYXJkU3RhdGVbaV0uY29uY2F0KHRoaXMubnVpc2FuY2VTdGF0ZS5udWlzYW5jZUFycmF5W2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBSZXNldCB0aGUgbnVpc2FuY2Ugc3RhdGVcclxuXHRcdFx0dGhpcy5udWlzYW5jZVN0YXRlID0geyBudWlzYW5jZUFycmF5OiBbXSwgbnVpc2FuY2VBbW91bnQ6IDAsIGN1cnJlbnRGcmFtZTogMCwgdG90YWxGcmFtZXM6IDAgfTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaGFzaDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENhbGxlZCBldmVyeSBmcmFtZSB3aGlsZSBjaGFpbmluZyBpcyBvY2N1cnJpbmcuIChQcmV2ZW50cyBpbnB1dHMuKVxyXG5cdCAqIFJldHVybnMgdGhlIGN1cnJlbnQgYm9hcmQgaGFzaC5cclxuXHQgKi9cclxuXHRyZXNvbHZlQ2hhaW5zKCkge1xyXG5cdFx0Ly8gU2V0dGluZyB1cCB0aGUgYm9hcmQgc3RhdGVcclxuXHRcdGlmKHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4gPT09IDApIHtcclxuXHRcdFx0Y29uc3QgcHV5b0xvY3MgPSB0aGlzLnJlc29sdmluZ0NoYWluc1swXTtcclxuXHRcdFx0Y29uc3QgbnVpc2FuY2VMb2NzID0gdGhpcy5ib2FyZC5maW5kTnVpc2FuY2VQb3BwZWQocHV5b0xvY3MpO1xyXG5cdFx0XHRjb25zdCBkcm9wRnJhbWVzID0gVXRpbHMuZ2V0RHJvcEZyYW1lcyhwdXlvTG9jcy5jb25jYXQobnVpc2FuY2VMb2NzKSwgdGhpcy5ib2FyZC5ib2FyZFN0YXRlLCB0aGlzLnNldHRpbmdzKTtcclxuXHRcdFx0dGhpcy5yZXNvbHZpbmdTdGF0ZSA9IHsgY2hhaW46IDEsIHB1eW9Mb2NzLCBudWlzYW5jZUxvY3MsIGN1cnJlbnRGcmFtZTogMSwgdG90YWxGcmFtZXM6IHRoaXMuc2V0dGluZ3MucG9wRnJhbWVzICsgZHJvcEZyYW1lcyB9O1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHRoaXMucmVzb2x2aW5nU3RhdGUuY3VycmVudEZyYW1lKys7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVXBkYXRlIHRoZSBib2FyZFxyXG5cdFx0Y29uc3QgY3VycmVudEJvYXJkSGFzaCA9IHRoaXMuYm9hcmREcmF3ZXIuaGFzaEZvclJlc29sdmluZyh0aGlzLmJvYXJkLmJvYXJkU3RhdGUsIHRoaXMucmVzb2x2aW5nU3RhdGUpO1xyXG5cdFx0dGhpcy5ib2FyZERyYXdlci5yZXNvbHZlQ2hhaW5zKHRoaXMuYm9hcmQuYm9hcmRTdGF0ZSwgdGhpcy5yZXNvbHZpbmdTdGF0ZSk7XHJcblxyXG5cdFx0Ly8gT25jZSBkb25lIHBvcHBpbmcsIHBsYXkgU0ZYXHJcblx0XHRpZih0aGlzLnJlc29sdmluZ1N0YXRlLmN1cnJlbnRGcmFtZSA9PT0gdGhpcy5zZXR0aW5ncy5wb3BGcmFtZXMpIHtcclxuXHRcdFx0Ly8gUGxheSBzZnhcclxuXHRcdFx0dGhpcy5hdWRpb1BsYXllci5wbGF5QW5kRW1pdFNmeCgnY2hhaW5fdm9pY2VkX2pwbicsIHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4pO1xyXG5cdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlBbmRFbWl0U2Z4KCdjaGFpbicsIHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4gPiA3ID8gNyA6IHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4pO1xyXG5cdFx0XHRpZih0aGlzLnJlc29sdmluZ1N0YXRlLmNoYWluID4gMSkge1xyXG5cdFx0XHRcdHRoaXMuYXVkaW9QbGF5ZXIucGxheUFuZEVtaXRTZngoJ251aXNhbmNlU2VuZCcsIHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4gPiA1ID8gNSA6IHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2hlY2sgaWYgdGhlIGNoYWluIGlzIGRvbmUgcmVzb2x2aW5nXHJcblx0XHRpZih0aGlzLnJlc29sdmluZ1N0YXRlLmN1cnJlbnRGcmFtZSA9PT0gdGhpcy5yZXNvbHZpbmdTdGF0ZS50b3RhbEZyYW1lcykge1xyXG5cdFx0XHQvLyBVcGRhdGUgdGhlIHNjb3JlIGRpc3BsYXllZFxyXG5cdFx0XHR0aGlzLnVwZGF0ZVNjb3JlKCk7XHJcblxyXG5cdFx0XHQvLyBSZW1vdmUgdGhlIGNoYWluZWQgcHV5b3MgYW5kIHBvcHBlZCBudWlzYW5jZSBwdXlvc1xyXG5cdFx0XHR0aGlzLmJvYXJkLmRlbGV0ZVB1eW9zKHRoaXMucmVzb2x2aW5nU3RhdGUucHV5b0xvY3MuY29uY2F0KHRoaXMuYm9hcmQuZmluZE51aXNhbmNlUG9wcGVkKHRoaXMucmVzb2x2aW5nU3RhdGUucHV5b0xvY3MpKSk7XHJcblxyXG5cdFx0XHQvLyBTcXVpc2ggcHV5b3MgaW50byB0aGUgc3RhY2tcclxuXHRcdFx0dGhpcy5zcXVpc2hTdGF0ZS5jdXJyZW50RnJhbWUgPSAwO1xyXG5cclxuXHRcdFx0Ly8gRG9uZSByZXNvbHZpbmcgYWxsIGNoYWluc1xyXG5cdFx0XHRpZih0aGlzLnJlc29sdmluZ1N0YXRlLmNoYWluID09PSB0aGlzLnJlc29sdmluZ0NoYWlucy5sZW5ndGgpIHtcclxuXHRcdFx0XHR0aGlzLnJlc29sdmluZ0NoYWlucyA9IFtdO1xyXG5cdFx0XHRcdHRoaXMucmVzb2x2aW5nU3RhdGUgPSB7IGNoYWluOiAwLCBwdXlvTG9jczogW10sIG51aXNhbmNlTG9jczogW10sIGN1cnJlbnRGcmFtZTogMCwgdG90YWxGcmFtZXM6IDAgfTtcclxuXHJcblx0XHRcdFx0Ly8gTm8gcGVuZGluZyBudWlzYW5jZSwgY2hhaW4gY29tcGxldGVkXHJcblx0XHRcdFx0aWYodGhpcy5nZXRUb3RhbE51aXNhbmNlKCkgPT09IDApIHtcclxuXHRcdFx0XHRcdHRoaXMuc29ja2V0LmVtaXQoJ2FjdGl2YXRlTnVpc2FuY2UnLCB0aGlzLmdhbWVJZCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBDaGVjayBmb3IgYWxsIGNsZWFyXHJcblx0XHRcdFx0aWYodGhpcy5ib2FyZC5ib2FyZFN0YXRlLmV2ZXJ5KGNvbCA9PiBjb2wubGVuZ3RoID09PSAwKSkge1xyXG5cdFx0XHRcdFx0dGhpcy5hbGxDbGVhciA9IHRydWU7XHJcblx0XHRcdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlBbmRFbWl0U2Z4KCdhbGxDbGVhcicpO1xyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coXCJBbGwgY2xlYXIgYnkgcGxheWVyIHdpdGggaWQgXCIgKyB0aGlzLmdhbWVJZCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdC8vIFN0aWxsIGhhdmUgbW9yZSBjaGFpbnMgdG8gcmVzb2x2ZVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRjb25zdCBwdXlvTG9jcyA9IHRoaXMucmVzb2x2aW5nQ2hhaW5zW3RoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW5dO1xyXG5cdFx0XHRcdGNvbnN0IG51aXNhbmNlTG9jcyA9IHRoaXMuYm9hcmQuZmluZE51aXNhbmNlUG9wcGVkKHB1eW9Mb2NzKTtcclxuXHRcdFx0XHRjb25zdCBkcm9wRnJhbWVzID0gVXRpbHMuZ2V0RHJvcEZyYW1lcyhwdXlvTG9jcywgdGhpcy5ib2FyZC5ib2FyZFN0YXRlLCB0aGlzLnNldHRpbmdzKTtcclxuXHRcdFx0XHR0aGlzLnJlc29sdmluZ1N0YXRlID0ge1xyXG5cdFx0XHRcdFx0Y2hhaW46IHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4gKyAxLFxyXG5cdFx0XHRcdFx0cHV5b0xvY3MsXHJcblx0XHRcdFx0XHRudWlzYW5jZUxvY3MsXHJcblx0XHRcdFx0XHRjdXJyZW50RnJhbWU6IDAsXHJcblx0XHRcdFx0XHR0b3RhbEZyYW1lczogdGhpcy5zZXR0aW5ncy5wb3BGcmFtZXMgKyBkcm9wRnJhbWVzXHJcblx0XHRcdFx0fTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGN1cnJlbnRCb2FyZEhhc2g7XHJcblx0fVxyXG5cclxuXHRzcXVpc2hQdXlvcygpIHtcclxuXHRcdHRoaXMuc3F1aXNoU3RhdGUuY3VycmVudEZyYW1lKys7XHJcblx0XHRpZih0aGlzLnNxdWlzaFN0YXRlLmN1cnJlbnRGcmFtZSA9PT0gdGhpcy5zZXR0aW5ncy5zcXVpc2hGcmFtZXMpIHtcclxuXHRcdFx0Ly8gQ2hhaW4gd2FzIG5vdCBzdGFydGVkXHJcblx0XHRcdGlmKHRoaXMucmVzb2x2aW5nQ2hhaW5zLmxlbmd0aCA9PT0gMCkge1xyXG5cdFx0XHRcdGNvbnN0IHsgbnVpc2FuY2VEcm9wcGVkLCBudWlzYW5jZUFycmF5IH0gPSB0aGlzLmJvYXJkLmRyb3BOdWlzYW5jZSh0aGlzLmFjdGl2ZU51aXNhbmNlKTtcclxuXHRcdFx0XHR0aGlzLm51aXNhbmNlU3RhdGUubnVpc2FuY2VBbW91bnQgPSBudWlzYW5jZURyb3BwZWQ7XHJcblx0XHRcdFx0dGhpcy5udWlzYW5jZVN0YXRlLm51aXNhbmNlQXJyYXkgPSBudWlzYW5jZUFycmF5O1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuc3F1aXNoU3RhdGUuY3VycmVudEZyYW1lID0gLTE7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgY3VycmVudEJvYXJkU3RhdGUgPSB7IGJvYXJkU3RhdGU6IHRoaXMuYm9hcmQuYm9hcmRTdGF0ZSwgY3VycmVudERyb3A6IHRoaXMuY3VycmVudERyb3AgfTtcclxuXHRcdGNvbnN0IGN1cnJlbnRCb2FyZEhhc2ggPSB0aGlzLmJvYXJkRHJhd2VyLmhhc2hGb3JVcGRhdGUoY3VycmVudEJvYXJkU3RhdGUpO1xyXG5cdFx0dGhpcy5ib2FyZERyYXdlci51cGRhdGVCb2FyZChjdXJyZW50Qm9hcmRTdGF0ZSk7XHJcblxyXG5cdFx0cmV0dXJuIGN1cnJlbnRCb2FyZEhhc2g7XHJcblx0fVxyXG5cclxuXHRnZXRJbnB1dHMoKSB7XHJcblx0XHQvLyBJbXBsZW1lbnRlZCBieSB0aGUgY2hpbGQgY2xhc3Nlc1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdnZXRJbnB1dCgpIG11c3QgYmUgaW1wbGVtZW50ZWQgaW4gdGhlIGNoaWxkIGNsYXNzIScpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmV0dXJucyBhIGJvb2xlYW4gaW5kaWNhdGluZyB3aGV0aGVyIHRoaXMuY3VycmVudERyb3Agc2hvdWxkIGJlIGxvY2tlZCBpbiBwbGFjZS5cclxuXHQgKiBBIGRyb3Agd2lsbCBsb2NrIGlmIGFueSBvZiBpdHMgcHV5b3MnIHktY29vcmRpbmF0ZSBpcyBiZWxvdyB0aGUgaGVpZ2h0IG9mIHRoZSBzdGFjayBpbiB0aGF0IGNvbHVtbi5cclxuXHQgKlxyXG5cdCAqIEZvciBub3csIHRoaXMgZnVuY3Rpb24gb25seSBzdXBwb3J0cyBUc3UgZHJvcHMuXHJcblx0ICpcclxuXHQgKiBVbmRlcmx5aW5nIGxvZ2ljOlxyXG5cdCAqICAgICBJZiB0aGUgZHJvcCBpcyByb3RhdGluZywgdGhlIGZpbmFsIHBvc2l0aW9uIG9mIHRoZSBzY2hlem8gcHV5byBtdXN0IGJlIGtub3duLlxyXG5cdCAqICAgICBUaGlzIGNhbiBiZSBmb3VuZCBmcm9tIHRoZSBzY2hlem8ncyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgYXJsZSBhbmQgdGhlIGRyb3AncyByb3RhdGUgZGlyZWN0aW9uLlxyXG5cdCAqICAgICBUaGVuIGNvbXBhcmUgdGhlIHktY29vcmRpbmF0ZSBvZiBib3RoIHB1eW9zIGFnYWluc3QgdGhlIHktY29vcmRpbmF0ZSBvZiB0aGUgc3RhY2suXHJcblx0ICogICAgIElmIHRoZSBkcm9wIGlzIChvciB3aWxsIGJlKSB2ZXJ0aWNhbCwgb25seSB0aGUgbG93ZXIgb25lIG5lZWRzIHRvIGJlIGNvbXBhcmVkLlxyXG5cdCAqL1xyXG5cdGNoZWNrTG9jayhjdXJyZW50RHJvcCA9IHRoaXMuY3VycmVudERyb3AsIGJvYXJkU3RhdGUgPSB0aGlzLmJvYXJkLmJvYXJkU3RhdGUpIHtcclxuXHRcdC8vIERvIG5vdCBsb2NrIHdoaWxlIHJvdGF0aW5nIDE4MFxyXG5cdFx0aWYoY3VycmVudERyb3Aucm90YXRpbmcxODAgPiAwKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHRcdGNvbnN0IGFybGUgPSBjdXJyZW50RHJvcC5hcmxlO1xyXG5cdFx0Y29uc3Qgc2NoZXpvID0gVXRpbHMuZ2V0T3RoZXJQdXlvKGN1cnJlbnREcm9wKTtcclxuXHRcdGxldCBsb2NrO1xyXG5cclxuXHRcdGlmKHNjaGV6by54ID4gdGhpcy5zZXR0aW5ncy5jb2xzIC0gMSkge1xyXG5cdFx0XHRjb25zb2xlLmxvZygnc3RvUCBTUEFNTUlORyBZT1VSIEtFWUJPQVJER1RHSFZEUlkgeW91IG5vbiBsb25nZXIgaGF2ZSB0aGUgcHJpdmlsZWdlIG9mIGdhbWUgcGh5c2ljcycpO1xyXG5cdFx0XHRhcmxlLngtLTtcclxuXHRcdFx0c2NoZXpvLngtLTtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYoc2NoZXpvLnggPCAwKSB7XHJcblx0XHRcdGNvbnNvbGUubG9nKCdzdG9QIFNQQU1NSU5HIFlPVVIgS0VZQk9BUkRHVEdIVkRSWSB5b3Ugbm9uIGxvbmdlciBoYXZlIHRoZSBwcml2aWxlZ2Ugb2YgZ2FtZSBwaHlzaWNzJyk7XHJcblx0XHRcdGFybGUueCsrO1xyXG5cdFx0XHRzY2hlem8ueCsrO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmKGN1cnJlbnREcm9wLnJvdGF0aW5nID09PSAnQ1cnKSB7XHJcblx0XHRcdGlmKHNjaGV6by54ID4gYXJsZS54KSB7XHJcblx0XHRcdFx0aWYoc2NoZXpvLnkgPiBhcmxlLnkpIHtcdFx0Ly8gcXVhZHJhbnQgMVxyXG5cdFx0XHRcdFx0bG9jayA9IGJvYXJkU3RhdGVbTWF0aC5jZWlsKHNjaGV6by54KV0ubGVuZ3RoID49IHNjaGV6by55IHx8IGJvYXJkU3RhdGVbYXJsZS54XS5sZW5ndGggPj0gYXJsZS55O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlIHtcdFx0XHRcdFx0XHQvLyBxdWFkcmFudCAyXHJcblx0XHRcdFx0XHRsb2NrID0gYm9hcmRTdGF0ZVthcmxlLnhdLmxlbmd0aCA+IHNjaGV6by55O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRpZihzY2hlem8ueSA8IGFybGUueSkge1x0XHQvLyBxdWFkcmFudCAzXHJcblx0XHRcdFx0XHRsb2NrID0gYm9hcmRTdGF0ZVtNYXRoLmZsb29yKHNjaGV6by54KV0ubGVuZ3RoID49IHNjaGV6by55IHx8IGJvYXJkU3RhdGVbYXJsZS54XS5sZW5ndGggPj0gYXJsZS55O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlIHtcdFx0XHRcdFx0XHQvLyBxdWFkcmFudCA0XHJcblx0XHRcdFx0XHRsb2NrID0gYm9hcmRTdGF0ZVthcmxlLnhdLmxlbmd0aCA+IGFybGUueTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGVsc2UgaWYoY3VycmVudERyb3Aucm90YXRpbmcgPT09ICdDQ1cnKSB7XHJcblx0XHRcdGlmKHNjaGV6by54ID4gYXJsZS54KSB7XHJcblx0XHRcdFx0aWYoc2NoZXpvLnkgPiBhcmxlLnkpIHtcdFx0Ly8gcXVhZHJhbnQgMVxyXG5cdFx0XHRcdFx0bG9jayA9IGJvYXJkU3RhdGVbYXJsZS54XS5sZW5ndGggPiBhcmxlLnk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2Uge1x0XHRcdFx0XHRcdC8vIHF1YWRyYW50IDJcclxuXHRcdFx0XHRcdGxvY2sgPSBib2FyZFN0YXRlW01hdGguY2VpbChzY2hlem8ueCldLmxlbmd0aCA+PSBzY2hlem8ueSB8fCBib2FyZFN0YXRlW2FybGUueF0ubGVuZ3RoID49IGFybGUueTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0aWYoc2NoZXpvLnkgPCBhcmxlLnkpIHtcdFx0Ly8gcXVhZHJhbnQgM1xyXG5cdFx0XHRcdFx0bG9jayA9IGJvYXJkU3RhdGVbYXJsZS54XS5sZW5ndGggPiBzY2hlem8ueTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSB7XHRcdFx0XHRcdFx0Ly8gcXVhZHJhbnQgNFxyXG5cdFx0XHRcdFx0bG9jayA9IGJvYXJkU3RhdGVbTWF0aC5mbG9vcihzY2hlem8ueCldLmxlbmd0aCA+PSBzY2hlem8ueSB8fCBib2FyZFN0YXRlW2FybGUueF0ubGVuZ3RoID49IGFybGUueTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGVsc2Uge1x0XHQvLyBub3Qgcm90YXRpbmdcclxuXHRcdFx0aWYoYXJsZS54ID09PSBzY2hlem8ueCkge1x0XHQvLyB2ZXJ0aWNhbCBvcmllbnRhdGlvblxyXG5cdFx0XHRcdGxvY2sgPSBib2FyZFN0YXRlW2FybGUueF0ubGVuZ3RoID49IE1hdGgubWluKGFybGUueSwgc2NoZXpvLnkpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1x0XHQvL2hvcml6b250YWwgb3JpZW50YXRpb25cclxuXHRcdFx0XHRsb2NrID0gYm9hcmRTdGF0ZVthcmxlLnhdLmxlbmd0aCA+PSBhcmxlLnkgfHwgYm9hcmRTdGF0ZVtzY2hlem8ueF0ubGVuZ3RoID49IHNjaGV6by55O1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbG9jaztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIExvY2tzIHRoZSBkcm9wIGFuZCBhZGRzIHRoZSBwdXlvcyB0byB0aGUgc3RhY2suXHJcblx0ICovXHJcblx0bG9ja0Ryb3AoKSB7XHJcblx0XHRjb25zdCBjdXJyZW50RHJvcCA9IHRoaXMuY3VycmVudERyb3A7XHJcblx0XHRjb25zdCBib2FyZFN0YXRlID0gdGhpcy5ib2FyZC5ib2FyZFN0YXRlO1xyXG5cdFx0Y3VycmVudERyb3Auc2NoZXpvID0gVXRpbHMuZ2V0T3RoZXJQdXlvKGN1cnJlbnREcm9wKTtcclxuXHJcblx0XHQvLyBGb3JjZSByb3VuZCB0aGUgc2NoZXpvIGJlZm9yZSBpdCBpcyBwdXQgb24gdGhlIHN0YWNrXHJcblx0XHRjdXJyZW50RHJvcC5zY2hlem8ueCA9IE1hdGgucm91bmQoY3VycmVudERyb3Auc2NoZXpvLngpO1xyXG5cclxuXHRcdGlmKGN1cnJlbnREcm9wLmFybGUueCA9PSBjdXJyZW50RHJvcC5zY2hlem8ueCkge1x0XHQvLyB2ZXJ0aWNhbCBvcmllbnRhdGlvblxyXG5cdFx0XHRpZihjdXJyZW50RHJvcC5hcmxlLnkgPCBjdXJyZW50RHJvcC5zY2hlem8ueSkge1xyXG5cdFx0XHRcdGJvYXJkU3RhdGVbY3VycmVudERyb3Auc2NoZXpvLnhdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1swXSk7XHJcblx0XHRcdFx0Ym9hcmRTdGF0ZVtjdXJyZW50RHJvcC5zY2hlem8ueF0ucHVzaChjdXJyZW50RHJvcC5jb2xvdXJzWzFdKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRib2FyZFN0YXRlW2N1cnJlbnREcm9wLnNjaGV6by54XS5wdXNoKGN1cnJlbnREcm9wLmNvbG91cnNbMV0pO1xyXG5cdFx0XHRcdGJvYXJkU3RhdGVbY3VycmVudERyb3Auc2NoZXpvLnhdLnB1c2goY3VycmVudERyb3AuY29sb3Vyc1swXSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFJlbW92ZSBhbnkgcHV5b3MgYWJvdmUgcm93IDEzXHJcblx0XHRcdHRoaXMuYm9hcmQudHJpbSgpO1xyXG5cclxuXHRcdFx0dGhpcy5yZXNvbHZpbmdDaGFpbnMgPSB0aGlzLmJvYXJkLnJlc29sdmVDaGFpbnMoKTtcclxuXHRcdFx0Y3VycmVudERyb3Auc2NoZXpvLnggPSBudWxsO1xyXG5cdFx0XHRjdXJyZW50RHJvcC5zY2hlem8ueSA9IG51bGw7XHJcblx0XHRcdGN1cnJlbnREcm9wLnNoYXBlID0gbnVsbDtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1x0XHRcdC8vIGhvcml6b250YWwgb3JpZW50YXRpb25cclxuXHRcdFx0Y3VycmVudERyb3AuYXJsZS55ID0gTWF0aC5tYXgoYm9hcmRTdGF0ZVtjdXJyZW50RHJvcC5hcmxlLnhdLmxlbmd0aCwgYm9hcmRTdGF0ZVtjdXJyZW50RHJvcC5zY2hlem8ueF0ubGVuZ3RoKTtcclxuXHRcdFx0Y3VycmVudERyb3Auc2NoZXpvLnkgPSBjdXJyZW50RHJvcC5hcmxlLnk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGVzIHRoZSBkaXNwbGF5ZWQgc2NvcmUgYW5kIHNlbmRzIG51aXNhbmNlIHRvIG9wcG9uZW50cy5cclxuXHQgKi9cclxuXHR1cGRhdGVTY29yZSgpIHtcclxuXHRcdGNvbnN0IHBvaW50c0Rpc3BsYXlOYW1lID0gJ3BvaW50c0Rpc3BsYXknICsgdGhpcy5ib2FyZERyYXdlcklkO1xyXG5cclxuXHRcdGlmKHRoaXMucmVzb2x2aW5nU3RhdGUuY2hhaW4gPT09IDApIHtcclxuXHRcdFx0Ly8gU2NvcmUgZnJvbSBzb2Z0IGRyb3BwaW5nICh3aWxsIG5vdCBzZW5kIG51aXNhbmNlKVxyXG5cdFx0XHRpZih0aGlzLnNvZnREcm9wcyA+IDUpIHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnRTY29yZSArPSBNYXRoLmZsb29yKHRoaXMuc29mdERyb3BzIC8gNSk7XHJcblx0XHRcdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQocG9pbnRzRGlzcGxheU5hbWUpLmlubmVySFRNTCA9IFwiU2NvcmU6IFwiICsgdGhpcy5jdXJyZW50U2NvcmU7XHJcblx0XHRcdFx0dGhpcy5zb2Z0RHJvcHMgJT0gNTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dGhpcy5jdXJyZW50U2NvcmUgKz0gVXRpbHMuY2FsY3VsYXRlU2NvcmUodGhpcy5yZXNvbHZpbmdTdGF0ZS5wdXlvTG9jcywgdGhpcy5yZXNvbHZpbmdTdGF0ZS5jaGFpbik7XHJcblx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwb2ludHNEaXNwbGF5TmFtZSkuaW5uZXJIVE1MID0gXCJTY29yZTogXCIgKyB0aGlzLmN1cnJlbnRTY29yZTtcclxuXHJcblx0XHRsZXQgeyBudWlzYW5jZVNlbnQsIGxlZnRvdmVyTnVpc2FuY2UgfSA9XHJcblx0XHRcdFV0aWxzLmNhbGN1bGF0ZU51aXNhbmNlKHRoaXMuY3VycmVudFNjb3JlIC0gdGhpcy5wcmVDaGFpblNjb3JlLCB0aGlzLnNldHRpbmdzLnRhcmdldFBvaW50cywgdGhpcy5sZWZ0b3Zlck51aXNhbmNlKTtcclxuXHRcdHRoaXMubGVmdG92ZXJOdWlzYW5jZSA9IGxlZnRvdmVyTnVpc2FuY2U7XHJcblxyXG5cdFx0Ly8gU2VuZCBhbiBleHRyYSByb2NrIGlmIGFsbCBjbGVhclxyXG5cdFx0aWYodGhpcy5hbGxDbGVhcikge1xyXG5cdFx0XHRudWlzYW5jZVNlbnQgKz0gNSAqIHRoaXMuc2V0dGluZ3MuY29scztcclxuXHRcdFx0dGhpcy5hbGxDbGVhciA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdFx0Y29uc29sZS5sb2coXCJTZW50OiBcIiArIG51aXNhbmNlU2VudCArIFwiIExlZnRvdmVyOiBcIiArIGxlZnRvdmVyTnVpc2FuY2UpO1xyXG5cclxuXHRcdHRoaXMucHJlQ2hhaW5TY29yZSA9IHRoaXMuY3VycmVudFNjb3JlO1xyXG5cclxuXHRcdGlmKG51aXNhbmNlU2VudCA9PT0gMCkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUGFydGlhbGx5IGNhbmNlbCB0aGUgYWN0aXZlIG51aXNhbmNlXHJcblx0XHRpZih0aGlzLmFjdGl2ZU51aXNhbmNlID4gbnVpc2FuY2VTZW50KSB7XHJcblx0XHRcdHRoaXMuYWN0aXZlTnVpc2FuY2UgLT0gbnVpc2FuY2VTZW50O1xyXG5cdFx0XHRjb25zb2xlLmxvZygnUGFydGlhbGx5IGNhbmNlbGVkICcgKyBudWlzYW5jZVNlbnQgKyAnIGFjdGl2ZSBudWlzYW5jZS4nKTtcclxuXHRcdH1cclxuXHRcdC8vIEZ1bGx5IGNhbmNlbCB0aGUgYWN0aXZlIG51aXNhbmNlXHJcblx0XHRlbHNlIHtcclxuXHRcdFx0aWYodGhpcy5hY3RpdmVOdWlzYW5jZSAhPT0gMCkge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCdGdWxseSBjYW5jZWxlZCAnICsgdGhpcy5hY3RpdmVOdWlzYW5jZSArICcgYWN0aXZlIG51aXNhbmNlLicpO1xyXG5cdFx0XHR9XHJcblx0XHRcdG51aXNhbmNlU2VudCAtPSB0aGlzLmFjdGl2ZU51aXNhbmNlO1xyXG5cdFx0XHR0aGlzLmFjdGl2ZU51aXNhbmNlID0gMDtcclxuXHJcblx0XHRcdC8vIENhbmNlbCB0aGUgdmlzaWJsZSBudWlzYW5jZVxyXG5cdFx0XHRjb25zdCBvcHBvbmVudHMgPSBPYmplY3Qua2V5cyh0aGlzLnZpc2libGVOdWlzYW5jZSk7XHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCBvcHBvbmVudHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHQvLyBQYXJ0aWFsbHkgY2FuY2VsIHRoaXMgb3Bwb25lbnQncyBudWlzYW5jZVxyXG5cdFx0XHRcdGlmKHRoaXMudmlzaWJsZU51aXNhbmNlW29wcG9uZW50c1tpXV0gPiBudWlzYW5jZVNlbnQpIHtcclxuXHRcdFx0XHRcdHRoaXMudmlzaWJsZU51aXNhbmNlW29wcG9uZW50c1tpXV0gLT0gbnVpc2FuY2VTZW50O1xyXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0NvdWxkIG5vdCBmdWxseSBjYW5jZWwgJ1xyXG5cdFx0XHRcdFx0XHQrIHRoaXMudmlzaWJsZU51aXNhbmNlW29wcG9uZW50c1tpXV0gKyAnIHZpc2libGUgbnVpc2FuY2UgZnJvbSAnICsgb3Bwb25lbnRzW2ldICsgJy4nKVxyXG5cdFx0XHRcdFx0Ly8gTm8gbnVpc2FuY2UgbGVmdCB0byBzZW5kLCBzbyBicmVha1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIEZ1bGx5IGNhbmNlbCB0aGlzIG9wcG9uZW50J3MgbnVpc2FuY2VcclxuXHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdGlmKHRoaXMudmlzaWJsZU51aXNhbmNlW29wcG9uZW50c1tpXV0gIT09IDApIHtcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0Z1bGx5IGNhbmNlbGVkICdcclxuXHRcdFx0XHRcdFx0XHQrIHRoaXMudmlzaWJsZU51aXNhbmNlW29wcG9uZW50c1tpXV0gKyAnIHZpc2libGUgbnVpc2FuY2UgZnJvbSAnICsgb3Bwb25lbnRzW2ldICsgJy4nKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdG51aXNhbmNlU2VudCAtPSB0aGlzLnZpc2libGVOdWlzYW5jZVtvcHBvbmVudHNbaV1dO1xyXG5cdFx0XHRcdFx0dGhpcy52aXNpYmxlTnVpc2FuY2Vbb3Bwb25lbnRzW2ldXSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTdGlsbCBudWlzYW5jZSBsZWZ0IHRvIHNlbmRcclxuXHRcdFx0aWYobnVpc2FuY2VTZW50ID4gMCkge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCdTZW5kaW5nICcgKyBudWlzYW5jZVNlbnQgKyAnIG51aXNhbmNlLicpO1xyXG5cdFx0XHRcdHRoaXMuc29ja2V0LmVtaXQoJ3NlbmROdWlzYW5jZScsIHRoaXMuZ2FtZUlkLCBudWlzYW5jZVNlbnQpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDYWxsZWQgd2hlbiBhIG1vdmUgZXZlbnQgaXMgZW1pdHRlZCwgYW5kIHZhbGlkYXRlcyB0aGUgZXZlbnQgYmVmb3JlIHBlcmZvcm1pbmcgaXQuXHJcblx0ICogUHV5b3MgbWF5IG5vdCBtb3ZlIGludG8gdGhlIHdhbGwgb3IgaW50byB0aGUgc3RhY2suXHJcblx0ICovXHJcblx0bW92ZShkaXJlY3Rpb24pIHtcclxuICAgIC8vIERvIG5vdCBtb3ZlIHdoaWxlIHJvdGF0aW5nIDE4MFxyXG5cdFx0aWYodGhpcy5jdXJyZW50RHJvcC5yb3RhdGluZzE4MCA+IDApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNvbnN0IGFybGUgPSB0aGlzLmN1cnJlbnREcm9wLmFybGU7XHJcblx0XHRjb25zdCBzY2hlem8gPSBVdGlscy5nZXRPdGhlclB1eW8odGhpcy5jdXJyZW50RHJvcCk7XHJcblx0XHRjb25zdCBib2FyZFN0YXRlID0gdGhpcy5ib2FyZC5ib2FyZFN0YXRlO1xyXG5cdFx0bGV0IGxlZnRlc3QsIHJpZ2h0ZXN0O1xyXG5cclxuXHRcdGlmKGFybGUueCA8IHNjaGV6by54KSB7XHJcblx0XHRcdGxlZnRlc3QgPSBhcmxlO1xyXG5cdFx0XHRyaWdodGVzdCA9IHNjaGV6bztcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYgKGFybGUueCA+IHNjaGV6by54KSB7XHJcblx0XHRcdGxlZnRlc3QgPSBzY2hlem87XHJcblx0XHRcdHJpZ2h0ZXN0ID0gYXJsZTtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRpZihhcmxlLnkgPCBzY2hlem8ueSkge1xyXG5cdFx0XHRcdGxlZnRlc3QgPSByaWdodGVzdCA9IGFybGU7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0bGVmdGVzdCA9IHJpZ2h0ZXN0ID0gc2NoZXpvO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYoZGlyZWN0aW9uID09PSAnTGVmdCcpIHtcclxuXHRcdFx0aWYobGVmdGVzdC54ID49IDEgJiYgYm9hcmRTdGF0ZVtNYXRoLmZsb29yKGxlZnRlc3QueCkgLSAxXS5sZW5ndGggPD0gbGVmdGVzdC55KSB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5zaGlmdCgnTGVmdCcpO1xyXG5cdFx0XHRcdHRoaXMuYXVkaW9QbGF5ZXIucGxheUFuZEVtaXRTZngoJ21vdmUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihkaXJlY3Rpb24gPT09ICdSaWdodCcpIHtcclxuXHRcdFx0aWYocmlnaHRlc3QueCA8PSB0aGlzLnNldHRpbmdzLmNvbHMgLSAyICYmIGJvYXJkU3RhdGVbTWF0aC5jZWlsKHJpZ2h0ZXN0LngpICsgMV0ubGVuZ3RoIDw9IHJpZ2h0ZXN0LnkpIHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wLnNoaWZ0KCdSaWdodCcpO1xyXG5cdFx0XHRcdHRoaXMuYXVkaW9QbGF5ZXIucGxheUFuZEVtaXRTZngoJ21vdmUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihkaXJlY3Rpb24gPT09ICdEb3duJykge1xyXG5cdFx0XHRpZihhcmxlLnkgPiBib2FyZFN0YXRlW2FybGUueF0ubGVuZ3RoICYmIHNjaGV6by55ID4gYm9hcmRTdGF0ZVtNYXRoLnJvdW5kKHNjaGV6by54KV0ubGVuZ3RoKSB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5zaGlmdCgnRG93bicpO1xyXG5cdFx0XHRcdHRoaXMuc29mdERyb3BzICs9IDE7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0dGhpcy5mb3JjZUxvY2tEZWxheSArPSAxNTtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBuZXdfc2NoZXpvID0gVXRpbHMuZ2V0T3RoZXJQdXlvKHRoaXMuY3VycmVudERyb3ApO1xyXG5cdFx0XHRpZihuZXdfc2NoZXpvLnkgPCAwKSB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5zaGlmdCgnVXAnLCAtbmV3X3NjaGV6by55KTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHRocm93IG5ldyBFcnJvcignQXR0ZW1wdGVkIHRvIG1vdmUgaW4gYW4gdW5kZWZpbmVkIGRpcmVjdGlvbicpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2FsbGVkIHdoZW4gYSByb3RhdGUgZXZlbnQgaXMgZW1pdHRlZCBmcm9tIHRoZSBJbnB1dE1hbmFnZXIsIGFuZCB2YWxpZGF0ZXMgdGhlIGV2ZW50IGJlZm9yZSBwZXJmb3JtaW5nIGl0LlxyXG5cdCAqIFRoZSBkcm9wIG1heSBub3QgYmUgcm90YXRlZCB3aGlsZSBpdCBpcyBhbHJlYWR5IHJvdGF0aW5nLCBhbmQga2ljay8xODAgcm90YXRlIGNoZWNraW5nIG11c3QgYmUgcGVyZm9ybWVkLlxyXG5cdCAqL1xyXG5cdHJvdGF0ZShkaXJlY3Rpb24pIHtcclxuXHRcdGlmKHRoaXMuY3VycmVudERyb3Aucm90YXRpbmcgIT09ICdub3QnKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBuZXdEcm9wID0gdGhpcy5jdXJyZW50RHJvcC5jb3B5KCk7XHJcblxyXG5cdFx0aWYoZGlyZWN0aW9uID09PSAnQ1cnKSB7XHJcblx0XHRcdGNvbnN0IG5ld1N0YW5kYXJkQW5nbGUgPSB0aGlzLmN1cnJlbnREcm9wLnN0YW5kYXJkQW5nbGUgLSBNYXRoLlBJIC8gMjtcclxuXHRcdFx0bmV3RHJvcC5zdGFuZGFyZEFuZ2xlID0gbmV3U3RhbmRhcmRBbmdsZTtcclxuXHJcblx0XHRcdGlmKHRoaXMuY2hlY2tLaWNrKG5ld0Ryb3AsIGRpcmVjdGlvbikpIHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wLnJvdGF0ZSgnQ1cnKTtcclxuXHRcdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlBbmRFbWl0U2Z4KCdyb3RhdGUnKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGNvbnN0IG5ld1N0YW5kYXJkQW5nbGUgPSB0aGlzLmN1cnJlbnREcm9wLnN0YW5kYXJkQW5nbGUgKyBNYXRoLlBJIC8gMjtcclxuXHRcdFx0bmV3RHJvcC5zdGFuZGFyZEFuZ2xlID0gbmV3U3RhbmRhcmRBbmdsZTtcclxuXHJcblx0XHRcdGlmKHRoaXMuY2hlY2tLaWNrKG5ld0Ryb3AsIGRpcmVjdGlvbikpIHtcclxuXHRcdFx0XHR0aGlzLmN1cnJlbnREcm9wLnJvdGF0ZSgnQ0NXJyk7XHJcblx0XHRcdFx0dGhpcy5hdWRpb1BsYXllci5wbGF5QW5kRW1pdFNmeCgncm90YXRlJyk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZXMgaWYgYSBzcGVjaWZpZWQgcm90YXRpb24gaXMgdmFsaWQuXHJcblx0ICogSWYgdGhlIGRyb3AgZW5jb3VudGVycyBhIHdhbGwsIHRoZSBncm91bmQgb3IgYSBzdGFjayBkdXJpbmcgcm90YXRpb24sIGl0IGF0dGVtcHRzIHRvIGtpY2sgYXdheS5cclxuXHQgKiBJZiB0aGVyZSBpcyBubyBzcGFjZSB0byBraWNrIGF3YXksIHRoZSByb3RhdGlvbiB3aWxsIGZhaWwgdW5sZXNzIGEgMTgwIHJvdGF0ZSBpcyBwZXJmb3JtZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHtEcm9wfSBcdCBuZXdEcm9wICAgXHRUaGUgXCJmaW5hbCBzdGF0ZVwiIG9mIHRoZSBkcm9wIGFmdGVyIHRoZSByb3RhdGlvbiBmaW5pc2hlc1xyXG5cdCAqIEBwYXJhbSAge3N0cmluZ30gIGRpcmVjdGlvbiBcdFRoZSBkaXJlY3Rpb24gb2Ygcm90YXRpb25cclxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBcdFx0XHRXaGV0aGVyIHJvdGF0aW5nIGlzIGEgdmFsaWQgb3BlcmF0aW9uIG9yIG5vdFxyXG5cdCAqL1xyXG5cdGNoZWNrS2ljayhuZXdEcm9wLCBkaXJlY3Rpb24pIHtcclxuXHRcdGNvbnN0IGFybGUgPSB0aGlzLmN1cnJlbnREcm9wLmFybGU7XHJcblx0XHRjb25zdCBzY2hlem8gPSBVdGlscy5nZXRPdGhlclB1eW8obmV3RHJvcCk7XHJcblx0XHRjb25zdCBib2FyZFN0YXRlID0gdGhpcy5ib2FyZC5ib2FyZFN0YXRlO1xyXG5cclxuXHRcdGxldCBraWNrID0gJyc7XHJcblx0XHRsZXQgZG9Sb3RhdGUgPSB0cnVlO1xyXG5cclxuXHRcdC8vIENoZWNrIGJvYXJkIGVkZ2VzIHRvIGRldGVybWluZSBraWNrIGRpcmV0aW9uXHJcblx0XHRpZihzY2hlem8ueCA+IHRoaXMuc2V0dGluZ3MuY29scyAtIDEpIHtcclxuXHRcdFx0a2ljayA9ICdsZWZ0JztcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYoc2NoZXpvLnggPCAwKSB7XHJcblx0XHRcdGtpY2sgPSAncmlnaHQnO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdC8vIENoZWNrIHRoZSBzdGFja3MgdG8gZGV0ZXJtaW5lIGtpY2sgZGlyZWN0aW9uXHJcblx0XHRcdGlmKGJvYXJkU3RhdGVbc2NoZXpvLnhdLmxlbmd0aCA+PSBzY2hlem8ueSkge1xyXG5cdFx0XHRcdGlmKHNjaGV6by54ID4gYXJsZS54KSB7XHJcblx0XHRcdFx0XHRraWNrID0gJ0xlZnQnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlbHNlIGlmKHNjaGV6by54IDwgYXJsZS54KSB7XHJcblx0XHRcdFx0XHRraWNrID0gJ1JpZ2h0JztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0XHRraWNrID0gJ1VwJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBEZXRlcm1pbmUgaWYga2lja2luZyBpcyBwb3NzaWJsZVxyXG5cdFx0aWYoa2ljayA9PT0gJ0xlZnQnKSB7XHJcblx0XHRcdGlmKGFybGUueCA+PSAxICYmIGJvYXJkU3RhdGVbYXJsZS54IC0gMV0ubGVuZ3RoIDwgYXJsZS55KSB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5zaGlmdCgnTGVmdCcpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdGRvUm90YXRlID0gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGVsc2UgaWYoa2ljayA9PT0gJ1JpZ2h0Jykge1xyXG5cdFx0XHRpZihhcmxlLnggPD0gdGhpcy5zZXR0aW5ncy5jb2xzIC0gMiAmJiBib2FyZFN0YXRlW2FybGUueCArIDFdLmxlbmd0aCA8IGFybGUueSkge1xyXG5cdFx0XHRcdHRoaXMuY3VycmVudERyb3Auc2hpZnQoJ1JpZ2h0Jyk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZWxzZSB7XHJcblx0XHRcdFx0ZG9Sb3RhdGUgPSBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihraWNrID09PSAnVXAnKSB7XHJcblx0XHRcdHRoaXMuY3VycmVudERyb3Auc2hpZnQoJ1VwJywgYm9hcmRTdGF0ZVtzY2hlem8ueF0ubGVuZ3RoIC0gc2NoZXpvLnkgKyAwLjA1KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBDYW5ub3Qga2ljaywgYnV0IG1pZ2h0IGJlIGFibGUgdG8gMTgwIHJvdGF0ZVxyXG5cdFx0aWYoIWRvUm90YXRlKSB7XHJcblx0XHRcdGlmKERhdGUubm93KCkgLSB0aGlzLmxhc3RSb3RhdGVBdHRlbXB0W2RpcmVjdGlvbl0gPCB0aGlzLnNldHRpbmdzLnJvdGF0ZTE4MF90aW1lKSB7XHJcblx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5yb3RhdGUoZGlyZWN0aW9uLCAxODApO1xyXG5cclxuXHRcdFx0XHQvLyBDaGVjayBjYXNlIHdoZXJlIHNjaGV6byAxODAgcm90YXRlcyB0aHJvdWdoIHRoZSBzdGFjay9ncm91bmRcclxuXHRcdFx0XHRpZigoc2NoZXpvLnggPiBhcmxlLnggJiYgZGlyZWN0aW9uID09PSAnQ1cnKSB8fCAoc2NoZXpvLnggPCBhcmxlLnggJiYgZGlyZWN0aW9uID09PSAnQ0NXJykpIHtcclxuXHRcdFx0XHRcdGlmKGJvYXJkU3RhdGVbYXJsZS54XS5sZW5ndGggPj0gYXJsZS55IC0gMSkge1xyXG5cdFx0XHRcdFx0XHQvLyBPbmx5IGtpY2sgdGhlIHJlbWFpbmluZyBhbW91bnRcclxuXHRcdFx0XHRcdFx0dGhpcy5jdXJyZW50RHJvcC5zaGlmdCgnVXAnLCBib2FyZFN0YXRlW2FybGUueF0ubGVuZ3RoIC0gYXJsZS55ICsgMSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMubGFzdFJvdGF0ZUF0dGVtcHRbZGlyZWN0aW9uXSA9IERhdGUubm93KCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZG9Sb3RhdGU7XHJcblx0fVxyXG5cclxuXHRnZXRUb3RhbE51aXNhbmNlKCkge1xyXG5cdFx0Y29uc3QgdG90YWxWaXNpYmxlTnVpc2FuY2UgPVxyXG5cdFx0XHRPYmplY3Qua2V5cyh0aGlzLnZpc2libGVOdWlzYW5jZSkucmVkdWNlKChudWlzYW5jZSwgb3BwKSA9PiB7XHJcblx0XHRcdFx0bnVpc2FuY2UgKz0gdGhpcy52aXNpYmxlTnVpc2FuY2Vbb3BwXTtcclxuXHRcdFx0XHRyZXR1cm4gbnVpc2FuY2U7XHJcblx0XHRcdH0sIDApO1xyXG5cclxuXHRcdHJldHVybiB0aGlzLmFjdGl2ZU51aXNhbmNlICsgdG90YWxWaXNpYmxlTnVpc2FuY2U7XHJcblx0fVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgR2FtZSB9O1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5jbGFzcyBJbnB1dE1hbmFnZXJ7XHJcblx0Y29uc3RydWN0b3IodXNlclNldHRpbmdzKSB7XHJcblx0XHR0aGlzLmV2ZW50cyA9IFtdO1x0XHRcdFx0Ly8gQXJyYXkgb2YgY2FsbGJhY2sgZnVuY3Rpb25zLCBpbmRleGVkIGF0IHRoZWlyIHRyaWdnZXJpbmcgZXZlbnRcclxuXHRcdHRoaXMua2V5c1ByZXNzZWQgPSB7fTtcdFx0XHQvLyBPYmplY3QgY29udGFpbmluZyBrZXlzIHdpdGggd2hldGhlciB0aGV5IGFyZSBwcmVzc2VkIG9yIG5vdFxyXG5cdFx0dGhpcy5sYXN0UHJlc3NlZCA9IHVuZGVmaW5lZDtcdC8vIExhc3QgcHJlc3NlZCBMZWZ0L1JpZ2h0IGtleS4gQmVjb21lcyB1bmRlZmluZWQgaWYgdGhlIGtleSBpcyByZWxlYXNlZC5cclxuXHRcdHRoaXMuZGFzVGltZXIgPSB7fTtcdFx0XHRcdC8vIE9iamVjdCBjb250YWluaW5nIERBUyB0aW1lcnMgZm9yIGVhY2gga2V5XHJcblx0XHR0aGlzLmFyclRpbWVyID0ge307XHRcdFx0XHQvLyBPYmplY3QgY29udGFpbmluZyBBUlIgdGltZXJzIGZvciBlYWNoIGtleVxyXG5cdFx0dGhpcy51c2VyU2V0dGluZ3MgPSB1c2VyU2V0dGluZ3M7XHJcblxyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgZXZlbnQgPT4ge1xyXG5cdFx0XHR0aGlzLmtleXNQcmVzc2VkW2V2ZW50LmtleV0gPSB0cnVlO1xyXG5cdFx0XHRpZihldmVudC5rZXkgPT09ICdBcnJvd0xlZnQnIHx8IGV2ZW50LmtleSA9PT0gJ0Fycm93UmlnaHQnKSB7XHJcblx0XHRcdFx0dGhpcy5sYXN0UHJlc3NlZCA9IGV2ZW50LmtleTtcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIGV2ZW50ID0+IHtcclxuXHRcdFx0dGhpcy5rZXlzUHJlc3NlZFtldmVudC5rZXldID0gdW5kZWZpbmVkO1xyXG5cdFx0XHR0aGlzLmRhc1RpbWVyW2V2ZW50LmtleV0gPSB1bmRlZmluZWQ7XHJcblx0XHRcdGlmKHRoaXMuYXJyVGltZXJbZXZlbnQua2V5XSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0dGhpcy5hcnJUaW1lcltldmVudC5rZXldID0gdW5kZWZpbmVkO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmKGV2ZW50LmtleSA9PT0gJ0Fycm93TGVmdCcgfHwgZXZlbnQua2V5ID09PSAnQXJyb3dSaWdodCcpIHtcclxuXHRcdFx0XHR0aGlzLmxhc3RQcmVzc2VkID0gdW5kZWZpbmVkO1xyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRoZSAndXBkYXRlJyBtZXRob2QgZm9yIElucHV0TWFuYWdlcjsgY2FsbGVkIG9uY2UgZXZlcnkgZnJhbWUuXHJcblx0ICogRGV0ZXJtaW5lcyB3aGV0aGVyIGNvbmRpdGlvbnMgc3VjaCBhcyBEQVMgYW5kIEFSUiBzaG91bGQgYmUgYXBwbGllZC5cclxuXHQgKiBBbGwgJ3N1Y2Nlc3NmdWwnIGV2ZW50cyB3aWxsIGJlIGVtaXR0ZWQgYW5kIGNhdWdodCBieSB0aGUgZ2FtZSdzIHZhbGlkYXRpb24gZnVuY3Rpb25zIGJlZm9yZSBiZWluZyBleGVjdXRlZC5cclxuXHQgKiBTb2Z0IGRyb3BwaW5nIHdpbGwgYWx3YXlzIGJlIGV4ZWN1dGVkLlxyXG5cdCAqL1xyXG5cdGV4ZWN1dGVLZXlzKCkge1xyXG5cdFx0Ly8gRmlyc3QsIHRha2UgYWxsIHRoZSBrZXlzIGN1cnJlbnRseSBwcmVzc2VkXHJcblx0XHRPYmplY3Qua2V5cyh0aGlzLmtleXNQcmVzc2VkKS5maWx0ZXIoa2V5ID0+IHRoaXMua2V5c1ByZXNzZWRba2V5XSAhPT0gdW5kZWZpbmVkKS5mb3JFYWNoKGtleSA9PiB7XHJcblxyXG5cdFx0XHQvLyBJZiB0aGlzIGtleSBpcyBuZXdseSBwcmVzc2VkIE9SIHRoZSBEQVMgdGltZXIgaGFzIGNvbXBsZXRlZFxyXG5cdFx0XHRpZih0aGlzLmRhc1RpbWVyW2tleV0gPT09IHVuZGVmaW5lZCB8fCAoRGF0ZS5ub3coKSAtIHRoaXMuZGFzVGltZXJba2V5XSkgPj0gdGhpcy51c2VyU2V0dGluZ3MuZGFzIHx8IGtleSA9PT0gJ0Fycm93RG93bicpIHtcclxuXHRcdFx0XHQvLyBJZiB0aGUgcHV5byBpcyB1bmRlcmdvaW5nIEFSUiBBTkQgdGhlIEFSUiB0aW1lciBoYXMgbm90IGNvbXBsZXRlZFxyXG5cdFx0XHRcdGlmKHRoaXMuYXJyVGltZXJba2V5XSAhPT0gdW5kZWZpbmVkICYmIChEYXRlLm5vdygpIC0gdGhpcy5hcnJUaW1lcltrZXldKSA8IHRoaXMudXNlclNldHRpbmdzLmFyciAmJiBrZXkgIT09ICdBcnJvd0Rvd24nKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBJZiB0aGUgcHV5byBpcyByb3RhdGluZyBhbmQgdGhlIHJvdGF0ZSBidXR0b24gaXMgc3RpbGwgaGVsZFxyXG5cdFx0XHRcdGlmKHRoaXMuZGFzVGltZXJba2V5XSAhPT0gdW5kZWZpbmVkICYmIChrZXkgPT09ICd6JyB8fCBrZXkgPT09ICd4JykpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFBlcmZvcm0ga2V5IGFjdGlvblxyXG5cdFx0XHRcdHN3aXRjaChrZXkpIHtcclxuXHRcdFx0XHRcdGNhc2UgJ0Fycm93TGVmdCc6XHJcblx0XHRcdFx0XHRcdC8vIFNwZWNpYWwgY2FzZSBmb3IgaG9sZGluZyBib3RoIGRpcmVjdGlvbnMgZG93blxyXG5cdFx0XHRcdFx0XHRpZih0aGlzLmxhc3RQcmVzc2VkICE9PSAnQXJyb3dSaWdodCcpIHtcclxuXHRcdFx0XHRcdFx0XHR0aGlzLmVtaXQoJ01vdmUnLCAnTGVmdCcsIHRydWUpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0Y2FzZSAnQXJyb3dSaWdodCc6XHJcblx0XHRcdFx0XHRcdC8vIFNwZWNpYWwgY2FzZSBmb3IgaG9sZGluZyBib3RoIGRpcmVjdGlvbnMgZG93blxyXG5cdFx0XHRcdFx0XHRpZih0aGlzLmxhc3RQcmVzc2VkICE9PSAnQXJyb3dMZWZ0Jykge1xyXG5cdFx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnTW92ZScsICdSaWdodCcsIHRydWUpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0Y2FzZSAnQXJyb3dEb3duJzpcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdNb3ZlJywgJ0Rvd24nLCB0cnVlKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRjYXNlICd6JzpcclxuXHRcdFx0XHRcdFx0dGhpcy5lbWl0KCdSb3RhdGUnLCAnQ0NXJywgdHJ1ZSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0Y2FzZSAneCc6XHJcblx0XHRcdFx0XHRcdHRoaXMuZW1pdCgnUm90YXRlJywgJ0NXJywgdHJ1ZSk7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSWYgdG9vayBhbiBhY3Rpb24gYW5kIERBUyB0aW1lciBleGlzdHMsIHRoYXQgbXVzdCBtZWFuIGVudGVyaW5nIEFSUlxyXG5cdFx0XHRcdGlmKHRoaXMuZGFzVGltZXJba2V5XSAhPT0gdW5kZWZpbmVkKSB7XHJcblx0XHRcdFx0XHR0aGlzLmFyclRpbWVyW2tleV0gPSBEYXRlLm5vdygpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBPdGhlcndpc2UsIHRoaXMgaXMgYSBuZXcgcHJlc3MgYW5kIG11c3QgdW5kZXJnbyBEQVNcclxuXHRcdFx0XHRlbHNlIHtcclxuXHRcdFx0XHRcdHRoaXMuZGFzVGltZXJba2V5XSA9IERhdGUubm93KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldHMgdXAgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiBhIHBhcnRpY3VsYXIgZXZlbnQgZmlyZXMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHtzdHJpbmd9ICAgZXZlbnQgICAgVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgd2lsbCBiZSBmaXJlZFxyXG5cdCAqIEBwYXJhbSAge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCB3aWxsIGJlIGV4ZWN1dGVkIHdoZW4gdGhlIGV2ZW50IGZpcmVzXHJcblx0ICovXHJcblx0b24oZXZlbnQsIGNhbGxiYWNrKSB7XHJcblx0XHR0aGlzLmV2ZW50c1tldmVudF0gPSBjYWxsYmFjaztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEV4ZWN1dGVzIHRoZSBhcHByb3ByaWF0ZSBjYWxsYmFjayBmdW5jdGlvbiB3aGVuIGFuIGV2ZW50IGZpcmVzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtICB7c3RyaW5nfSBldmVudCAgVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRoYXQgd2FzIGZpcmVkXHJcblx0ICogQHBhcmFtICB7W3R5cGVdfSBkYXRhICAgQW55IHBhcmFtZXRlcnMgdGhhdCBuZWVkIHRvIGJlIHBhc3NlZCB0byB0aGUgY2FsbGJhY2tcclxuXHQgKi9cclxuXHRlbWl0KGV2ZW50LCBkYXRhLCBwbGF5ZXIpIHtcclxuXHRcdGNvbnN0IGNhbGxiYWNrID0gdGhpcy5ldmVudHNbZXZlbnRdO1xyXG5cdFx0Y2FsbGJhY2soZGF0YSwgcGxheWVyKTtcclxuXHR9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0geyBJbnB1dE1hbmFnZXIgfTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBCb2FyZERyYXdlciB9ID0gcmVxdWlyZSgnLi9Cb2FyZERyYXdlcicpO1xyXG5jb25zdCB7IEdhbWUgfSA9IHJlcXVpcmUoJy4vR2FtZS5qcycpO1xyXG5jb25zdCB7IElucHV0TWFuYWdlciB9ID0gcmVxdWlyZSgnLi9JbnB1dE1hbmFnZXIuanMnKTtcclxuXHJcbmNsYXNzIFBsYXllckdhbWUgZXh0ZW5kcyBHYW1lIHtcclxuXHRjb25zdHJ1Y3RvcihnYW1lSWQsIG9wcG9uZW50SWRzLCBzb2NrZXQsIHNldHRpbmdzLCB1c2VyU2V0dGluZ3MpIHtcclxuXHRcdHN1cGVyKGdhbWVJZCwgb3Bwb25lbnRJZHMsIHNvY2tldCwgMSwgc2V0dGluZ3MsIHVzZXJTZXR0aW5ncyk7XHJcblxyXG5cdFx0Ly8gQWNjZXB0cyBpbnB1dHMgZnJvbSBwbGF5ZXJcclxuXHRcdHRoaXMuaW5wdXRNYW5hZ2VyID0gbmV3IElucHV0TWFuYWdlcih0aGlzLnVzZXJTZXR0aW5ncywgdGhpcy5wbGF5ZXIsIHRoaXMuZ2FtZUlkLCB0aGlzLm9wcG9uZW50SWQsIHRoaXMuc29ja2V0KTtcclxuXHRcdHRoaXMuaW5wdXRNYW5hZ2VyLm9uKCdNb3ZlJywgdGhpcy5tb3ZlLmJpbmQodGhpcykpO1xyXG5cdFx0dGhpcy5pbnB1dE1hbmFnZXIub24oJ1JvdGF0ZScsIHRoaXMucm90YXRlLmJpbmQodGhpcykpO1xyXG5cdFx0dGhpcy5vcHBvbmVudEJvYXJkRHJhd2VycyA9IHt9O1xyXG5cclxuXHRcdC8vIEFkZCBhIEJvYXJkRHJhd2VyIGZvciBlYWNoIG9wcG9uZW50LiBDUFUgYm9hcmRzIHdpbGwgZHJhdyB0aGVtc2VsdmVzXHJcblx0XHRsZXQgb3Bwb25lbnRDb3VudGVyID0gMTtcclxuXHRcdHRoaXMub3Bwb25lbnRJZHMuZm9yRWFjaChpZCA9PiB7XHJcblx0XHRcdGlmKGlkID4gMCkge1xyXG5cdFx0XHRcdHRoaXMub3Bwb25lbnRCb2FyZERyYXdlcnNbaWRdID0gbmV3IEJvYXJkRHJhd2VyKHRoaXMuc2V0dGluZ3MsIG9wcG9uZW50Q291bnRlciArIDEpO1xyXG5cdFx0XHR9XHJcblx0XHRcdG9wcG9uZW50Q291bnRlcisrO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXHJcblx0XHR0aGlzLnNvY2tldC5vbignc2VuZFN0YXRlJywgKGdhbWVJZCwgYm9hcmRIYXNoLCBzY29yZSwgbnVpc2FuY2UpID0+IHtcclxuXHRcdFx0aWYoIXRoaXMub3Bwb25lbnRJZHMuaW5jbHVkZXMoZ2FtZUlkKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZihnYW1lSWQgPiAwKSB7XHJcblx0XHRcdFx0dGhpcy5vcHBvbmVudEJvYXJkRHJhd2Vyc1tnYW1lSWRdLmRyYXdGcm9tSGFzaChib2FyZEhhc2gpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMudXBkYXRlT3Bwb25lbnRTY29yZShnYW1lSWQsIHNjb3JlKTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdHRoaXMuc29ja2V0Lm9uKCdzZW5kU291bmQnLCAoZ2FtZUlkLCBzZnhfbmFtZSwgaW5kZXgpID0+IHtcclxuXHRcdFx0aWYoIXRoaXMub3Bwb25lbnRJZHMuaW5jbHVkZXMoZ2FtZUlkKSkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLmF1ZGlvUGxheWVyLnBsYXlTZngoc2Z4X25hbWUsIGluZGV4KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQE92ZXJyaWRlXHJcblx0ICogRXhlY3V0ZXMgdGhlIElucHV0TWFuYWdlciBmb3IgdGhlIGdhbWUuXHJcblx0ICovXHJcblx0Z2V0SW5wdXRzKCkge1xyXG5cdFx0dGhpcy5pbnB1dE1hbmFnZXIuZXhlY3V0ZUtleXMoKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZXMgdGhlIHNjb3JlIGZvciBvcHBvbmVudHMuXHJcblx0ICovXHJcblx0dXBkYXRlT3Bwb25lbnRTY29yZShnYW1lSWQsIHNjb3JlKSB7XHJcblx0XHRjb25zdCBwb2ludHNEaXNwbGF5TmFtZSA9ICdwb2ludHNEaXNwbGF5JyArICcyJztcclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHBvaW50c0Rpc3BsYXlOYW1lKS5pbm5lckhUTUwgPSBcIlNjb3JlOiBcIiArIHNjb3JlO1xyXG5cdH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7IFBsYXllckdhbWUgfTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgeyBEcm9wIH0gPSByZXF1aXJlKCcuL0Ryb3AuanMnKTtcclxuXHJcbmNvbnN0IENPTE9VUl9MSVNUID0gWyAnUmVkJywgJ0JsdWUnLCAnR3JlZW4nLCAnUHVycGxlJywgJ1llbGxvdycsICdHcmF5J107XHJcbmNvbnN0IFBVWU9fQ09MT1VSUyA9IHsgJ1JlZCc6ICdyZ2JhKDIwMCwgMjAsIDIwLCAwLjkpJyxcclxuXHRcdFx0XHRcdFx0J0dyZWVuJzogJ3JnYmEoMjAsIDIwMCwgMjAsIDAuOSknLFxyXG5cdFx0XHRcdFx0XHQnQmx1ZSc6ICdyZ2JhKDIwLCAyMCwgMjAwLCAwLjkpJyxcclxuXHRcdFx0XHRcdFx0J1B1cnBsZSc6ICdyZ2JhKDE1MCwgMjAsIDE1MCwgMC45KScsXHJcblx0XHRcdFx0XHRcdCdZZWxsb3cnOiAncmdiYSgxNTAsIDE1MCwgMjAsIDAuOSknLFxyXG5cdFx0XHRcdFx0XHQnR3JheSc6ICdyZ2JhKDEwMCwgMTAwLCAxMDAsIDAuOSknIH07XHJcbmNvbnN0IFBVWU9fRVlFU19DT0xPVVIgPSAncmdiYSgyNTUsIDI1NSwgMjU1LCAwLjcpJztcclxuXHJcbmNsYXNzIFNldHRpbmdzIHtcclxuXHRjb25zdHJ1Y3RvcihnYW1lbW9kZSA9ICdUc3UnLCBncmF2aXR5ID0gMC4wMzYsIHJvd3MgPSAxMiwgY29scyA9IDYsIHNvZnREcm9wID0gMC4yNywgbnVtQ29sb3VycyA9IDQsIHRhcmdldFBvaW50cyA9IDcwLCBzZWVkID0gTWF0aC5yYW5kb20oKSkge1xyXG5cdFx0dGhpcy5nYW1lbW9kZSA9IGdhbWVtb2RlO1x0XHRcdC8vIFR5cGUgb2YgZ2FtZSB0aGF0IGlzIGJlaW5nIHBsYXllZFxyXG5cdFx0dGhpcy5ncmF2aXR5ID0gZ3Jhdml0eTtcdFx0XHRcdC8vIFZlcnRpY2FsIGRpc3RhbmNlIHRoZSBkcm9wIGZhbGxzIGV2ZXJ5IGZyYW1lIG5hdHVyYWxseSAod2l0aG91dCBzb2Z0IGRyb3BwaW5nKVxyXG5cdFx0dGhpcy5yb3dzID0gcm93cztcdFx0XHRcdFx0Ly8gTnVtYmVyIG9mIHJvd3MgaW4gdGhlIGdhbWUgYm9hcmRcclxuXHRcdHRoaXMuY29scyA9IGNvbHM7XHRcdFx0XHRcdC8vIE51bWJlciBvZiBjb2x1bW5zIGluIHRoZSBnYW1lIGJvYXJkXHJcblx0XHR0aGlzLnNvZnREcm9wID0gc29mdERyb3A7XHRcdFx0Ly8gQWRkaXRpb25hbCB2ZXJ0aWNhbCBkaXN0YW5jZSB0aGUgZHJvcCBmYWxscyB3aGVuIHNvZnQgZHJvcHBpbmdcclxuXHRcdHRoaXMubnVtQ29sb3VycyA9IG51bUNvbG91cnM7XHRcdC8vIE51bWJlciBvZiB1bmlxdWUgcHV5byBjb2xvdXJzIGJlaW5nIHVzZWRcclxuXHRcdHRoaXMudGFyZ2V0UG9pbnRzID0gdGFyZ2V0UG9pbnRzO1x0Ly8gUG9pbnRzIHJlcXVpcmVkIHRvIHNlbmQgb25lIG51aXNhbmNlIHB1eW9cclxuXHRcdHRoaXMuc2VlZCA9IHNlZWQ7XHJcblxyXG5cdFx0Ly8gQ29uc3RhbnRzIHRoYXQgY2Fubm90IGJlIG1vZGlmaWVkXHJcblx0XHR0aGlzLmxvY2tEZWxheSA9IDIwMDtcdFx0XHRcdC8vIE1pbGxpc2Vjb25kcyBvZiB0aW1lIGJlZm9yZSBhIGRyb3AgbG9ja3MgaW50byBwbGFjZVxyXG5cdFx0dGhpcy5mcmFtZXNfcGVyX3JvdGF0aW9uID0gODtcdFx0Ly8gTnVtYmVyIG9mIGZyYW1lcyB1c2VkIHRvIGFuaW1hdGUgOTAgZGVncmVlcyBvZiByb3RhdGlvblxyXG5cdFx0dGhpcy5yb3RhdGUxODBfdGltZSA9IDIwMDtcdFx0XHQvLyBNYXggbWlsbGlzZWNvbmRzIGFmdGVyIGEgcm90YXRlIGF0dGVtcHQgdGhhdCBhIHNlY29uZCByb3RhdGUgYXR0ZW1wdCB3aWxsIHRyaWdnZXIgMTgwIHJvdGF0aW9uXHJcblx0XHR0aGlzLnNxdWlzaEZyYW1lcyA9IDg7XHRcdFx0XHQvLyBOdW1iZXIgb2YgZnJhbWVzIHVzZWQgZm9yIHNxdWlzaGluZyBhIGRyb3AgaW50byB0aGUgc3RhY2tcclxuXHRcdHRoaXMuZHJvcEZyYW1lcyA9IDEwO1x0XHRcdFx0Ly8gTnVtYmVyIG9mIGZyYW1lcyB1c2VkIGZvciBhbGwgdGhlIHB1eW8gdG8gZHJvcFxyXG5cdFx0dGhpcy5wb3BGcmFtZXMgPSA2NTtcdFx0XHRcdC8vIE51bWJlciBvZiBmcmFtZXMgdXNlZCB0byBwb3AgYW55IGFtb3VudCBvZiBwdXlvc1xyXG5cdFx0dGhpcy5pc29DYXNjYWRlRnJhbWVzUGVyUm93XHQ9IDMuMjU7XHQvLyBOdW1iZXIgb2YgZnJhbWVzIHVzZWQgZm9yIGFuIGlzb2xhdGVkIHB1eW8gdG8gZmFsbCBvbmUgcm93XHJcblx0XHR0aGlzLm1lYW5OdWlzYW5jZUNhc2NhZGVGUFIgPSAzO1x0Ly8gQXZlcmFnZSBmcmFtZXMgdXNlZCBmb3IgbnVpc2FuY2UgdG8gZHJvcCBvbmUgcm93XHJcblx0XHR0aGlzLnZhck51aXNhbmNlQ2FzY2FkZUZQUiA9IDAuMzsgXHQvLyBNYXggcG9zaXRpdmUgb3IgbmVnYXRpdmUgZGlmZmVyZW5jZSBpbiBmcmFtZXMgdXNlZCBmb3IgbnVpc2FuY2UgdG8gZHJvcCBvbmUgcm93XHJcblx0XHR0aGlzLm51aXNhbmNlTGFuZEZyYW1lcyA9IDQ7XHRcdC8vIE51bWJlciBvZiBmcmFtZXMgdGFrZW4gZm9yIHRoZSBudWlzYW5jZSBsYW5kaW5nIGFuaW1hdGlvblxyXG5cdFx0dGhpcy5oYXNoU25hcEZhY3RvciA9IDEwMDtcdFx0XHQvLyBGcmFjdGlvbiBvZiBhIHJvdyByb3VuZGVkIHRvIHdoZW4gaGFzaGluZ1xyXG5cdFx0dGhpcy5oYXNoUm90RmFjdG9yID0gNTA7XHRcdFx0Ly8gRnJhY3Rpb24gb2YgYSByZXYgcm91bmRlZCB0byB3aGVuIGhhc2hpbmdcclxuXHRcdHRoaXMubnVpc2FuY2VTcGF3blJvdyA9IHJvd3MgKyAyO1x0Ly8gUm93IG9mIG51aXNhbmNlIHNwYXduXHJcblx0fVxyXG5cclxuXHR0b1N0cmluZygpIHtcclxuXHRcdHJldHVybiB0aGlzLmdhbWVtb2RlICsgJyAnXHJcblx0XHRcdCsgdGhpcy5ncmF2aXR5ICsgJyAnXHJcblx0XHRcdCsgdGhpcy5yb3dzICsgJyAnXHJcblx0XHRcdCsgdGhpcy5jb2xzICsgJyAnXHJcblx0XHRcdCsgdGhpcy5zb2Z0RHJvcCArICcgJ1xyXG5cdFx0XHQrIHRoaXMubnVtQ29sb3VycyArICcgJ1xyXG5cdFx0XHQrIHRoaXMudGFyZ2V0UG9pbnRzICsgJyAnXHJcblx0XHRcdCsgdGhpcy5zZWVkO1xyXG5cdH1cclxuXHJcblx0c3RhdGljIGZyb21TdHJpbmcoc3RyKSB7XHJcblx0XHRjb25zdCBwYXJ0cyA9IHN0ci5zcGxpdCgnICcpO1xyXG5cdFx0Y29uc3QgZ2FtZW1vZGUgPSBwYXJ0cy5zcGxpY2UoMCwgMSlbMF07XHJcblx0XHRjb25zdCBwYXJzZWRQYXJ0cyA9IHBhcnRzLm1hcChwYXJ0ID0+IE51bWJlcihwYXJ0KSk7XHJcblx0XHRyZXR1cm4gbmV3IFNldHRpbmdzKGdhbWVtb2RlLCAuLi5wYXJzZWRQYXJ0cyk7XHJcblx0fVxyXG59XHJcblxyXG5jbGFzcyBVc2VyU2V0dGluZ3Mge1xyXG5cdGNvbnN0cnVjdG9yKGRhcyA9IDIwMCwgYXJyID0gMjAsIHZvbHVtZSA9IDAuMSkge1xyXG5cdFx0dGhpcy5kYXMgPSBkYXM7XHRcdFx0XHRcdFx0Ly8gTWlsbGlzZWNvbmRzIGJlZm9yZSBob2xkaW5nIGEga2V5IHJlcGVhdGVkbHkgdHJpZ2dlcnMgdGhlIGV2ZW50XHJcblx0XHR0aGlzLmFyciA9IGFycjtcdFx0XHRcdFx0XHQvLyBNaWxsaXNlY29uZHMgYmV0d2VlbiBldmVudCB0cmlnZ2VycyBhZnRlciB0aGUgREFTIHRpbWVyIGlzIGNvbXBsZXRlXHJcblx0XHR0aGlzLnZvbHVtZSA9IHZvbHVtZTtcdFx0XHRcdC8vIFZvbHVtZSAodmFyaWVzIGJldHdlZW4gMCBhbmQgMSlcclxuXHR9XHJcbn1cclxuXHJcbmNsYXNzIEF1ZGlvUGxheWVyIHtcclxuXHRjb25zdHJ1Y3RvcihnYW1lSWQsIHNvY2tldCwgdm9sdW1lKSB7XHJcblx0XHR0aGlzLmdhbWVJZCA9IGdhbWVJZDtcclxuXHRcdHRoaXMuc29ja2V0ID0gc29ja2V0O1xyXG5cdFx0dGhpcy52b2x1bWUgPSB2b2x1bWU7XHJcblx0XHR0aGlzLmNhbmNlbCA9IGZhbHNlO1xyXG5cclxuXHRcdHRoaXMuc2Z4ID0ge1xyXG5cdFx0XHQnbW92ZSc6IG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QwN19tb3ZlLndhdicpLFxyXG5cdFx0XHQncm90YXRlJzogbmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDA4X3JvdGF0ZS53YXYnKSxcclxuXHRcdFx0J3dpbic6IG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QxOV93aW4ud2F2JyksXHJcblx0XHRcdCdsb3NzJzogbmV3IEF1ZGlvKCcuLi9zb3VuZHMvc2VfcHV5MjBfbG9zZS53YXYnKSxcclxuXHRcdFx0J2NoYWluJzogW1xyXG5cdFx0XHRcdG51bGwsXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDAwX3JlbjEud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDAxX3JlbjIud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDAyX3JlbjMud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDAzX3JlbjQud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDA0X3JlbjUud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDA1X3JlbjYud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDA2X3Jlbjcud2F2JylcclxuXHRcdFx0XSxcclxuXHRcdFx0J2NoYWluX3ZvaWNlZCc6IFtcclxuXHRcdFx0XHRudWxsXHJcblx0XHRcdF0sXHJcblx0XHRcdCdjaGFpbl92b2ljZWRfanBuJzogW1xyXG5cdFx0XHRcdG51bGwsXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvdm9pY2VzL2NoYWluXzFfanBuLndhdicpLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL3ZvaWNlcy9jaGFpbl8yX2pwbi53YXYnKSxcclxuXHRcdFx0XHRuZXcgQXVkaW8oJy4uL3NvdW5kcy92b2ljZXMvY2hhaW5fM19qcG4ud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvdm9pY2VzL2NoYWluXzRfanBuLndhdicpLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL3ZvaWNlcy9jaGFpbl81X2pwbi53YXYnKSxcclxuXHRcdFx0XHRuZXcgQXVkaW8oJy4uL3NvdW5kcy92b2ljZXMvY2hhaW5fNl9qcG4ud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvdm9pY2VzL2NoYWluXzdfanBuLndhdicpLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL3ZvaWNlcy9jaGFpbl84X2pwbi53YXYnKSxcclxuXHRcdFx0XHRuZXcgQXVkaW8oJy4uL3NvdW5kcy92b2ljZXMvY2hhaW5fOV9qcG4ud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvdm9pY2VzL2NoYWluXzEwX2pwbi53YXYnKSxcclxuXHRcdFx0XHRuZXcgQXVkaW8oJy4uL3NvdW5kcy92b2ljZXMvY2hhaW5fMTFfanBuLndhdicpLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL3ZvaWNlcy9jaGFpbl8xMl9qcG4ud2F2JyksXHJcblx0XHRcdF0sXHJcblx0XHRcdCdudWlzYW5jZVNlbmQnOiBbXHJcblx0XHRcdFx0bnVsbCxcclxuXHRcdFx0XHRudWxsLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QxNF9val9va3VyaTEud2F2JyksXHJcblx0XHRcdFx0bmV3IEF1ZGlvKCcuLi9zb3VuZHMvU0VfVDE1X29qX29rdXJpMi53YXYnKSxcclxuXHRcdFx0XHRuZXcgQXVkaW8oJy4uL3NvdW5kcy9TRV9UMTZfb2pfb2t1cmkzLndhdicpLFxyXG5cdFx0XHRcdG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QxN19val9va3VyaTQud2F2JylcclxuXHRcdFx0XSxcclxuXHRcdFx0J251aXNhbmNlRmFsbDEnOiBuZXcgQXVkaW8oJy4uL3NvdW5kcy9TRV9UMTJfb2phbWExLndhdicpLFxyXG5cdFx0XHQnbnVpc2FuY2VGYWxsMic6IG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QxM19vamFtYTIud2F2JyksXHJcblx0XHRcdCdhbGxDbGVhcic6IG5ldyBBdWRpbygnLi4vc291bmRzL1NFX1QyMl96ZW5rZXNpLndhdicpXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIFNldCB2b2x1bWUgZm9yIGVhY2ggc291bmRcclxuXHRcdE9iamVjdC5rZXlzKHRoaXMuc2Z4KS5mb3JFYWNoKGtleSA9PiB7XHJcblx0XHRcdGNvbnN0IHNvdW5kcyA9IHRoaXMuc2Z4W2tleV07XHJcblx0XHRcdGlmKGtleS5pbmNsdWRlcygndm9pY2VkJykpIHtcclxuXHRcdFx0XHRzb3VuZHMuZmlsdGVyKHNvdW5kID0+IHNvdW5kICE9PSBudWxsKS5mb3JFYWNoKHNvdW5kID0+IHNvdW5kLnZvbHVtZSA9IDAuNCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmKEFycmF5LmlzQXJyYXkoc291bmRzKSkge1xyXG5cdFx0XHRcdHNvdW5kcy5maWx0ZXIoc291bmQgPT4gc291bmQgIT09IG51bGwpLmZvckVhY2goc291bmQgPT4gc291bmQudm9sdW1lID0gdGhpcy52b2x1bWUpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYoc291bmRzICE9PSBudWxsKSB7XHJcblx0XHRcdFx0Ly8gV2luL0xvc2UgU0ZYIGFyZSBlc3BlY2lhbGx5IGxvdWRcclxuXHRcdFx0XHRpZihrZXkgPT09ICd3aW4nIHx8IGtleSA9PT0gJ2xvc2UnKSB7XHJcblx0XHRcdFx0XHRzb3VuZHMudm9sdW1lID0gdGhpcy52b2x1bWUgKiAwLjY7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGVsc2Uge1xyXG5cdFx0XHRcdFx0c291bmRzLnZvbHVtZSA9IHRoaXMudm9sdW1lO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQbGF5cyBhIHNvdW5kIGVmZmVjdC4gQW4gMS1iYXNlZCBpbmRleCBwYXJhbWV0ZXIgaXMgcHJvdmlkZWQgZm9yIG1vcmUgZGV0YWlsZWQgc2VsZWN0aW9uLlxyXG5cdCAqL1xyXG5cdHBsYXlTZngoc2Z4X25hbWUsIGluZGV4ID0gbnVsbCkge1xyXG5cdFx0aWYodGhpcy5jYW5jZWwpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYoaW5kZXggIT09IG51bGwpIHtcclxuXHRcdFx0dGhpcy5zZnhbc2Z4X25hbWVdW2luZGV4XS5wbGF5KCk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0dGhpcy5zZnhbc2Z4X25hbWVdLnBsYXkoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBsYXlzIGEgc291bmQgZWZmZWN0LCBhbmQgZW1pdHMgdGhlIHNvdW5kIHRvIHRoZSBzZXJ2ZXIuXHJcblx0ICogVXNlZCBzbyB0aGF0IG90aGVyIHBsYXllcnMgY2FuIGhlYXIgdGhlIGFwcHJvcHJpYXRlIHNvdW5kLlxyXG5cdCAqL1xyXG5cdHBsYXlBbmRFbWl0U2Z4KHNmeF9uYW1lLCBpbmRleCA9IG51bGwpIHtcclxuXHRcdHRoaXMucGxheVNmeChzZnhfbmFtZSwgaW5kZXgpO1xyXG5cdFx0dGhpcy5zb2NrZXQuZW1pdCgnc2VuZFNvdW5kJywgdGhpcy5nYW1lSWQsIHNmeF9uYW1lLCBpbmRleCk7XHJcblx0fVxyXG5cclxuXHRkaXNhYmxlKCkge1xyXG5cdFx0dGhpcy5jYW5jZWwgPSB0cnVlO1xyXG5cdH1cclxufVxyXG5cclxuY2xhc3MgRHJvcEdlbmVyYXRvciB7XHJcblx0Y29uc3RydWN0b3Ioc2V0dGluZ3MpIHtcclxuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuXHRcdHRoaXMuc2VlZCA9IHRoaXMuc2V0dGluZ3Muc2VlZDtcclxuXHRcdHRoaXMuZHJvcHMgPSBbXTtcclxuXHRcdHRoaXMuY29sb3VyTGlzdCA9IE9iamVjdC5rZXlzKFBVWU9fQ09MT1VSUykuc2xpY2UoMCwgdGhpcy5zZXR0aW5ncy5udW1Db2xvdXJzKS5tYXAoY29sb3VyX25hbWUgPT4gUFVZT19DT0xPVVJTW2NvbG91cl9uYW1lXSk7XHJcblx0XHR0aGlzLmNvbG91ckJ1Y2tldHMgPSB7fTtcclxuXHRcdHRoaXMuZHJvcHNbMF0gPSBbXTtcclxuXHJcblx0XHQvLyBTZXQgdXAgY29sb3VyQnVja2V0cyBmb3IgdGhlIGZpcnN0IGJhdGNoIG9mIDEyOFxyXG5cdFx0dGhpcy5jb2xvdXJMaXN0LmZvckVhY2goY29sb3VyID0+IHtcclxuXHRcdFx0Ly8gQ2VpbGluZyBpbnN0ZWFkIG9mIGZsb29yaW5nIHNvIHRoYXQgdGhlcmUgd2lsbCBiZSBsZWZ0b3ZlciBhbW91bnRzIGluc3RlYWQgb2Ygbm90IGVub3VnaFxyXG5cdFx0XHR0aGlzLmNvbG91ckJ1Y2tldHNbY29sb3VyXSA9IE1hdGguY2VpbCgxMjggLyB0aGlzLnNldHRpbmdzLm51bUNvbG91cnMpO1xyXG5cdFx0fSk7XHJcblxyXG5cdFx0Ly8gR2VuZXJhdGUgdGhlIDMgY29sb3VycyB0aGF0IHdpbGwgYmUgdXNlZCBmb3IgdGhlIGZpcnN0IDMgZHJvcHNcclxuXHRcdGNvbnN0IGZpcnN0Q29sb3VycyA9IFtdO1xyXG5cdFx0d2hpbGUoZmlyc3RDb2xvdXJzLmxlbmd0aCA8IDMpIHtcclxuXHRcdFx0bGV0IGNvbG91ciA9IHRoaXMuY29sb3VyTGlzdFtNYXRoLmZsb29yKHRoaXMucmFuZG9tTnVtYmVyKCkgKiB0aGlzLmNvbG91ckxpc3QubGVuZ3RoKV07XHJcblx0XHRcdGlmKCFmaXJzdENvbG91cnMuaW5jbHVkZXMoY29sb3VyKSkge1xyXG5cdFx0XHRcdGZpcnN0Q29sb3Vycy5wdXNoKGNvbG91cik7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBPbmx5IHVzZSB0aGUgcHJldmlvdXNseSBkZXRlcm1pbmVkIDMgY29sb3VycyBmb3IgdGhlIGZpcnN0IDMgZHJvcHNcclxuXHRcdGZvcihsZXQgaSA9IDA7IGkgPCAzOyBpKyspIHtcclxuXHRcdFx0Y29uc3QgY29sb3VycyA9IFtcclxuXHRcdFx0XHRmaXJzdENvbG91cnNbTWF0aC5mbG9vcih0aGlzLnJhbmRvbU51bWJlcigpICogMyldLFxyXG5cdFx0XHRcdGZpcnN0Q29sb3Vyc1tNYXRoLmZsb29yKHRoaXMucmFuZG9tTnVtYmVyKCkgKiAzKV1cclxuXHRcdFx0XTtcclxuXHRcdFx0dGhpcy5jb2xvdXJCdWNrZXRzW2NvbG91cnNbMF1dLS07XHJcblx0XHRcdHRoaXMuY29sb3VyQnVja2V0c1tjb2xvdXJzWzFdXS0tO1xyXG5cdFx0XHR0aGlzLmRyb3BzWzBdLnB1c2goRHJvcC5nZXROZXdEcm9wKHRoaXMuc2V0dGluZ3MsIGNvbG91cnMpKTtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IobGV0IGkgPSAzOyBpIDwgMTI4OyBpKyspIHtcclxuXHRcdFx0Ly8gRmlsdGVyIG91dCBjb2xvdXJzIHRoYXQgaGF2ZSBiZWVuIGNvbXBsZXRlbHkgdXNlZCB1cFxyXG5cdFx0XHRjb25zdCB0ZW1wQ29sb3VyTGlzdCA9IE9iamVjdC5rZXlzKHRoaXMuY29sb3VyQnVja2V0cykuZmlsdGVyKGNvbG91ciA9PiB0aGlzLmNvbG91ckJ1Y2tldHNbY29sb3VyXSA+IDApO1xyXG5cdFx0XHRjb25zdCBjb2xvdXJzID0gW1xyXG5cdFx0XHRcdHRlbXBDb2xvdXJMaXN0W01hdGguZmxvb3IodGhpcy5yYW5kb21OdW1iZXIoKSAqIHRlbXBDb2xvdXJMaXN0Lmxlbmd0aCldLFxyXG5cdFx0XHRcdHRlbXBDb2xvdXJMaXN0W01hdGguZmxvb3IodGhpcy5yYW5kb21OdW1iZXIoKSAqIHRlbXBDb2xvdXJMaXN0Lmxlbmd0aCldXHJcblx0XHRcdF07XHJcblx0XHRcdHRoaXMuY29sb3VyQnVja2V0c1tjb2xvdXJzWzBdXS0tO1xyXG5cdFx0XHR0aGlzLmNvbG91ckJ1Y2tldHNbY29sb3Vyc1sxXV0tLTtcclxuXHJcblx0XHRcdHRoaXMuZHJvcHNbMF0ucHVzaChEcm9wLmdldE5ld0Ryb3AodGhpcy5zZXR0aW5ncywgY29sb3VycykpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmVxdWVzdERyb3BzKGluZGV4KSB7XHJcblx0XHRpZih0aGlzLmRyb3BzW2luZGV4ICsgMV0gPT09IHVuZGVmaW5lZCkge1xyXG5cdFx0XHR0aGlzLmRyb3BzW2luZGV4ICsgMV0gPSBbXTtcclxuXHJcblx0XHRcdC8vIFJlc2V0IGNvbG91ckJ1Y2tldHMgZm9yIHRoZSBuZXh0IGJhdGNoIG9mIDEyOFxyXG5cdFx0XHR0aGlzLmNvbG91ckxpc3QuZm9yRWFjaChjb2xvdXIgPT4ge1xyXG5cdFx0XHRcdC8vIENlaWxpbmcgaW5zdGVhZCBvZiBmbG9vcmluZyBzbyB0aGF0IHRoZXJlIHdpbGwgYmUgbGVmdG92ZXIgYW1vdW50cyBpbnN0ZWFkIG9mIG5vdCBlbm91Z2hcclxuXHRcdFx0XHR0aGlzLmNvbG91ckJ1Y2tldHNbY29sb3VyXSA9IE1hdGguY2VpbCgxMjggLyB0aGlzLnNldHRpbmdzLm51bUNvbG91cnMpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdGZvcihsZXQgaSA9IDA7IGkgPCAxMjg7IGkrKykge1xyXG5cdFx0XHRcdC8vIEZpbHRlciBvdXQgY29sb3VycyB0aGF0IGhhdmUgYmVlbiBjb21wbGV0ZWx5IHVzZWQgdXBcclxuXHRcdFx0XHRjb25zdCBjb2xvdXJMaXN0ID0gT2JqZWN0LmtleXModGhpcy5jb2xvdXJCdWNrZXRzKS5maWx0ZXIoY29sb3VyID0+IHRoaXMuY29sb3VyQnVja2V0c1tjb2xvdXJdID4gMCk7XHJcblx0XHRcdFx0Y29uc3QgY29sb3VycyA9IFtcclxuXHRcdFx0XHRcdGNvbG91ckxpc3RbTWF0aC5mbG9vcih0aGlzLnJhbmRvbU51bWJlcigpICogY29sb3VyTGlzdC5sZW5ndGgpXSxcclxuXHRcdFx0XHRcdGNvbG91ckxpc3RbTWF0aC5mbG9vcih0aGlzLnJhbmRvbU51bWJlcigpICogY29sb3VyTGlzdC5sZW5ndGgpXVxyXG5cdFx0XHRcdF07XHJcblx0XHRcdFx0dGhpcy5jb2xvdXJCdWNrZXRzW2NvbG91cnNbMF1dLS07XHJcblx0XHRcdFx0dGhpcy5jb2xvdXJCdWNrZXRzW2NvbG91cnNbMV1dLS07XHJcblxyXG5cdFx0XHRcdHRoaXMuZHJvcHNbaW5kZXggKyAxXS5wdXNoKERyb3AuZ2V0TmV3RHJvcCh0aGlzLnNldHRpbmdzLCBjb2xvdXJzKSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiB0aGlzLmRyb3BzW2luZGV4XTtcclxuXHR9XHJcblxyXG5cdHJhbmRvbU51bWJlcigpIHtcclxuXHRcdGNvbnN0IHggPSBNYXRoLnNpbih0aGlzLnNlZWQrKykgKiAxMDAwMDtcclxuXHRcdHJldHVybiB4IC0gTWF0aC5mbG9vcih4KTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgcmFuZG9tIHB1eW8gY29sb3VyLCBnaXZlbiB0aGUgc2l6ZSBvZiB0aGUgY29sb3VyIHBvb2wuXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRSYW5kb21Db2xvdXIgKG51bUNvbG91cnMpIHtcclxuXHRjb25zdCBjb2xvdXJzID0gQ09MT1VSX0xJU1Quc2xpY2UoMCwgbnVtQ29sb3Vycyk7XHJcblxyXG5cdHJldHVybiBQVVlPX0NPTE9VUlNbY29sb3Vyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBudW1Db2xvdXJzKV1dO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgbG9jYXRpb24ocykgb2YgdGhlIHNjaGV6byBwdXlvKHMpLlxyXG4gKlxyXG4gKiBDdXJyZW50bHkgb25seSB3b3JrcyBmb3IgSS1zaGFwZWQgRHJvcHMgKFRzdSkuXHJcbiAqL1xyXG5mdW5jdGlvbiBnZXRPdGhlclB1eW8gKGRyb3ApIHtcclxuXHRsZXQgeCA9IGRyb3AuYXJsZS54ICsgTWF0aC5jb3MoZHJvcC5zdGFuZGFyZEFuZ2xlICsgTWF0aC5QSSAvIDIpO1xyXG5cdGxldCB5ID0gZHJvcC5hcmxlLnkgKyBNYXRoLnNpbihkcm9wLnN0YW5kYXJkQW5nbGUgKyBNYXRoLlBJIC8gMik7XHJcblxyXG5cdC8vIFBlcmZvcm0gaW50ZWdlciByb3VuZGluZ1xyXG5cdGlmKE1hdGguYWJzKHggLSBNYXRoLnJvdW5kKHgpKSA8IDAuMDAxKSB7XHJcblx0XHR4ID0gTWF0aC5yb3VuZCh4KTtcclxuXHR9XHJcblx0aWYoTWF0aC5hYnMoeSAtIE1hdGgucm91bmQoeSkpIDwgMC4wMDEpIHtcclxuXHRcdHkgPSBNYXRoLnJvdW5kKHkpO1xyXG5cdH1cclxuXHRyZXR1cm4geyB4LCB5IH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXRzIHRoZSBmcmFtZXMgbmVlZGVkIGZvciB0aGUgYW5pbWF0aW9uIChhY2NvdW50cyBmb3IgZmFsbGluZyB0aW1lKS5cclxuICovXHJcbmZ1bmN0aW9uIGdldERyb3BGcmFtZXMocG9wcGluZ0xvY3MsIGJvYXJkU3RhdGUsIHNldHRpbmdzKSB7XHJcblx0cmV0dXJuIHBvcHBpbmdMb2NzLnNvbWUobG9jID0+IHtcclxuXHRcdHJldHVybiBib2FyZFN0YXRlW2xvYy5jb2xdW2xvYy5yb3cgKyAxXSAhPT0gdW5kZWZpbmVkICYmICFwb3BwaW5nTG9jcy5pbmNsdWRlcyh7IGNvbDogbG9jLmNvbCwgcm93OiBsb2Mucm93ICsgMX0pO1xyXG5cdH0pID8gc2V0dGluZ3MuZHJvcEZyYW1lcyA6IDA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGaW5kcyB0aGUgc2NvcmUgb2YgdGhlIGdpdmVuIGNoYWluLiBDdXJyZW50bHkgb25seSBmb3IgVHN1IHJ1bGUuXHJcbiAqL1xyXG5mdW5jdGlvbiBjYWxjdWxhdGVTY29yZSAocHV5b0xvY3MsIGNoYWluX2xlbmd0aCkge1xyXG5cdC8vIFRoZXNlIGFycmF5cyBhcmUgMS1pbmRleGVkLlxyXG5cdGNvbnN0IENIQUlOX1BPV0VSID0gW251bGwsIDAsIDgsIDE2LCAzMiwgNjQsIDk2LCAxMjgsIDE2MCwgMTkyLCAyMjQsIDI1NiwgMjg4LCAzMjAsIDM1MiwgMzg0LCA0MTYsIDQ0OCwgNDgwLCA1MTIsIDU0NCwgNTc2LCA2MDgsIDY0MCwgNjcyXTtcclxuXHRjb25zdCBDT0xPVVJfQk9OVVMgPSBbbnVsbCwgMCwgMywgNiwgMTIsIDI0LCA0OF07XHJcblx0Y29uc3QgR1JPVVBfQk9OVVMgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgMCwgMiwgMywgNCwgNSwgNiwgNywgMTAsIDEwLCAxMCwgMTBdO1xyXG5cclxuXHQvLyBOdW1iZXIgb2YgcHV5b3MgY2xlYXJlZCBpbiB0aGUgY2hhaW5cclxuXHRjb25zdCBwdXlvc19jbGVhcmVkID0gcHV5b0xvY3MubGVuZ3RoO1xyXG5cclxuXHQvLyBGaW5kIHRoZSBkaWZmZXJlbnQgY29sb3Vyc1xyXG5cdGNvbnN0IGNvbnRhaW5lZENvbG91cnMgPSB7fTtcclxuXHJcblx0cHV5b0xvY3MuZm9yRWFjaChwdXlvID0+IHtcclxuXHRcdGlmKGNvbnRhaW5lZENvbG91cnNbcHV5by5jb2xvdXJdID09PSB1bmRlZmluZWQpIHtcclxuXHRcdFx0Y29udGFpbmVkQ29sb3Vyc1twdXlvLmNvbG91cl0gPSAxO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGNvbnRhaW5lZENvbG91cnNbcHV5by5jb2xvdXJdKys7XHJcblx0XHR9XHJcblx0fSk7XHJcblxyXG5cdC8vIENoYWluIHBvd2VyIGJhc2VkIG9uIGxlbmd0aCBvZiBjaGFpblxyXG5cdGNvbnN0IGNoYWluX3Bvd2VyID0gQ0hBSU5fUE9XRVJbY2hhaW5fbGVuZ3RoXTtcclxuXHJcblx0Ly8gQ29sb3VyIGJvbnVzIGJhc2VkIG9uIG51bWJlciBvZiBjb2xvdXJzIHVzZWRcclxuXHRjb25zdCBjb2xvdXJfYm9udXMgPSBDT0xPVVJfQk9OVVNbT2JqZWN0LmtleXMoY29udGFpbmVkQ29sb3VycykubGVuZ3RoXTtcclxuXHJcblx0Ly8gR3JvdXAgYm9udXMgYmFzZWQgb24gbnVtYmVyIG9mIHB1eW9zIGluIGVhY2ggZ3JvdXBcclxuXHRjb25zdCBncm91cF9ib251cyA9IE9iamVjdC5rZXlzKGNvbnRhaW5lZENvbG91cnMpLnJlZHVjZSgoYm9udXMsIGNvbG91cikgPT4gYm9udXMgKz0gR1JPVVBfQk9OVVNbY29udGFpbmVkQ29sb3Vyc1tjb2xvdXJdXSwgMCk7XHJcblxyXG5cdHJldHVybiAoMTAgKiBwdXlvc19jbGVhcmVkKSAqIChjaGFpbl9wb3dlciArIGNvbG91cl9ib251cyArIGdyb3VwX2JvbnVzKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2FsY3VsYXRlTnVpc2FuY2UoY2hhaW5fc2NvcmUsIHRhcmdldFBvaW50cywgbGVmdG92ZXJOdWlzYW5jZSkge1xyXG5cdGNvbnN0IG51aXNhbmNlUG9pbnRzID0gY2hhaW5fc2NvcmUgLyB0YXJnZXRQb2ludHMgKyBsZWZ0b3Zlck51aXNhbmNlO1xyXG5cdGNvbnN0IG51aXNhbmNlU2VudCA9IE1hdGguZmxvb3IobnVpc2FuY2VQb2ludHMpO1xyXG5cclxuXHRyZXR1cm4geyBudWlzYW5jZVNlbnQsIGxlZnRvdmVyTnVpc2FuY2U6IG51aXNhbmNlUG9pbnRzIC0gbnVpc2FuY2VTZW50IH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWVwIGNvcGllcyBhbiBvYmplY3Qgd2hlcmUgYWxsIHZhbHVlcyBhcmUgcHJpbWl0eXBlIHR5cGVzLlxyXG4gKiBDYWxsIHRoaXMgZnVuY3Rpb24gcmVjdXJzaXZlbHkgdG8gZGVlcCBjb3B5IG1vcmUgbmVzdGVkIG9iamVjdHMuXHJcbiAqL1xyXG5mdW5jdGlvbiBvYmplY3RDb3B5KG9iaikge1xyXG5cdHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xyXG59XHJcblxyXG5jb25zdCBVdGlscyA9IHtcclxuXHRnZXRSYW5kb21Db2xvdXIsXHJcblx0Z2V0T3RoZXJQdXlvLFxyXG5cdGdldERyb3BGcmFtZXMsXHJcblx0Y2FsY3VsYXRlU2NvcmUsXHJcblx0Y2FsY3VsYXRlTnVpc2FuY2UsXHJcblx0b2JqZWN0Q29weVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRDT0xPVVJfTElTVCxcclxuXHRQVVlPX0NPTE9VUlMsXHJcblx0UFVZT19FWUVTX0NPTE9VUixcclxuXHRTZXR0aW5ncyxcclxuXHRVc2VyU2V0dGluZ3MsXHJcblx0RHJvcEdlbmVyYXRvcixcclxuXHRBdWRpb1BsYXllcixcclxuXHRVdGlsc1xyXG59XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmNvbnN0IHsgQ3B1IH0gPSByZXF1aXJlKCcuL0NwdS5qcycpO1xyXG5jb25zdCB7IENwdUdhbWUgfSA9IHJlcXVpcmUoJy4vQ3B1R2FtZS5qcycpO1xyXG5jb25zdCB7IFBsYXllckdhbWUgfSA9IHJlcXVpcmUoJy4vUGxheWVyR2FtZS5qcycpO1xyXG5jb25zdCB7IFNldHRpbmdzLCBVc2VyU2V0dGluZ3MgfSA9IHJlcXVpcmUoJy4vVXRpbHMuanMnKTtcclxuXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0Y29uc3Qgc29ja2V0ID0gd2luZG93LmlvKCk7XHJcblx0bGV0IGdhbWUsIGdhbWVJZDtcclxuXHRsZXQgY3B1R2FtZXMgPSBbXTtcclxuXHJcblx0Ly8gRGljdGlvbmFyeSBvZiBhbGwgVVJMIHF1ZXJ5IHBhcmFtZXRlcnNcclxuXHRjb25zdCB1cmxQYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpO1xyXG5cclxuXHRjb25zdCBjcHUgPSB1cmxQYXJhbXMuZ2V0KCdjcHUnKSA9PT0gJ3RydWUnO1x0Ly8gRmxhZyB0byBwbGF5IGFnYWluc3QgYSBDUFVcclxuXHRjb25zdCBhaSA9IHVybFBhcmFtcy5nZXQoJ2FpJykgfHwgJ1Rlc3QnO1x0XHQvLyBBSSBvZiB0aGUgQ1BVXHJcblx0Y29uc3Qgc3BlZWQgPSB1cmxQYXJhbXMuZ2V0KCdzcGVlZCcpO1x0XHRcdC8vIFNwZWVkIG9mIHRoZSBDUFVcclxuXHJcblx0Y29uc3QgY3JlYXRlUm9vbSA9IHVybFBhcmFtcy5nZXQoJ2NyZWF0ZVJvb20nKSA9PT0gJ3RydWUnO1x0Ly8gRmxhZyB0byBjcmVhdGUgYSByb29tXHJcblx0Y29uc3Qgcm9vbVNpemUgPSB1cmxQYXJhbXMuZ2V0KCdzaXplJykgfHwgMjtcdFx0XHRcdC8vIFNpemUgb2YgdGhlIHJvb21cclxuXHJcblx0Y29uc3QgcmFua2VkID0gdXJsUGFyYW1zLmdldCgncmFua2VkJykgPT09ICd0cnVlJztcdFx0Ly8gRmxhZyB0byBqb2luIHJhbmtlZCBxdWV1ZVxyXG5cdGNvbnN0IGpvaW5JZCA9IHVybFBhcmFtcy5nZXQoJ2pvaW5Sb29tJyk7XHRcdFx0XHQvLyBJZCBvZiByb29tIHRvIGpvaW5cclxuXHJcblx0bGV0IGdhbWVJbmZvID0geyBnYW1lSWQ6IG51bGwsIHNldHRpbmdzU3RyaW5nOiBuZXcgU2V0dGluZ3MoKS50b1N0cmluZygpLCBqb2luSWQgfTtcclxuXHJcblx0Ly8gU2VuZCBhIHJlZ2lzdHJhdGlvbiByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdG8gcmVjZWl2ZSBhIGdhbWVJZFxyXG5cdHNvY2tldC5lbWl0KCdyZWdpc3RlcicpO1xyXG5cclxuXHRzb2NrZXQub24oJ2dldEdhbWVJZCcsIGlkID0+IHtcclxuXHRcdGdhbWVJZCA9IGlkO1xyXG5cdFx0Z2FtZUluZm8uZ2FtZUlkID0gaWQ7XHJcblxyXG5cdFx0Ly8gQ1BVIG92ZXJyaWRlcyBhbGwgb3RoZXIgb3B0aW9uc1xyXG5cdFx0aWYoY3B1KSB7XHJcblx0XHRcdHNvY2tldC5lbWl0KCdjcHVNYXRjaCcsIGdhbWVJbmZvKTtcclxuXHRcdFx0Y29uc29sZS5sb2coJ1N0YXJ0aW5nIENQVSBtYXRjaC4uLicpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihjcmVhdGVSb29tKSB7XHJcblx0XHRcdC8vIFRPRE86IEFsbG93IGNoYW5naW5nIG9mIHJvb20gc2V0dGluZ3NcclxuXHRcdFx0Z2FtZUluZm8ucm9vbVNpemUgPSBOdW1iZXIocm9vbVNpemUpIHx8IDI7XHJcblxyXG5cdFx0XHRzb2NrZXQuZW1pdCgnY3JlYXRlUm9vbScsIGdhbWVJbmZvKTtcclxuXHRcdFx0Y29uc29sZS5sb2coJ0NyZWF0aW5nIGEgcm9vbS4uLicpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSBpZihqb2luSWQgIT09IG51bGwpIHtcclxuXHRcdFx0c29ja2V0LmVtaXQoJ2pvaW5Sb29tJywgZ2FtZUluZm8pO1xyXG5cdFx0XHRjb25zb2xlLmxvZygnSm9pbmluZyBhIHJvb20uLi4nKTtcclxuXHRcdH1cclxuXHRcdGVsc2UgaWYocmFua2VkKSB7XHJcblx0XHRcdHNvY2tldC5lbWl0KCdyYW5rZWQnLCBnYW1lSW5mbyk7XHJcblx0XHRcdGNvbnNvbGUubG9nKCdGaW5kaW5nIGEgbWF0Y2guLi4nKVxyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdHNvY2tldC5lbWl0KCdxdWlja1BsYXknLCBnYW1lSW5mbyk7XHJcblx0XHRcdGNvbnNvbGUubG9nKCdBd2FpdGluZyBtYXRjaC4uLicpO1xyXG5cdFx0fVxyXG5cdH0pO1xyXG5cclxuXHRzb2NrZXQub24oJ2dpdmVSb29tSWQnLCBpZCA9PiB7XHJcblx0XHRjb25zb2xlLmxvZygnT3RoZXIgcGxheWVycyBjYW4gam9pbiB0aGlzIHJvb20gYnkgYXBwZW5kaW5nID9qb2luUm9vbT0nICsgaWQpO1xyXG5cdH0pO1xyXG5cclxuXHRzb2NrZXQub24oJ2pvaW5GYWlsdXJlJywgKCkgPT4ge1xyXG5cdFx0Y29uc29sZS5sb2coJ0VSUk9SOiBVbmFibGUgdG8gam9pbiByb29tIGFzIHRoaXMgcm9vbSBpZCBpcyBub3QgY3VycmVudGx5IGluIHVzZS4nKTtcclxuXHR9KTtcclxuXHJcblx0c29ja2V0Lm9uKCdyb29tVXBkYXRlJywgKGFsbElkcywgcm9vbVNpemUsIHNldHRpbmdzU3RyaW5nKSA9PiB7XHJcblx0XHRjb25zb2xlLmxvZygnQ3VycmVudCBwbGF5ZXJzOiAnICsgSlNPTi5zdHJpbmdpZnkoYWxsSWRzKSk7XHJcblx0XHRpZihyb29tU2l6ZSA+IGFsbElkcy5sZW5ndGgpIHtcclxuXHRcdFx0Y29uc29sZS5sb2coJ1dhaXRpbmcgZm9yICcgKyAocm9vbVNpemUgLSBhbGxJZHMubGVuZ3RoKSArICcgbW9yZSBwbGF5ZXJzLicpO1xyXG5cdFx0fVxyXG5cdFx0Y29uc29sZS5sb2coJ1NldHRpbmdzOiAnICsgU2V0dGluZ3MuZnJvbVN0cmluZyhzZXR0aW5nc1N0cmluZykpO1xyXG5cdH0pO1xyXG5cclxuXHRzb2NrZXQub24oJ3N0YXJ0JywgKG9wcG9uZW50SWRzLCBjcHVJZHMsIHNldHRpbmdzU3RyaW5nKSA9PiB7XHJcblx0XHRjb25zb2xlLmxvZygnT3Bwb25lbnRzOiAnICsgSlNPTi5zdHJpbmdpZnkob3Bwb25lbnRJZHMpICsgJyBDUFVzOiAnICsgSlNPTi5zdHJpbmdpZnkoY3B1SWRzKSk7XHJcblxyXG5cdFx0Y29uc3QgYWxsT3Bwb25lbnRJZHMgPSBvcHBvbmVudElkcy5jb25jYXQoY3B1SWRzKTtcclxuXHJcblx0XHQvLyBTZXQgdXAgdGhlIHBsYXllcidzIGdhbWVcclxuXHRcdGdhbWUgPSBuZXcgUGxheWVyR2FtZShcclxuXHRcdFx0Z2FtZUlkLFxyXG5cdFx0XHRhbGxPcHBvbmVudElkcyxcclxuXHRcdFx0c29ja2V0LFxyXG5cdFx0XHRTZXR0aW5ncy5mcm9tU3RyaW5nKHNldHRpbmdzU3RyaW5nKSxcclxuXHRcdFx0bmV3IFVzZXJTZXR0aW5ncygpXHJcblx0XHQpO1xyXG5cclxuXHRcdGxldCBib2FyZERyYXdlckNvdW50ZXIgPSAyO1xyXG5cdFx0Y29uc3QgYWxsSWRzID0gYWxsT3Bwb25lbnRJZHMuY29uY2F0KGdhbWVJZCk7XHJcblxyXG5cdFx0bGV0IHNldHRpbmdzID0gU2V0dGluZ3MuZnJvbVN0cmluZyhzZXR0aW5nc1N0cmluZyk7XHJcblx0XHRsZXQgY3B1U3BlZWQgPSBOdW1iZXIoc3BlZWQpIHx8IDEwO1xyXG5cdFx0bGV0IGNwdUFJID0gQ3B1LmZyb21TdHJpbmcoYWksIHNldHRpbmdzKTtcclxuXHJcblx0XHQvLyBDcmVhdGUgdGhlIENQVSBnYW1lc1xyXG5cdFx0Y3B1R2FtZXMgPSBjcHVJZHMubWFwKGlkID0+IHtcclxuXHRcdFx0Y29uc3QgdGhpc1NvY2tldCA9IHdpbmRvdy5pbygpO1xyXG5cdFx0XHRjb25zdCB0aGlzT3BwSWRzID0gYWxsSWRzLnNsaWNlKCk7XHJcblx0XHRcdHRoaXNPcHBJZHMuc3BsaWNlKGFsbElkcy5pbmRleE9mKGlkKSwgMSk7XHJcblxyXG5cdFx0XHRjb25zdCB0aGlzR2FtZSA9IG5ldyBDcHVHYW1lKFxyXG5cdFx0XHRcdGlkLFxyXG5cdFx0XHRcdHRoaXNPcHBJZHMsXHJcblx0XHRcdFx0dGhpc1NvY2tldCxcclxuXHRcdFx0XHRib2FyZERyYXdlckNvdW50ZXIsXHJcblx0XHRcdFx0Y3B1QUksXHJcblx0XHRcdFx0Y3B1U3BlZWQsXHJcblx0XHRcdFx0c2V0dGluZ3NcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdGJvYXJkRHJhd2VyQ291bnRlcisrO1xyXG5cdFx0XHRyZXR1cm4geyBnYW1lOiB0aGlzR2FtZSwgc29ja2V0OiB0aGlzU29ja2V0LCBpZCB9O1xyXG5cdFx0fSk7XHJcblx0XHRtYWluKCk7XHJcblx0fSk7XHJcblxyXG5cdGxldCBmaW5hbE1lc3NhZ2UgPSBudWxsO1x0XHQvLyBUaGUgbWVzc2FnZSB0byBiZSBkaXNwbGF5ZWRcclxuXHJcblx0ZnVuY3Rpb24gbWFpbigpIHtcclxuXHRcdGNvbnN0IG1haW5GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUobWFpbik7XHJcblx0XHRnYW1lLnN0ZXAoKTtcclxuXHRcdGNwdUdhbWVzLmZvckVhY2goY3B1R2FtZSA9PiBjcHVHYW1lLmdhbWUuc3RlcCgpKTtcclxuXHRcdGlmKGZpbmFsTWVzc2FnZSAhPT0gbnVsbCkge1xyXG5cdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUobWFpbkZyYW1lKTtcclxuXHRcdFx0Y29uc29sZS5sb2coZmluYWxNZXNzYWdlKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgZW5kUmVzdWx0ID0gZ2FtZS5lbmQoKTtcclxuXHRcdGlmKGVuZFJlc3VsdCAhPT0gbnVsbCkge1xyXG5cdFx0XHRzd2l0Y2goZW5kUmVzdWx0KSB7XHJcblx0XHRcdFx0Y2FzZSAnV2luJzpcclxuXHRcdFx0XHRcdGZpbmFsTWVzc2FnZSA9ICdZb3Ugd2luISc7XHJcblx0XHRcdFx0XHRzb2NrZXQuZW1pdCgnZ2FtZUVuZCcsIGdhbWVJZCk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlICdMb3NzJzpcclxuXHRcdFx0XHRcdGZpbmFsTWVzc2FnZSA9ICdZb3UgbG9zZS4uLic7XHJcblx0XHRcdFx0XHRzb2NrZXQuZW1pdCgnZ2FtZU92ZXInLCBnYW1lSWQpO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnT3BwRGlzY29ubmVjdCc6XHJcblx0XHRcdFx0XHRmaW5hbE1lc3NhZ2UgPSAnWW91ciBvcHBvbmVudCBoYXMgZGlzY29ubmVjdGVkLiBUaGlzIG1hdGNoIHdpbGwgYmUgY291bnRlZCBhcyBhIHdpbi4nO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRjcHVHYW1lcy5mb3JFYWNoKGNwdUdhbWUgPT4ge1xyXG5cdFx0XHRjb25zdCBjcHVFbmRSZXN1bHQgPSBjcHVHYW1lLmdhbWUuZW5kKCk7XHJcblx0XHRcdGlmKGNwdUVuZFJlc3VsdCAhPT0gbnVsbCkge1xyXG5cdFx0XHRcdHN3aXRjaChjcHVFbmRSZXN1bHQpIHtcclxuXHRcdFx0XHRcdGNhc2UgJ1dpbic6XHJcblx0XHRcdFx0XHRcdC8vIGZpbmFsTWVzc2FnZSA9ICdZb3Ugd2luISc7XHJcblx0XHRcdFx0XHRcdGNwdUdhbWUuc29ja2V0LmVtaXQoJ2dhbWVFbmQnLCBjcHVHYW1lLmlkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRjYXNlICdMb3NzJzpcclxuXHRcdFx0XHRcdFx0Ly8gZmluYWxNZXNzYWdlID0gJ1lvdSBsb3NlLi4uJztcclxuXHRcdFx0XHRcdFx0Y3B1R2FtZS5zb2NrZXQuZW1pdCgnZ2FtZU92ZXInLCBjcHVHYW1lLmlkKTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHRjYXNlICdPcHBEaXNjb25uZWN0JzpcclxuXHRcdFx0XHRcdFx0Ly8gZmluYWxNZXNzYWdlID0gJ1lvdXIgb3Bwb25lbnQgaGFzIGRpc2Nvbm5lY3RlZC4gVGhpcyBtYXRjaCB3aWxsIGJlIGNvdW50ZWQgYXMgYSB3aW4uJztcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHR9XHJcbn0pKCk7XHJcbiJdfQ==
