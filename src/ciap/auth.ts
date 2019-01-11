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

export interface AuthenticationHandler {
  // Returns the Auth instance for the corresponding tenant.
  getAuth(tenantId: string): FirebaseAuth;
  // Starts sign in with the corresponding Auth instance. Developer is expected to show
  // the corresponding sign in options based on auth.tenantId.
  startSignIn(
      auth: FirebaseAuth,
      onSuccess: ((result: UserCredential) => void),
      locale?: string,
  ): Promise<void>;
  // Triggered after user is signed out from all tenants.
  // This is optional to provide the developer the ability to render their own
  // UI on signout.
  // This is not called on single tenant sign out.
  completeSignout?(): Promise<void>;
  showProgressBar?(): void;
  hideProgressBar?(): void;
}

export class Authentication {

  constructor(handler: AuthenticationHandler) {
    if (typeof handler === 'undefined') {
      throw new Error('Invalid AuthenticationHandler');
    }
    // TODO
  }

  public start() {
    // TODO
  }
}
