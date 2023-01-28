import { reactive } from 'vue';

import { UserSettings } from '../utils/Settings';

interface AnonymousFunctions {
	saveSettings: (newSettings: Partial<UserSettings>) => void
}

interface ModalProps {
	anonymous: boolean,
	anonymousFunctions: Partial<AnonymousFunctions>,

	host: boolean,
	createRoomMode: 'create' | 'set',
	roomId: string,
	allRoomIds: string[],
	errorMsg: string
}

export default reactive({
	active: false,
	activeModal: 'RoomOptionsModal',
	props: {} as Partial<ModalProps>,
	currentlyHost: false,
	setActiveModal(modal: string, props: Partial<ModalProps> = {}) {
		this.active = true;
		this.activeModal = modal;
		Object.assign(this.props, props);
	},
	clearModal() {
		this.active = false;
		this.props.errorMsg = '';
	},
	toggleHost(host: boolean) {
		this.currentlyHost = host;
		this.props.host = host;
	}
});
