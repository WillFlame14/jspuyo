'use strict';

/*eslint-env mocha */

const chaiExclude = require('chai-exclude');
const { expect } = require('chai').use(chaiExclude);

const { updateRatings, findDelta, findUncertainty } = require('../../src/utils/Ratings.js');

describe('Ratings.js', function() {
	describe('findDelta', function() {
		it('should calculate the right delta', function() {
			const delta = findDelta(0.8, 1.6, 15, 20);
			expect(delta).to.be.closeTo(0.003536, 0.00001);
		});
	});

	describe('updateRatings', function() {
		it('should update the ratings correctly', function() {
			const {ratingA, ratingB} = updateRatings(0.8, 1.6, 15, 20);
			expect(ratingA).to.be.closeTo(0.8028288, 0.00001);
			expect(ratingB).to.be.closeTo(1.5943623, 0.00001);
		});
	});

	describe('findUncertainty', function() {
		it('should calculate the right uncertainty', function() {
			const timestamp = Date.now();

			// B 15 - 10 A. B is rated 1.0, A is rated 0.4
			// C 25 - 18 A. C is rated 0.5714, A is rated 0.4
			const matches = {
				'B': [{ wins: 10, opponent_wins: 15, timestamp }],
				'C': [{ wins: 25, opponent_wins: 18, timestamp }]
			};

			/*
				Coefficient of A against B is 0.0004, match strength is 0.0004 * 25 = 0.01.
				This adds sqrt(0.01)/10 = 0.01 to total matchup strength.

				Coefficient of A against C is 0.0005, match strength is 0.0005 * 43 = 0.0215
				This adds sqrt(0.0215)/10 = 0.01466 to total matchup strength.

				Total matchup strength is thus 0.01 + 0.01466 = 0.02466.
				Uncertainty is 0.6/(0.02466^1.2) = 51.0151, approximately
			 */

			const all_ratings = {
				'A': 0.4,
				'B': 1.0,
				'C': 0.8
			}

			const uncertainty = findUncertainty(0.4, matches, all_ratings);

			expect(uncertainty).to.be.closeTo(51.0151, 0.0001);
		});
	});
});
