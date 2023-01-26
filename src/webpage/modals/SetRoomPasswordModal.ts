import * as Vue from 'vue';

export const SetRoomPasswordModal = Vue.defineComponent({
	emits: ['clearModal'],
	data(): { password: string } {
		return {
			password: ''
		};
	},
	inject: ['audioPlayer', 'socket', 'getCurrentUID', 'stopCurrentSession'],
	methods: {
		submit() {
			// Prevent submit button from refreshing the page
			event.preventDefault();

			this.socket.emit('setRoomPassword', this.getCurrentUID(), this.password);
			this.audioPlayer.playSfx('submit');

			this.$emit('clearModal');
		},

		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	template:`
		<div class="modal-content" id="roomPasswordModal">
			<div class="close" v-on:click="clearModal()">&times;</div>
	        <form id="roomPasswordForm" autocomplete="off" v-on:submit="submit()">
	            <label for="roomPassword">Enter the password for the room.</label><br>
	            <div id="roomPasswordInput">
	                <input type="text" id="roomPassword" placeholder="<no password>" maxlength="20" v-model="password">
	            </div>
	            <input type="submit" id="roomPasswordSubmit" value="Save Password">
	        </form>
	    </div>`
});
