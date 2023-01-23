import * as Vue from 'vue';

import { CpuOptionsModal } from './modals/CpuOptionsModal';
import { JoinIdModal } from './modals/JoinIdModal';
import { JoinRoomModal } from './modals/JoinRoomModal';
import { JoinRoomPasswordModal } from './modals/JoinRoomPasswordModal';
import { RoomOptionsModal } from './modals/RoomOptionsModal';
import { SettingsModal } from './modals/SettingsModal';
import { SetRoomPasswordModal } from './modals/SetRoomPasswordModal';
import { SpectateRoomModal } from './modals/SpectateRoomModal';

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
	data() {
		return {
			active: false,
			activeModal: 'RoomOptionsModal',
			props: {
				host: true,
				createRoomMode: 'create',
				roomId: '',
				errorMsg: '',
				allRoomIds: []
			}
		};
	},
	methods: {
		clearModal() {
			this.active = false;
			this.props.errorMsg = '';
		}
	},
	mounted() {
		this.emitter.on('setActiveModal', ({name, props}: {name: string, props: Record<string, unknown>}) => {
			this.activeModal = name;
			Object.assign(this.props, props);
			this.active = true;
		});

		this.emitter.on('clearModal', () => {
			this.active = false;
		});

		this.emitter.on('toggleHost', (host: boolean) => {
			this.props.host = host;
		});
	},
	template:`
		<div v-show="active" class="modal" id="modal-background">
			<div class="modal-content" id="viewGuideModal">
				<div class="close">&times;</div>
				<p>It looks like it's your first time here. Would you like to view a guide on controls and how to play?</p>
				<p>If not, you can always visit the Guide from the Singleplayer menu.</p>
				<button id="visitGuide">Go to guide</button>
			</div>
			<component v-show="active" :is="activeModal" v-bind="props" v-on:clearModal="clearModal"/>
		</div>`
});
