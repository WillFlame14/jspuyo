import * as Vue from 'vue';
import mitt from 'mitt';
import { Socket } from 'socket.io-client';

import { SettingsModal } from '../modals/SettingsModal';
import { UserSettings } from '../../utils/Settings';
import { AudioPlayer } from '../../utils/AudioPlayer';

import { Settings } from '../../utils/Settings';
import { PlayerGame } from '../../PlayerGame';
import { clearCells, generateCells } from '../../Main';
import { Simulator } from '../../PlayerSession';

interface GuidePage {
	pageNumber: number,
	title: string,
	content: string[],
	images?: { src: string, caption: string }[],
	options: Options
}

interface Options {
	simulator?: boolean;
	settings?: boolean;
	nuisance?: number;
	startingBoard?: number[][];
	seed?: number;
}

const settings = new Settings();
const userSettings = new UserSettings();
let currentSession: Simulator;

export function initGuide(app: Vue.App<Element>, emitter: ReturnType<typeof mitt>, socket: Socket, audioPlayer: AudioPlayer): void {
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

	emitter.on('startSimulator', (options: Options) => {
		clearCells();
		settings.setSeed(options.seed);		// Will default to random seed if none is provided
		const gameAreas = generateCells(['test'], settings);
		const game = new PlayerGame(null, ['system'], socket, settings, userSettings, gameAreas, audioPlayer);

		if(options.nuisance) {
			game.receiveNuisance('system', options.nuisance);
			game.activateNuisance('system');
		}
		if(options.startingBoard) {
			game.setStartingBoard(options.startingBoard);
		}

		currentSession = new Simulator(game, socket);
		currentSession.run();
	});

	emitter.on('stopSimulator', () => {
		void currentSession.stop();
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
			'You can view and change your controls using the Settings Panel below. Settings will apply when you start a new simulator session.',
			'Play with the simulator until you find a comfortable control scheme.',
			'Note that these settings will not be saved. You must change them again when creating an account.'
		],
		options: { simulator: true, settings: true }
	},
	{
		pageNumber: 2,
		title: 'Chaining',
		content: [
			'To pop, puyos must be connected in a group of 4 or more. However, these attacks aren’t very strong by themselves.',
			`There are 2 ways to increase the strength of your attacks:
    - Popping more puyos at once
    - Popping puyos in a way that the falling puyos create another group of 4 or more (known as chaining).`,
			'Chaining is much more efficient, and is the foundation of building strong attacks in jspuyo. Try building some chains of length 2 or longer!'
		],
		images: [{ src: "stairs.png", caption: 'Stairs'}, { src: "sandwich.png", caption: 'Sandwich'}],
		options: { simulator: true }
	},
	{
		pageNumber: 3,
		title: 'Nuisance',
		content: [
			'If your attack is sufficiently strong, you will send nuisance to your opponents. Nuisance always falls from the top of the board.',
			'Nuisance only falls once your opponent\'s chain finishes and you place a piece, assuming that you don\'t set off a counterattack (see Offsetting on next page).',
			'A maximum of one rock (5 lines) will fall at once. Remember that if nuisance falls on your X, you lose!',
			'Popping puyos will cause any adjacent nuisance to disappear. Knowing this, you can create chains even around nuisance!'
		],
		options: { simulator: true, nuisance: 18 }
	},
	{
		pageNumber: 4,
		title: 'Offsetting',
		content: [
			'If you set off an attack when you have pending nuisance, you can offset the incoming nuisance.',
			'If your attack sends more than what you had pending, you will counter and send nuisance to your opponents.',
			'Otherwise, your attack will just reduce the amount of nuisance you receive.',
			'Remember, nuisance isn\'t activated until your opponent\'s chain finishes. Until then, you can continue to extend your own chain!',
			'Counter the incoming nuisance by setting off this chain.'
		],
		options: {
			simulator: true,
			nuisance: 50,
			startingBoard: [
				[3, 3, 3],
				[1, 1, 1, 3],
				[2, 2, 2, 1],
				[3, 3, 3, 2],
				[2, 2, 2, 3],
				[]
			],
			seed: 0.1923749
		}
	},
	{
		pageNumber: 4,
		title: 'Conclusion',
		content: [
			'jspuyo is a game about reading your opponents. This guide has only covered the basics of how the game works.',
			'For a more in-depth guide on strategy, see our Lessons (under the Singleplayer tab).',
			'If you want to practice more, you can access the Simulator (also under the Singleplayer tab).',
			'You can revisit this Guide at any time (yep, under the Singleplayer tab).',
			'If you\'ve changed any settings, don\'t forget to make the same changes in your Profile.',
			'Good luck!'
		],
		options: {}
	}
];

const GuideComponent = Vue.defineComponent({
	data(): { pageNum: number, currentPage: GuidePage, guidePages: GuidePage[], simulatorOn: boolean } {
		return {
			pageNum: 0,
			currentPage: guidePages[0],
			guidePages,
			simulatorOn: false
		};
	},
	methods: {
		changePage(change: number) {
			this.pageNum += change;
			this.currentPage = this.guidePages[this.pageNum];
			clearCells();
			if(this.currentPage.options.simulator) {
				generateCells(['test'], settings);
			}
			if(this.simulatorOn) {
				this.stopSimulator();
			}
		},
		startSimulator() {
			this.emitter.emit('startSimulator', this.currentPage.options);
			this.simulatorOn = true;
		},
		stopSimulator() {
			this.emitter.emit('stopSimulator');
			this.simulatorOn = false;
		},
		openSettings() {
			document.getElementById('modal-background').style.display = 'block';
			document.getElementById('settingsModal').style.display = 'block';

			if(this.simulatorOn) {
				this.stopSimulator();
			}
		},
		returnHome() {
			window.location.assign('/');
		}
	},
	template: `
		<table class="guide" id="playArea">
			<!-- Inserted by javascript -->
		</table>
		<div class="guide" id="content">
			<div class="title" id="guideTitle">{{currentPage.title}}</div>
			<div id="info">
				<p v-for="line in currentPage.content">{{line}}</p>
				<div class="justify-flexbox" v-show="currentPage.images">
					<div v-for="img in currentPage.images">
						<img class="guide-image" v-bind:src="'images/guide/' + img.src">
						<div class="caption" v-if="img.caption">{{img.caption}}</div>
					</div>
				</div>
				<div class="justify-flexbox">
					<button id="simulatorStart" v-show="currentPage.options.simulator && !simulatorOn" v-on:click="startSimulator()">Start Simulator</button>
					<button id="simulatorStop" v-show="currentPage.options.simulator && simulatorOn" v-on:click="stopSimulator()">Stop Simulator</button>
					<button id="settingsButton" v-show="currentPage.options.settings" v-on:click="openSettings()">Open Settings</button>
					<button id="jspuyoButton" v-show="pageNum === guidePages.length - 1" v-on:click="returnHome()">Go to jspuyo</button>
				</div>
			</div>
			<div id="navigation">
				<button id="previousButton" v-show="pageNum !== 0" v-on:click="changePage(-1)">Previous Page</button>
				<button id="nextButton" v-show="pageNum !== guidePages.length - 1" v-on:click="changePage(1)">Next Page</button>
			</div>
		</div>`
});
