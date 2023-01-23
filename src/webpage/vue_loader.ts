import * as Vue from 'vue';

import { ModalManager } from './ModalManager';

import { Chat } from './Chat';
import { PlayerList } from './PlayerList';
import { StatusComponent } from './StatusComponent';

import { NavbarComponent } from './NavbarComponent';

export function vueInit(app: Vue.App<Element>): void {
	app.component('modal-manager', ModalManager);

	app.component('chat', Chat);
	app.component('player-list', PlayerList);
	app.component('status-component', StatusComponent);

	app.component('navbar', NavbarComponent);

	app.mount('#vue-app');
}
