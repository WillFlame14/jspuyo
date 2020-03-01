'use strict';

window.Board = class Board {
	constructor(height = 12, width = 6) {
		this.height = height;
		this.width = width;

		this.boardState = [];
		for(let i = 0; i < width; i++) {
			this.boardState.push([]);
		}
	}

	checkGameOver() {
		return this.boardState[2].length >= this.height;
	}

	resolveChains(chain_length = 0) {
		let chained = false;
		let current_chain_puyos = [];
		const visited = [];

		const boardState = this.boardState;
		const height = this.height;
		const width = this.width;

		const dfs = function(location, puyo_colour, colour_length, chain_puyo_locs) {
			visited.push(location);
			console.log(JSON.stringify(location));

			const { col, row } = location;

			for(let i = -1; i <= 1; i++) {
				for(let j = -1; j <= 1; j++) {
					if(Math.abs(i) + Math.abs(j) === 1) {
						const new_col = col + i;
						const new_row = row + j;
						const newloc = { col: new_col, row: new_row };

						if(validLoc(newloc) && notVisited(newloc) && boardState[new_col][new_row] === puyo_colour) {
							console.log(`same colour! ${colour_length}`);
							chain_puyo_locs.push(newloc);
							// Update with the length of this branch
							const { length, locs } = dfs(newloc, puyo_colour, colour_length + 1, chain_puyo_locs);
							colour_length = length;
							chain_puyo_locs = locs;
						}
					}
				}
			}
			return { length: colour_length, locs: chain_puyo_locs };
		}

		const notVisited = function(location) {
			const { col, row } = location;
			return visited.filter(loc => loc.col == col && loc.row == row).length === 0;
		}

		const validLoc = function(location) {
			const { col, row } = location;
			return col >= 0 && row >= 0 && col < width && row < height && boardState[col][row] !== undefined;
		}

		for(let i = 0; i < this.boardState.length; i++) {
			for(let j = 0; j < this.boardState[i].length; j++) {
				const loc = { col: i, row: j };
				if(notVisited(loc)) {
					console.log('found a starting point');
					const { length, locs } = dfs(loc, this.boardState[i][j], 1, [loc]);
					if (length > 3) {
						current_chain_puyos = current_chain_puyos.concat(locs);
						console.log(`chain! ${JSON.stringify(locs)}`);
						chained = true;
					}
				}
			}
		}

		current_chain_puyos.forEach(location => {
			const { col, row } = location;

			// Set chained puyos to null
			this.boardState[col][row] = null;
		});

		// Remove all the null puyos
		this.boardState = this.boardState.map(col => col.filter(row => row !== null));

		console.log(this.boardState);

		if(chained) {
			return this.resolveChains(chain_length + 1);
		}
		return chain_length;
	}
}
