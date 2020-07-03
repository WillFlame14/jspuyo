'use strict';

const { Board } = require('./Board.js');
const { SpriteDrawer } = require('./Draw.js');
const { PUYO_COLOURS, COLOUR_LIST } = require('./Utils.js');

/**
 * Class to manage updating for any canvas that draws Puyo (the main board or the queue).
 * The settings should not change over the span of the drawer being used
 * but the update function will need game state info.
 */
class DrawerWithPuyo {
	constructor() {
		this.spriteDrawer = new SpriteDrawer();
	}

	drawObject(xPos, yPos, sizeX, sizeY, dX, dY) {
		this.spriteDrawer.drawSprite(this.ctx, this.appearance, sizeX, sizeY, xPos, yPos, dX, dY);
	}

	writePuyo(colour, sizeX, sizeY, directions = [], dX, dY) {
		let xPos, yPos;
		if(colour === PUYO_COLOURS['Gray']) {
			xPos = 6;
			yPos = 12;
		}
		else {
			xPos = 0;
			yPos = this.colourArray.indexOf(colour);

			if(directions.includes('Down')) {
				xPos += 1;
			}
			if(directions.includes('Up')) {
				xPos += 2;
			}
			if(directions.includes('Right')) {
				xPos += 4;
			}
			if(directions.includes('Left')) {
				xPos += 8;
			}
		}
		return {xPos, yPos, sizeX, sizeY, dX, dY};
	}

	writePoppingPuyo(colour, sizeX, sizeY, drawPhaseTwo, dX, dY) {
		if(colour === PUYO_COLOURS['Gray']) {
			if(!drawPhaseTwo) {
				return {xPos: 6, yPos:12, sizeX, sizeY, dX, dY};
			}
			return;
		}
		const xPos = this.colourArray.indexOf(colour) * 2 + (drawPhaseTwo ? 7 : 6);
		const yPos = 10;

		return {xPos, yPos, sizeX, sizeY, dX, dY};
	}
	writeDrop(drop, sizeX, sizeY, dX, dY) {
		if ("IhLHO".includes(drop.shape)) {
			const a = this["write_" + drop.shape](drop, sizeX, sizeY, dX, dY);
			if(a.includes(null)) {
				console.log(drop.shape);
			}
			return a;
		}
	}
	write_I(drop, sizeX, sizeY, dX, dY) {
		const puyos = [];
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX, dY));

		dX += Math.cos(drop.standardAngle + Math.PI / 2);
		dY -= Math.sin(drop.standardAngle + Math.PI / 2);

		puyos.push(this.writePuyo(drop.colours[1], sizeX, sizeY, [], dX, dY));
		return puyos;
	}

	write_h(drop, sizeX, sizeY, dX, dY) {
		const puyos = [];
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX, dY));

		const dX2 = dX + Math.cos(drop.standardAngle + Math.PI / 2);
		const dY2 = dY - Math.sin(drop.standardAngle + Math.PI / 2);

		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX2, dY2));

		const dX3 = dX + Math.cos(drop.standardAngle);
		const dY3 = dY - Math.sin(drop.standardAngle);

		puyos.push(this.writePuyo(drop.colours[1], sizeX, sizeY, [], dX3, dY3));
		return puyos;
	}

	write_L(drop, sizeX, sizeY, dX, dY) {
		const puyos = [];
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX, dY));

		const dX2 = dX + Math.cos(drop.standardAngle + Math.PI / 2);
		const dY2 = dY - Math.sin(drop.standardAngle + Math.PI / 2);

		puyos.push(this.writePuyo(drop.colours[1], sizeX, sizeY, [], dX2, dY2));

		const dX3 = dX + Math.cos(drop.standardAngle);
		const dY3 = dY - Math.sin(drop.standardAngle);

		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX3, dY3));
		return puyos;
	}

	write_H(drop, sizeX, sizeY, dX, dY) {
		const xChange = 1 / Math.sqrt(2) * Math.cos(- drop.standardAngle + Math.PI / 4);
		const yChange = 1 / Math.sqrt(2) * Math.sin(- drop.standardAngle + Math.PI / 4);

		const puyos = [];
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX - xChange, dY - yChange));
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX - yChange, dY + xChange));
		puyos.push(this.writePuyo(drop.colours[1], sizeX, sizeY, [], dX + xChange, dY + yChange));
		puyos.push(this.writePuyo(drop.colours[1], sizeX, sizeY, [], dX + yChange, dY - xChange));
		return puyos;
	}

	write_O(drop, sizeX, sizeY, dX, dY) {
		const xChange = 0.5;
		const yChange = 0.5;

		const puyos = [];
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX - xChange, dY - yChange));
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX - yChange, dY - xChange));
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX + xChange, dY + yChange));
		puyos.push(this.writePuyo(drop.colours[0], sizeX, sizeY, [], dX + yChange, dY - xChange));
		return puyos;
	}
}

/**
 * The drawer for the main area of the game.
 */
class BoardDrawer extends DrawerWithPuyo {
	constructor(settings, appearance, boardNum = null) {
		super();
		this.appearance = appearance;
		this.settings = settings;
		this.poppedLocs = [];
		this.colourArray = [];

		if(boardNum !== null) {
			this.board = document.getElementById("board" + boardNum);
			this.ctx = this.board.getContext("2d");

			this.width = this.board.width;
			this.height = this.board.height;
			this.unitW = this.width / this.settings.cols;
			this.unitH = this.height / this.settings.rows;
		}

		for (let i = 0; i < COLOUR_LIST.length; i++) {
			this.colourArray.push(PUYO_COLOURS[COLOUR_LIST[i]]);
		}

		this.nuisanceCascadeFPR = [];
	}

	updateBoard(currentBoardState) {
		// Get current information about what to draw and get current width and height in case of resizing
		const {connections, currentDrop} = currentBoardState;

		// Clear list of drawn objects
		let objectsDrawn = [];

		// Use the connections array instead of board state
		connections.forEach(group => {
			group.forEach(puyo => {
				objectsDrawn.push(this.writePuyo(puyo.colour, 1, 1, puyo.connections, puyo.col, -puyo.row));
			});
		});

		if (currentDrop.schezo.y != null) {
			objectsDrawn.push(this.writePuyo(currentDrop.colours[0], 1, 1, [], currentDrop.arle.x, -currentDrop.arle.y));
			objectsDrawn.push(this.writePuyo(currentDrop.colours[1], 1, 1, [], currentDrop.schezo.x, -currentDrop.schezo.y));
		} else {
			const puyos = this.writeDrop(currentDrop, 1, 1, currentDrop.arle.x, -currentDrop.arle.y);
			// Returns undefined when there is no drop
			if(puyos !== undefined) {
				objectsDrawn = objectsDrawn.concat(puyos);
			}
		}

		return JSON.stringify(objectsDrawn);
	}

	resolveChains(resolvingState) {
		// Get current information and assign it to convenient variables
		const {popFrames, dropFrames} = this.settings;
		const {connections, poppedLocs, connectionsAfterPop, unstablePuyos} = resolvingState;
		const objectsDrawn = [];

		// Draw the stack in the pre-pop positions, with some puyo mid pop
		if (resolvingState.currentFrame <= this.settings.popFrames) {
			connections.forEach(group => {
				group.forEach(puyo => {
					// Do not draw popping puyos
					if(!poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)) {
						objectsDrawn.push(this.writePuyo(puyo.colour, 1, 1, puyo.connections, puyo.col, -puyo.row));
					}
				});
			});

			poppedLocs.forEach(puyo => {
				const drawnObject = this.writePoppingPuyo(
					puyo.colour,
					1, 1,
					resolvingState.currentFrame >= this.settings.popFrames / 3,
					puyo.col, -puyo.row
				);
				// Will return undefined if drawing a popped nuisance puyo
				if(drawnObject !== undefined) {
					objectsDrawn.push(drawnObject);
				}
			});
		}
		// Draw the stack dropping with the popped puyos gone
		else {
			connectionsAfterPop.forEach(group => {
				group.forEach(puyo => {
					objectsDrawn.push(this.writePuyo(puyo.colour, 1, 1, puyo.connections, puyo.col, -puyo.row));
				});
			});

			unstablePuyos.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
				objectsDrawn.push(
					this.writePuyo(
						puyo.colour,
						1, 1,
						[],             // Force drawing of isolated puyo
						puyo.col, -Math.max(puyo.row - (puyo.row - puyo.above) * (resolvingState.currentFrame - popFrames) / dropFrames, puyo.above)
					)
				);
			});
		}

		return JSON.stringify(objectsDrawn);
	}

	initNuisanceDrop(nuisanceCascadeFPR) {
		this.nuisanceCascadeFPR = nuisanceCascadeFPR;
	}

	dropNuisance(boardState, nuisanceState) {
		const {nuisanceArray, currentFrame} = nuisanceState;
		const {cols} = this.settings;

		// Clear list of drawn objects
		const objectsDrawn = [];

		const connections = new Board(this.settings, boardState).getConnections();
		connections.forEach(group => {
			group.forEach(puyo => {
				objectsDrawn.push(this.writePuyo(puyo.colour, 1, 1, puyo.connections, puyo.col, -puyo.row));
			});
		});

		for (let i = 0; i < cols; i++) {
			const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
			const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
			for (let j = 0; j < nuisanceArray[i].length; j++) {
				objectsDrawn.push(this.writePuyo(PUYO_COLOURS['Gray'], 1, 1, [], i, -(this.settings.nuisanceSpawnRow - rowsDropped + j)));
			}
		}

		return JSON.stringify(objectsDrawn);
	}

	drawFromHash(hash) {
		const objects = JSON.parse(hash);
		const {rows} = this.settings;

		const ctx = this.ctx;
		ctx.clearRect(0, 0, this.width, this.height);

		// Save a canvas with the origin at the top left (every save coupled with a restore)
		ctx.save();

		// Move the canvas with the origin at the middle of the bottom left square
		ctx.translate(0.5 * this.unitW, (rows - 0.5) * this.unitH);

		objects.forEach(object => {
			const { xPos, yPos, sizeX, sizeY, dX, dY } = object;
			this.drawObject(xPos, yPos, sizeX * this.unitW, sizeY * this.unitH, dX * this.unitW, dY * this.unitH);
		});

		// Restore origin to top left
		ctx.restore();
	}
}

module.exports = { BoardDrawer };
