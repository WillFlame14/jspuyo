'use strict';

const { Board } = require('./Board.js');
const { SpriteDrawer } = require('./Draw.js');
const DIMENSIONS = {
	BOARD : { W: 270, H: 540 },
	QUEUE : { W: 72, H: 540 },
	NUISANCE_QUEUE : { W: 270, H: 90 },
	MARGIN: 10,
	MIN_SCALE: 0.5
};
const PUYO_COORDINATES = {
	NUISANCE: { X: 6, Y: 12 },
	PUYO_START: { X: 0, Y: 0 },
	POPPING: {
		0: { 1: { X: 6, Y: 12}, 2: { X: 9, Y: 15 } },
		1: { 1: { X: 0, Y: 12}, 2: { X: 1, Y: 12 } },
		2: { 1: { X: 0, Y: 13}, 2: { X: 1, Y: 13 } },
		3: { 1: { X: 2, Y: 12}, 2: { X: 3, Y: 12 } },
		4: { 1: { X: 2, Y: 13}, 2: { X: 3, Y: 13 } },
		5: { 1: { X: 4, Y: 12}, 2: { X: 5, Y: 12 } }
	},
	HIGHLIGHT_START: { X: 0, Y: 9 },
	GHOST_START: {
		1: { X: 14.5, Y: 7, SCALE: 0.5 },
		2: { X: 14.5, Y: 7.5, SCALE: 0.5 },
		3: { X: 14.5, Y: 8, SCALE: 0.5 },
		4: { X: 14, Y: 7, SCALE: 0.5 },
		5: { X: 14, Y: 7.5, SCALE: 0.5 }
	},
	INCOMING: {
		SMALL: { X: 14, Y: 12, SCALE: 1 },
		LARGE: { X: 13, Y: 12, SCALE: 1 },
		ROCK: { X: 12, Y: 12, SCALE: 1 },
		STAR: { X: 12, Y: 11, SCALE: 1 },
		MOON: { X: 11, Y: 11, SCALE: 1 },
		CROWN: { X: 10, Y: 11, SCALE: 1 },
		COMET: { X: 12, Y: 7, SCALE: 1.5 }
	},
	CROSS: { X: 7, Y: 12 }
};
const INCOMING_SYMBOLS = [
	{ SYMBOL: 'SMALL', VALUE: 1 },
	{ SYMBOL: 'LARGE', VALUE: 6 },
	{ SYMBOL: 'ROCK', VALUE: 30 },
	{ SYMBOL: 'STAR', VALUE: 180 },
	{ SYMBOL: 'MOON', VALUE: 360 },
	{ SYMBOL: 'CROWN', VALUE: 720 },
	{ SYMBOL: 'COMET', VALUE: 1440 }
];
const NUM_DRAWING_STATES = 128;
const MODE = {
	PUYO_DROPPING: 0,
	PUYO_DROPPING_SPLIT: 1,
	PUYO_SQUISHING: 2,
	CHAIN_POPPING: 3,
	CHAIN_DROPPING: 4,
	CHAIN_SQUISHING: 5,
	NUISANCE_DROPPING: 6
};
const NUISANCE = 0;

class CanvasLayer {
	constructor(width, height, onNode = false, className) {
		this.onNode = onNode;
		this.width = width;
		this.height = height;
		if (!this.onNode) {
			this.canvas = document.createElement('canvas');
			this.canvas.width = width;
			this.canvas.height = height;
			if (className) {
				this.canvas.className = className;
			}
			this.ctx = this.canvas.getContext('2d');
		}
	}
	clear() {
		if (!this.onNode) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}
}

class DrawingLayer extends CanvasLayer {
	constructor(width, height, unit, onNode, className) {
		super(width, height, onNode, className);
		this.unit = unit;
		this.objectsDrawn = [];
		this.drawingState = 0;
		this.defaultArgs = {};
	}
	drawFromArgs(drawingArgs) {
		if (!this.onNode) {
			const args = Object.assign({}, this.defaultArgs, drawingArgs);
			SpriteDrawer.drawSprite(
				this.ctx, args.appearance,
				args.size * this.unit, args.sX, args.sY,
				args.dX * this.unit, args.dY * this.unit, args.sWidth, args.sHeight, args.merge
			);
		}
	}
	draw(drawingArgs) {
		this.objectsDrawn.push(drawingArgs);
		this.drawFromArgs(drawingArgs);
	}
	getStateObject() {
		return { drawingState: this.drawingState, objectsDrawn: this.objectsDrawn };
	}
	drawFromStateObject(state) {
		if (state.drawingState !== this.drawingState) {
			this.clear();
			state.objectsDrawn.forEach((drawingArgs) => {
				this.drawFromArgs(drawingArgs);
			});
			this.drawingState = state.drawingState;
		}
	}
	resetState() {
		this.objectsDrawn = [];
		this.clear();
		this.drawingState++;
		this.drawingState %= NUM_DRAWING_STATES;
	}
}

class PuyoDrawingLayer extends DrawingLayer {
	constructor(width, height, unit, appearance, onNode, className) {
		super(width, height, unit, onNode, className);
		this.defaultArgs.appearance = appearance;
		this.defaultArgs.size = 1;
		this.defaultArgs.sWidth = 1;
		this.defaultArgs.sHeight = 1;
		this.defaultArgs.merge = true;
	}
	drawPuyo(colour, dX, dY, directions = []) {
		let sX, sY;
		if(colour === 0) {
			sX = PUYO_COORDINATES.NUISANCE.X;
			sY = PUYO_COORDINATES.NUISANCE.Y;
		}
		else {
			sX = PUYO_COORDINATES.PUYO_START.X;
			sY = PUYO_COORDINATES.PUYO_START.Y + colour - 1;
			if(directions.includes('Down')) {
				sX += 1;
			}
			if(directions.includes('Up')) {
				sX += 2;
			}
			if(directions.includes('Right')) {
				sX += 4;
			}
			if(directions.includes('Left')) {
				sX += 8;
			}
		}
		this.draw({ sX, sY, dX, dY });
	}
	drawPoppingPuyo(colour, dX, dY, drawPhaseTwo) {
		const sX = PUYO_COORDINATES.POPPING[colour][drawPhaseTwo ? 2 : 1].X;
		const sY = PUYO_COORDINATES.POPPING[colour][drawPhaseTwo ? 2 : 1].Y;
		this.draw({ sX, sY, dX, dY });
	}
	drawDrop(drop, dX, dY) {
		if('I'.includes(drop.shape)) {
			this['draw' + drop.shape](drop, dX, dY, false);
		}
	}
	drawHighlightedDrop(drop, dX, dY) {
		if('I'.includes(drop.shape)) {
			this['draw' + drop.shape](drop, dX, dY, true);
		}
	}
	drawI(drop, dX, dY, highlighted = false) {
		if (highlighted) {
			this.drawHighlighted(drop.colours[0], dX, dY, []);
		}
		else {
			this.drawPuyo(drop.colours[0], dX, dY, []);
		}
		dX += Math.cos(drop.standardAngle + Math.PI / 2);
		dY -= Math.sin(drop.standardAngle + Math.PI / 2);
		this.drawPuyo(drop.colours[1], dX, dY, []);
	}
	drawHighlighted(colour, dX, dY) {
		const sX = PUYO_COORDINATES.HIGHLIGHT_START.X + colour - 1;
		const sY = PUYO_COORDINATES.HIGHLIGHT_START.Y;
		this.draw({ sX, sY, dX, dY });
	}
	drawGhost(colour, dX, dY) {
		const sX = PUYO_COORDINATES.GHOST_START[colour].X;
		const sY = PUYO_COORDINATES.GHOST_START[colour].Y;
		const scale = PUYO_COORDINATES.GHOST_START[colour].SCALE;
		this.draw({ sX, sY, dX, dY, sWidth: scale, sHeight: scale });
	}
}

class GameArea extends CanvasLayer {
	constructor(settings, appearance, scaleFactor = 1, onNode) {
		super(
			DIMENSIONS.BOARD.W * scaleFactor + ((scaleFactor > DIMENSIONS.MIN_SCALE) ? (DIMENSIONS.MARGIN + DIMENSIONS.QUEUE.W * scaleFactor) : 0),
			DIMENSIONS.BOARD.H * scaleFactor + DIMENSIONS.MARGIN + DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor,
			onNode
		);
		this.settings = settings;
		this.appearance = appearance;
		this.boardLayer = new BoardLayer(settings, appearance, scaleFactor, onNode);
		this.nuisanceLayer = new NuisanceLayer(DIMENSIONS.NUISANCE_QUEUE.W * scaleFactor, DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor, appearance, onNode);
		this.queueLayer = new QueueLayer(DIMENSIONS.QUEUE.W * scaleFactor, DIMENSIONS.QUEUE.H * scaleFactor, DIMENSIONS.QUEUE.W * scaleFactor / 2, appearance, onNode);
		this.simplified = scaleFactor <= DIMENSIONS.MIN_SCALE;
	}
	update() {
		if (!this.onNode) {
			this.clear();
			this.ctx.drawImage(this.nuisanceLayer.canvas, 0, 0);
			this.ctx.drawImage(this.boardLayer.canvas, 0, this.nuisanceLayer.canvas.height + DIMENSIONS.MARGIN);
			if (!this.simplified) {
				this.ctx.drawImage(this.queueLayer.canvas, this.boardLayer.canvas.width + DIMENSIONS.MARGIN, 0);
			}
		}
	}
	getHash() {
		return JSON.stringify({ boardObject: this.boardLayer.getStateObject(), nuisanceObject: this.nuisanceLayer.getStateObject(), queueObject: this.queueLayer.getStateObject() });
	}
	drawFromHash(hash) {
		const stateObject = JSON.parse(hash);
		this.boardLayer.drawFromStateObject(stateObject.boardObject);
		this.nuisanceLayer.drawFromStateObject(stateObject.nuisanceObject);
		if (!this.simplified) {
			this.queueLayer.drawFromStateObject(stateObject.queueObject);
		}
		this.update();
	}
	updateBoard(currentBoardState) {
		this.boardLayer.updateBoard(currentBoardState);
		this.update();
		return this.getHash();
	}
	squishPuyos(currentBoardState) {
		this.boardLayer.squishPuyos(currentBoardState);
		this.update();
		return this.getHash();
	}
	resolveChains(resolvingState) {
		this.boardLayer.resolveChains(resolvingState);
		this.update();
		return this.getHash();
	}
	dropNuisance(boardState, nuisanceState) {
		this.boardLayer.dropNuisance(boardState, nuisanceState);
		this.update();
		return this.getHash();
	}
	updateQueue(queueState) {
		this.queueLayer.updateQueue(queueState);
		this.update();
		return this.getHash();
	}
	updateNuisance(nuisance) {
		this.nuisanceLayer.updateNuisance(nuisance);
		this.update();
		return this.getHash();
	}
}

class BoardLayer extends CanvasLayer {
	constructor(settings, appearance, scaleFactor = 1, onNode) {
		super(
			DIMENSIONS.BOARD.W * scaleFactor, DIMENSIONS.BOARD.H * scaleFactor, onNode
		);
		this.unit = this.width / settings.cols;
		this.settings = settings;
		this.appearance = appearance;
		this.backgroundLayer = new DrawingLayer(this.width, this.height, this.unit, onNode);
		this.backgroundLayer.resetState();
		if (!this.onNode) {
			this.backgroundLayer.ctx.fillStyle = 'black';
			this.backgroundLayer.ctx.globalAlpha = 0.2;
			this.backgroundLayer.ctx.fillRect(0, 0, this.width, this.height);
			this.backgroundLayer.draw({ appearance, size: 1, sX: PUYO_COORDINATES.CROSS.X, sY: PUYO_COORDINATES.CROSS.Y, dX: 2.5, dY: 0.5, sWidth: 1, sHeight: 1, merge: false });
		}
		this.stackLayer = new PuyoDrawingLayer(this.width, this.height, this.unit, appearance, onNode);
		this.dynamicLayer = new PuyoDrawingLayer(this.width, this.height, this.unit, appearance, onNode);
		this.columnHeights = [];
		this.nuisanceCascadeFPR = [];
		this.mode = null;
	}
	update() {
		if (!this.onNode) {
			this.clear();
			this.ctx.drawImage(this.backgroundLayer.canvas, 0, 0);
			this.ctx.drawImage(this.stackLayer.canvas, 0, 0);
			this.ctx.drawImage(this.dynamicLayer.canvas, 0, 0);
		}
	}
	getStateObject() {
		return { /* backgroundObject: this.backgroundLayer.getStateObject(), */stackObject: this.stackLayer.getStateObject(), dynamicObject: this.dynamicLayer.getStateObject() };
	}
	drawFromStateObject(stateObject) {
		/*this.backgroundLayer.drawFromStateObject(stateObject.backgroundObject);*/
		this.stackLayer.drawFromStateObject(stateObject.stackObject);
		this.dynamicLayer.drawFromStateObject(stateObject.dynamicObject);
		this.update();
	}
	hasStackChanged(mode) {
		if (this.mode !== mode) {
			this.mode = mode;
			return true;
		}
		return false;
	}
	updateBoard(currentBoardState) {
		const { connections, currentDrop } = currentBoardState;
		if (currentDrop.schezo.y == null) {
			if (this.hasStackChanged(MODE.PUYO_DROPPING)) {
				this.columnHeights = new Array(this.settings.cols).fill(0);
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
						if (this.columnHeights[puyo.col] < puyo.row + 1) {
							this.columnHeights[puyo.col] = puyo.row + 1;
						}
					});
				});
			}
			this.dynamicLayer.resetState();
			if (currentDrop.standardAngle > Math.PI / 4 && currentDrop.standardAngle <= 3 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x]);
				if (this.columnHeights[currentDrop.arle.x - 1] <= this.columnHeights[currentDrop.arle.x] || this.columnHeights[currentDrop.arle.x - 1] <= currentDrop.arle.y) {
					this.dynamicLayer.drawGhost(currentDrop.colours[1], -0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x - 1]);
				}
			}
			else if (currentDrop.standardAngle > 3 * Math.PI / 4 && currentDrop.standardAngle <= 5 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(currentDrop.colours[1], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x]);
				this.dynamicLayer.drawGhost(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 1.5 - this.columnHeights[currentDrop.arle.x]);
			}
			else if (currentDrop.standardAngle > 5 * Math.PI / 4 && currentDrop.standardAngle <= 7 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x]);
				if (this.columnHeights[currentDrop.arle.x + 1] <= this.columnHeights[currentDrop.arle.x] || this.columnHeights[currentDrop.arle.x + 1] <= currentDrop.arle.y) {
					this.dynamicLayer.drawGhost(currentDrop.colours[1], 1.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x + 1]);
				}
			}
			else {
				this.dynamicLayer.drawGhost(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - this.columnHeights[currentDrop.arle.x]);
				this.dynamicLayer.drawGhost(currentDrop.colours[1], 0.5 + currentDrop.arle.x, this.settings.rows - 1.5 - this.columnHeights[currentDrop.arle.x]);
			}
			this.dynamicLayer.drawHighlightedDrop(currentDrop, 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - currentDrop.arle.y);
		}
		else {
			if (this.hasStackChanged(MODE.PUYO_DROPPING_SPLIT)) {
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			this.dynamicLayer.drawPuyo(currentDrop.colours[0], 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - currentDrop.arle.y);
			this.dynamicLayer.drawPuyo(currentDrop.colours[1], 0.5 + currentDrop.schezo.x, this.settings.rows - 0.5 - currentDrop.schezo.y);
		}
		this.update();
	}
	squishPuyos(currentBoardState) {
		const { connections } = currentBoardState;
		if (this.hasStackChanged(MODE.PUYO_SQUISHING)) {
			this.stackLayer.resetState();
			connections.forEach(group => {
				group.forEach(puyo => {
					this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
				});
			});
			this.dynamicLayer.resetState();
		}
		this.update();
	}
	resolveChains(resolvingState) {
		const { connections, poppedLocs, connectionsAfterPop, unstablePuyos } = resolvingState;
		if (resolvingState.currentFrame <= this.settings.popFrames) {
			if (this.hasStackChanged(MODE.CHAIN_POPPING)) {
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			poppedLocs.forEach(puyo => {
				this.dynamicLayer.drawPoppingPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, resolvingState.currentFrame >= this.settings.popFrames / 3);
			});
		}
		else {
			if (this.hasStackChanged(MODE.CHAIN_DROPPING)) {
				this.stackLayer.resetState();
				connectionsAfterPop.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			unstablePuyos.filter(puyo => !poppedLocs.some(puyo2 => puyo.col === puyo2.col && puyo.row === puyo2.row)).forEach(puyo => {
				this.dynamicLayer.drawPuyo(
					puyo.colour,
					0.5 + puyo.col,
					this.settings.rows - 0.5 - Math.max(puyo.row - (puyo.row - puyo.above) * (resolvingState.currentFrame - this.settings.popFrames) / this.settings.dropFrames, puyo.above)
				);
			});
		}
		this.update();
	}
	dropNuisance(boardState, nuisanceState) {
		const { nuisanceArray, positions } = nuisanceState;
		if (this.hasStackChanged(MODE.NUISANCE_DROPPING)) {
			this.stackLayer.resetState();
			const connections = new Board(this.settings, boardState).getConnections();
			connections.forEach(group => {
				group.forEach(puyo => {
					this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
				});
			});
		}
		this.dynamicLayer.resetState();
		nuisanceState.allLanded = true;

		positions.forEach((height, index) => {
			if(height !== -1) {
				const startRow = Math.max(height, boardState[index].length);
				if(height > boardState[index].length) {
					nuisanceState.allLanded = false;
				}
				for (let i = 0; i < nuisanceArray[index].length; i++) {
					this.dynamicLayer.drawPuyo(NUISANCE, index + 0.5, this.settings.rows - 0.5 - (startRow + i));
				}
			}
		});
		this.update();
	}
}

class NuisanceLayer extends DrawingLayer {
	constructor(width, height, appearance, onNode) {
		super(width, height, height / 2, onNode);
		this.nuisance = null;
		this.defaultArgs.appearance = appearance;
		this.defaultArgs.size = 1;
		this.defaultArgs.merge = false;
	}
	drawIncomingSymbol(symbol, dX, dY) {
		const sX = PUYO_COORDINATES.INCOMING[symbol].X;
		const sY = PUYO_COORDINATES.INCOMING[symbol].Y;
		const scale = PUYO_COORDINATES.INCOMING[symbol].SCALE;
		this.draw({ sX, sY, dX, dY, sWidth: scale, sHeight: scale });
	}
	updateNuisance(nuisance) {
		if (this.nuisance !== nuisance) {
			this.nuisance = nuisance;
			this.resetState();
			let runningX = 0;
			for (let i = INCOMING_SYMBOLS.length - 1; i >= 0; i--) {
				for (let j = 0; j < Math.floor(nuisance / INCOMING_SYMBOLS[i].VALUE); j++) {
					const dimension = PUYO_COORDINATES.INCOMING[INCOMING_SYMBOLS[i].SYMBOL].SCALE;
					runningX += dimension / 2;
					this.drawIncomingSymbol(INCOMING_SYMBOLS[i].SYMBOL, runningX, 1);
					runningX += dimension / 2;
				}
				nuisance %= INCOMING_SYMBOLS[i].VALUE;
			}
		}
	}
}

class QueueLayer extends PuyoDrawingLayer {
	updateQueue(queueState) {
		const { dropArray } = queueState;
		this.resetState();
		for (let i = 0; i < dropArray.length; i++) {
			this.drawDrop(dropArray[i], 1, 2 + 3 * i);
		}
	}
}

module.exports = { GameArea };
