import * as Vue from 'vue';

import { PlayerInfo } from './firebase';

export const SpectateRoomModal = Vue.defineComponent({
	data(): { roomIds: string[], errorMsg: string, currentRoomId: string, currentRoomPlayers: string[] } {
		return {
			roomIds: [],
			errorMsg: '',
			currentRoomId: '',
			currentRoomPlayers: []
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	methods: {
		getPlayers() {
			this.errorMsg = '';
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

			this.socket.emit('spectate', this.getCurrentUID(), this.currentRoomId);
			this.audioPlayer.playSfx('submit');
		}
	},
	mounted() {
		this.emitter.on('allRooms', (roomIds: string[]) => {
			this.roomIds = roomIds;
		});
		this.emitter.on('spectateFailure', (errMessage: string) => {
			this.errorMsg = errMessage;
		});
	},
	unmounted() {
		this.emitter.off('allRooms', undefined);
	},
	template:`
		<div class="close">&times;</div>
		<form id="spectateForm" autocomplete="off" v-on:submit="submit()">
			<label for="roomList">Select a room you wish to spectate.</label><br>
			<div class="errorMsg" id="spectateFormError" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
			<div class="errorMsg" id="noRoomsSpectate" v-show="roomIds.length === 0">There are no rooms currently available to spectate.</div>
			<div v-show="roomIds.length !== 0">
				<input list="roomIdList" id="roomList" name="roomList" v-model="currentRoomId" v-on:input="getPlayers()">
				<datalist id="roomIdList">
					<option v-for="id in roomIds" v-bind:value="id">{{id}}</option>
				</datalist>
				<div id="roomPlayers" v-show="currentRoomPlayers.length !== 0">Players: {{JSON.stringify(currentRoomPlayers)}}</div>
			</div>
			<input type="submit" id="spectateSubmit" value="Spectate Room"
				v-bind:class="{disable: roomIds.length === 0}"
				v-bind:disabled="roomIds.length === 0">
		</form>`
});
