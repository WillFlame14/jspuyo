import * as Vue from 'vue';

import { PlayerInfo } from '../firebase';

export const SpectateRoomModal = Vue.defineComponent({
	emits: ['clearModal'],
	data(): { currentRoomId: string, currentRoomPlayers: string[] } {
		return {
			currentRoomId: '',
			currentRoomPlayers: []
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	props: {
		allRoomIds: Array,
		errorMsg: String
	},
	methods: {
		getPlayers() {
			if(this.currentRoomId.length !== 6) {
				this.currentRoomPlayers = [];
				return;
			}

			// Callback function passed to server on response
			const givePlayers = (players: string[]) => {
				const promises = players.map(playerId => PlayerInfo.getUserProperty(playerId, 'username')) as Promise<string>[];

				Promise.all(promises).then(playerNames => {
					this.currentRoomPlayers = playerNames;
				}).catch((err) => {
					console.log(err);
				});
			};

			this.socket.emit('getPlayers', this.currentRoomId, givePlayers);
		},
		submit() {
			// Prevent submit button from refreshing the page
			event.preventDefault();
			// await this.stopCurrentSession();

			this.socket.emit('spectateRoom', this.getCurrentUID(), this.currentRoomId);
			this.audioPlayer.playSfx('submit');
		},
		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	template:`
		<div class="modal-content" id="spectateRoomModal">
			<div class="close" v-on:click="clearModal()">&times;</div>
			<form id="spectateForm" autocomplete="off" v-on:submit="submit()">
				<label for="roomList">Select a room you wish to spectate.</label><br>
				<div class="errorMsg" id="spectateFormError" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
				<div class="errorMsg" id="noRoomsSpectate" v-show="allRoomIds.length === 0">There are no rooms currently available to spectate.</div>
				<div v-show="allRoomIds.length !== 0">
					<input list="roomIdList" id="roomList" name="roomList" v-model="currentRoomId" v-on:input="getPlayers()">
					<datalist id="roomIdList">
						<option v-for="id in allRoomIds" v-bind:value="id">{{id}}</option>
					</datalist>
					<div id="roomPlayers" v-show="currentRoomPlayers.length !== 0">Players: {{JSON.stringify(currentRoomPlayers)}}</div>
				</div>
				<input type="submit" id="spectateSubmit" value="Spectate Room"
					v-bind:class="{disable: allRoomIds.length === 0}"
					v-bind:disabled="allRoomIds.length === 0">
			</form>
		</div>`
});
