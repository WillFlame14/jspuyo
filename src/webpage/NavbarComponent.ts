import * as Vue from 'vue';
import { PlayerInfo, signOut } from './firebase';

import store from './store';

const panelDropdowns: Record<string, string[]> = {
	'queue': ['freeForAll', 'ranked'],
	'custom': ['createRoom', 'joinRoom', 'spectate'],
	'singleplayer': ['sprint', 'timeChallenge', 'guide'],
	'profile': ['settings', 'gallery', 'logout']
};

type PanelName = 'queue' | 'custom' | 'singleplayer' | 'profile';

const zIndexMap = {
	queue: [6, 5, 4, 3],
	custom: [5, 6, 4, 3],
	singleplayer: [3, 4, 6, 5],
	profile: [3, 4, 5, 6]
};

export const NavbarComponent = Vue.defineComponent({
	inject: ['audioPlayer', 'getCurrentUID', 'socket', 'stopCurrentSession'],
	data(): { selectedPanel: string, zIndexes: Record<PanelName, number>, heights: Record<PanelName, number> } {
		return {
			selectedPanel: null,
			zIndexes: { queue: 5, custom: 4, singleplayer: 3, profile: 2 },
			heights: { queue: 0, custom: 0, singleplayer: 0, profile: 0 }
		};
	},
	methods: {
		expandDropdown(panelName: PanelName) {
			// If the current dropdown menu is already open, it is closed.
			if(panelName === this.selectedPanel) {
				this.heights[panelName] = 0;

				this.selectedPanel = null;
				this.audioPlayer.playSfx('close_panel');
			}
			// Otherwise, expands the dropdown menu and closes any other open dropdown menu.
			else {
				this.heights[this.selectedPanel] = 0;
				this.heights[panelName] = panelDropdowns[panelName].length * 40;
				this.selectedPanel = panelName;
				this.audioPlayer.playSfx('open_panel');
			}

			// Then set the z-index for each panel on selection for nice shadow cascading.
			const map = zIndexMap[panelName];
			for(const [index, key] of Object.keys(this.heights).entries()) {
				this.zIndexes[key] = map[index];
			}
		},
		hoverSfx() {
			this.audioPlayer.playSfx('hover_option', 0);
		},
		logoClick() {
			window.location.assign('/info');
		},
		// Queue Panel
		async freeForAll() {
			await this.stopCurrentSession();
			document.getElementById('statusGamemode').innerHTML = 'Free For All';
			this.socket.emit('freeForAll', { gameId: this.getCurrentUID() });
		},
		async ranked() {
			await this.stopCurrentSession();
			document.getElementById('statusGamemode').innerHTML = 'Ranked';
			this.socket.emit('ranked', { gameId: this.getCurrentUID() });
		},
		// Custom Panel
		createRoom() {
			store.setActiveModal('RoomOptionsModal', { createRoomMode: 'create' });
			store.toggleHost(true);
		},
		joinRoom() {
			store.setActiveModal('JoinRoomModal');
		},
		// Singleplayer Panel
		async spectate() {
			await this.stopCurrentSession();
			this.socket.emit('getAllRooms', this.getCurrentUID(), (allRoomIds: string[]) => {
				store.setActiveModal('SpectateRoomModal', { allRoomIds });
			});
		},
		async openGuide() {
			await this.stopCurrentSession();
			window.location.assign('/guide');
		},
		// Profile Panel
		async openGallery() {
			void this.stopCurrentSession();
			// Leave the room
			this.socket.emit('forceDisconnect', this.getCurrentUID());

			let stats = [] as unknown;
			try {
				stats = await PlayerInfo.getUserProperty(this.getCurrentUID(), 'stats');
			}
			catch(err) {
				// No games played yet. Special warning message?
				console.log(err);
			}

			// Need to stringify object before storing, otherwise the data will not be stored correctly
			window.localStorage.setItem('stats', JSON.stringify(stats));

			// Redirect to gallery subdirectory
			window.location.assign('/gallery');
		},
		openSettings() {
			void this.stopCurrentSession();

			store.setActiveModal('SettingsModal');
		},
		logOut() {
			this.socket.emit('forceDisconnect', this.getCurrentUID());
			this.socket.emit('unlinkUser');
			void signOut();
		}
	},
	template:
		`<span id="navbarSpacer"></span>
			<span
				id="queuePanel"
				class="navPanel"
				v-bind:class="{ expanded: true }"
				v-bind:style="{ zIndex: zIndexes.queue }"
				v-on:click="expandDropdown('queue')"
			>
				<img src="images/navbar/QueueIcon.png" class="navIcon">
				<span class="panelName">Queue</span>
				<div class="dropdown" v-bind:style="{ height: heights.queue }">
					<a id="freeForAll" v-on:mouseover="hoverSfx()" v-on:click="freeForAll()">Free for all</a>
					<a id="ranked" v-on:mouseover="hoverSfx()" v-on:click="ranked()">Ranked</a>
				</div>
			</span>
			<span
				id="customPanel"
				class="navPanel"
				v-bind:class="{ expanded: true }"
				v-bind:style="{ zIndex: zIndexes.custom }"
				v-on:click="expandDropdown('custom')"
			>
				<img src="images/navbar/CustomIcon.png" class="navIcon">
				<span class="panelName">Custom</span>
				<div class="dropdown" v-bind:style="{ height: heights.custom }">
					<a id="createRoom" v-on:mouseover="hoverSfx()" v-on:click="createRoom()">Create Room</a>
					<a id="joinRoom" v-on:mouseover="hoverSfx()" v-on:click="joinRoom()">Join Room</a>
					<a id="spectate" v-on:mouseover="hoverSfx()" v-on:click="spectate()">Spectate</a>
				</div>
			</span>
			<span
				id="singleplayerPanel"
				class="navPanel"
				v-bind:class="{ expanded: true }"
				v-bind:style="{ zIndex: zIndexes.singleplayer }"
				v-on:click="expandDropdown('singleplayer')"
			>
				<img src="images/navbar/SingleplayerIcon.png" class="navIcon">
				<span class="panelName">Singleplayer</span>
				<div class="dropdown" v-bind:style="{ height: heights.singleplayer }">
					<a id="sprint" v-on:mouseover="hoverSfx()">Sprint [WIP]</a>
					<a id="timeChallenge" v-on:mouseover="hoverSfx()">Time Challenge [WIP]</a>
					<a id="guide" v-on:mouseover="hoverSfx()" v-on:click="openGuide()">Guide</a>
				</div>
			</span>
			<span
				id="profilePanel"
				class="navPanel"
				v-bind:class="{ expanded: true }"
				v-bind:style="{ zIndex: zIndexes.profile }"
				v-on:click="expandDropdown('profile')"
			>
				<img src="images/navbar/ProfileIcon.png" class="navIcon">
				<span class="panelName">Profile</span>
				<div class="dropdown" v-bind:style="{ height: heights.profile }">
					<a id="gallery" v-on:mouseover="hoverSfx()" v-on:click="openGallery()">Gallery</a>
					<a id="settings" v-on:mouseover="hoverSfx()" v-on:click="openSettings()">Settings</a>
					<a id="logout" v-on:mouseover="hoverSfx()" v-on:click="logOut()">Log Out</a>
				</div>
			</span>
			<span id="logo" v-on:click="logoClick()">jspuyo</span>`
});
