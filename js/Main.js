'use strict';

(function () {
	const socket = window.io();
	let game, gameId;
	let cpuGames = [];

	const cpu = true;

	socket.emit('register');

	socket.on('getGameId', data => {
		gameId = data;
		socket.emit('findOpponent', gameId, cpu);
		console.log('Awaiting match...');
	});

	socket.on('start', opponentIds => {
		console.log('gameId: ' + gameId + ' opponents: ' + JSON.stringify(opponentIds));
		game = new window.PlayerGame('Tsu', gameId, opponentIds, socket);

		let boardDrawerCounter = 2;
		const allIds = opponentIds.slice();
		allIds.push(gameId);

		cpuGames = opponentIds.filter(id => id < 0).map(id => {
			const thisSocket = window.io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new window.CpuGame('Tsu', id, thisOppIds, thisSocket, boardDrawerCounter, new window.HarpyCpu());
			boardDrawerCounter++;
			return { game: thisGame, socket: thisSocket, id };
		});
		main();
	});

	let finalMessage = null;		// The message to be displayed

	function main() {
		const mainFrame = window.requestAnimationFrame(main);
		game.step();
		cpuGames.forEach(cpuGame => cpuGame.game.step());
		if(finalMessage !== null) {
			window.cancelAnimationFrame(mainFrame);
			alert(finalMessage);
		}
		if(game.end()) {
			switch(game.end()) {
				case 'Win':
					finalMessage = 'You win!';
					window.sfx['win'].play();
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					socket.emit('gameOver', gameId);
					window.sfx['lose'].play();
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}

		cpuGames.forEach(cpuGame => {
			if(cpuGame.game.end()) {
				switch(cpuGame.game.end()) {
					case 'Win':
						// finalMessage = 'You win!';
						break;
					case 'Loss':
						// finalMessage = 'You lose...';
						cpuGame.socket.emit('gameOver', cpuGame.id);
						break;
					case 'OppDisconnect':
						// finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
						break;
				}
			}
		});
	}
})();
