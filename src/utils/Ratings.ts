/* To be used when adding support for ranked matches
----------------------------------------------------------
import { PlayerInfo } from '../webpage/firebase';

	const promises = [
		PlayerInfo.getUserProperty(uidA, 'rating'),
		PlayerInfo.getUserProperty(uidB, 'rating'),
		PlayerInfo.getUserProperty(uidA, 'matches'),
		PlayerInfo.getUserProperty(uidB, 'matches')
	];

	const [ratingA, ratingB, matchesA, matchesB] = await Promise.all(promises) as [number, number, Record<string, Match[]>, Record<string, Match[]>];

	if(matchesA[uidB] === undefined) {
		matchesA[uidB] = [];
	}

	if(matchesB[uidA] === undefined) {
		matchesB[uidB] = [];
	}

	matchesA[uidB].push({ wins: winsA, opponent_wins: winsB, timestamp });
	matchesA[uidB].push({ wins: winsB, opponent_wins: winsA, timestamp });

	await Promise.all([
		PlayerInfo.updateUser(uidA, 'matches', matchesA),
		PlayerInfo.updateUser(uidA, 'matches', matchesB)
	]);
 */


interface Match {
	wins: number;
	opponent_wins: number;
	timestamp: number;
}

export function updateRatings(ratingA: number, ratingB: number, winsA: number, winsB: number): { ratingA: number, ratingB: number } {
	const delta = findDelta(ratingA, ratingB, winsA, winsB);

	let medA: number, medB: number;

	if(delta >= 0) {
		medA = ratingA * (1 + delta);
		medB = ratingB / (1 + delta);
	}
	else {
		medA = ratingA / (1 + delta);
		medB = ratingB * (1 + delta);
	}

	return {
		ratingA: medA,
		ratingB: medB
	};
}

/**
 * Finds the uncertainty of a user's rating.
 * @param  {number}            			rating     		The user's current rating.
 * @param  {Record<string, Match[]>} 	all_matches   	All the matches the user has played.
 * @param  {Record<string, number>}  	all_ratings   	A map of current ratings of all players.
 * @return {number}                       The user's rating uncertainty.
 */
export function findUncertainty(rating: number, all_matches: Record<string, Match[]>, all_ratings: Record<string, number>): number {
	let total_matchup_str = 0;

	for(const [opponent, matches] of Object.entries(all_matches)) {
		const level_coefficient = levelCoeff(rating, all_ratings[opponent]);

		let matchup_str = 0;

		for(const match of matches) {
			const coefficient = findCoefficient(timeCoeff(match.timestamp), level_coefficient);
			console.log(coefficient);
			matchup_str += coefficient * (match.wins + match.opponent_wins);

			if(matchup_str > 100) {
				break;
			}
		}

		total_matchup_str += Math.min(Math.sqrt(matchup_str) / 10, 1);
	}

	return 0.6 / Math.pow(total_matchup_str, 1.2);
}

export function findDelta(ratingA: number, ratingB: number, winsA: number, winsB: number): number {
	return (Math.sqrt(ratingB/ratingA) * winsA - Math.sqrt(ratingA/ratingB) * winsB) * findCoefficient(levelCoeff(ratingA, ratingB), 1);
}

function findCoefficient(level_coefficient: number, time_coefficient): number {
	return time_coefficient * level_coefficient / 1000;
}

function timeCoeff(timestamp: number): number {
	return 1 / (Math.pow((Date.now() - timestamp) / (1000 * 60 * 60 * 24 * 365), 2) + 1);
}

function levelCoeff(ratingA: number, ratingB: number): number {
	return Math.min(ratingA/ratingB, ratingB/ratingA);
}
