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

// Import Firebase dependencies.
import firebase from 'firebase/app';
import 'firebase/auth';
// Import FirebaseUI dependencies.
import * as firebaseui from 'firebaseui';
// Import configuration.
const config = require('./config.json');

// Import CICP/IAP module (using local build).
import * as ciap from '../../../dist/index.esm.js';

// The list of UI configs for each supported tenant.
const uiConfigs = {
  // TODO: replace tenantId1 with actual tenant ID as well as the
  // corresponding signInOptions for that tenant.
  tenantId1: {
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'oidc.myProvider1',
        providerName: 'Provider1',
        buttonColor: '#ADD8E6',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png'
      },
      {
        provider: 'oidc.myProvider2',
        providerName: 'Provider1',
        buttonColor: '#FFB6C1',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png'
      },
    ]
  },
  // TODO: replace tenantId2 with actual tenant ID as well as the
  // corresponding signInOptions for that tenant.
  tenantId2: {
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'saml.myProvider1',
        providerName: 'Provider1',
        buttonColor: '#ADD8E6',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png'
      },
      {
        provider: 'saml.myProvider2',
        providerName: 'Provider1',
        buttonColor: '#FFB6C1',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png'
      },
    ]
  },
};

// This will handle the underlying handshake for sign-in, sign-out,
// token refresh, safe redirect to callback URL, etc.
const handler = new firebaseui.auth.FirebaseUiHandler(
    '#firebaseui-container', config, uiConfigs);
const ciapInstance = new ciap.Authentication(handler);
ciapInstance.start();
