/*
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import '../public/style.css';

// Import Firebase dependencies.
import firebase from '@firebase/app';
import '@firebase/auth';
// Import FirebaseUI dependencies.
import * as firebaseui from 'firebaseui'
// Import GCIP/IAP module (using local build).
import * as ciap from '../../../dist/index.esm';

// The list of UI configs for each supported tenant.
const tenantsConfig = {
  // Agent flow.
  '_': {
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
    credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    callbacks: {
      uiShown: function() {
        document.getElementById('tid').textContent = 'Awesome App';
        document.getElementById('tenant-header').classList.remove('hidden');
      },
      beforeSignInSuccess: function(user) {
        // Do additional processing on user before sign-in is complete.
        return Promise.resolve(user);
      }
    },
  },
  // Tenant flow.
  '1036546636501': {
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'saml.okta-cicp-app',
        providerName: 'SAML',
        buttonColor: '#4666FF',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png'
      },
    ],
    signInFlow: 'redirect',
    // A boolean which determines whether to immediately redirect to the provider's site or
    // instead show the default 'Sign in with Provider' button when there is only a single
    // federated provider in signInOptions. In order for this option to take effect, the
    // signInOptions must only hold a single federated provider (like 'google.com') and
    // signInFlow must be set to 'redirect'.
    immediateFederatedRedirect: false,
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
    credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    callbacks: {
      uiShown: function() {
        document.getElementById('tid').textContent = 'Tenant 1036546636501';
        document.getElementById('tenant-header').classList.remove('hidden');
      },
      beforeSignInSuccess: function(user) {
        // Do additional processing on user before before sign-in is complete.
        return Promise.resolve(user);
      }
    }
  },
};

// Fetch configuration via reserved Firebase Hosting URL.
fetch('/__/firebase/init.json').then((response) => {
  return response.json();
}).then((config) => {
  const configs = {};
  configs[config['apiKey']] = {
    authDomain: config['authDomain'],
    tenants: tenantsConfig
  };
  // This will handle the underlying handshake for sign-in, sign-out,
  // token refresh, safe redirect to callback URL, etc.
  const handler = new firebaseui.auth.FirebaseUiHandler(
      '#firebaseui-container', configs);
  const ciapInstance = new ciap.Authentication(handler);
  ciapInstance.start();
});
