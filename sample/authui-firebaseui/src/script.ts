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
import '../node_modules/firebaseui/dist/firebaseui.css';
import '../public/style.css';

// Import Firebase dependencies.
import * as firebase from 'firebase/app';
import 'firebase/auth';
// Import FirebaseUI dependencies.
import * as firebaseui from 'firebaseui';
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';

// The list of UI configs for each supported tenant.
const tenantsConfig = {
  // Project level IdPs flow.
  '*': {
    displayName: 'My Organization',
    signInOptions: [
      firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    ],
    immediateFederatedRedirect: true,
  },
};

// Fetch configuration via reserved Firebase Hosting URL.
fetch('/__/firebase/init.json').then((response) => {
  return response.json();
}).then((config) => {
  const configs = {};
  configs[config.apiKey] = {
    authDomain: config.authDomain,
    displayMode: 'optionsFirst',
    tenants: tenantsConfig,
  };
  // This will handle the underlying handshake for sign-in, sign-out,
  // token refresh, safe redirect to callback URL, etc.
  const handler = new firebaseui.auth.FirebaseUiHandler(
      '#firebaseui-container', configs);
  const ciapInstance = new ciap.Authentication(handler);
  ciapInstance.start();
});
