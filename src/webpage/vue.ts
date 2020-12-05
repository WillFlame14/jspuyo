import * as Vue from 'vue';

import { CpuOptionsModal } from './modals/CpuOptionsModal';
import { JoinIdModal } from './modals/JoinIdModal';
import { JoinRoomModal } from './modals/JoinRoomModal';
import { JoinRoomPasswordModal } from './modals/JoinRoomPasswordModal';
import { RoomOptionsModal } from './modals/RoomOptionsModal';
import { SettingsModal } from './modals/SettingsModal';
import { SetRoomPasswordModal } from './modals/SetRoomPasswordModal';
import { SpectateRoomModal } from './modals/SpectateRoomModal';

import { Chat } from './Chat';
import { PlayerList } from './PlayerList';

export function vueInit(app: Vue.App<Element>): void {
	app.component('cpu-options-modal', CpuOptionsModal);
	app.component('create-room-modal', RoomOptionsModal);
	app.component('join-id-modal', JoinIdModal);
	app.component('join-room-modal', JoinRoomModal);
	app.component('join-room-password-modal', JoinRoomPasswordModal);
	app.component('settings-modal', SettingsModal);
	app.component('set-room-password-modal', SetRoomPasswordModal);
	app.component('spectate-room-modal', SpectateRoomModal);

	app.component('chat', Chat);
	app.component('player-list', PlayerList);

	app.mount('#vue-app');
}
