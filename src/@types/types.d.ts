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
