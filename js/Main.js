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

	let finalMessage = null;		// The message to be displayed

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		if(finalMessage !== null) {
			window.cancelAnimationFrame(mainFrame);
			alert(finalMessage);
		}
		if(game.end()) {
			switch(game.end()) {
				case 'Win':
					finalMessage = 'You win!';
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					console.log('loss');
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}
	}
})();
