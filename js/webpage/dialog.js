'use strict';

const dialogBackground = document.getElementById('modal-background-disable');

function dialogInit() {
	document.getElementById('forceStopAccept').onclick = () => {
		document.getElementById('forceStopPenalty').style.display = 'none';
		dialogBackground.style.display = 'none';
	}

	document.getElementById('timeoutAccept').onclick = () => {
		document.getElementById('timeoutInfo').style.display = 'none';
		dialogBackground.style.display = 'none';
	}
}

function timeout() {
	dialogBackground.style.display = 'block';
	document.getElementById('timeoutInfo').style.display = 'block';
}

const showDialog = {
	timeout
};

module.exports = {
	dialogInit,
	showDialog
};
