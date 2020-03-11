'use strict';

(function () {
	/* eslint-disable-next-line no-undef */
	const socket = io();
	let game, gameId;

	socket.emit('register');
	socket.on('getGameId', data => {
		gameId = data;
		socket.emit('findOpponent', gameId);
		console.log('Awaiting match...');
	});

	socket.on('start', opponentIds => {
		console.log('gameId: ' + gameId + ' opponents: ' + JSON.stringify(opponentIds));
		game = new window.Game('Tsu', gameId, opponentIds, socket);
		main();
	});

	let gameOver = false;		// Flag so that one last frame is requested before termination

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		if(gameOver) {
			window.cancelAnimationFrame(mainFrame);
			alert("Game over!");
		}
		if(game.gameOver()) {
			gameOver = true;
		}
	}
})();
