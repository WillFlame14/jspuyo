import * as Vue from 'vue';

import { RoomSizeSelector } from './RoomSizeSelector';

import { Gamemode, Settings } from '../../utils/Settings';
import { puyoImgs } from '../panels_custom';

interface RoomSettings extends Settings {
	numPlayers: number,
	hardDrop: boolean,
	winCondition: string
}

export const RoomOptionsModal = Vue.defineComponent({
	components: {
		'room-size-selector': RoomSizeSelector
	},
	data(): { settings: RoomSettings, wildNumSelected: boolean, puyoImgs: string[], gamemodes: string[], winConditions: string[], disabled: boolean, mode: string } {
		return {
			settings: Object.assign(new Settings(), {
				marginTime: 96,		// Set to seconds
				numPlayers: 4,
				hardDrop: false,
				winCondition: 'None'
			}),
			wildNumSelected: false,
			puyoImgs,
			gamemodes: Object.values(Gamemode),
			winConditions: ['None', 'FT 3', 'FT 5', 'FT 7'],
			disabled: false,
			mode: 'create'
		};
	},
	computed: {
		hardDropStatus(): string {
			return this.settings.hardDrop ? 'ON': 'OFF';
		},
		submitMessage(): string {
			return this.mode === 'create' ? 'Create Room' : 'Save Settings';
		}
	},
	methods: {
		selectNumPlayers({ num, wildNum }: { num: number, wildNum: boolean }) {
			// Only allow setting number of players when creating a new room
			if(this.mode === 'create') {
				this.settings.numPlayers = num;
				this.wildNumSelected = wildNum;
			}
		},

		changeGamemode() {
			if(this.disabled) {
				return;
			}

			const index = this.gamemodes.indexOf(this.settings.gamemode);

			// Wrap around if at last element
			if(index === this.gamemodes.length - 1) {
				this.settings.gamemode = Gamemode[this.gamemodes[0] as keyof typeof Gamemode];
			}
			else {
				this.settings.gamemode = Gamemode[this.gamemodes[index + 1] as keyof typeof Gamemode];
			}
		},
		changeWinCondition() {
			const index = this.winConditions.indexOf(this.settings.winCondition);

			// Wrap around if at last element
			if(index === this.winConditions.length - 1) {
				this.settings.winCondition = this.winConditions[0];
			}
			else {
				this.settings.winCondition = this.winConditions[index + 1];
			}
		},

		toggleHardDrop() {
			this.settings.hardDrop = !this.settings.hardDrop;
		},

		submitSettings(event: Event) {
			event.preventDefault();

			const settings = Object.assign({}, this.settings);
			settings.numPlayers = undefined;	// Separate the numPlayers property from settings
			settings.marginTime *= 1000;		// Convert margin time to milliseconds

			const roomType = this.settings.winCondition === 'None' ? 'default' : this.settings.winCondition;

			this.emitter.emit('submitRoomSettings', { settings, roomSize: this.settings.numPlayers || 4, mode: this.mode, roomType });
		}
	},
	mounted() {
		this.emitter.on('disableRoomSettings', (state: boolean) => {
			this.disabled = state;
		});

		this.emitter.on('setMode', (mode: string) => {
			this.mode = mode;
		});
	},
	unmounted() {
		this.emitter.off('disableRoomSettings', undefined);
		this.emitter.off('setMode', undefined);
	},
	template: `
		<div class="close">&times;</div>
		<div class="modal-title">Room Options</div>
		<div class="left-right-container" id="createRoomOptions">
			<div id="createRoomOptionsLeft">
				<div id="modeSelector">
					<div class="option-title">Mode</div>
					<img id="mode-icon"
						v-bind:src="'images/modal_boxes/' + settings.gamemode.toLowerCase() + '_icon.png'"
						v-on:click="changeGamemode()">
				</div>
				<form id="boardSizeSelector" autocomplete="off">
					<label for="numRows">Rows</label>
					<input type="number" id="numRows" v-model.number="settings.rows" min="6" max="100" v-bind:disabled="disabled">
					<label for="numCols">Columns</label>
					<input type="number" id="numCols" v-model.number="settings.cols" min="3" max="50" v-bind:disabled="disabled">
				</form>
				<div id="roomSizeSelector">
					<room-size-selector
						v-bind:selectedNum="settings.numPlayers"
						v-bind:wildNumSelected="wildNumSelected"
						v-on:selectNumPlayers="selectNumPlayers"
						v-bind:disabled="disabled || mode === 'set'">
					</room-size-selector>
				</div>
				<form id="coloursSelector" autocomplete="off">
					<label id="coloursSelectorTitle" for="numColoursInput">Colours</label><br>
					<input type="number" id="numColoursInput" v-model.number="settings.numColours" min="0" max="5" v-bind:disabled="disabled">
					<span id="coloursSelected">
						<img v-for="index in settings.numColours"
							v-bind:src="'images/modal_boxes/puyo_' + puyoImgs[index - 1] + '.png'">
					</span>
				</form>
			</div>
			<div class="divider vertical" id="createRoomDivider"></div>
			<form id="createRoomOptionsAdvanced" autocomplete="off">
				<label class="roomOptionLabel" for="marginTime">Margin Time</label>
				<input class="roomOptionInput" type="number" id="marginTime" v-model.number="settings.marginTime" min="0" max="1000" v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="targetPoints">Target Points</label>
				<input class="roomOptionInput" type="number" id="targetPoints" v-model.number="settings.targetPoints" min="0" max="100000" v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="minChainLength">Min Chain Length</label>
				<input class="roomOptionInput" type="number" id="minChainLength" v-model.number="settings.minChain" min="0" max="16" v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="gravity">Gravity</label>
				<input class="roomOptionInput" type="number" id="gravity" v-model.number="settings.gravity" min="0" max="0.2" step="any" v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="softDrop">Soft Drop</label>
				<input class="roomOptionInput" type="number" id="softDrop" v-model.number="settings.softDrop" min="0" max="1"  step="any" v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="hardDrop">Hard Drop</label>
				<input class="roomOptionInput" type="button" id="hardDrop"
					v-bind:class="{ on: settings.hardDrop, off: !settings.hardDrop }"
					v-model="hardDropStatus"
					v-on:click="toggleHardDrop()"
					v-bind:disabled="disabled">
				<label class="roomOptionLabel" for="winCondition">Win Condition</label>
				<input class="roomOptionInput" type="button" id="winCondition"
					v-model="settings.winCondition"
					v-on:click="changeWinCondition()"
					v-bind:disabled="disabled">
				<input type="submit" id="createRoomSubmit"
					v-if="!disabled"
					v-bind:value="submitMessage"
					v-on:click="submitSettings($event)">
			</form>
		</div>`
});
