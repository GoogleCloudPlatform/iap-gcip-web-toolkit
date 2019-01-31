/*!
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FirebaseAuth } from '../../src/ciap/firebase-auth';
import { AuthenticationHandler } from '../../src/ciap/authentication-handler';

 /**
 * Creates the mock URL for testing configuration URLs.
 *
 * @param {string|undefined} mode The optional operation mode.
 * @param {string|undefined} apiKey The optional API key.
 * @param {string|undefined} tid The optional tenant ID.
 * @param {string|undefined} redirectUri The optional redirect URL.
 * @param {string|undefined} state The optional state.
 * @param {string|undefined} hl The optional language code.
 * @return {string} A mock configuration URL built with requested parameters.
 */
export function createMockUrl(
    mode: string, apiKey?: string, tid?: string, redirectUri?: string,
    state?: string, hl?: string): string {
  return `https://www.example.com/path/page?` +
      `apiKey=${encodeURIComponent(apiKey || '')}` +
      `&mode=${encodeURIComponent(mode || '')}` +
      `&tid=${encodeURIComponent(tid || '')}` +
      `&redirect_uri=${encodeURIComponent(redirectUri || '')}` +
      `&state=${encodeURIComponent(state || '')}` +
      `&hl=${encodeURIComponent(hl || '')}`;
}

/**
 * @param {string=} tenantId The optional tenant ID to set on the FirebaseAuth instance.
 * @return {FirebaseAuth} A mock FirebaseAuth instance.
 */
export function createMockAuth(tenantId?: string): FirebaseAuth {
  return {
    tenantId,
    onAuthStateChanged: () => {
      // Return null function.
      return () => {};
    },
    signOut: () => Promise.resolve(),
  };
}

/**
 * Creates a mock AuthenticationHandler instance.
 *
 * @param {(function(string): FirebaseAuth)} getAuth The getAuth function to use.
 * @return {AuthenticationHandler} The mock AuthenticationHandler instance.
 */
export function createMockAuthenticationHandler(
    getAuth: (tenantId: string) => FirebaseAuth): AuthenticationHandler {
  return {
    getAuth,
    startSignIn: () => Promise.resolve(),
  };
}
