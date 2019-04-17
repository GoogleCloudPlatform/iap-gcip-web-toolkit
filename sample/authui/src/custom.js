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

'use strict';
import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import '../public/style.css';

import 'bootstrap';
// Import CICP/IAP module (using local build).
import * as ciap from '../../../dist/index.esm';
import * as templates from './templates';
import jQuery from 'jquery';
window.$ = window.jQuery = jQuery;

const SAML_PROVIDER_ID = 'saml.okta-cicp-app';

class CustomUiHandler {
  constructor(element, config) {
    this.config = config;
    this.container = document.querySelector(element);
  }

  getAuth(apiKey, tenantId) {
    let auth = null;
    if (apiKey !== this.config.apiKey) {
      throw new Error('Invalid project!');
    }
    try {
      auth = firebase.app(tenantId || undefined).auth();
      // Tenant ID should be already set on initialization below.
    } catch (e) {
      const app = firebase.initializeApp(this.config, tenantId || '[DEFAULT]');
      auth = app.auth();
      auth.tenantId = tenantId || null;
    }
    return auth;
  }

  handleError(error) {
    this.container.innerHTML = templates.showAlert({
      code: error.code,
      message: error.message,
      retry: !!error.retry,
    });
    // Retry will only be show if retry is available.
    $('.alert-link').on('click', (e) => {
      error.retry();
      e.preventDefault();
      return false;
    });
  }

  startSignIn(auth, locale) {
    return new Promise((resolve, reject) => {
      this.container.innerHTML = templates.signIn({
        tenantId: auth.tenantId,
        // Use SAML for tenant flow, Google otherwise.
        saml: !!auth.tenantId,
      });
      // Sign in with SAML provider.
      $('#sign-in-saml').on('click', (e) => {
        $('#error').hide();
        e.preventDefault();
        auth.signInWithRedirect(new firebase.auth.SAMLAuthProvider(SAML_PROVIDER_ID))
          .catch((error) => {
            $('#error').html(templates.showAlert({message: error.message})).show();
          });
        return false;
      });
      $('#sign-in-google').on('click', (e) => {
        $('#error').hide();
        e.preventDefault();
        auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider())
          .catch((error) => {
            $('#error').html(templates.showAlert({message: error.message})).show();
          });
        return false;
      });
      $('#sign-in-facebook').on('click', (e) => {
        $('#error').hide();
        e.preventDefault();
        auth.signInWithRedirect(new firebase.auth.FacebookAuthProvider())
          .catch((error) => {
            $('#error').html(templates.showAlert({message: error.message})).show();
          });
        return false;
      });
      $('#enter-email-form').on('submit', (e) => {
        $('#error').hide();
        e.preventDefault();
        const email = $('#email').val();
        auth.fetchSignInMethodsForEmail(email)
          .then((signInMethods) => {
            if (signInMethods.length) {
              // Show password sign in.
              this.container.innerHTML = templates.signInWithEmail({email});
              $('#sign-in-form').on('submit', (e) => {
                $('#error').hide();
                e.preventDefault();
                const password = $('#password').val();
                auth.signInWithEmailAndPassword(email, password)
                  .then((userCredential) => {
                    resolve(userCredential);
                  })
                  .catch((error) => {
                    $('#error').html(templates.showAlert({message: error.message})).show();
                  });
              });
            } else {
              // Show password sign up.
              this.container.innerHTML = templates.signUpWithEmail({email});
              $('#sign-up-form').on('submit', (e) => {
                $('#error').hide();
                e.preventDefault();
                const displayName = $('#displayName').val() || null;
                const password = $('#password').val();
                auth.createUserWithEmailAndPassword(email, password)
                  .then((userCredential) => {
                    return userCredential.user.updateProfile({displayName})
                      .then(() => {
                        resolve(userCredential);
                      })
                  })
                  .catch((error) => {
                    $('#error').html(templates.showAlert({message: error.message})).show();
                  });
                e.preventDefault();
              });
            }
          })
          .catch((error) => {
            $('#error').html(templates.showAlert({message: error.message})).show();
          });
        return false;
      });
    });
  }

  completeSignOut() {
    this.container.innerHTML = templates.signOut({});
    return Promise.resolve();
  }

  showProgressBar() {
    this.container.innerHTML = templates.showProgressBar({});
  }

  hideProgressBar() {
    this.container.innerHTML = templates.hideProgressBar({});
  }
}

$(() => {
  $('#navbar').html(templates.showNavbar({
    link: `/${window.location.search}`,
  }));
  // Fetch configuration via reserved Firebase Hosting URL.
  fetch('/__/firebase/init.json').then((response) => {
    return response.json();
  }).then((config) => {
    // This will handle the underlying handshake for sign-in, sign-out,
    // token refresh, safe redirect to callback URL, etc.
    const handler = new CustomUiHandler('#sign-in-ui-container', config);
    const ciapInstance = new ciap.Authentication(handler);
    ciapInstance.start();
  });
});
