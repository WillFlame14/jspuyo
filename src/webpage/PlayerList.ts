import * as Vue from 'vue';

import { PlayerInfo } from './firebase';
import { puyoImgs } from './panels_custom';

interface Player {
	name: string,
	rating: number
}

export const PlayerList = Vue.defineComponent({
	data(): { players: Player[], puyoImgs: string[] } {
		return {
			players: [],
			puyoImgs
		};
	},
	mounted() {
		this.emitter.on('updatePlayers', (players: string[]) => {
			const promises: (Promise<string> | string)[] = [];
			// Fetch usernames from the database using the ids
			players.forEach(id => {
				if(id.includes('CPU-')) {
					promises.push(id);
					promises.push('1000');
				}
				else {
					promises.push(PlayerInfo.getUserProperty(id, 'username') as Promise<string>);
					promises.push(PlayerInfo.getUserProperty(id, 'rating') as Promise<string>);
				}
			});

			// Wait for all promises to resolve, then add them to the player list
			Promise.all(promises).then(playerInfos => {
				this.players = [];

				for(let i = 0; i < playerInfos.length; i += 2) {
					this.players.push({ name: playerInfos[i], rating: Number(playerInfos[i + 1]) });
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
				<span>{{player.name}}</span>
				<span>{{player.rating}}</span>
			</li>
		</ul>`
});
