'use strict';

const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const chaiExclude = require('chai-exclude');
const { expect } = require('chai').use(deepEqualInAnyOrder).use(chaiExclude);
const { Board } = require('../js/Board.js');
const { Drop } = require('../js/Drop.js');
const { Utils, Settings, PUYO_COLOURS } = require('../js/Utils.js');

const red = PUYO_COLOURS['Red'];
const grn = PUYO_COLOURS['Green'];
const blu = PUYO_COLOURS['Blue'];
const prp = PUYO_COLOURS['Purple'];
const nui = PUYO_COLOURS['Gray'];

const settings = new Settings();

describe('Board.js', function() {
	describe('getConnections', function() {
		it('should return no connections with empty board', function() {
			const board = new Board(new Settings());

			const chain_puyos = board.getConnections();
			expect(chain_puyos).to.deep.equal([]);
		});

		it('should return small connections', function() {
			const boardState = [
				[red, red, blu],
				[blu, grn, red],
				[blu, grn, red, grn],
				[grn, grn],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const chain_puyos = board.getConnections();

			const expectedResult = [
				[
					{ col: 0, row: 0, colour: red },
					{ col: 0, row: 1, colour: red }
				],
				[
					{ col: 0, row: 2, colour: blu },
				],
				[
					{ col: 1, row: 0, colour: blu },
					{ col: 2, row: 0, colour: blu }
				],
				[
					{ col: 1, row: 1, colour: grn },
					{ col: 2, row: 1, colour: grn },
					{ col: 3, row: 1, colour: grn },
					{ col: 3, row: 0, colour: grn }
				],
				[
					{ col: 1, row: 2, colour: red },
					{ col: 2, row: 2, colour: red }
				],
				[
					{ col: 2, row: 3, colour: grn }
				]
			]
			expect(chain_puyos).to.deep.equalInAnyOrder(expectedResult);
		});

		it('should filter out connections below minLength', function() {
			const boardState = [
				[blu, red, blu],
				[blu, grn, red],
				[blu, grn, red, grn],
				[grn, grn],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const chain_puyos = board.getConnections(3);

			const expectedResult = [
				[
					{ col: 0, row: 0, colour: blu },
					{ col: 1, row: 0, colour: blu },
					{ col: 2, row: 0, colour: blu }
				],
				[
					{ col: 1, row: 1, colour: grn },
					{ col: 2, row: 1, colour: grn },
					{ col: 3, row: 1, colour: grn },
					{ col: 3, row: 0, colour: grn }
				]
			]
			expect(chain_puyos).to.deep.equalInAnyOrder(expectedResult);
		});
	});

	describe('resolveChains', function() {
		it('should not resolve with no chains', function() {
			const boardState = [
				[red, red, blu],
				[blu, grn, red],
				[blu, grn, red, grn],
				[red, red, blu],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const puyos_chained = board.resolveChains();

			expect(puyos_chained).to.deep.equal([]);
		});

		it('can resolve simple chains', function() {
			const boardState = [
				[red, grn, red],
				[red, grn, grn],
				[red, grn, blu],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const puyos_chained = board.resolveChains();

			const expectedResult = [
				[
					{ col: 0, row: 1, colour: grn },
					{ col: 1, row: 1, colour: grn },
					{ col: 1, row: 2, colour: grn },
					{ col: 2, row: 1, colour: grn },
				],
				[
					{ col: 0, row: 0, colour: red },
					{ col: 0, row: 1, colour: red },
					{ col: 1, row: 0, colour: red },
					{ col: 2, row: 0, colour: red },
				],
			];

			expect(puyos_chained).to.deep.equalInAnyOrder(expectedResult);
		});

		it('can resolve powered chains', function() {
			const boardState = [
				[red, grn, grn, grn],
				[red, grn, red, grn],
				[red, red, blu],
				[blu, blu],
				[blu],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const puyos_chained = board.resolveChains();

			const expectedResult = [
				[
					{ col: 0, row: 0, colour: red },
					{ col: 1, row: 0, colour: red },
					{ col: 2, row: 0, colour: red },
					{ col: 2, row: 1, colour: red },
					{ col: 0, row: 1, colour: grn },
					{ col: 0, row: 2, colour: grn },
					{ col: 0, row: 3, colour: grn },
					{ col: 1, row: 1, colour: grn },
					{ col: 1, row: 3, colour: grn }
				],
				[
					{ col: 2, row: 0, colour: blu },
					{ col: 3, row: 0, colour: blu },
					{ col: 3, row: 1, colour: blu },
					{ col: 4, row: 0, colour: blu },
				]
			];
		});

		it('can resolve chains with nuisance', function() {
			const boardState = [
				[red, nui, grn, nui, red],
				[red, grn, grn],
				[red, grn, blu],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const puyos_chained = board.resolveChains();

			const expectedResult = [
				[
					{ col: 0, row: 2, colour: grn },
					{ col: 1, row: 1, colour: grn },
					{ col: 1, row: 2, colour: grn },
					{ col: 2, row: 1, colour: grn },
				],
				[
					{ col: 0, row: 0, colour: red },
					{ col: 0, row: 1, colour: red },
					{ col: 1, row: 0, colour: red },
					{ col: 2, row: 0, colour: red },
				],
			];

			expect(puyos_chained).to.deep.equalInAnyOrder(expectedResult);
		});

		it('should not resolve groups of nuisance', function() {
			const boardState = [
				[nui, nui, grn, blu],
				[nui, nui, grn],
				[],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const puyos_chained = board.resolveChains();

			expect(puyos_chained).to.deep.equal([]);
		});
	});

	describe('findNuisancePopped', function() {
		it('should be able to find the nuisance popped', function() {
			const boardState = [
				[],
				[nui, nui],
				[nui, red, red, red, red, nui],
				[nui, nui, nui],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const current_chain_puyos = [
					{ col: 2, row: 1, colour: red },
					{ col: 2, row: 2, colour: red },
					{ col: 2, row: 3, colour: red },
					{ col: 2, row: 4, colour: red }
			];
			const nuisancePopped = board.findNuisancePopped(current_chain_puyos);

			const expectedResult = [
				{ col: 1, row: 1 },
				{ col: 2, row: 0 },
				{ col: 2, row: 5 },
				{ col: 3, row: 1 },
				{ col: 3, row: 2 },
			];

			expect(nuisancePopped).to.deep.equalInAnyOrder(expectedResult);
		});
	});

	describe('dropNuisance', function() {
		it('should be able to drop less than a rock', function() {
			const boardState = [
				[],
				[],
				[red],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const { nuisanceDropped, nuisanceArray } = board.dropNuisance(10);

			let total_nuisance = 0;

			nuisanceArray.forEach(col => {
				expect(col.length).to.be.above(0);
				total_nuisance += col.length;
			});

			expect(nuisanceDropped).to.equal(10);
			expect(total_nuisance).to.equal(10);
		});

		it('should be able to drop a rock', function() {
			const boardState = [
				[],
				[],
				[red],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const { nuisanceDropped, nuisanceArray } = board.dropNuisance(40);

			let total_nuisance = 0;

			nuisanceArray.forEach(col => {
				expect(col.length).to.equal(5);
				total_nuisance += col.length;
			});

			expect(nuisanceDropped).to.equal(30);
			expect(total_nuisance).to.equal(30);
		});
	});
});

describe('Utils.js', function() {
	describe('Settings', function() {
		it('should be able to transform into a string and back', function() {
			const settings1 = new Settings();
			const settings2 = Settings.fromString(settings1.toString());

			expect(settings1).excluding(['timer', 'seed']).to.deep.equal(settings2);
		});

		it('checkMarginTime - should not change target points before margin time', function() {
			const settings = new Settings();
			const startTime = settings.timer;
			const targetPoints = settings.targetPoints;

			settings.checkMarginTime(startTime + 32000);

			expect(settings.targetPoints).to.equal(targetPoints);
			expect(settings.timer).to.equal(startTime);
		});

		it('checkMarginTime - should update target points correctly jumping into margin time', function() {
			const settings = new Settings();
			const startTime = settings.timer;
			const targetPoints = settings.targetPoints;

			// Start margin time and incrment twice
			settings.checkMarginTime(startTime + (96001 + 32000));
			const expectedResult = Math.floor(Math.floor(Math.floor(targetPoints * 0.75) / 2) / 2);

			expect(settings.targetPoints).to.equal(expectedResult);
			expect(settings.timer).to.equal(startTime + (96000 + 32000));
		});

		it('checkMarginTime - should update target points correctly incrementing margin time', function() {
			const settings = new Settings();
			const startTime = settings.timer;
			const targetPoints = settings.targetPoints;

			// Start margin time
			const midTime1 = startTime + 96001;
			settings.checkMarginTime(midTime1);
			const expectedResultMid = Math.floor(targetPoints * 0.75);

			expect(settings.targetPoints).to.equal(expectedResultMid);
			expect(settings.timer).to.equal(midTime1 - 1);

			// Margin time has started, but not yet re-incremented
			const midTime2 = midTime1 + 9000;
			settings.checkMarginTime(midTime2);

			expect(settings.targetPoints).to.equal(expectedResultMid);
			expect(settings.timer).to.equal(midTime1 - 1);

			// Margin time has started and incremented once
			const finalTime = midTime2 + 8001;
			settings.checkMarginTime(finalTime);
			const expectedResultFinal = Math.floor(expectedResultMid / 2);

			expect(settings.targetPoints).to.equal(expectedResultFinal);
			expect(settings.timer).to.equal(midTime1 + 16000 - 1);
		});
	});

	describe('getOtherPuyo', function() {
		it('should retrieve the correct location of a Tsu schezo', function() {
			// Set the arle at (1, 1) with standardAngle 0 deg
			const drop1 = new Drop('I', [red, blu], settings, { x: 1, y: 1}, undefined, 0);
			const schezo1 = Utils.getOtherPuyo(drop1);

			expect(schezo1).to.deep.equal({ x: 1, y: 2});

			// Set the arle at (1, 1) with standardAngle 120 deg
			const drop2 = new Drop('I', [red, blu], settings, { x: 1, y: 1}, undefined, 120);
			const schezo2 = Utils.getOtherPuyo(drop2);

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
				{ col: 0, row: 2 },
				{ col: 0, row: 3 },		// popped nuisance
				{ col: 1, row: 1 },
				{ col: 1, row: 2 },
				{ col: 2, row: 1 }
			];
			const dropFrames = Utils.getDropFrames(poppingLocs, boardState, settings);
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
				{ col: 0, row: 0 },
				{ col: 0, row: 1 },
				{ col: 1, row: 0 },
				{ col: 2, row: 0 }
			];
			const dropFrames = Utils.getDropFrames(poppingLocs, boardState, settings);
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
				{ col: 0, row: 2 },
				{ col: 0, row: 3 },		//popped nuisance
				{ col: 1, row: 1 },
				{ col: 1, row: 2 },
				{ col: 2, row: 1 }
			];
			const dropFrames = Utils.getDropFrames(poppingLocs, boardState, settings);
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
			const score = Utils.calculateScore(puyos, 2);
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
				{ colour: blu}
			];
			// 9 puyos together as the 4th chain
			const score = Utils.calculateScore(puyos, 4);
			expect(score).to.equal(90 * 37);
		});
	});
});