interface Puyo extends Location {
	/** The number of puyos this one is above */
	above?: number,
	colour: number,
	connections?: string[]
}

interface Location {
	col: number,
	row: number
}

interface Position {
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

declare enum Gamemode {
	TSU = 'Tsu',
	FEVER = 'Fever'
}

declare enum Shape {
	h = 'h',
	L = 'L',
	H = 'H',
	O = 'O',
	I = 'I'
}

declare enum Direction {
	UP = 'Up',
	DOWN = 'Down',
	LEFT = 'Left',
	RIGHT = 'Right',
	CW = 'CW',
	CCW = 'CCW'
}

declare enum NuisanceSymbol {
	SMALL = 'SMALL',
	LARGE = 'LARGE',
	ROCK = 'ROCK',
	STAR = 'STAR',
	MOON = 'MOON',
	CROWN = 'CROWN',
	COMET = 'COMET'
}

interface CpuInfo {
	client_socket: SocketIOClient.Socket,
	socket: SocketIO.Socket,
	speed: number,
	ai: string
}
