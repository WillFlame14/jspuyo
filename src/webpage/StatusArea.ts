import * as Vue from 'vue';

export const StatusArea = Vue.defineComponent({
	data() {
		return {};
	},
	methods: {

	},
	template: `
		<div class="status" id="statusArea">
            <ul class="justify-flexbox vertical" id="roomManage">
                <li class="player roomManageOption" id="manageCpus">
                    <img class="roomManageIcon" src="images/mainpage/cpu.png">
                    <span>Manage CPUs</span>
                </li>
                <li class="player roomManageOption" id="manageSettings">
                    <img class="roomManageIcon" src="images/mainpage/settings.png">
                    <span>Settings</span>
                </li>
                <li class="player roomManageOption" id="manageRoomPassword">
                    <img class="roomManageIcon" src="images/mainpage/password.png">
                    <span>Set Password</span>
                </li>
                <li class="player roomManageOption" id="manageJoinLink">
                    <img class="roomManageIcon" src="images/mainpage/link.png">
                    <span>Show Join Link</span>
                </li>
                <li class="player roomManageOption" id="manageStartRoom">
                    <img class="roomManageIcon" src="images/mainpage/start.png">
                    <span>Start Room</span>
                </li>
                <li class="player roomManageOption" id="manageSpectate">
                    <img class="roomManageIcon" src="images/mainpage/spectate.png">
                    <span>Spectate</span>
                </li>
                <li class="roomManageOption" id="managePlay">
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
