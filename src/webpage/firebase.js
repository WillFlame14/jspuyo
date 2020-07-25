'use strict';

const firebase = require('firebase/app');
const firebaseui = require('firebaseui');
const { firebaseConfig } = require('../../config.js');
const { UserSettings } = require('../Utils.js');

// Add the Firebase products that you want to use
require("firebase/auth");
require("firebase/database");

let newUser = false;
let currentUser = null;
let fallbackName = '';		// Display name that is used if empty string is provided (aka the original name)

let ui;			// firebaseui object

const uiConfig = {
	callbacks: {
		signInSuccessWithAuthResult: function(authResult) {
			// Update global boolean with whether user is new or not
			newUser = authResult.additionalUserInfo.isNewUser;

			// Do not redirect page
			return false;
		},
		uiShown: function() {
			document.getElementById('loader').style.display = 'none';
		}
	},
	credentialHelper: firebaseui.auth.CredentialHelper.NONE,
	// Will use popup for IDP Providers sign-in flow instead of the default, redirect.
	signInFlow: 'popup',
	signInOptions: [
		firebase.auth.EmailAuthProvider.PROVIDER_ID,
		firebase.auth.GoogleAuthProvider.PROVIDER_ID,
		firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
	],
	tosUrl: '/terms',
	privacyPolicyUrl: '/privacy'
};

/**
 * Initialize the firebase login screen and associated UI changes, as well as methods that handle game start on successful login.
 */
function initApp(loginSuccess) {
	// Initialize Firebase
	firebase.initializeApp(firebaseConfig);
	ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);

	initializeUI(loginSuccess);

	firebase.auth().onAuthStateChanged(async function(user) {
		// Just logged in
		if (user) {
			document.getElementById('firebaseui-auth-container').style.display = 'none';

			// Open username change screen if new user
			if(newUser) {
				// Set their current name as default
				document.getElementById('usernamePickerText').value = user.displayName;
				document.getElementById('usernamePickerText').placeholder = user.displayName;
				fallbackName = user.displayName;

				document.getElementById('usernamePicker').style.display = 'block';
				currentUser = user;

				// Login will occur on username submission
			}
			else {
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				if(user.isAnonymous) {
					// If anonymous, clear session once the tab is closed
					await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
				}
				else {
					// If registered, maintain session until manually logged out
					await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
				}

				// Start the actual game logic
				loginSuccess(user);
			}
		}
		// Just logged out
		else {
			document.getElementById('main-content').style.display = 'none';
			document.getElementById('modal-background').style.display = 'none';
			document.getElementById('modal-background-disable').style.display = 'none';

			document.getElementById('modal-login').style.display = 'block';
			document.getElementById('firebaseui-auth-container').style.display = 'block';
		}
	}, function(error) {
		console.log(error);
	});
}

function initializeUI(loginSuccess) {
	// Hackily add the welcome message into the FirebaseUI login screen
	const welcomeMessage = document.createElement('div');
	welcomeMessage.id = 'welcomeMessage';
	welcomeMessage.innerHTML = 'Welcome to jspuyo!';
	document.getElementById('firebaseui-auth-container').prepend(welcomeMessage);

	// Upon submission of the display name change
	document.getElementById('usernamePickerForm').onsubmit = function(event) {
		// Do not refresh the page
		event.preventDefault();

		// Use fallback name if there is no name in the input field
		let username = document.getElementById('usernamePickerText').value || fallbackName;

		usernameAvailable(username).then(() => {
			// Update with new username
			currentUser.updateProfile({ displayName: username }).then(function() {
				PlayerInfo.addUser(currentUser.uid, currentUser.displayName);

				document.getElementById('usernamePickerError').style.display = 'none';
				document.getElementById('modal-login').style.display = 'none';
				document.getElementById('main-content').style.display = 'grid';

				// Start game logic
				loginSuccess(currentUser);
			}
			).catch(function(error) {
				console.log(error);
			});
		}
		).catch(() => {
			// Promise was rejected - username already taken
			document.getElementById('usernamePickerError').style.display = 'block';
			username = document.getElementById('usernamePickerText').value || fallbackName;
		});
	};
}

/**
 * Signs out the current user and opens the login screen again.
 * Used in other modules where Firebase is not accessible.
 */
function signOut() {
	firebase.auth().signOut();
	ui.start('#firebaseui-auth-container', uiConfig);
}

/**
 * Checks if a username is already in use.
 */
function usernameAvailable(username) {
	return new Promise((resolve, reject) => {
		firebase.database().ref(`username`).once('value').then(data => {
			if(!data.exists()) {
				resolve();
			}
			else {
				const takenUsernames = Object.values(data.val()).map(pair => pair.username);
				if(takenUsernames.includes(username)) {
					reject();
				}
				else {
					resolve();
				}
			}
		});
	});
}

// Properties of the firebase auth User object
const userProperties = ['username', 'email'];

class PlayerInfo {
	static addUser(uid, username) {
		firebase.database().ref(`username/${uid}`).set({ username });
		firebase.database().ref(`userSettings/${uid}`).set({ userSettings: JSON.stringify(new UserSettings()) });
		firebase.database().ref(`rating/${uid}`).set({ rating: 1000 });
	}

	static updateUser(uid, property, value) {
		// Update the firebase auth User object if it is one of their properties
		if(userProperties.includes(property)) {
			if(property === 'username') {
				property = 'displayName';
			}
			firebase.auth().currentUser.updateProfile({ [property]: value });
		}

		// Update the database property
		firebase.database().ref(`${property}/${uid}`).set({ value });
	}

	static getUserProperty(uid, property) {
		return new Promise((resolve, reject) => {
			firebase.database().ref(`${property}/${uid}`).once('value').then(data => {
				if(!data.exists()) {
					reject(`No ${property} found for user ${uid}`);
				}
				else {
					resolve(data.val()[property]);
				}
			});
		});
	}
}

module.exports = {
	PlayerInfo,
	initApp,
	signOut
};
