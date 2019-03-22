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
// Import CICP/IAP module (using local build).
import * as ciap from '../../../dist/index.esm';

// The list of UI configs for each supported tenant.
const uiConfigs = {
  // Tenant ID.
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
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
    credentialHelper: firebaseui.auth.CredentialHelper.NONE,
    callbacks: {
      uiShown: function() {
        document.getElementById('tid').textContent='1036546636501';
        document.getElementById('tenant-header').classList.remove('hidden');
      }
    }
  },
};

// Fetch configuration via reserved Firebase Hosting URL.
fetch('/__/firebase/init.json').then((response) => {
  return response.json();
}).then((config) => {
  // This will handle the underlying handshake for sign-in, sign-out,
  // token refresh, safe redirect to callback URL, etc.
  const handler = new firebaseui.auth.FirebaseUiHandler(
      '#firebaseui-container', config, uiConfigs);
  const ciapInstance = new ciap.Authentication(handler);
  ciapInstance.start();
});
