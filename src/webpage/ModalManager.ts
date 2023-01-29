import * as Vue from 'vue';

import { CpuOptionsModal } from './modals/CpuOptionsModal';
import { JoinIdModal } from './modals/JoinIdModal';
import { JoinRoomModal } from './modals/JoinRoomModal';
import { JoinRoomPasswordModal } from './modals/JoinRoomPasswordModal';
import { RoomOptionsModal } from './modals/RoomOptionsModal';
import { SettingsModal } from './modals/SettingsModal';
import { SetRoomPasswordModal } from './modals/SetRoomPasswordModal';
import { SpectateRoomModal } from './modals/SpectateRoomModal';

import store from './store';

export const ModalManager = Vue.defineComponent({
	components: {
		CpuOptionsModal,
		JoinIdModal,
		JoinRoomModal,
		JoinRoomPasswordModal,
		RoomOptionsModal,
		SettingsModal,
		SetRoomPasswordModal,
		SpectateRoomModal
	},
	inject: ['audioPlayer'],
	data() {
		return {
			store
		};
	},
	methods: {
		clearModal(playSfx = true) {
			this.store.clearModal();

			if (playSfx) {
				this.audioPlayer.playSfx('close_modal');
			}
		},
		// Clear modal if the click was on the background (and not a child element)
		modalClick(event: Event) {
			if ((event.target as HTMLElement).id === 'modal-background') {
				this.clearModal();
			}
		},
		visitGuide() {
			window.location.assign('/guide');
		},
		setActiveModal(name: string, props: Record<string, unknown>) {
			this.store.setActiveModal(name, props);
		}
	},
	template:`
		<div v-show="store.active" class="modal" id="modal-background" v-on:click="modalClick">
			<div class="modal-content" id="viewGuideModal">
				<div class="close">&times;</div>
				<p>It looks like it's your first time here. Would you like to view a guide on controls and how to play?</p>
				<p>If not, you can always visit the Guide from the Singleplayer menu.</p>
				<button id="visitGuide" v-on:click.prevent="visitGuide()">Go to guide</button>
			</div>
			<component :is="store.activeModal" v-bind="store.props" v-on:clear-modal="clearModal" v-on:set-active-modal="setActiveModal"/>
		</div>`
});
