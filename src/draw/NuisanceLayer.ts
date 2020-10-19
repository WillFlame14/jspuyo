import { DrawingLayer } from './GameDrawer';
import * as CONSTANTS from './DrawingConfig';

export class NuisanceLayer extends DrawingLayer {
	nuisance: number;

	constructor(width: number, height: number, appearance: string, onNode: boolean) {
		super(width, height, height / 2, onNode);
		this.nuisance = null;
		this.defaultArgs = {
			appearance,
			size: 1,
			merge: false
		};
	}

	drawIncomingSymbol(symbol: NuisanceSymbol, dX: number, dY: number): void {
		const { X: sX, Y: sY, SCALE: scale } = CONSTANTS.PUYO_COORDINATES.INCOMING[symbol];
		this.draw({ sX, sY, dX, dY, sWidth: scale, sHeight: scale });
	}

	updateNuisance(nuisance: number): void {
		if (this.nuisance !== nuisance) {
			this.nuisance = nuisance;
			this.resetState();
			let runningX = 0;
			for (let i = CONSTANTS.INCOMING_SYMBOLS.length - 1; i >= 0; i--) {
				const symbol = CONSTANTS.INCOMING_SYMBOLS[i];
				for (let j = 0; j < Math.floor(nuisance / symbol.VALUE); j++) {
					const dimension = CONSTANTS.PUYO_COORDINATES.INCOMING[symbol.SYMBOL].SCALE;
					runningX += dimension / 2;
					this.drawIncomingSymbol(symbol.SYMBOL, runningX, 1);
					runningX += dimension / 2;
				}
				nuisance %= symbol.VALUE;
			}
		}
	}
}
