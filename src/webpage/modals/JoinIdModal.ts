import * as Vue from 'vue';

export const JoinIdModal = Vue.defineComponent({
	emits: ['clearModal'],
	data() {
		return {
			copied: false
		};
	},
	inject: ['audioPlayer'],
	props: {
		roomId: String
	},
	computed: {
		link(): string {
			return `${window.location.href.split('?')[0]}?joinRoom=${this.roomId}`;
		}
	},
	methods: {
		copyLink() {
			(this.$refs.joinIdLink as HTMLInputElement).select();

			try {
				// Copy the selected text and show "Copied!" message
				document.execCommand('copy');
				this.copied = true;
			}
			catch(err) {
				console.warn(err);
			}
			finally {
				// Deselect the input field
				document.getSelection().removeAllRanges();
				this.audioPlayer.playSfx('submit');
			}
		},

		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	template:`
		<div class="modal-content" id="giveJoinId">
			<div class="close" v-on:click="clearModal()">&times;</div>
			<div>Use the following link to join the room:</div>
			<form autocomplete="off">
				<input type="text" ref="joinIdLink" id="joinIdLink" v-bind:value="link">
				<input type="button" id="copyJoinId" value="&#x1F4CB" v-on:click="copyLink()">
			</form>
			<div id="joinIdCopied" v-show="copied">Copied to clipboard!</div>
		</div>`
});
