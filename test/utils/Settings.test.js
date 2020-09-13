'use strict';

/*eslint-env mocha */

const chaiExclude = require('chai-exclude');
const { expect } = require('chai').use(chaiExclude);

const { Settings } = require('../../src/utils/Settings.js');

describe('Settings.js', function() {
	describe('Settings', function() {
		it('should be able to transform into a string and back', function() {
			const settings1 = new Settings();
			const settings2 = Settings.fromString(settings1.toString());

			expect(settings1).excluding(['timer', 'seed']).to.deep.equal(settings2);
		});

		it('checkMarginTime - should not change target points before margin time', function() {
			const settings2 = new Settings();
			const startTime = settings2.timer;
			const targetPoints = settings2.targetPoints;

			settings2.checkMarginTime(startTime + 32000);

			expect(settings2.targetPoints).to.equal(targetPoints);
			expect(settings2.timer).to.equal(startTime);
		});

		it('checkMarginTime - should update target points correctly jumping into margin time', function() {
			const settings2 = new Settings();
			const startTime = settings2.timer;
			const targetPoints = settings2.targetPoints;

			// Start margin time and incrment twice
			settings2.checkMarginTime(startTime + (96001 + 32000));
			const expectedResult = Math.floor(Math.floor(Math.floor(targetPoints * 0.75) / 2) / 2);

			expect(settings2.targetPoints).to.equal(expectedResult);
			expect(settings2.timer).to.equal(startTime + (96000 + 32000));
		});

		it('checkMarginTime - should update target points correctly incrementing margin time', function() {
			const settings2 = new Settings();
			const startTime = settings2.timer;
			const targetPoints = settings2.targetPoints;

			// Start margin time
			const midTime1 = startTime + 96001;
			settings2.checkMarginTime(midTime1);
			const expectedResultMid = Math.floor(targetPoints * 0.75);

			expect(settings2.targetPoints).to.equal(expectedResultMid);
			expect(settings2.timer).to.equal(midTime1 - 1);

			// Margin time has started, but not yet re-incremented
			const midTime2 = midTime1 + 9000;
			settings2.checkMarginTime(midTime2);

			expect(settings2.targetPoints).to.equal(expectedResultMid);
			expect(settings2.timer).to.equal(midTime1 - 1);

			// Margin time has started and incremented once
			const finalTime = midTime2 + 8001;
			settings2.checkMarginTime(finalTime);
			const expectedResultFinal = Math.floor(expectedResultMid / 2);

			expect(settings2.targetPoints).to.equal(expectedResultFinal);
			expect(settings2.timer).to.equal(midTime1 + 16000 - 1);
		});
	});
});
