'use strict';

/*eslint-env mocha */

const { expect } = require('chai');

const { CpuVariants } = require('../../src/cpu/CpuVariants.js');
const { Settings } = require('../../src/utils/Settings.js');

const cpu = CpuVariants.fromString('Random', new Settings());

const red = 1;
const grn = 2;
const blu = 3;

describe('Cpu.js', function() {
	describe('checkForSimpleChains', function() {
		it('should return -1 when no chains are found', function() {
			const boardState = [
				[red, red],
				[blu],
				[],
				[blu, grn],
				[],
				[]
			];
			const currentDrop = { colours: [blu, grn] };
			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 0);

			expect(col).to.equal(-1);
			expect(rotations).to.equal(-1);
		});

		it('should return -1 when no chains long enough are found', function() {
			const boardState = [
				[red, blu, blu],
				[red, blu, red],
				[grn, red],
				[],
				[],
				[]
			];
			const currentDrop = { colours: [blu, grn] };
			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 3);

			expect(col).to.equal(-1);
			expect(rotations).to.equal(-1);
		});

		it('should return the correct result when a chain is found - no rotation', function() {
			const boardState = [
				[red, blu, blu],	// answer: blu, grn
				[red, blu, red],
				[grn, red, grn],
				[grn],
				[grn],
				[]
			];
			const currentDrop = { colours: [blu, grn] };

			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 3);

			expect(col).to.equal(0);
			expect(rotations).to.equal(0);
		});

		it('should return the correct result when a chain is found - with rotation', function() {
			const boardState = [
				[red],
				[blu],
				[],
				[blu, grn],
				[grn, red, grn],
				[grn, red, red]		// answer: red, grn
			];
			const currentDrop = { colours: [grn, red] };
			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 1);

			expect(col).to.equal(5);
			expect(rotations).to.equal(2);
		});

		it('should return the more powerful chain', function() {
			const boardState = [
				[red, red, red],		// incorrect answer: red, blu (this is weaker)
				[blu],
				[blu],
				[blu, grn],
				[grn, red, grn, grn],
				[grn, red, red]			// answer: red, blu
			];
			const currentDrop = { colours: [blu, red] };
			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 2);

			expect(col).to.equal(5);
			expect(rotations).to.equal(2);
		});

		it('should return the longer chain', function() {
			const boardState = [
				[red, red, red],	// answer: red, blu (this is a 3-chain)
				[blu],
				[blu],
				[blu, grn, grn],
				[grn, red, grn],
				[grn, red, red]		// incorrect answer: red, blu (this is a 2-chain)
			];
			const currentDrop = { colours: [blu, red] };
			const { col, rotations } = cpu.checkForSimpleChains(boardState, currentDrop, 1);

			expect(col).to.equal(0);
			expect(rotations).to.equal(2);
		});
	});

	describe('checkForAllChains', function() {
		it('should return -1 when no chains are found', function() {
			const boardState = [
				[red, red],
				[blu],
				[],
				[blu, grn],
				[],
				[red]
			];
			const currentDrop = { colours: [blu, grn] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 0);

			expect(col).to.equal(-1);
			expect(rotations).to.equal(-1);
		});

		it('should return -1 when no chains long enough are found', function() {
			const boardState = [
				[red, blu, blu],
				[red, blu, red],
				[grn, red],
				[],
				[],
				[]
			];
			const currentDrop = { colours: [blu, grn] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 3);

			expect(col).to.equal(-1);
			expect(rotations).to.equal(-1);
		});

		it('should return the correct result when a chain is found - no rotation', function() {
			const boardState = [
				[red, red],
				[blu, blu],
				[],					// answer: blu, grn
				[blu, grn, red],
				[grn],
				[grn]
			];
			const currentDrop = { colours: [blu, grn] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 0);

			expect(col).to.equal(2);
			expect(rotations).to.equal(0);
		});

		it('should return the correct result when a chain is found - CW rotation', function() {
			const boardState = [
				[red, red],
				[red],
				[],				// answer: red
				[],				// answer: blu
				[blu],
				[blu, blu]
			];
			const currentDrop = { colours: [red, blu] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 0);

			expect(col).to.equal(2);
			expect(rotations).to.equal(1);
		});

		it('should return the correct result when a chain is found - double rotation', function() {
			const boardState = [
				[red, red],
				[grn],
				[],
				[],				// answer: blu, red
				[blu, red],
				[blu, blu, red, red]
			];
			const currentDrop = { colours: [red, blu] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 0);

			expect(col).to.equal(3);
			expect(rotations).to.equal(2);
		});

		it('should return the correct result when a chain is found - CCW rotation', function() {
			const boardState = [
				[grn, grn, blu, red, red, red],
				[grn, blu],			// answer: red
				[],					// answer: grn
				[],
				[],
				[blu]
			];
			const currentDrop = { colours: [grn, red] };
			const { col, rotations } = cpu.checkForAllChains(boardState, currentDrop, 0);

			expect(col).to.equal(2);
			expect(rotations).to.equal(-1);
		});
	});
});
