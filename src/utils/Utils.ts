'use strict';

import { Drop } from '../Drop';
import { Settings } from './Settings';

/**
 * Returns a random puyo colour.
 * @param  {[type]} numColours Number of colours in the pool
 * @return {number}            The randomized colour
 */
export function getRandomColour (numColours: number): number {
	return Math.floor(Math.random() * numColours) + 1;
}

/**
 * Returns the location(s) of the schezo puyo(s).
 *
 * Currently only works for I-shaped Drops (Tsu).
 */
export function getOtherPuyo (drop: Drop): Point {
	let x = drop.arle.x + Math.cos(drop.standardAngle + Math.PI / 2);
	let y = drop.arle.y + Math.sin(drop.standardAngle + Math.PI / 2);

	// Perform integer rounding
	if(Math.abs(x - Math.round(x)) < 0.001) {
		x = Math.round(x);
	}
	if(Math.abs(y - Math.round(y)) < 0.001) {
		y = Math.round(y);
	}
	return { x, y };
}

/**
 * Gets the frames needed for the animation (accounts for falling time).
 * @param  {Puyo[]}     poppingLocs The locations of the popped puyos
 * @param  {number[][]} boardState  The current board state
 * @param  {Settings}   settings    The game settings
 * @return {number}                 The frames required
 */
export function getDropFrames(poppingLocs: Puyo[], boardState: number[][], settings: Settings): number {
	return poppingLocs.some(loc => {
		return boardState[loc.x][loc.y + 1] !== undefined && !poppingLocs.some(loc2 => loc2.x === loc.x && loc2.y === loc.y + 1);
	}) ? settings.dropFrames : 0;
}

/**
 * Finds the score of the given chain. Currently only for Tsu rule.
 */
export function calculateScore (puyos: Puyo[], chain_length: number): number {
	// These arrays are 1-indexed.
	const CHAIN_POWER = [null, 0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672];
	const COLOUR_BONUS = [null, 0, 3, 6, 12, 24, 48];
	const GROUP_BONUS = [null, null, null, null, 0, 2, 3, 4, 5, 6, 7, 10, 10, 10, 10];

	// Number of puyos cleared in the chain
	const puyos_cleared = puyos.length;

	// Find the different colours
	const containedColours: Record<number, number> = {};

	puyos.forEach(puyo => {
		if(containedColours[puyo.colour] === undefined) {
			containedColours[puyo.colour] = 1;
		}
		else {
			containedColours[puyo.colour]++;
		}
	});

	// Chain power based on length of chain
	const chain_power = CHAIN_POWER[chain_length];

	// Colour bonus based on number of colours used
	const colour_bonus = COLOUR_BONUS[Object.keys(containedColours).length];

	// Group bonus based on number of puyos in each group
	const group_bonus = Object.keys(containedColours).reduce((bonus, colour) => bonus += GROUP_BONUS[containedColours[Number(colour)]], 0);

	return (10 * puyos_cleared) * (chain_power + colour_bonus + group_bonus);
}

/**
 * Finds the amount of nuisance generated from a particular increase in score.
 */
export function calculateNuisance(chain_score: number, targetPoints: number, leftoverNuisance: number): { nuisanceSent: number, leftoverNuisance: number } {
	const nuisancePoints = chain_score / targetPoints + leftoverNuisance;
	const nuisanceSent = Math.floor(nuisancePoints);

	return { nuisanceSent, leftoverNuisance: nuisancePoints - nuisanceSent };
}

/**
 * Deep copies an object where all values are primitype types.
 * Call this function recursively to deep copy more nested objects.
 */
export function objectCopy(obj: unknown): unknown {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Clamps a number between a minimum and maximum number.
 */
export function clampBetween(value: number, min: number, max: number): number {
	if(value < min) {
		return min;
	}
	else if(value > max) {
		return max;
	}
	return value;
}

export function shuffleArray(array: unknown[]): void {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}
