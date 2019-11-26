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

import { FirebaseAuth, UserCredential, User } from './firebase-auth';
import { isNonNullObject } from '../utils/validator';

export interface SelectedTenantInfo {
  email?: string;
  tenantId: string | null;
  providerIds?: string[];
}

export interface ProjectConfig {
  projectId: string;
  apiKey: string;
}

/**
 * The Authentication handler interface provided externally used to handle sign-in
 * and sign-out for various Auth tenants and other UI related functionality.
 */
export interface AuthenticationHandler {
  // Language code.
  languageCode?: string | null;
  // Returns the Auth instance for the corresponding API key/tenant.
  getAuth(apiKey: string, tenantId: string | null): FirebaseAuth;
  // Starts sign in with the corresponding Auth instance. Developer is expected to show
  // the corresponding sign in options based on auth.tenantId.
  startSignIn(auth: FirebaseAuth, match?: SelectedTenantInfo): Promise<UserCredential>;
  // Triggered after user is signed out from all tenants or from single tenant with no redirect URL.
  completeSignOut(): Promise<void>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
  // Developer may want to make additional changes to the user before handing ID token to IAP.
  processUser?(user: User): Promise<User>;
  handleError?(error: Error): void;
  selectTenant?(
    projectConfig: ProjectConfig,
    tenantIds: string[],
  ): Promise<SelectedTenantInfo>;
}

/**
 * Checks whether the supplied handler complies with the AuthenticationHandler interface.
 *
 * @param handler The handler to confirm.
 * @return Whether the handler complies with the AuthenticationHandler interface.
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
    if (typeof handler.handleError !== 'undefined' &&
        typeof handler.handleError !== 'function') {
      return false;
    }
    if (typeof handler.processUser !== 'undefined' &&
        typeof handler.processUser !== 'function') {
      return false;
    }
    if (typeof handler.selectTenant !== 'undefined' &&
        typeof handler.selectTenant !== 'function') {
      return false;
    }
    return true;
  }
  return false;
}
