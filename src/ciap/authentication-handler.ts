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

import { FirebaseAuth, UserCredential } from './firebase-auth';
import { isNonNullObject } from '../utils/validator';

/**
 * The Authentication handler interface provided externally used to handle sign-in
 * and sign-out for various Auth tenants and other UI related functionality.
 */
export interface AuthenticationHandler {
  // Returns the Auth instance for the corresponding tenant.
  getAuth(tenantId: string): FirebaseAuth;
  // Starts sign in with the corresponding Auth instance. Developer is expected to show
  // the corresponding sign in options based on auth.tenantId.
  startSignIn(
      auth: FirebaseAuth,
      locale?: string,
  ): Promise<UserCredential>;
  // Triggered after user is signed out from all tenants or from single tenant with no redirect URL.
  completeSignOut(): Promise<void>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
}

/**
 * Checks whether the supplied handler complies with the AuthenticationHandler interface.
 *
 * @param {any} handler The handler to confirm.
 * @return {boolean} Whether the handler complies with the AuthenticationHandler interface.
 */
export function isAuthenticationHandler(handler: any): handler is AuthenticationHandler {
  if (isNonNullObject(handler) &&
      typeof handler.getAuth === 'function' &&
      typeof handler.startSignIn === 'function' &&
      typeof handler.completeSignOut === 'function') {
    if (typeof handler.showProgressBar !== 'undefined' &&
        typeof handler.showProgressBar !== 'function') {
      return false;
    }
    if (typeof handler.hideProgressBar !== 'undefined' &&
        typeof handler.hideProgressBar !== 'function') {
      return false;
    }
    return true;
  }
  return false;
}
