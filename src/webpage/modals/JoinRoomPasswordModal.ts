import * as Vue from 'vue';

export const JoinRoomPasswordModal = Vue.defineComponent({
	emits: ['clearModal'],
	data() {
		return {
			password: ''
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	props: {
		roomId: String,
		errorMsg: String
	},
	methods: {
		submit() {
			// Prevent submit button from refreshing the page
			event.preventDefault();

			this.socket.emit('joinRoom', { gameId: this.getCurrentUID(), joinId: this.roomId, roomPassword: this.password });
			this.audioPlayer.playSfx('submit');
		},

		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	template:`
		<div class="modal-content" id="joinRoomPasswordModal">
			<div class="close" v-on:click="clearModal()">&times;</div>
			<form id="joinRoomPasswordForm" autocomplete="off" v-on:submit="submit()">
				<label for="joinRoomPassword">Enter the password for the room.</label><br>
				<div class="errorMsg" id="joinRoomPasswordFormError" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
				<div>
					<input type="text" id="joinRoomPassword" maxlength="20" v-model="password">
				</div>
				<input type="submit" id="joinRoomPasswordSubmit" value="Join Room">
			</form>
		</div>`
});
