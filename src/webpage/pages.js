'use strict';

const path = require('path');
const { Chartist } = window;

const backgrounds = [
	'forest.jpg',
	'forest2.jpg',
	'winter.jpg',
	'wildlife.jpg'
];

let selectedVariableGames = -1;

function pageInit() {
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	const address = path.join(__dirname, '..', '..', 'images', 'backgrounds', background);
	document.documentElement.style.backgroundImage = 'url("' + address + '")';

	document.getElementById('logo').onclick = function() {
		window.location.assign('/about');
	};

	// Initialize event listeners for the variable game options
	document.querySelectorAll('.variableGameOption').forEach(element => {
		element.onclick = function() {
			// Turn off the old selected option
			document.getElementById(`${selectedVariableGames}games`).classList.remove('selected');

			// All ids are in the form "##games"
			selectedVariableGames = element.id.substring(0, element.id.length - 5);
			createCharts(selectedVariableGames);
			element.classList.add('selected');
		};
	});

	// Create charts for gallery
	if(window.location.pathname === '/gallery/') {
		initCharts();
		createCharts(-1);
	}
}

let stats;

function initCharts() {
	const statsString = window.localStorage.getItem('stats');

	try {
		stats = JSON.parse(statsString);
	}
	catch(err) {
		console.log(`Could not parse statsString: ${statsString}`);
		console.log(err);
		localStorage.removeItem('stats');
		return;
	}

	document.getElementById('gamesTracked').innerHTML = `Games tracked: ${Object.keys(stats).length}`;

	if(Object.keys(stats).length < 5) {
		document.getElementById('insufficientData').style.display = 'block';
		document.getElementById('variableGames').style.display = 'none';
		document.getElementById('chartsWrapper').style.display = 'none';
		return;
	}

	document.getElementById('insufficientData').style.display = 'none';
	document.getElementById('variableGames').style.display = 'flex';
	document.getElementById('chartsWrapper').style.display = 'block';
}

const charts = {};

/**
 * Generates all the charts on screen based on the game range.
 * @param  {Number} gameRange Number of previous games included. A value of -1 means all games will be included.
 * @return {undefined}
 */
function createCharts(gameRange = -1) {
	let includedGameKeys;

	// All games
	if(gameRange === -1) {
		includedGameKeys = Object.keys(stats);
	}
	else {
		includedGameKeys = Object.keys(stats).slice(stats.length - gameRange, stats.length);
	}

	const splitDataSeries = [];
	const split = [], nonsplit = [];

	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		game.splitPuyos.forEach((dropNumData, dropNum) => {
			// Do not include data that has not yet been collected
			if(dropNumData.split + dropNumData.nonsplit === 0) {
				return;
			}

			// Initialize count
			if(split[dropNum] === undefined) {
				split[dropNum] = 0;
				nonsplit[dropNum] = 0;
			}

			split[dropNum] += dropNumData.split;
			nonsplit[dropNum] += dropNumData.nonsplit;
		});
	});

	split.forEach((puyos, dropNum) => {
		splitDataSeries[dropNum] = 100 * split[dropNum] / (split[dropNum] + nonsplit[dropNum]);
	});

	const splitData = {
		labels: Array.from(new Array(splitDataSeries.length).keys()),
		series: [splitDataSeries]
	};

	const splitDataOptions = {
		fullWidth: true,
		chartPadding: { left: 35, top: 35, bottom: 170, right: 40 },
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
					offset: { x: 0, y: 50 }
				},
				axisY: {
					axisTitle: "Percentage (%)",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: -15 }
				}
			})
		]
	};
	const splitDataChart = new Chartist.Line('#splitData', splitData, splitDataOptions);
	animateLine(splitDataChart, 500, 50);
	charts['split'] = splitDataChart;

	const buildOrderSeries = [[], [], [], [], [], []];
	const columns = [[], [], [], [], [], []];
	const totals = [];

	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		game.buildOrder.forEach((dropNumData, dropNum) => {
			// Consolidate the games
			dropNumData.forEach((puyos, col) => {
				if(columns[col][dropNum] === undefined) {
					columns[col][dropNum] = 0;
				}
				columns[col][dropNum] += Number(puyos);
			});
		});
	});

	columns.forEach((col, colNum) => {
		col.forEach((puyos, dropNum) => {
			if(totals[dropNum] === undefined) {
				let total = 0;
				columns.forEach(col2 => {
					total += Number(col2[dropNum]);
				});
				totals[dropNum] = total;
			}

			// Do not include data that has not yet been collected
			if(totals[dropNum] === 0) {
				return;
			}

			buildOrderSeries[colNum][dropNum] = 100 * puyos / totals[dropNum];
		});
	});

	const buildOrderData = {
		labels: Array.from(new Array(buildOrderSeries[0].length).keys()),
		series: buildOrderSeries
	};

	const buildOrderOptions = {
		high: 100,
		low: 0,
		stackBars: true,
		horizontalBars: true,
		seriesBarDistance: 35,
		chartPadding: { left: 10, bottom: 190, right: 40 },
		axisX: {
			showGrid: false,
			showLabel: false
		},
		axisY: {
			showGrid: false,
			labelInterpolationFnc: (value) => (value % 10 === 0 ? value : null),
			offset: 70
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisY: {
					axisTitle: "Drop Number",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: -15 }
				}
			}),
			Chartist.plugins.legend({
				legendNames: ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'],
				position: "bottom"
			})
		]
	};
	const buildOrderChart = new Chartist.Bar('#buildOrderData', buildOrderData, buildOrderOptions);
	animateBar(buildOrderChart, 20);
	charts['buildOrder'] = buildOrderChart;

	const buildSpeedSeries = [];
	const speeds = [];

	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		game.buildSpeed.forEach((frames, dropNum) => {
			if(speeds[dropNum] === undefined) {
				speeds[dropNum] = 0;
			}
			speeds[dropNum] += Number(frames);
		});
	});

	speeds.forEach((frames, dropNum) => {
		// Don't include drop numbers that have no data yet
		if(frames === 0) {
			return;
		}

		buildSpeedSeries[dropNum] = frames / includedGameKeys.length / 60 * 1000;
	});

	const buildSpeedData = {
		labels: Array.from(new Array(buildSpeedSeries.length + 1).keys()),
		series: [buildSpeedSeries]
	};

	const buildSpeedOptions = {
		fullWidth: true,
		low: 0,
		chartPadding: { left: 35, top: 25, bottom: 165, right: 40 },
		axisX: {
			labelInterpolationFnc: (value, index) => (index % 5 === 0 ? index : null),
			offset: 65
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
					offset: { x: 0, y: 55 }
				},
				axisY: {
					axisTitle: "Time (ms)",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: -15 }
				}
			})
		]
	};
	const buildSpeedChart = new Chartist.Line('#buildSpeedData', buildSpeedData, buildSpeedOptions);
	animateLine(buildSpeedChart, 500, 50);
	charts['buildSpeed'] = buildSpeedChart;

	const chainScoresSeries = [[], []];
	const allScores = [];

	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		game.chainScores.forEach((scores, chainLength) => {
			if(allScores[chainLength] === undefined) {
				allScores[chainLength] = [];
			}
			allScores[chainLength] = allScores[chainLength].concat(scores);
		});
	});

	allScores.forEach(scores => {
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
		chainScoresSeries[0].push(totalScore / allScores.length);		// Average score
		chainScoresSeries[1].push(maxScore);								// Max score
	});

	const chainScoresData = {
		labels: Array.from(new Array(chainScoresSeries[0].length).keys()),
		series: chainScoresSeries
	};

	const chainScoresOptions = {
		fullWidth: true,
		chartPadding: { left: 35, bottom: 165, right: 40, top: 20 },
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
					offset: { x: 0, y: 48 }
				},
				axisY: {
					axisTitle: "Score (pts)",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: -15 }
				}
			})
		]
	};
	const chainScoresChart = new Chartist.Line('#chainScoresData', chainScoresData, chainScoresOptions);
	animateLine(chainScoresChart, 500, 50);
	charts['chainScores'] = chainScoresChart;

	const finesseDist = {};

	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		Object.keys(game.finesse).forEach(fault => {
			if(finesseDist[fault] === undefined) {
				finesseDist[fault] = game.finesse[fault];
			}
			else {
				finesseDist[fault] += game.finesse[fault];
			}
		});
	});

	const finesseFaultData = {
		labels: Object.keys(finesseDist),
		series: Object.keys(finesseDist).map(fault => finesseDist[fault])
	};

	const totalFaults = finesseFaultData.series.reduce((total, current) => total += current);

	const finesseFaultOptions = {
		fullWidth: true,
		chartPadding: 120,
		labelOffset: 0,
		donut: true,
		labelInterpolationFnc: (value, index) => {
			return `${Math.round(100 * finesseFaultData.series[index].value / totalFaults)}%`;
		},
		plugins: [Chartist.plugins.legend()]
	};
	const finesseFaultChart = new Chartist.Pie('#finesseFaultData', finesseFaultData, finesseFaultOptions);
	animatePie(finesseFaultChart, 500);
	charts['finesseFault'] = finesseFaultChart;

	const finesseSeries = [];
	includedGameKeys.forEach(timestamp => {
		const game = JSON.parse(stats[timestamp]);
		const faults = Object.keys(game.finesse).reduce((total = 0, fault) => total + game.finesse[fault], 0);

		finesseSeries.push({x: timestamp, y: faults});
	});

	const finesseData = {
		series: [finesseSeries]
	};

	const finesseOptions = {
		showLine: false,
		chartPadding: { left: 35, top: 20, bottom: 200, right: 40 },
		low: 0,
		axisX: {
			type: Chartist.FixedScaleAxis,
			divisor: 5,
			labelInterpolationFnc: (value) => {
				const date = new Date(Number(value)).toLocaleDateString();
				return date.substring(0, date.length - 5);
			}
		},
		axisY : {
			labelInterpolationFnc: (value, index) => (index % 2 === 0 ? value : null),
		},
		plugins: [
			Chartist.plugins.ctAxisTitle({
				axisX: {
					axisTitle: "Date",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: 50 }
				},
				axisY: {
					axisTitle: "Finesse Faults",
					axisClass: "ct-axis-title",
					offset: { x: 0, y: -15 }
				}
			})
		]
	};
	const finesseChart = new Chartist.Line('#finesseData', finesseData, finesseOptions);
	animateLine(finesseChart, 500, 50);
	charts['finesse'] = finesseChart;

	document.querySelectorAll('.refresh').forEach(button => {
		button.onclick = function() {
			const id = button.parentNode.id;
			const chart = charts[id.substring(0, id.length - 5)];
			chart.update();
		};
	});
}

function animateLine(chart, duration, delay) {
	let seq = 0;

	chart.on('created', () => {seq = 0;});

	chart.on('draw', (data) => {
		seq++;

		switch(data.type) {
			case 'line':
				// Fade-in
				data.element.animate({
					opacity: { begin: seq * delay + 500, dur: duration, from: 0, to: 1 }
				});
				break;
			case 'label':
				if(data.axis.units.pos === 'x') {
					data.element.animate({
						y: { begin: seq * delay, dur: duration, from: data.y + 50, to: data.y, easing: 'easeOutQuart' },
						opacity: { begin: seq * delay, dur: duration, from: 0, to: 1, easing: 'easeOutQuart' }
					});
				}
				else {
					data.element.animate({
						x: { begin: seq * delay, dur: duration, from: data.x - 50, to: data.x, easing: 'easeOutQuart' },
						opacity: { begin: seq * delay, dur: duration, from: 0, to: 1, easing: 'easeOutQuart' }
					});
				}
				break;
			case 'point':
				data.element.animate({
					x1: { begin: seq * delay, dur: duration, from: data.x - 10, to: data.x, easing: 'easeOutQuart' },
					x2: { begin: seq * delay, dur: duration, from: data.x - 10, to: data.x, easing: 'easeOutQuart' },
					opacity: { begin: seq * delay, dur: duration, from: 0, to: 1, easing: 'easeOutQuart' }
				});
				break;
			case 'grid': {
				// Using data.axis we get x or y which we can use to construct our animation definition objects
				const pos1Animation = {
					begin: seq * delay,
					dur: duration,
					from: data[data.axis.units.pos + '1'] - 30,
					to: data[data.axis.units.pos + '1'],
					easing: 'easeOutQuart'
				};

				const pos2Animation = {
					begin: seq * delay,
					dur: duration,
					from: data[data.axis.units.pos + '2'] - 100,
					to: data[data.axis.units.pos + '2'],
					easing: 'easeOutQuart'
				};

				const animations = {};
				animations[data.axis.units.pos + '1'] = pos1Animation;
				animations[data.axis.units.pos + '2'] = pos2Animation;
				animations['opacity'] = { begin: seq * delay, dur: duration, from: 0, to: 1, easing: 'easeOutQuart' };

				data.element.animate(animations);
			}
		}
	});
}

function animateBar(chart, duration) {
	chart.on('draw', (data) => {
		if(data.type === 'bar') {
			const distance = data.x2 - data.x1;
			data.element.animate({
				x2: {
					begin: (8 * duration) * data.index + data.seriesIndex * duration,
					dur: distance / 100 * duration,
					from: data.x1,
					to: data.x2
				}
			});
		}
	});
}

function animatePie(chart, duration) {
	chart.on('draw', (data) => {

		let pathLength, animationDefinition;

		switch(data.type) {
			case 'slice':
				// Get the total path length in order to use for dash array animation
				pathLength = data.element._node.getTotalLength();

				// Set a dasharray that matches the path length as prerequisite to animate dashoffset
				data.element.attr({
					'stroke-dasharray': pathLength + 'px ' + pathLength + 'px'
				});

				// Create animation definition while also assigning an ID to the animation for later sync usage
				animationDefinition = {
					'stroke-dashoffset': {
						id: 'anim' + data.index,
						dur: duration,
						from: -pathLength + 'px',
						to:  '0px',
						easing: Chartist.Svg.Easing.easeOutQuint,
						// We need to use `fill: 'freeze'` otherwise our animation will fall back to initial (not visible)
						fill: 'freeze'
					}
				};

				// If this was not the first slice, we need to time the animation so that it uses the end sync event of the previous animation
				if(data.index !== 0) {
					animationDefinition['stroke-dashoffset'].begin = data.index * duration;
				}

				// We need to set an initial value before the animation starts as we are not in guided mode which would do that for us
				data.element.attr({
					'stroke-dashoffset': -pathLength + 'px'
				});

				// We can't use guided mode as the animations need to rely on setting begin manually
				// See http://gionkunz.github.io/chartist-js/api-documentation.html#chartistsvg-function-animate
				data.element.animate(animationDefinition, false);
				break;
			case 'label':
				if(data.index !== 0) {
					data.element.animate({ opacity: { begin: data.index * duration + 50, dur: duration, from: 0, to: 1 } });
				}
				break;
		}
	});
}

pageInit();

module.exports = {
	pageInit
};
