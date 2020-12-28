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
					{ x: 0, y: 0, colour: red, connections: ['Up'] },
					{ x: 0, y: 1, colour: red, connections: ['Down'] }
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
					{ x: 0, y: 0, colour: red, connections: ['Up'] },
					{ x: 0, y: 1, colour: red, connections: ['Down'] }
				],
				[
					{ x: 0, y: 2, colour: blu, connections: [] },
				],
				[
					{ x: 1, y: 0, colour: blu, connections: ['Right'] },
					{ x: 2, y: 0, colour: blu, connections: ['Left'] }
				],
				[
					{ x: 1, y: 1, colour: grn, connections: ['Right'] },
					{ x: 2, y: 1, colour: grn, connections: ['Left', 'Right'] },
					{ x: 3, y: 1, colour: grn, connections: ['Left', 'Down'] },
					{ x: 3, y: 0, colour: grn, connections: ['Up'] }
				],
				[
					{ x: 1, y: 2, colour: red, connections: ['Right'] },
					{ x: 2, y: 2, colour: red, connections: ['Left'] }
				],
				[
					{ x: 2, y: 3, colour: grn, connections: [] }
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
					{ x: 0, y: 0, colour: blu, connections: ['Right'] },
					{ x: 1, y: 0, colour: blu, connections: ['Left', 'Right'] },
					{ x: 2, y: 0, colour: blu, connections: ['Left'] }
				],
				[
					{ x: 1, y: 1, colour: grn, connections: ['Right'] },
					{ x: 2, y: 1, colour: grn, connections: ['Left', 'Right'] },
					{ x: 3, y: 1, colour: grn, connections: ['Left', 'Down'] },
					{ x: 3, y: 0, colour: grn, connections: ['Up'] }
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
					{ x: 0, y: 0, colour: red, connections: ['Up', 'Right'] },
					{ x: 0, y: 1, colour: red, connections: ['Down', 'Right'] },
					{ x: 1, y: 0, colour: red, connections: ['Left', 'Up', 'Right'] },
					{ x: 1, y: 1, colour: red, connections: ['Left', 'Down'] },
					{ x: 2, y: 0, colour: red, connections: ['Left'] }
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
					{ x: 0, y: 1, colour: grn, connections: ['Right'] },
					{ x: 1, y: 1, colour: grn, connections: ['Left', 'Up', 'Right'] },
					{ x: 1, y: 2, colour: grn, connections: ['Down'] },
					{ x: 2, y: 1, colour: grn, connections: ['Left'] },
				],
				[
					{ x: 0, y: 0, colour: red, connections: ['Right', 'Up'] },
					{ x: 0, y: 1, colour: red, connections: ['Down'] },
					{ x: 1, y: 0, colour: red, connections: ['Left', 'Right'] },
					{ x: 2, y: 0, colour: red, connections: ['Left'] },
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
					{ x: 0, y: 0, colour: red, connections: ['Right'] },
					{ x: 1, y: 0, colour: red, connections: ['Left', 'Right'] },
					{ x: 2, y: 0, colour: red, connections: ['Left', 'Up'] },
					{ x: 2, y: 1, colour: red, connections: ['Down'] },
					{ x: 0, y: 1, colour: grn, connections: ['Right', 'Up'] },
					{ x: 0, y: 2, colour: grn, connections: ['Up', 'Down'] },
					{ x: 0, y: 3, colour: grn, connections: ['Down', 'Right'] },
					{ x: 1, y: 1, colour: grn, connections: ['Left'] },
					{ x: 1, y: 3, colour: grn, connections: ['Left'] }
				],
				[
					{ x: 2, y: 0, colour: blu, connections: ['Right'] },
					{ x: 3, y: 0, colour: blu, connections: ['Left', 'Up', 'Right'] },
					{ x: 3, y: 1, colour: blu, connections: ['Down'] },
					{ x: 4, y: 0, colour: blu, connections: ['Left'] },
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
					{ x: 0, y: 2, colour: grn, connections: ['Right'] },
					{ x: 1, y: 1, colour: grn, connections: ['Up', 'Right'] },
					{ x: 1, y: 2, colour: grn, connections: ['Left', 'Down'] },
					{ x: 2, y: 1, colour: grn, connections: ['Left'] },
				],
				[
					{ x: 0, y: 0, colour: red, connections: ['Right', 'Up'] },
					{ x: 0, y: 1, colour: red, connections: ['Down'] },
					{ x: 1, y: 0, colour: red, connections: ['Left', 'Right'] },
					{ x: 2, y: 0, colour: red, connections: ['Left'] },
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
				{ x: 2, y: 1, colour: red },
				{ x: 2, y: 2, colour: red },
				{ x: 2, y: 3, colour: red },
				{ x: 2, y: 4, colour: red }
			];
			const nuisancePopped = board.findNuisancePopped(current_chain_puyos);

			const expectedResult = [
				{ x: 1, y: 1, colour: nui },
				{ x: 2, y: 0, colour: nui },
				{ x: 2, y: 5, colour: nui },
				{ x: 3, y: 1, colour: nui },
				{ x: 3, y: 2, colour: nui },
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

			nuisanceArray.forEach(x => {
				expect(x.length).to.be.above(0);
				total_nuisance += x.length;
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

			nuisanceArray.forEach(x => {
				expect(x.length).to.equal(5);
				total_nuisance += x.length;
			});

			expect(nuisanceAmount).to.equal(30);
			expect(total_nuisance).to.equal(30);
		});
	});
});
