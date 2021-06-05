import path = require('path');

const backgrounds = [
	'forest.jpg',
	'forest2.jpg',
	'winter.jpg',
	'wildlife.jpg'
];

export function pageInit(): void {
	const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
	const address = path.join(__dirname, '..', '..', 'images', 'backgrounds', background);
	document.documentElement.style.backgroundImage = 'url("' + address + '")';
}
