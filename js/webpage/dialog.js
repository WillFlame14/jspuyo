'use strict';

const dialogBackground = document.getElementById('modal-background-disable');

function dialogInit() {
	document.getElementById('dialogAccept').onclick = () => {
		document.getElementById('dialogBox').style.display = 'none';
		dialogBackground.style.display = 'none';
	};
}

function showDialog(message) {
	dialogBackground.style.display = 'block';
	document.getElementById('dialogText').innerHTML = message;
	document.getElementById('dialogBox').style.display = 'block';
}

module.exports = {
	dialogInit,
	showDialog
};
