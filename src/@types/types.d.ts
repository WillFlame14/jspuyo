interface Point {
	x: number,
	y: number
}

interface Puyo extends Point {
	/** The number of puyos this one is above */
	above?: number,
	colour: number,
	connections?: string[]
}

interface ResolvingState {
	chain: number,
	puyoLocs: Puyo[],
	currentFrame: number,
	totalFrames: number,
	connections?: Puyo[][],
	poppedLocs?: Puyo[],
	connectionsAfterPop?: Puyo[][],
	unstablePuyos?: Puyo[],
}

interface NuisanceState {
	nuisanceArray: number[][],
	nuisanceAmount: number,
	positions?: number[],
	velocities?: number[],
	allLanded?: boolean,
	landFrames?: number
}

interface SquishState {
	currentFrame: number;
	totalFrames: number;
	squishingPuyos: Array<{puyo: Puyo, squishType: string}>;
}
