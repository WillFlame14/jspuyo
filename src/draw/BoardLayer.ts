import { Board } from '../Board';
import { CanvasLayer, DrawingLayer } from './GameDrawer';
import { Drop } from '../Drop';
import { PuyoDrawingLayer } from './PuyoDrawingLayer';
import { Settings } from '../utils/Settings';

import * as CONSTANTS from './DrawingConfig';

enum MODE {
	PUYO_DROPPING,
	PUYO_DROPPING_SPLIT,
	PUYO_SQUISHING,
	CHAIN_POPPING,
	CHAIN_DROPPING,
	CHAIN_SQUISHING,
	NUISANCE_DROPPING
}

export class BoardLayer extends CanvasLayer {
	unit: number;
	settings: Settings;
	appearance: string;
	backgroundLayer: DrawingLayer;
	stackLayer: PuyoDrawingLayer;
	dynamicLayer: PuyoDrawingLayer;
	columnHeights: number[];
	mode: MODE;

	constructor(settings: Settings, appearance: string, scaleFactor = 1, onNode: boolean) {
		super(CONSTANTS.DIMENSIONS.BOARD.W * scaleFactor, CONSTANTS.DIMENSIONS.BOARD.H * scaleFactor, onNode);
		this.unit = this.width / settings.cols;
		this.settings = settings;
		this.appearance = appearance;
		this.backgroundLayer = new DrawingLayer(this.width, this.height, this.unit, onNode);
		this.backgroundLayer.resetState();
		if (!this.onNode) {
			this.backgroundLayer.ctx.fillStyle = 'black';
			this.backgroundLayer.ctx.globalAlpha = 0.2;
			this.backgroundLayer.ctx.fillRect(0, 0, this.width, this.height);
			this.backgroundLayer.draw({ appearance, size: 1, sX: CONSTANTS.PUYO_COORDINATES.CROSS.X, sY: CONSTANTS.PUYO_COORDINATES.CROSS.Y, dX: 2.5, dY: 0.5, sWidth: 1, sHeight: 1, merge: false });
		}
		this.stackLayer = new PuyoDrawingLayer(this.width, this.height, this.unit, appearance, onNode);
		this.dynamicLayer = new PuyoDrawingLayer(this.width, this.height, this.unit, appearance, onNode);
		this.columnHeights = [];
		this.mode = null;
	}

	update(): void {
		if (!this.onNode) {
			this.clear();
			this.ctx.drawImage(this.backgroundLayer.canvas, 0, 0);
			this.ctx.drawImage(this.stackLayer.canvas, 0, 0);
			this.ctx.drawImage(this.dynamicLayer.canvas, 0, 0);
		}
	}

	getStateObject(): LayerHash {
		return { /* backgroundObject: this.backgroundLayer.getStateObject(), */stackObject: this.stackLayer.getStateObject(), dynamicObject: this.dynamicLayer.getStateObject() };
	}

	drawFromStateObject(stateObject: LayerHash): void {
		/*this.backgroundLayer.drawFromStateObject(stateObject.backgroundObject);*/
		this.stackLayer.drawFromStateObject(stateObject.stackObject);
		this.dynamicLayer.drawFromStateObject(stateObject.dynamicObject);
		this.update();
	}

	hasStackChanged(mode: MODE): boolean {
		if (this.mode !== mode) {
			this.mode = mode;
			return true;
		}
		return false;
	}

	updateBoard(currentBoardState : { connections: Puyo[][], currentDrop: Drop }): void {
		const { connections, currentDrop } = currentBoardState;
		if (currentDrop.schezo.y == null) {
			if (this.hasStackChanged(MODE.PUYO_DROPPING)) {
				this.columnHeights = (new Array(this.settings.cols).fill(0)) as number[];
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

	squishPuyos(currentBoardState: { connections: Puyo[][], currentDrop: Drop }): void {
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

	resolveChains(resolvingState: ResolvingState): void {
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

	dropNuisance(boardState: number[][], nuisanceState: NuisanceState): void {
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
					this.dynamicLayer.drawPuyo(CONSTANTS.NUISANCE, index + 0.5, this.settings.rows - 0.5 - (startRow + i));
				}
			}
		});
		this.update();
	}
}
