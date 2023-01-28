import * as Vue from 'vue';

import store from './store';

export const StatusArea = Vue.defineComponent({
	inject: ['audioPlayer', 'getCurrentUID', 'socket'],
	data() {
		return {
			store
		};
	},
	methods: {
		clickSfx() {
			this.audioPlayer.playSfx('click_option');
		},
		manageCpus() {
			this.socket.emit('requestCpus', this.getCurrentUID(), (cpus) => {
				this.store.setActiveModal('CpuOptionsModal', { cpus });
			});
		},
		manageSettings() {
			// Flag so the submit button causes settings to be changed (instead of creating a new room)
			this.store.setActiveModal('RoomOptionsModal', { createRoomMode: 'set' });
		},
		manageRoomPassword() {
			this.store.setActiveModal('SetRoomPasswordModal');
		},
		manageJoinLink() {
			this.socket.emit('requestJoinLink', this.getCurrentUID(), (roomId) => {
				this.store.setActiveModal('JoinIdModal', { roomId });
			});
		},
		startRoom() {
			this.socket.emit('startRoom', this.getCurrentUID());
		},
		spectate() {
			this.socket.emit('spectateRoom', this.getCurrentUID());
		},
		play() {
			this.socket.emit('joinRoom', { gameId: this.getCurrentUID() });
		}
	},
	template: `
		<div class="status" id="statusArea">
			<ul class="justify-flexbox vertical" id="roomManage">
				<template v-if="!store.currentlySpectating">
					<li class="player roomManageOption" id="manageCpus" v-on:click="clickSfx(), manageCpus()">
						<img class="roomManageIcon" src="images/mainpage/cpu.png">
						<span>Manage CPUs</span>
					</li>
					<li class="player roomManageOption" id="manageSettings" v-on:click="clickSfx(), manageSettings()">
						<img class="roomManageIcon" src="images/mainpage/settings.png">
						<span>Settings</span>
					</li>
					<li class="player roomManageOption" id="manageRoomPassword" v-show="store.currentlyHost" v-on:click="clickSfx(), manageRoomPassword()">
						<img class="roomManageIcon" src="images/mainpage/password.png">
						<span>Set Password</span>
					</li>
					<li class="player roomManageOption" id="manageJoinLink" v-on:click="clickSfx(), manageJoinLink()">
						<img class="roomManageIcon" src="images/mainpage/link.png">
						<span>Show Join Link</span>
					</li>
					<li class="player roomManageOption" id="manageStartRoom" v-show="store.currentlyHost" v-on:click="clickSfx(), startRoom()">
						<img class="roomManageIcon" src="images/mainpage/start.png">
						<span>Start Room</span>
					</li>
					<li class="player roomManageOption" id="manageSpectate" v-on:click="clickSfx(), spectate()">
						<img class="roomManageIcon" src="images/mainpage/spectate.png">
						<span>Spectate</span>
					</li>
				</template>
				<li class="roomManageOption" id="managePlay" v-show="store.currentlySpectating" v-on:click="clickSfx(), play()">
					<img class="roomManageIcon" src="images/navbar/CustomIcon.png">
					<span>Play</span>
				</li>
			</ul>
			<div id="statusMsg"></div>
			<div id="statusGamemode"></div>
			<div id="statusExtra"></div>
		</div>
	`
});
