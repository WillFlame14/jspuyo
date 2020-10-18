'use strict';

const dialogBackground = document.getElementById('modal-background-disable');

export function dialogInit() {
	document.getElementById('dialogAccept').onclick = () => {
		document.getElementById('dialogBox').style.display = 'none';
		dialogBackground.style.display = 'none';
	};
}

export function showDialog(message) {
	dialogBackground.style.display = 'block';
	document.getElementById('dialogText').innerHTML = message;
	document.getElementById('dialogBox').style.display = 'block';
}
