import * as Vue from 'vue';

import { PlayerInfo } from './firebase';
import { puyoImgs } from './panels_custom';

interface Player {
	name: string,
	wins: number,
	rating: number
}

export const PlayerList = Vue.defineComponent({
	data(): { players: Player[], showWins: boolean, puyoImgs: string[] } {
		return {
			players: [],
			showWins: true,
			puyoImgs
		};
	},
	mounted() {
		this.emitter.on('updatePlayers', ({playerScores, showWins}: { playerScores: Record<string, number>, showWins: boolean }) => {
			this.showWins = showWins;
			const promises: (Promise<string> | string)[] = [];
			// Fetch usernames from the database using the ids
			for(const [id, wins] of Object.entries(playerScores)) {
				if(id.includes('CPU-')) {
					promises.push(id);
					promises.push('1000');
				}
				else {
					promises.push(PlayerInfo.getUserProperty(id, 'username') as Promise<string>);
					promises.push(PlayerInfo.getUserProperty(id, 'rating') as Promise<string>);
				}
				promises.push(`${wins}`);
			}

			// Wait for all promises to resolve, then add them to the player list
			Promise.all(promises).then(playerInfos => {
				this.players = [];

				for(let i = 0; i < playerInfos.length; i += 3) {
					this.players.push({ name: playerInfos[i], rating: Number(playerInfos[i + 1]), wins: Number(playerInfos[i + 2]) });
				}
			}).catch((err) => {
				console.log(err);
			});
		});
	},
	unmounted() {
		this.socket.off('updatePlayers', undefined);
	},
	template: `
		<div id="playersTitle">Players</div>
		<ul class="playerList" id="playerList">
			<li class="playerIndividual" v-for="(player, index) in players">
				<img v-bind:src="'images/modal_boxes/puyo_' + puyoImgs[index % puyoImgs.length] + '.png'">
				<span >{{player.name}}</span>
				<span class="centre-align">{{showWins ? player.wins + '★' : ''}}</span>
				<span class="right-align">{{player.rating}}</span>
			</li>
		</ul>`
});
