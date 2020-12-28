export enum NuisanceSymbol {
	SMALL = 'SMALL',
	LARGE = 'LARGE',
	ROCK = 'ROCK',
	STAR = 'STAR',
	MOON = 'MOON',
	CROWN = 'CROWN',
	COMET = 'COMET'
}

export const DIMENSIONS = {
	BOARD : { W: 270, H: 540 },
	QUEUE : { W: 72, H: 540 },
	NUISANCE_QUEUE : { W: 270, H: 90 },
	MARGIN: 10,
	MIN_SCALE: 0.5
};

export const FLAT_SQUISH_FRAMES = [1, 2, 4, 6, 8, 10];

export const PUYO_COORDINATES = {
	NUISANCE: { X: 6, Y: 12 },
	PUYO_START: { X: 0, Y: 0 },
	POPPING: {
		0: { 1: { X: 6, Y: 12 }, 2: { X: 9, Y: 15 } },
		1: { 1: { X: 0, Y: 12 }, 2: { X: 1, Y: 12 } },
		2: { 1: { X: 0, Y: 13 }, 2: { X: 1, Y: 13 } },
		3: { 1: { X: 2, Y: 12 }, 2: { X: 3, Y: 12 } },
		4: { 1: { X: 2, Y: 13 }, 2: { X: 3, Y: 13 } },
		5: { 1: { X: 4, Y: 12 }, 2: { X: 5, Y: 12 } }
	} as Record<number, Record<number, SpriteLocation>>,
	SQUISHING: {
		1: { FLAT: { X: 11, Y: 9 }, TALL: { X: 12, Y: 9 } },
		2: { FLAT: { X: 13, Y: 9 }, TALL: { X: 14, Y: 9 } },
		3: { FLAT: { X: 0, Y: 10 }, TALL: { X: 1, Y: 10 } },
		4: { FLAT: { X: 2, Y: 10 }, TALL: { X: 3, Y: 10 } },
		5: { FLAT: { X: 4, Y: 10 }, TALL: { X: 5, Y: 10 } }
	} as Record<number, Record<'FLAT' | 'TALL', SpriteLocation>>,
	HIGHLIGHT_START: { X: 0, Y: 9 },
	GHOST_START: {
		1: { X: 14.5, Y: 7, SCALE: 0.5 },
		2: { X: 14.5, Y: 7.5, SCALE: 0.5 },
		3: { X: 14.5, Y: 8, SCALE: 0.5 },
		4: { X: 14, Y: 7, SCALE: 0.5 },
		5: { X: 14, Y: 7.5, SCALE: 0.5 }
	} as Record<number, SpriteLocation>,
	INCOMING: {
		SMALL: { X: 14, Y: 12, SCALE: 1 },
		LARGE: { X: 13, Y: 12, SCALE: 1 },
		ROCK: { X: 12, Y: 12, SCALE: 1 },
		STAR: { X: 12, Y: 11, SCALE: 1 },
		MOON: { X: 11, Y: 11, SCALE: 1 },
		CROWN: { X: 10, Y: 11, SCALE: 1 },
		COMET: { X: 12, Y: 7, SCALE: 1.5 }
	} as Record<string, SpriteLocation>,
	CROSS: { X: 7, Y: 12 }
};

export const INCOMING_SYMBOLS = [
	{ SYMBOL: NuisanceSymbol.SMALL, VALUE: 1 },
	{ SYMBOL: NuisanceSymbol.LARGE, VALUE: 6 },
	{ SYMBOL: NuisanceSymbol.ROCK, VALUE: 30 },
	{ SYMBOL: NuisanceSymbol.STAR, VALUE: 180 },
	{ SYMBOL: NuisanceSymbol.MOON, VALUE: 360 },
	{ SYMBOL: NuisanceSymbol.CROWN, VALUE: 720 },
	{ SYMBOL: NuisanceSymbol.COMET, VALUE: 1440 }
];

export const NUM_DRAWING_STATES = 128;

export const NUISANCE = 0;
