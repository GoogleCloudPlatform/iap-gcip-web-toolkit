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

export type Unsubscribe = () => void;

export interface IdTokenResult {
  authTime: string;
  claims: {[key: string]: any};
  expirationTime: string;
  issuedAtTime: string;
  signInProvider: string | null;
  signInSecondFactor?: string | null;
  token: string;
}

export interface User {
  uid: string;
  tenantId?: string | null;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;
}

export interface FirebaseApp {
  options: {
    apiKey: string;
    authDomain?: string;
  };
}

export interface FirebaseAuth {
  app: FirebaseApp;
  currentUser: User | null;
  tenantId?: string;
  /* tslint:disable:variable-name */
  INTERNAL: {logFramework: (string) => void};
  /* tslint:enable:variable-name */
  onAuthStateChanged(
    nextOrObserver: ((a: User | null) => any),
    error?: (a: Error) => any,
    completed?: Unsubscribe,
  ): Unsubscribe;
  signOut(): Promise<void>;
}

export interface UserCredential {
  user: User;
}