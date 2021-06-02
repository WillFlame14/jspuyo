import * as Vue from 'vue';

import { AppearanceComponent } from './AppearanceComponent';
import { KeyBindings as KeyBindingsComponent } from './KeyBindingsComponent';

import { UserSettings, KeyBindings } from '../../utils/Settings';

export const SettingsModal = Vue.defineComponent({
	components: {
		'appearance-icons': AppearanceComponent,
		'key-bindings': KeyBindingsComponent
	},
	data(): { settings: UserSettings } {
		return {
			settings: {
				das: 200,
				arr: 20,
				sfxVolume: 50,
				musicVolume: 50,
				skipFrames: 50,
				appearance: null,		// The properties below are just for completion, they are not really used
				keyBindings: null,
				voice: ''
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

			const _appearance: Promise<string> = new Promise((resolve) => {
				this.emitter.emit('getAppearance', (newAppearance: string) => {
					resolve(newAppearance);
				});
			});

			const [keyBindings, appearance] = await Promise.all([_keyBindings, _appearance]);
			newSettings.keyBindings = keyBindings;
			newSettings.appearance = appearance;

			this.emitter.emit('saveSettings', newSettings);
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
		this.emitter.off('getSettings', undefined);
	},
	template:
		`<div class="close">&times;</div>
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
				<appearance-icons></appearance-icons>
				<button id="settingsSubmit" v-on:click="saveSettings()">Save Settings</button>
			</div>
		</div>`
});


