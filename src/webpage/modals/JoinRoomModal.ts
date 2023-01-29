import * as Vue from 'vue';

export const JoinRoomModal = Vue.defineComponent({
	emits: ['clearModal'],
	data(): { joinId: string } {
		return {
			joinId: ''
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	props: {
		errorMsg: String
	},
	methods: {
		async submit() {
			event.preventDefault();
			await this.stopCurrentSession();

			this.socket.emit('joinRoom', { gameId: this.getCurrentUID(), joinId: this.joinId });
			this.audioPlayer.playSfx('submit');
		},

		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	template:`
		<div class="modal-content" id="joinRoomModal">
			<div class="close" v-on:click="$emit('clearModal')">&times;</div>
			<form id="joinIdForm" autocomplete="off" v-on:submit="submit()">
				<label for="joinId">Enter the code for the room you wish to join.</label><br>
				<div class="errorMsg" v-show="errorMsg.length !== 0">{{errorMsg}}</div>
				<div id="joinIdInput">
					<input type="text" id="joinRoomFiller" value="?joinRoom=" disabled>
					<input type="text" id="joinId" placeholder="######" maxlength="6" v-model="joinId">
				</div>
				<input type="submit" id="joinRoomSubmit" value="Join Room">
			</form>
		</div>`
});
