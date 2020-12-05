import * as Vue from 'vue';

export const JoinIdModal = Vue.defineComponent({
	data(): { link: string, copied: boolean } {
		return {
			link: '',
			copied: false
		};
	},
	inject: ['audioPlayer'],
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
		}
	},
	mounted() {
		this.emitter.on('setLink', (link: string) => {
			this.link = link;

			// Hide the "Copied!" message
			this.copied = false;
		});
	},
	unmounted() {
		this.emitter.off('setLink', undefined);
	},
	template:`
		<div class="close">&times;</div>
		<div>Use the following link to join the room:</div>
		<form autocomplete="off">
			<input type="text" ref="joinIdLink" id="joinIdLink" v-bind:value="link">
			<input type="button" id="copyJoinId" value="&#x1F4CB" v-on:click="copyLink()">
		</form>
		<div id="joinIdCopied" v-show="copied">Copied to clipboard!</div>`
});
