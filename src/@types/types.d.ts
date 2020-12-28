interface Puyo extends Point {
	/** The number of puyos this one is above */
	above?: number,
	colour: number,
	connections?: string[]
}

interface Point {
	x: number,
	y: number
}

interface KeyBindings {
	moveLeft: string,
	moveRight: string,
	rotateCCW: string,
	rotateCW: string,
	softDrop: string,
	hardDrop: string
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

interface CpuInfo {
	client_socket: SocketIOClient.Socket,
	socket: SocketIO.Socket,
	speed: number,
	ai: string
}
