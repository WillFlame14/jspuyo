'use strict';

/*eslint-env mocha */

const deepEqualInAnyOrder = require('deep-equal-in-any-order');
const { expect } = require('chai').use(deepEqualInAnyOrder);

const { Board } = require('../src/Board.js');
const { Settings } = require('../src/utils/Settings.js');

const red = 1;
const grn = 2;
const blu = 3;
const nui = 0;

describe('Board.js', function() {
	describe('getConnections', function() {
		it('should return no connections with empty board', function() {
			const board = new Board(new Settings());

			const chain_puyos = board.getConnections();
			expect(chain_puyos).to.deep.equal([]);
		});

		it('should return extremely small connections', function() {
			const boardState = [
				[red, red],
				[],
				[],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const chain_puyos = board.getConnections();

			const expectedResult = [
				[
					{ col: 0, row: 0, colour: red, connections: ['Up'] },
					{ col: 0, row: 1, colour: red, connections: ['Down'] }
				]
			];
			expect(chain_puyos).to.deep.equalInAnyOrder(expectedResult);
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
					{ col: 0, row: 0, colour: red, connections: ['Up'] },
					{ col: 0, row: 1, colour: red, connections: ['Down'] }
				],
				[
					{ col: 0, row: 2, colour: blu, connections: [] },
				],
				[
					{ col: 1, row: 0, colour: blu, connections: ['Right'] },
					{ col: 2, row: 0, colour: blu, connections: ['Left'] }
				],
				[
					{ col: 1, row: 1, colour: grn, connections: ['Right'] },
					{ col: 2, row: 1, colour: grn, connections: ['Left', 'Right'] },
					{ col: 3, row: 1, colour: grn, connections: ['Left', 'Down'] },
					{ col: 3, row: 0, colour: grn, connections: ['Up'] }
				],
				[
					{ col: 1, row: 2, colour: red, connections: ['Right'] },
					{ col: 2, row: 2, colour: red, connections: ['Left'] }
				],
				[
					{ col: 2, row: 3, colour: grn, connections: [] }
				]
			];
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
					{ col: 0, row: 0, colour: blu, connections: ['Right'] },
					{ col: 1, row: 0, colour: blu, connections: ['Left', 'Right'] },
					{ col: 2, row: 0, colour: blu, connections: ['Left'] }
				],
				[
					{ col: 1, row: 1, colour: grn, connections: ['Right'] },
					{ col: 2, row: 1, colour: grn, connections: ['Left', 'Right'] },
					{ col: 3, row: 1, colour: grn, connections: ['Left', 'Down'] },
					{ col: 3, row: 0, colour: grn, connections: ['Up'] }
				]
			];
			expect(chain_puyos).to.deep.equalInAnyOrder(expectedResult);
		});

		it('should return circular connections', function() {
			const boardState = [
				[red, red],
				[red, red],
				[red],
				[],
				[],
				[]
			];

			const board = new Board(new Settings(), boardState);
			const chain_puyos = board.getConnections();

			const expectedResult = [
				[
					{ col: 0, row: 0, colour: red, connections: ['Up', 'Right'] },
					{ col: 0, row: 1, colour: red, connections: ['Down', 'Right'] },
					{ col: 1, row: 0, colour: red, connections: ['Left', 'Up', 'Right'] },
					{ col: 1, row: 1, colour: red, connections: ['Left', 'Down'] },
					{ col: 2, row: 0, colour: red, connections: ['Left'] }
				]
			];
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
					{ col: 0, row: 1, colour: grn, connections: ['Right'] },
					{ col: 1, row: 1, colour: grn, connections: ['Left', 'Up', 'Right'] },
					{ col: 1, row: 2, colour: grn, connections: ['Down'] },
					{ col: 2, row: 1, colour: grn, connections: ['Left'] },
				],
				[
					{ col: 0, row: 0, colour: red, connections: ['Right', 'Up'] },
					{ col: 0, row: 1, colour: red, connections: ['Down'] },
					{ col: 1, row: 0, colour: red, connections: ['Left', 'Right'] },
					{ col: 2, row: 0, colour: red, connections: ['Left'] },
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
					{ col: 0, row: 0, colour: red, connections: ['Right'] },
					{ col: 1, row: 0, colour: red, connections: ['Left', 'Right'] },
					{ col: 2, row: 0, colour: red, connections: ['Left', 'Up'] },
					{ col: 2, row: 1, colour: red, connections: ['Down'] },
					{ col: 0, row: 1, colour: grn, connections: ['Right', 'Up'] },
					{ col: 0, row: 2, colour: grn, connections: ['Up', 'Down'] },
					{ col: 0, row: 3, colour: grn, connections: ['Down', 'Right'] },
					{ col: 1, row: 1, colour: grn, connections: ['Left'] },
					{ col: 1, row: 3, colour: grn, connections: ['Left'] }
				],
				[
					{ col: 2, row: 0, colour: blu, connections: ['Right'] },
					{ col: 3, row: 0, colour: blu, connections: ['Left', 'Up', 'Right'] },
					{ col: 3, row: 1, colour: blu, connections: ['Down'] },
					{ col: 4, row: 0, colour: blu, connections: ['Left'] },
				]
			];

			expect(puyos_chained).to.deep.equalInAnyOrder(expectedResult);
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
					{ col: 0, row: 2, colour: grn, connections: ['Right'] },
					{ col: 1, row: 1, colour: grn, connections: ['Up', 'Right'] },
					{ col: 1, row: 2, colour: grn, connections: ['Left', 'Down'] },
					{ col: 2, row: 1, colour: grn, connections: ['Left'] },
				],
				[
					{ col: 0, row: 0, colour: red, connections: ['Right', 'Up'] },
					{ col: 0, row: 1, colour: red, connections: ['Down'] },
					{ col: 1, row: 0, colour: red, connections: ['Left', 'Right'] },
					{ col: 2, row: 0, colour: red, connections: ['Left'] },
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
				{ col: 1, row: 1, colour: nui },
				{ col: 2, row: 0, colour: nui },
				{ col: 2, row: 5, colour: nui },
				{ col: 3, row: 1, colour: nui },
				{ col: 3, row: 2, colour: nui },
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
			const { nuisanceAmount, nuisanceArray } = board.dropNuisance(10);

			let total_nuisance = 0;

			nuisanceArray.forEach(col => {
				expect(col.length).to.be.above(0);
				total_nuisance += col.length;
			});

			expect(nuisanceAmount).to.equal(10);
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
			const { nuisanceAmount, nuisanceArray } = board.dropNuisance(40);

			let total_nuisance = 0;

			nuisanceArray.forEach(col => {
				expect(col.length).to.equal(5);
				total_nuisance += col.length;
			});

			expect(nuisanceAmount).to.equal(30);
			expect(total_nuisance).to.equal(30);
		});
	});
});
