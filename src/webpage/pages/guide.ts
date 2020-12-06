import * as Vue from 'vue';
import mitt from 'mitt';

import { SettingsModal } from '../modals/SettingsModal';
import { UserSettings } from '../../utils/Settings';
import { AudioPlayer } from '../../utils/AudioPlayer';

interface GuidePage {
	pageNumber: number,
	title: string,
	content: string[],
	options: Record<string, boolean>
}

const userSettings = new UserSettings();

export function initGuide(app: Vue.App<Element>, emitter: ReturnType<typeof mitt>, audioPlayer: AudioPlayer): void {
	app.component('guide', GuideComponent);
	app.component('settings-modal', SettingsModal);
	app.mount('#vue-app');

	Array.from(document.getElementsByClassName('close')).forEach((close: HTMLElement) => {
		close.onclick = () => {
			document.getElementById('modal-background').style.display = 'none';
			document.getElementById('settingsModal').style.display = 'none';
			audioPlayer.playSfx('close_modal');
		};
	});

	emitter.on('saveSettings', (newSettings: UserSettings) => {
		Object.assign(userSettings, newSettings);
		document.getElementById('modal-background').style.display = 'none';
		document.getElementById('settingsModal').style.display = 'none';
	});
}

const guidePages: GuidePage[] = [
	{
		pageNumber: 0,
		title: 'Introduction',
		content: [
			'jspuyo is a competitive multiplayer puzzle game where you win by topping out your opponents.',
			'Topping out occurs when the X on the board is covered by a puyo. The X is always located in the 3rd column from the left, on the uppermost row.',
			'To attack, connect groups of 4 or more puyos that are the same colour. This pops them and sends nuisance puyos to your opponents.',
			'To win, you want to send attacks that will cover the opponents’ X while simultaneously keeping yours clear.'
		],
		options: {}
	},
	{
		pageNumber: 1,
		title: 'Game Controls',
		content: [
			'You receive puyos in pairs, known as “drops”. The queue shows what drops you have coming up next.',
			'You can view and change your controls using the Settings Panel below.',
			'There, you can rebind keys by clicking on the current keybind and pressing the desired key.',
			'Play with the simulator until you find a comfortable control scheme.',
			'Note that these settings will not be saved. You must change them again when creating an account.'
		],
		options: { simulator: true, settings: true }
	}
];

const GuideComponent = Vue.defineComponent({
	data(): { pageNum: number, currentPage: GuidePage, guidePages: GuidePage[] } {
		return {
			pageNum: 0,
			currentPage: guidePages[0],
			guidePages
		};
	},
	methods: {
		changePage(change: number) {
			this.pageNum += change;
			this.currentPage = this.guidePages[this.pageNum];
		},
		startSimulator() {
			console.log('hi');
		},
		stopSimulator() {
			console.log('bye');
		},
		openSettings() {
			document.getElementById('modal-background').style.display = 'block';
			document.getElementById('settingsModal').style.display = 'block';
		}
	},
	template: `
		<h1 class="title" id="guideTitle">{{currentPage.title}}</h1>
		<div id="info">
			<p v-for="line in currentPage.content">{{line}}</p>
			<button id="settingsButton" v-show="currentPage.options.settings" v-on:click="openSettings()">Open Settings</button>
			<div class="justify-flexbox" v-show="currentPage.options.simulator">
				<button id="simulatorStart" v-on:click="startSimulator()">Start Simulator</button>
				<button id="simulatorStop" v-on:click="stopSimulator()">Stop Simulator</button>
			</div>
		</div>
		<div id="navigation">
			<button id="previousButton" v-show="pageNum !== 0" v-on:click="changePage(-1)">Previous Page</button>
			<button id="nextButton" v-show="pageNum !== guidePages.length - 1" v-on:click="changePage(1)">Next Page</button>
		</div>`
});
