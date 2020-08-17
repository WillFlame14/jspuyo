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

	const { gamesTracked, buildOrder, buildSpeed, chainScores, splitPuyos, finesse } = stats;

	document.getElementById('gamesTracked').innerHTML = `Games tracked: ${gamesTracked}`;

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
		chartPadding: { left: 35, top: 35, bottom: 0 },
		high: 100,
		axisX: {
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 55
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 60
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Drop Number",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: 50
					}
				},
				axisY: {
					axisTitle: "Percentage (%)",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: -15
					}
				}
			})
		]
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
		chartPadding: { left: 35, bottom: 5 },
		axisX: {
			showGrid: false,
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 55
		},
		axisY: {
			showGrid: false,
			labelInterpolationFnc: (value, index) => (index % 3 === 0 ? value : null),
			offset: 70
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Drop Number",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: 50
					}
				},
				axisY: {
					axisTitle: "Percentage (%)",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: -15
					}
				}
			})
		]
	};
	new Chartist.Line('#buildOrderData', buildOrderData, buildOrderOptions);

	const buildSpeedSeries = [];

	buildSpeed.forEach(frames => {
		// Don't include drop numbers that have no data yet
		if(frames.length === 0) {
			return;
		}
		const totalFrames = frames.reduce((total = 0, current = 0) => total += current);

		buildSpeedSeries.push(totalFrames / frames.length / 60 * 1000);
	});

	const buildSpeedData = {
		labels: Array.from(new Array(buildSpeedSeries.length + 1).keys()),
		series: [buildSpeedSeries]
	};

	const buildSpeedOptions = {
		fullWidth: true,
		low: 0,
		chartPadding: { left: 35, bottom: 5 },
		axisX: {
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 55
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 75
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Drop Number",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: 55
					}
				},
				axisY: {
					axisTitle: "Time (ms)",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: -15
					}
				}
			})
		]
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
		chartPadding: { left: 35, bottom: 5 },
		low: 0,
		axisX: {
			offset: 55
		},
		axisY: {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
			offset: 85
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Drop Number",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: 55
					}
				},
				axisY: {
					axisTitle: "Score (pts)",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: -15
					}
				}
			})
		]
	};
	new Chartist.Line('#chainScoresData', chainScoresData, chainScoresOptions);

	const finesseDist = {};

	Object.keys(finesse).forEach(date => {
		Object.keys(finesse[date]).forEach(fault => {
			if(finesseDist[fault] === undefined) {
				finesseDist[fault] = finesse[date][fault];
			}
			else {
				finesseDist[fault] += finesse[date][fault];
			}
		});
	});

	const finesseFaultData = {
		labels: Object.keys(finesseDist),
		series: Object.keys(finesseDist).map(fault => finesseDist[fault])
	};

	const totalFaults = finesseFaultData.series.reduce((total, current) => total += current);

	const finesseFaultOptions = {
		// fullWidth: true,
		chartPadding: 35,
		labelOffset: 35,
		labelInterpolationFnc: (value, index) => {
			return `${Math.round(100 * finesseFaultData.series[index].value / totalFaults)}%`;
		},
		plugins: [Chartist.plugins.legend()]
	};
	new Chartist.Pie('#finesseFaultData', finesseFaultData, finesseFaultOptions);

	const finesseSeries = [];
	Object.keys(finesse).forEach(date => {
		const faults = finesse[date];
		let allFaults = 0;

		Object.keys(faults).forEach(fault => {
			allFaults += faults[fault];
		});

		finesseSeries.push(allFaults);
	});

	const finesseData = {
		labels: Object.keys(finesse),
		series: [finesseSeries]
	};

	const finesseOptions = {
		showLine: false,
		chartPadding: 35,
		axisX: {
			labelInterpolationFnc: (value) => {
				const date = new Date(Number(value));
				return date.toLocaleDateString();
			}
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Date",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: 55
					}
				},
				axisY: {
					axisTitle: "Finesse Faults",
					axisClass: "ct-axis-title",
					offset: {
						x: 0,
						y: -15
					}
				}
			})
		]
	};
	new Chartist.Line('#finesseData', finesseData, finesseOptions);
}

pageInit();

module.exports = {
	pageInit
};
