'use strict';

(function () {
	const socket = window.io();
	let game, gameId;
	const cpu = location.search.includes('cpu=true');				// Flag to play against a CPU
	const noPlayer = location.search.includes('player=false');		// Flag to let CPU play for you
	let cpuGames = [];

	socket.emit('register');

	socket.on('getGameId', id => {
		gameId = id;
		socket.emit('findOpponent', gameId, cpu);
		console.log('Awaiting match...');
	});

	socket.on('start', opponentIds => {
		console.log('gameId: ' + gameId + ' opponents: ' + JSON.stringify(opponentIds));

		// Temporary fixed settings
		const gamemode = 'Tsu';
		const settings = new window.Settings();
		const dropGenerator = new window.DropGenerator(gamemode, settings);

		if(noPlayer) {
			game = new window.CpuGame(gamemode, gameId, opponentIds, socket, 1, dropGenerator, new window.TestCpu(), settings);
		}
		else {
			game = new window.PlayerGame(gamemode, gameId, opponentIds, socket, dropGenerator, settings);
		}

		let boardDrawerCounter = 2;
		const allIds = opponentIds.slice();
		allIds.push(gameId);

		// Create the CPU games
		cpuGames = opponentIds.filter(id => id < 0).map(id => {
			const thisSocket = window.io();
			const thisOppIds = allIds.slice();
			thisOppIds.splice(allIds.indexOf(id), 1);

			const thisGame = new window.CpuGame('Tsu', id, thisOppIds, thisSocket, boardDrawerCounter, dropGenerator, new window.TestCpu(), settings);
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
			console.log(finalMessage);
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
