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

import { FirebaseAuth, UserCredential, User } from '@firebase/auth-types';

declare namespace ciap {
  interface CIAPError {
    httpErrorCode?: number;
    code: string;
    message: string;
    reason?: Error;
    retry?(): Promise<void>;
    toJSON(): object;
  }

  interface ProviderMatch {
    email?: string;
    tenantId: string | null;
    providerIds?: string[];
  }

  interface AuthenticationHandler {
    // Language code.
    languageCode?: string | null;
    // Returns the Auth instance for the corresponding API key/tenant.
    getAuth(apiKey: string, tenantId: string | null): FirebaseAuth;
    // Starts sign in with the corresponding Auth instance. Developer is expected to show
    // the corresponding sign in options based on auth.tenantId.
    startSignIn(auth: FirebaseAuth): Promise<UserCredential>;
    // Triggered after user is signed out from all tenants.
    // This is optional to provide the developer the ability to render their own
    // UI on signout.
    // This is not called on single tenant sign out.
    completeSignout(): Promise<void>;
    // Developer may want to make additional changes to the user before handing ID token to IAP.
    processUser?(user: User): Promise<User>;
    showProgressBar?(): void;
    hideProgressBar?(): void;
    handleError?(error: Error | CIAPError): void;
    selectProvider?(
      tenantIds: string[],
    ): Promise<ProviderMatch>;
  }

  class Authentication {
    constructor(handler: ciap.AuthenticationHandler);
    start(): void;
    getOriginalURL(): Promise<string|null>;
  }
}

declare module 'gcip-iap-js' {
}

export = ciap;
