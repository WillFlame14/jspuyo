import * as Vue from 'vue';

import { AppearanceComponent } from './AppearanceComponent';
import { KeyBindings as KeyBindingsComponent } from './KeyBindingsComponent';

import { UserSettings, KeyBindings } from '../../utils/Settings';
import { PlayerInfo } from '../firebase';
import { preloadSprites } from '../../draw/SpriteDrawer';

export const SettingsModal = Vue.defineComponent({
	emits: ['clearModal'],
	components: {
		'appearance-icons': AppearanceComponent,
		'key-bindings': KeyBindingsComponent
	},
	inject: ['audioPlayer', 'getCurrentUID'],
	data(): { settings: Partial<UserSettings> } {
		return {
			settings: {
				das: 200,
				arr: 20,
				sfxVolume: 50,
				musicVolume: 50,
				skipFrames: 50,
				appearance: 'TsuClassic'
			}
		};
	},
	methods: {
		async saveSettings() {
			// Perform conversions
			const newSettings = Object.assign({}, this.settings);
			newSettings.skipFrames = 50 - Math.floor(newSettings.skipFrames);
			newSettings.sfxVolume = (newSettings.sfxVolume / 100)**2 * 0.4;
			newSettings.musicVolume = (newSettings.musicVolume / 100)**2 * 0.4;

			// Request values from child components
			const _keyBindings: Promise<KeyBindings> = new Promise((resolve) => {
				this.emitter.emit('reqKeys', (newBindings: Record<string, Record<string, string>>) => {
					const simplifiedBindings = {} as KeyBindings;
					// Reduce the object to just operation: boundKey
					Object.keys(newBindings).forEach((key: string) => {
						simplifiedBindings[key] = newBindings[key].boundKey;
					});
					resolve(simplifiedBindings);
				});
			});

			const [keyBindings] = await Promise.all([_keyBindings]);
			newSettings.keyBindings = keyBindings;

			void PlayerInfo.getUserProperty(this.getCurrentUID(), 'userSettings').then((userSettings: UserSettings) => {
				userSettings = Object.assign(userSettings, newSettings);

				// Configure audio player with new volume settings
				this.audioPlayer.configureVolume(userSettings);

				// Update values
				PlayerInfo.updateUser(this.getCurrentUID(), 'userSettings', userSettings);

				this.audioPlayer.playSfx('submit');
				this.$emit('clearModal');
			});

			preloadSprites(newSettings.appearance);
		},

		selectAppearance(appearance: string) {
			this.settings.appearance = appearance;
		},

		clearModal() {
			this.$emit('clearModal');
			this.audioPlayer.playSfx('close_modal');
		}
	},
	mounted() {
		this.emitter.on('setSettings', (settings: UserSettings) => {
			const newSettings = Object.assign({}, settings);
			// Perform conversions
			newSettings.skipFrames = 50 - settings.skipFrames;
			newSettings.sfxVolume = 100 * Math.sqrt(settings.sfxVolume / 0.4);
			newSettings.musicVolume = 100 * Math.sqrt(settings.musicVolume / 0.4);

			this.settings = newSettings;

			// Hand off updated values to the components
			this.emitter.emit('bindKeys', settings.keyBindings);
			this.emitter.emit('setAppearance', settings.appearance);
		});
	},
	unmounted() {
		this.emitter.off('setSettings', undefined);
	},
	template:`
		<div class="modal-content" id="settingsModal">
			<div class="close" v-on:click="clearModal()">&times;</div>
			<div class="modal-title">User Settings</div>
			<div class="left-right-container" id="userSettingsOptions">
				<div>
					<div class="justify-flexbox">
						<form class="block-form" autocomplete="off">
							<label for="das">DAS</label>
							<input type="number" class="dasArrInput" id="das" v-model="settings.das" min="0" max="999"><br>
						</form>
						<form class="block-form" autocomplete="off">
							<label for="arr">ARR</label>
							<input type="number" class="dasArrInput" id="arr" v-model="settings.arr" min="0" max="99">
						</form>
					</div>
					<form class="block-form sliders" autocomplete="off">
						<label class="slider-label" for="sfxVolume">SFX Volume</label>
						<input class="slider-range" type="range" id="sfxVolume" v-model="settings.sfxVolume"  min="0" max="100">
						<label class="slider-label" for="musicVolume">Music Volume</label>
						<input class="slider-range" type="range" id="musicVolume" v-model="settings.musicVolume" min="0" max="100">
						<label class="slider-label" for="skipFrames">Intermediate Frames Shown</label>
						<input class="slider-range" type="range" id="skipFrames" v-model="settings.skipFrames" min="0" max="50">
					</form>
				</div>
				<div class="divider vertical" id="settingsDivider"></div>
				<div>
					<key-bindings></key-bindings>
					<div class="justify-flexbox ghostHighlightOptions">
						<form class="block-form" autocomplete="off">
							<label for="ghost">Ghost Drop</label>
							<input type="button" class="off" id="ghost" value="OFF" disabled><br>
						</form>
						<form class="block-form" autocomplete="off">
							<label for="highlightChains">Highlight Chains</label>
							<input type="button" class="off" id="highlightChains" value="OFF" disabled>
						</form>
					</div>
					<div class="option-title">Appearance</div>
					<appearance-icons v-bind:selected="settings.appearance" v-on:select-appearance="selectAppearance"></appearance-icons>
					<button id="settingsSubmit" v-on:click="saveSettings()">Save Settings</button>
				</div>
			</div>
		</div>`
});


