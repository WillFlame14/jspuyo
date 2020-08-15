'use strict';

const path = require('path');
const { Chartist } = window;

const backgrounds = [
	'forest.jpg',
	'forest2.jpg',
	'winter.jpg',
	'wildlife.jpg'
];

function pageInit() {
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	const address = path.join(__dirname, '..', '..', 'images', 'backgrounds', background);
	document.documentElement.style.backgroundImage = 'url("' + address + '")';

	document.getElementById('logo').onclick = function() {
		window.location.assign('/about');
	};

	// Create charts for gallery
	if(window.location.pathname === '/gallery/') {
		createCharts();
	}
}

function createCharts() {
	const statsString = window.localStorage.getItem('stats');
	let stats;

	try {
		stats = JSON.parse(statsString);
	}
	catch(err) {
		console.log(`Could not parse statsString: ${statsString}`);
		console.log(err);
		localStorage.removeItem('stats');
		return;
	}

	const { buildOrder, buildSpeed, chainScores, splitPuyos } = stats;

	let splitDataMax = -1;
	let splitDataSeries = splitPuyos.map((dropNumData, index) => {
		const totalDrops = dropNumData.split + dropNumData.nonsplit;
		if(totalDrops === 0) {
			if(splitDataMax === -1 && index > 0) {
				splitDataMax = index;
			}
			return 0;
		}
		return 100 * dropNumData.split / totalDrops;
	});

	splitDataSeries = splitDataSeries.slice(0, splitDataMax);

	const splitData = {
		labels: Array.from(new Array(splitDataMax).keys()),
		series: [splitDataSeries]
	};
	const splitDataOptions = {
		fullWidth: true,
		chartPadding: 20,
		axisX: {
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 50
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 30
		}
	};
	new Chartist.Line('#splitData', splitData, splitDataOptions);

	const buildOrderSeries = [[], [], [], [], [], []];
	let buildOrderMax = -1;

	buildOrder.map((dropNumData, index) => {
		// First, get the total puyos dropped for a certain drop number
		const totalPuyos = dropNumData.reduce((total, currentValue) => total + currentValue);

		// Do not include values where there is no data
		if(totalPuyos === 0 && index > 1) {
			if(buildOrderMax === -1) {
				buildOrderMax = index;
			}
			return;
		}

		// Generate the stacked line series
		let runningPercentage = 0;
		dropNumData.forEach((puyos, column) => {
			const percentage = 100 * puyos / totalPuyos;
			buildOrderSeries[column].push(runningPercentage + percentage);
			runningPercentage += percentage;
		});
	});

	// Reverse the series so that the tallest series gets drawn first (gets covered by closer series)
	buildOrderSeries.reverse();

	const buildOrderData = {
		labels: Array.from(new Array(buildOrderMax).keys()),
		series: buildOrderSeries
	};

	const buildOrderOptions = {
		showPoint: false,
		showArea: true,
		high: 100,
		chartPadding: 20,
		axisX: {
			showGrid: false,
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 50
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 40
		}
	};
	new Chartist.Line('#buildOrderData', buildOrderData, buildOrderOptions);

	const buildSpeedSeries = [];

	buildSpeed.forEach(frames => {
		// Don't include drop numbers that have no data yet
		if(frames.length === 0) {
			return;
		}
		const totalFrames = frames.reduce((total = 0, current = 0) => total += current);

		buildSpeedSeries.push(totalFrames / frames.length);
	});

	const buildSpeedData = {
		labels: Array.from(new Array(buildSpeedSeries.length + 1).keys()),
		series: [buildSpeedSeries]
	};

	const buildSpeedOptions = {
		low: 0,
		chartPadding: 20,
		axisX: {
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 50
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 40
		}
	};
	new Chartist.Line('#buildSpeedData', buildSpeedData, buildSpeedOptions);

	const chainScoresSeries = [[], []];

	chainScores.forEach(scores => {
		let totalScore = 0;
		let maxScore = -1;
		scores.forEach(score => {
			if(score > maxScore) {
				maxScore = score;
			}
			totalScore += score;
		});
		if(totalScore === 0) {
			return;
		}
		chainScoresSeries[0].push(totalScore / chainScores.length);		// Average score
		chainScoresSeries[1].push(maxScore);								// Max score
	});

	const chainScoresData = {
		labels: Array.from(new Array(chainScoresSeries[0].length).keys()),
		series: chainScoresSeries
	};

	const chainScoresOptions = {
		fullWidth: true,
		chartPadding: 20,
		low: 0,
		axisX: {
			offset: 40
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 60
		}
	};
	new Chartist.Line('#chainScoresData', chainScoresData, chainScoresOptions);
}

pageInit();

module.exports = {
	pageInit
};
