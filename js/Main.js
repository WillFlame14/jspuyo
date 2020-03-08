'use strict';

(function () {
	/* eslint-disable-next-line no-undef */
	const socket = io();
	let game, opponent, gameId;

	socket.emit('register');
	socket.on('getGameId', data => {
		gameId = data;

		game = new window.Game('Tsu', true, gameId, socket);
		opponent = new window.Game('Tsu', false, gameId, socket);
		console.log(gameId);

		main(game, opponent);
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
