'use strict';

const { Board } = require('./Board.js');
const { SpriteDrawer } = require('./Draw.js');
const { DIMENSIONS } = require('./Utils.js');
const { POSITIONS } = require('../images/sprite-positions.json');
const NUM_DRAWING_STATES = 5;
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
	constructor(width, height, className) {
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		if (className) {
			this.canvas.className = className;
		}
		this.ctx = this.canvas.getContext('2d');
	}
	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
}

class DrawingLayer extends CanvasLayer {
	constructor(width, height, unit, className) {
		super(width, height, className);
		this.unit = unit;
		this.objectsDrawn = [];
		this.drawingState = 0;
		this.defaultArgs = {};
	}
	drawHere(args) {
		SpriteDrawer.drawSprite(
			this.ctx, args.appearance,
			args.size * this.unit, args.sX, args.sY,
			args.dX * this.unit, args.dY * this.unit, args.sWidth, args.sHeight, args.merge
		);
	}
	drawFromArgs(drawingArgs) {
		Object.assign(drawingArgs, this.defaultArgs);
		this.drawHere(drawingArgs);
	}
	draw(drawingArgs) {
		this.objectsDrawn.push(drawingArgs);
		this.drawFromArgs(drawingArgs);
	}
	getStateObject() {
		return {drawingState: this.drawingState, objectsDrawn: this.objectsDrawn};
	}
	drawFromStateObject(state) {
		if (state.drawingState !== this.drawingState) {
			state.objectsDrawn.forEach((drawingArgs) => {
				this.drawFromArgs(drawingArgs);
			});
			this.drawingState = state.drawingState;
		}
	}
	setState() {
		this.drawingState++;
		this.drawingState %= NUM_DRAWING_STATES;
	}
	resetState() {
		this.objectsDrawn = [];
		this.clear();
		this.setState();
	}
}

class PuyoDrawingLayer extends DrawingLayer {
	constructor(width, height, unit, appearance, className) {
		super(width, height, unit, className);
		this.defaultArgs.appearance = appearance;
		this.defaultArgs.size = 1;
		this.defaultArgs.sWidth = 1;
		this.defaultArgs.sHeight = 1;
		this.defaultArgs.merge = true;
	}
	drawPuyo(colour, dX, dY, directions = []) {
		let sX, sY;
		if(colour === 0) {
			sX = POSITIONS.NUISANCE.X;
			sY = POSITIONS.NUISANCE.Y;
		}
		else {
			sX = POSITIONS.PUYO_START.X;
			sY = POSITIONS.PUYO_START.Y + colour - 1;
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
		this.draw({sX, sY, dX, dY});
	}
	drawPoppingPuyo(colour, dX, dY, drawPhaseTwo) {
		if(colour === 0) {
			if(!drawPhaseTwo) {
				const sX = POSITIONS.NUISANCE.X;
				const sY = POSITIONS.NUISANCE.Y;
				this.draw({sX, sY, dX, dY});
			}
		}
		else {
			const sX = (colour - 1) * 2 + (drawPhaseTwo ? 7 : 6);
			const sY = 10;
			this.draw({sX, sY, dX, dY});
		}
	}
	drawDrop(drop, dX, dY) {
		if("IhLHO".includes(drop.shape)) {
			this["draw_" + drop.shape](drop, dX, dY);
		}
		else {
			console.log('lol that\'s not a valid drop shape what kind of shape is ' + drop.shape);
		}
	}
	draw_I(drop, dX, dY) {
		this.drawPuyo(drop.colours[0], dX, dY, []);
		dX += this.unit * Math.cos(drop.standardAngle + Math.PI / 2);
		dY -= this.unit * Math.sin(drop.standardAngle + Math.PI / 2);
		this.drawPuyo(drop.colours[1], dX, dY, []);
	}
}

class GameArea extends CanvasLayer {
	constructor(settings, appearance, scaleFactor = 1) {
		super(
			DIMENSIONS.BOARD.W * scaleFactor + (scaleFactor > DIMENSIONS.MIN_SCALE) ? (DIMENSIONS.MARGIN + DIMENSIONS.QUEUE.W * scaleFactor) : 0,
			DIMENSIONS.BOARD.H * scaleFactor + DIMENSIONS.MARGIN + DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor
		);
		this.settings = settings;
		this.appearance = appearance;
		this.boardLayer = new BoardLayer(settings, appearance, scaleFactor);
		this.nuisanceLayer = new NuisanceLayer(DIMENSIONS.NUISANCE_QUEUE.W * scaleFactor, DIMENSIONS.NUISANCE_QUEUE.H * scaleFactor);
		this.queueLayer = new QueueLayer(DIMENSIONS.QUEUE.W * scaleFactor, DIMENSIONS.QUEUE.H * scaleFactor);
		this.simplified = scaleFactor <= DIMENSIONS.MIN_SCALE;
	}
	update() {
		this.clear();
		this.ctx.drawImage(this.nuisanceLayer.canvas, 0, 0);
		this.ctx.drawImage(this.boardLayer.canvas, 0, this.nuisanceLayer.canvas.height + DIMENSIONS.MARGIN);
		if (!this.simplified) {
			this.ctx.drawImage(this.queueLayer.canvas, this.boardLayer.canvas.width + DIMENSIONS.MARGIN);
		}
	}
	getHash() {
		return JSON.stringify({boardObject: this.boardLayer.getStateObject(), nuisanceObject: this.nuisanceLayer.getStateObject(), queueObject: this.queueLayer.getStateObject()});
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
	resolveChains(resolvingState) {
		this.boardLayer.resolveChains(resolvingState);
		this.update();
		return this.getHash();
	}
	initNuisanceDrop(nuisanceCascadeFPR) {
		this.boardLayer.initNuisanceDrop(nuisanceCascadeFPR);
		this.update();
		return this.getHash();
	}
	dropNuisance(boardState, nuisanceState) {
		this.boardLayer.dropNuisance(boardState, nuisanceState);
		this.update();
		return this.getHash();
	}
}

class BoardLayer extends CanvasLayer {
	constructor(settings, appearance, scaleFactor = 1) {
		super(
			DIMENSIONS.BOARD.W * scaleFactor, DIMENSIONS.BOARD.H * scaleFactor
		);
		this.unit = this.canvas.width / settings.cols;
		this.settings = settings;
		this.appearance = appearance;
		this.stackLayer = new PuyoDrawingLayer(this.canvas.width, this.canvas.height, this.unit, appearance);
		this.dynamicLayer = new PuyoDrawingLayer(this.canvas.width, this.canvas.height, this.unit, appearance);
		this.nuisanceCascadeFPR = [];
		this.mode = null;
	}
	update() {
		this.clear();
		this.ctx.drawImage(this.stackLayer, 0, 0);
		this.ctx.drawImage(this.dynamicLayer, 0, 0);
	}
	getStateObject() {
		return {stackObject: this.stackLayer.getStateObject(), dynamicObject: this.dynamicLayer.getStateObject()};
	}
	drawFromStateObject(stateObject) {
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
		const {connections, currentDrop} = currentBoardState;
		if (currentDrop.schezo.y == null) {
			if (this.hasStackChanged(MODE.PUYO_DROPPING)) {
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.col, this.settings.rows - 0.5 - puyo.row, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			this.dynamicLayer.drawDrop(currentDrop, 0.5 + currentDrop.arle.x, this.settings.rows - 0.5 - currentDrop.arle.y);

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
	resolveChains(resolvingState) {
		const {connections, poppedLocs, connectionsAfterPop, unstablePuyos} = resolvingState;
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
	initNuisanceDrop(nuisanceCascadeFPR) {
		this.nuisanceCascadeFPR = nuisanceCascadeFPR;
		this.update();
	}
	dropNuisance(boardState, nuisanceState) {
		const {nuisanceArray, currentFrame} = nuisanceState;
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
		for (let i = 0; i < this.settings.cols; i++) {
			const startingRowsAbove = this.settings.nuisanceSpawnRow - boardState[i].length;
			const rowsDropped = Math.min(currentFrame / this.nuisanceCascadeFPR[i], startingRowsAbove);
			for (let j = 0; j < nuisanceArray[i].length; j++) {
				this.dynamicLayer.drawPuyo(NUISANCE, i, this.settings.rows - 0.5 - this.settings.nuisanceSpawnRow + rowsDropped - j);
			}
		}
		this.update();
	}
}

class NuisanceLayer extends PuyoDrawingLayer {
}

class QueueLayer extends PuyoDrawingLayer {
}

module.exports = { GameArea };
