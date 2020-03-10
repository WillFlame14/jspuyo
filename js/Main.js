'use strict';

(function () {
	/* eslint-disable-next-line no-undef */
	const socket = io();
	let game, opponent, gameId, gameDrop_colours;

	socket.emit('register');
	socket.on('getGameId', data => {
		gameId = data;
		gameDrop_colours = window.Drop.getNewDrop('Tsu', new window.Settings()).colours;
		socket.emit('findOpponent', gameId, gameDrop_colours);
	});

	socket.on('start', (opponentId, opponentDrop_colours) => {
		console.log('gameId: ' + gameId + ' opponent: ' + opponentId);
		game = new window.Game('Tsu', true, gameId, opponentId, socket, gameDrop_colours);
		opponent = new window.Game('Tsu', false, gameId, opponentId, socket, opponentDrop_colours);
		main();
	});

	let gameOver = false;		// Flag so that one last frame is requested before termination

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		opponent.step();
		if(gameOver) {
			window.cancelAnimationFrame(mainFrame);
			alert("Game over!");
		}
		if(game.gameOver() || opponent.gameOver()) {
			gameOver = true;
		}
	}
})();
