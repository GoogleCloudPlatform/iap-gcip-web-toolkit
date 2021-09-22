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
import React from 'react';
// Import Firebase dependencies.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
// Import FirebaseUI dependencies.
import * as firebaseui from 'firebaseui';
import '../../node_modules/firebaseui/dist/firebaseui.css';
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';

// The list of UI configs for each supported tenant.
const tenantsConfig = {
  // Project-level IdPs flow.
  _: {
    displayName: 'My Organization',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
  },
  // Single tenant flow.
  'wtitenant-v0s72': {
    displayName: 'My Company',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'saml.okta-cicp-app',
        providerName: 'SAML',
        buttonColor: '#4666FF',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
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
  },
  // Multiple tenants flow.
  'tenant-a-esjtn': {
    displayName: 'Company A',
    buttonColor: '#007bff',
    iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'saml.okta-cicp-app',
        providerName: 'SAML',
        buttonColor: '#4666FF',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
      },
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
  },
  'tenant-b-59ih0': {
    displayName: 'Company B',
    buttonColor: '#007bff',
    iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      {
        provider: 'saml.okta-cicp-app',
        providerName: 'SAML',
        buttonColor: '#4666FF',
        iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
      },
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
  },
  'tenant-c-iooex': {
    displayName: 'Company C',
    buttonColor: '#007bff',
    iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
  },
  'tenant-d-9t831': {
    displayName: 'Company D',
    buttonColor: '#007bff',
    iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
    ],
    tosUrl: '/tos',
    privacyPolicyUrl: '/privacypolicy',
  },
};

interface FirebaseUiState {
  title?: string;
}

class FirebaseUi extends React.Component<{}, FirebaseUiState> {
  constructor(props: {}) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    // Fetch configuration via reserved Firebase Hosting URL.
    fetch('/__/firebase/init.json').then((response) => {
      return response.json();
    })
    .then((config: any) => {
      const configs: any = {};
      configs[config.apiKey] = {
        authDomain: config.authDomain,
        callbacks: {
          // The callback to trigger when tenant selection page is shown.
          selectTenantUiShown: () => {
            this.setState({
              title: 'Select Employer',
            });
          },
          // The callback to trigger when tenant selection page is hidden.
          selectTenantUiHidden: () => {
            this.setState({
              title: undefined,
            });
          },
          // The callback to trigger when the sign-in page
          // is shown.
          signInUiShown: (tenantId: string | null) => {
            const configKey = tenantId ? tenantId : '_';
            const title = (tenantsConfig as any)[configKey].displayName;
            this.setState({
              title,
            });
          },
          beforeSignInSuccess: (user: any) => {
            // Do additional processing on user before sign-in is
            // complete.
            return Promise.resolve(user);
          },
        },
        displayMode: 'optionsFirst',
        // The terms of service URL and privacy policy URL for the page
        // where the user selects a tenant or enters an email for tenant/provider
        // matching.
        tosUrl: '/tos',
        privacyPolicyUrl: '/privacypolicy',
        tenants: tenantsConfig,
      };
      // This will handle the underlying handshake for sign-in, sign-out,
      // token refresh, safe redirect to callback URL, etc.
      const handler = new firebaseui.auth.FirebaseUiHandler(
          '#firebaseui-container', configs);
      try {
        const ciapInstance = new ciap.Authentication(handler);
        ciapInstance.start();
      } catch (e) {
        console.log(e);
      }
    })
    .catch(console.log);
  }

  render(): JSX.Element {
    return (
      <div className="main-container">
        {!!this.state.title &&
          <h5 id="tenant-header" className="heading-center">
            <span id="tid">{this.state.title}</span>
          </h5>
        }
        <div id="firebaseui-container"></div>
      </div>
    );
  }
}

export default FirebaseUi;
