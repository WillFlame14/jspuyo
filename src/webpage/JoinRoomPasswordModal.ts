import * as Vue from 'vue';

export const JoinRoomPasswordModal = Vue.defineComponent({
	data(): { password: string, errorMsg: string, joinId: string } {
		return {
			password: '',
			errorMsg: '',
			joinId: ''
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	methods: {
		submit() {
			// Prevent submit button from refreshing the page
			event.preventDefault();

			this.socket.emit('joinRoom', { gameId: this.getCurrentUID(), joinId: this.joinId, roomPassword: this.password });
			this.audioPlayer.playSfx('submit');
		}
	},
	mounted() {
		this.emitter.on('setJoinId', (joinId: string) => {
			this.joinId = joinId;
		});
		this.emitter.on('joinRoomPasswordFailure', (message: string) => {
			this.errorMsg = message;
		});
	},
	unmounted() {
		this.emitter.off('setJoinId', undefined);
		this.emitter.off('joinRoomPasswordFailure',undefined);
	},
	template:`
		<div class="close">&times;</div>
		<form id="joinRoomPasswordForm" autocomplete="off" v-on:submit="submit()">
			<label for="joinRoomPassword">Enter the password for the room.</label><br>
			<div class="errorMsg" id="joinRoomPasswordFormError" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
			<div>
				<input type="text" id="joinRoomPassword" maxlength="20" v-model="password">
			</div>
			<input type="submit" id="joinRoomPasswordSubmit" value="Join Room">
		</form>`
});
