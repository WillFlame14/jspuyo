'use strict';

import { drawSprite } from './SpriteDrawer';
import * as CONSTANTS from './DrawingConfig';

export class CanvasLayer {
	onNode: boolean;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;

	constructor(width: number, height: number, onNode = false, className: string = undefined) {
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
	clear(): void {
		if (!this.onNode) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}
}

export class DrawingLayer extends CanvasLayer {
	unitW: number;
	unitH: number;
	objectsDrawn: Partial<DrawingArgs>[];
	drawingState: number;
	defaultArgs: Partial<DrawingArgs>;

	constructor(width: number, height: number, unitW: number, unitH: number, onNode: boolean, className: string = undefined) {
		super(width, height, onNode, className);
		this.unitW = unitW;
		this.unitH = unitH;
		this.objectsDrawn = [];
		this.drawingState = 0;
		this.defaultArgs = {};
	}

	drawFromArgs(drawingArgs: Partial<DrawingArgs>): boolean {
		let succeeded = true;
		if (!this.onNode) {
			const args = Object.assign({ ctx: this.ctx }, this.defaultArgs, drawingArgs) as DrawingArgs;
			succeeded = drawSprite(args);
		}
		return succeeded;
	}

	draw(drawingArgs: Partial<DrawingArgs>): void {
		this.objectsDrawn.push(drawingArgs);
		const succeeded = this.drawFromArgs(drawingArgs);

		const retry = (attempts = 0) => {
			const result = this.drawFromArgs(drawingArgs);
			if(!result && attempts < 10) {
				setTimeout(() => retry(attempts + 1), 20);
			}
		};

		if(!succeeded) {
			setTimeout(() => retry(), 20);
		}
	}

	getStateObject(): DrawingHash {
		return { drawingState: this.drawingState, objectsDrawn: this.objectsDrawn };
	}

	drawFromStateObject(state: DrawingHash): void {
		if (state.drawingState !== this.drawingState) {
			this.clear();

			let all_successful = true;
			state.objectsDrawn.forEach((drawingArgs) => {
				const succeeded = this.drawFromArgs(drawingArgs);
				if(!succeeded) {
					all_successful = false;
				}
			});

			if(all_successful) {
				this.drawingState = state.drawingState;
			}
		}
	}

	resetState(): void {
		this.objectsDrawn = [];
		this.clear();
		this.drawingState++;
		this.drawingState %= CONSTANTS.NUM_DRAWING_STATES;
	}
}
