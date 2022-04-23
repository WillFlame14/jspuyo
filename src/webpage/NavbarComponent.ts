import * as Vue from 'vue';

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
	inject: ['audioPlayer'],
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
					<a id="freeForAll" v-on:mouseover="hoverSfx()">Free for all</a>
					<a id="ranked" v-on:mouseover="hoverSfx()">Ranked</a>
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
					<a id="createRoom" v-on:mouseover="hoverSfx()">Create Room</a>
					<a id="joinRoom" v-on:mouseover="hoverSfx()">Join Room</a>
					<a id="spectate" v-on:mouseover="hoverSfx()">Spectate</a>
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
					<a id="guide" v-on:mouseover="hoverSfx()">Guide</a>
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
					<a id="gallery" v-on:mouseover="hoverSfx()">Gallery</a>
					<a id="settings" v-on:mouseover="hoverSfx()">Settings</a>
					<a id="logout" v-on:mouseover="hoverSfx()">Log Out</a>
				</div>
			</span>
			<span id="logo" v-on:click="logoClick()">jspuyo</span>`
});
