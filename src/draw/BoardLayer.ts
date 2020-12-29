import { Board } from '../Board';
import { MODE } from '../Game';
import { CanvasLayer, DrawingLayer } from './GameDrawer';
import { Drop } from '../Drop';
import { PuyoDrawingLayer } from './PuyoDrawingLayer';
import { Settings } from '../utils/Settings';

import * as CONSTANTS from './DrawingConfig';

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
		const { standardAngle, arle, schezo, colours } = currentDrop;
		const { rows, cols } = this.settings;

		if (currentDrop.schezo.y == null) {
			if (this.hasStackChanged(MODE.PUYO_DROPPING)) {
				this.columnHeights = new Array<number>(cols).fill(0);
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, rows - 0.5 - puyo.y, puyo.connections);
						if (this.columnHeights[puyo.x] < puyo.y + 1) {
							this.columnHeights[puyo.x] = puyo.y + 1;
						}
					});
				});
			}
			this.dynamicLayer.resetState();
			if (standardAngle > Math.PI / 4 && standardAngle <= 3 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(colours[0], 0.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x]);
				if (this.columnHeights[arle.x - 1] <= this.columnHeights[arle.x] || this.columnHeights[arle.x - 1] <= arle.y) {
					this.dynamicLayer.drawGhost(colours[1], -0.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x - 1]);
				}
			}
			else if (standardAngle > 3 * Math.PI / 4 && standardAngle <= 5 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(colours[1], 0.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x]);
				this.dynamicLayer.drawGhost(colours[0], 0.5 + arle.x, rows - 1.5 - this.columnHeights[arle.x]);
			}
			else if (standardAngle > 5 * Math.PI / 4 && standardAngle <= 7 * Math.PI / 4) {
				this.dynamicLayer.drawGhost(colours[0], 0.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x]);
				if (this.columnHeights[arle.x + 1] <= this.columnHeights[arle.x] || this.columnHeights[arle.x + 1] <= arle.y) {
					this.dynamicLayer.drawGhost(colours[1], 1.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x + 1]);
				}
			}
			else {
				this.dynamicLayer.drawGhost(colours[0], 0.5 + arle.x, rows - 0.5 - this.columnHeights[arle.x]);
				this.dynamicLayer.drawGhost(colours[1], 0.5 + arle.x, rows - 1.5 - this.columnHeights[arle.x]);
			}
			this.dynamicLayer.drawHighlightedDrop(currentDrop, 0.5 + arle.x, rows - 0.5 - arle.y);
		}
		else {
			if (this.hasStackChanged(MODE.PUYO_DROPPING_SPLIT)) {
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, rows - 0.5 - puyo.y, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			this.dynamicLayer.drawPuyo(colours[0], 0.5 + arle.x, rows - 0.5 - arle.y);
			this.dynamicLayer.drawPuyo(colours[1], 0.5 + schezo.x, rows - 0.5 - schezo.y);
		}
		this.update();
	}

	squishPuyos(currentBoardState: { connections: Puyo[][], squishingPuyos: { puyo: Puyo, squishType: string }[] }, squishState: { currentFrame: number }): void {
		const { connections, squishingPuyos } = currentBoardState;
		// console.log(schezo);
		const { rows } = this.settings;
		if (this.hasStackChanged(MODE.PUYO_SQUISHING)) {
			this.stackLayer.resetState();
			connections.forEach(group => {
				group.forEach(puyo => {
					this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, this.settings.rows - 0.5 - puyo.y, puyo.connections);
				});
			});
			// this.dynamicLayer.resetState();
		}
		this.dynamicLayer.resetState();
		if(squishingPuyos == null) {
			console.log(squishingPuyos);
			return;
		}
		for(const puyo of squishingPuyos) {
			const { colour, x, y } = puyo.puyo;
			const type = CONSTANTS.SQUISH_FRAMES[puyo.squishType][Math.floor(squishState.currentFrame / 2)];
			if(type === undefined) {
				continue;
			}
			this.dynamicLayer.drawSquishingPuyo(colour, 0.5 + x, rows - 0.5 - y, type);
		}
		this.update();
	}

	resolveChains(resolvingState: ResolvingState): void {
		const { connections, poppedLocs, connectionsAfterPop, unstablePuyos, currentFrame } = resolvingState;
		const { rows, popFrames, dropFrames } = this.settings;

		if (currentFrame <= popFrames) {
			if (this.hasStackChanged(MODE.CHAIN_POPPING)) {
				this.stackLayer.resetState();
				connections.forEach(group => {
					group.filter(puyo => !poppedLocs.some(puyo2 => puyo.x === puyo2.x && puyo.y === puyo2.y)).forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, rows - 0.5 - puyo.y, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			poppedLocs.forEach(puyo => {
				this.dynamicLayer.drawPoppingPuyo(puyo.colour, 0.5 + puyo.x, rows - 0.5 - puyo.y, currentFrame >= popFrames / 3);
			});
		}
		else {
			if (this.hasStackChanged(MODE.CHAIN_DROPPING)) {
				this.stackLayer.resetState();
				connectionsAfterPop.forEach(group => {
					group.forEach(puyo => {
						this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, rows - 0.5 - puyo.y, puyo.connections);
					});
				});
			}
			this.dynamicLayer.resetState();
			unstablePuyos.filter(puyo => !poppedLocs.some(puyo2 => puyo.x === puyo2.x && puyo.y === puyo2.y)).forEach(puyo => {
				this.dynamicLayer.drawPuyo(
					puyo.colour,
					0.5 + puyo.x,
					this.settings.rows - 0.5 - Math.max(puyo.y - (puyo.y - puyo.above) * (currentFrame - popFrames) / dropFrames, puyo.above)
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
					this.stackLayer.drawPuyo(puyo.colour, 0.5 + puyo.x, this.settings.rows - 0.5 - puyo.y, puyo.connections);
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
