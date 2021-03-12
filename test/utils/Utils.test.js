'use strict';

/*eslint-env mocha */

const chaiExclude = require('chai-exclude');
const { expect } = require('chai').use(chaiExclude);

const { Drop } = require('../../src/Drop.js');
const { getOtherPuyo, getDropFrames, calculateScore } = require('../../src/utils/Utils.js');
const { Settings } = require('../../src/utils/Settings.js');

const settings = new Settings();

const red = 1;
const grn = 2;
const blu = 3;
const nui = 0;

describe('Utils.js', function() {
	describe('getOtherPuyo', function() {
		it('should retrieve the correct location of a Tsu schezo', function() {
			// Set the arle at (1, 1) with standardAngle 0 deg
			const drop1 = new Drop('I', [red, blu], settings, { x: 1, y: 1}, undefined, 0);
			const schezo1 = getOtherPuyo(drop1);

			expect(schezo1).to.deep.equal({ x: 1, y: 2});

			// Set the arle at (1, 1) with standardAngle 120 deg
			const drop2 = new Drop('I', [red, blu], settings, { x: 1, y: 1}, undefined, 120);
			const schezo2 = getOtherPuyo(drop2);

			expect(schezo2.x).to.be.within(0.419, 0.42);
			expect(schezo2.y).to.be.within(1.814, 1.815);
		});
	});

	describe('getDropFrames', function() {
		it('should return 0 when no puyos fall', function() {
			const boardState = [
				[red, red, blu, nui],
				[red, blu, blu],
				[grn, blu],
				[blu],
				[],
				[]
			];
			const poppingLocs = [
				{ x: 0, y: 2 },
				{ x: 0, y: 3 },		// popped nuisance
				{ x: 1, y: 1 },
				{ x: 1, y: 2 },
				{ x: 2, y: 1 }
			];
			const dropFrames = getDropFrames(poppingLocs, boardState, settings);
			expect(dropFrames).to.equal(0);
		});

		it('should return the number of drop frames when puyos fall', function() {
			const boardState = [
				[red, red],
				[red],
				[red, grn],
				[],
				[],
				[]
			];
			const poppingLocs = [
				{ x: 0, y: 0 },
				{ x: 0, y: 1 },
				{ x: 1, y: 0 },
				{ x: 2, y: 0 }
			];
			const dropFrames = getDropFrames(poppingLocs, boardState, settings);
			expect(dropFrames).to.equal(settings.dropFrames);
		});

		it('should return ${dropFrames} when nuisance fall', function() {
			const boardState = [
				[red, red, nui, nui],
				[red],
				[red, grn],
				[],
				[],
				[]
			];
			const poppingLocs = [
				{ x: 0, y: 2 },
				{ x: 0, y: 3 },		//popped nuisance
				{ x: 1, y: 1 },
				{ x: 1, y: 2 },
				{ x: 2, y: 1 }
			];
			const dropFrames = getDropFrames(poppingLocs, boardState, settings);
			expect(dropFrames).to.equal(0);
		});
	});

	describe('calculateScore', function() {
		it('should calculate the correct score for a group of 4', function() {
			const puyos = [
				{ colour: grn },
				{ colour: grn },
				{ colour: grn },
				{ colour: grn }
			];
			// 4 puyos together as the 2nd chain
			const score = calculateScore(puyos, 2);
			expect(score).to.equal(4 * 80);
		});

		it('should calculate the correct score for a power chain', function() {
			const puyos = [
				{ colour: grn },
				{ colour: grn },
				{ colour: grn },
				{ colour: grn },
				{ colour: blu },
				{ colour: blu },
				{ colour: blu },
				{ colour: blu },
				{ colour: blu }
			];
			// 9 puyos together as the 4th chain
			const score = calculateScore(puyos, 4);
			expect(score).to.equal(90 * 37);
		});
	});
});
