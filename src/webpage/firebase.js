'use strict';

const firebase = require('firebase/app');
const firebaseui = require('firebaseui');
const { firebaseConfig } = require('../../config.js');

// Add the Firebase products that you want to use
require("firebase/auth");

const uiConfig = {
	callbacks: {
		// eslint-disable-next-line no-unused-vars
		signInSuccessWithAuthResult: function(authResult, redirectUrl) {
			// User successfully signed in.
			// Return type determines whether we continue the redirect automatically
			// or whether we leave that to developer to handle.
			return true;
		},
		uiShown: function() {
			// The widget is rendered.
			// Hide the loader.
			document.getElementById('loader').style.display = 'none';
		}
	},
	credentialHelper: firebaseui.auth.CredentialHelper.NONE,
	// Will use popup for IDP Providers sign-in flow instead of the default, redirect.
	signInFlow: 'popup',
	signInOptions: [
		firebase.auth.EmailAuthProvider.PROVIDER_ID,
		firebaseui.auth.AnonymousAuthProvider.PROVIDER_ID
	],
	tosUrl: '/terms',
	privacyPolicyUrl: '/privacy'
};

function initApp(callback) {
	// Initialize Firebase
	firebase.initializeApp(firebaseConfig);
	const ui = new firebaseui.auth.AuthUI(firebase.auth());
	ui.start('#firebaseui-auth-container', uiConfig);

	firebase.auth().onAuthStateChanged(function(user) {
		if (user) {
			document.getElementById('modal-login').style.display = 'none';
			callback(user);
		}
		else {
			document.getElementById('modal-login').style.display = 'block';
			document.getElementById('modal-background').style.display = 'none';
			document.getElementById('modal-background-disable').style.display = 'none';
			document.getElementById('firebaseui-auth-container').style.display = 'block';
		}
	}, function(error) {
		console.log(error);
	});
}

module.exports = {
	initApp
};
