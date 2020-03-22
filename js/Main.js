'use strict';

(function () {
	const socket = window.io();
	let game, gameId, cpu = location.search.includes('cpu=true');
	let cpuGames = [];

	socket.emit('register');

	socket.on('getGameId', id => {
		gameId = id;
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

			const thisGame = new window.CpuGame('Tsu', id, thisOppIds, thisSocket, boardDrawerCounter, new window.TestCpu());
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
		const endResult = game.end();
		if(endResult !== null) {
			switch(endResult) {
				case 'Win':
					finalMessage = 'You win!';
					break;
				case 'Loss':
					finalMessage = 'You lose...';
					socket.emit('gameOver', gameId);
					break;
				case 'OppDisconnect':
					finalMessage = 'Your opponent has disconnected. This match will be counted as a win.';
					break;
			}
		}

		cpuGames.forEach(cpuGame => {
			const cpuEndResult = cpuGame.game.end();
			if(cpuEndResult !== null) {
				switch(cpuEndResult) {
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
