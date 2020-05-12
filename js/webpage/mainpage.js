'use strict';

const { puyoImgs } = require('./panels.js');

const playerList = document.getElementById('playerList');

function addPlayer(name, rating = 1000) {
	const newPlayer = document.createElement('li');
	newPlayer.classList.add('playerIndividual');
	newPlayer.id = 'player' + name;

	const icon = document.createElement('img');
	icon.src = `images/modal_boxes/${puyoImgs[playerList.childElementCount % puyoImgs.length]}.png`;
	newPlayer.appendChild(icon);

	const playerName = document.createElement('span');
	playerName.innerHTML = name;
	newPlayer.appendChild(playerName);

	const playerRating = document.createElement('span');
	playerRating.innerHTML = rating;
	newPlayer.appendChild(playerRating);

	playerList.appendChild(newPlayer);
}

function clearPlayers() {
	while(playerList.firstChild) {
		playerList.firstChild.remove();
	}
}

/**
 * Updates the playerList to the current array.
 */
function updatePlayers(players) {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'block';
	players.forEach(id => {
		addPlayer(id);
	});
}

function hidePlayers() {
	clearPlayers();
	document.getElementById('playersDisplay').style.display = 'none';
}

module.exports = {
	updatePlayers,
	hidePlayers
};
