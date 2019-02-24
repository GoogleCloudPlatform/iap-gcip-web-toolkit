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

import { FirebaseAuth, User, Unsubscribe, UserCredential } from '../../src/ciap/firebase-auth';
import { addReadonlyGetter, runIfDefined } from '../../src/utils/index';
import { AuthenticationHandler } from '../../src/ciap/authentication-handler';
import { LowLevelError, HttpRequestConfig } from '../../src/utils/http-client';
import { Factory } from '../../src/storage/storage';
import { StorageManager } from '../../src/storage/manager';

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
 * Mock Storage utility that mimics the Storage interface:
 * https://developer.mozilla.org/en-US/docs/Web/API/Storage
 * This is used to stub window.localStorage and window.sessionStorage in unit tests.
 */
export class MockStorage {
  private map: {[key: string]: string};
  /**
   * Initializes a mock Storage instance.
   * @param {boolean=} isAvailable Whether storage is available. Throws an error on access if not.
   * @param {boolean=} noop Whether storage operations are no-ops.
   * @constructor
   */
  constructor(private readonly isAvailable: boolean = true, private readonly noop: boolean = false) {
    this.map = {};
  }

  /**
   * Returns the value corresponding to the key provided.
   * @param {string} key The key whose value is to be returned.
   * @return {string} The value corresponding to the key.
   */
  public getItem(key: string): string {
    this.checkIsAvailable();
    return this.map[key] || null;
  }

  /**
   * Saves the key/value pair in storage.
   * @param {string} key The key of the entry to save.
   * @param {string} value The value corresponding to the entry.
   */
  public setItem(key: string, value: string) {
    this.checkIsAvailable();
    // Don't save the entry if this is a no-op.
    if (!this.noop) {
      this.map[key] = value;
    }
  }

  /**
   * Removes the item associated with the provided key.
   * @param {string} key The key whose entry is to be removed.
   */
  public removeItem(key: string) {
    this.checkIsAvailable();
    delete this.map[key];
  }

  /** Clears Storage from any saved data. */
  public clear() {
    this.checkIsAvailable();
    this.map = {};
  }

  /** @return {number} The number of entries currently stored. */
  public get length() {
    return Object.keys(this.map).length;
  }

  /**
   * Returns the value associated with the entry index.
   * @param {number} index The index of the entry whose value is to be returned.
   * @return {string} The value corresponding to the entry identified by the index.
   */
  public key(index: number): string {
    this.checkIsAvailable();
    return Object.keys(this.map)[index];
  }

  /**
   * @return {Array<string>} The list of keys of the entries stored.
   */
  public get keys() {
    return Object.keys(this.map);
  }

  /** Checks if storage is available. If not, throws an error */
  private checkIsAvailable() {
    if (!this.isAvailable) {
      throw new Error('unavailable');
    }
  }
}

/** Defines the mock FirebaseAuth class. */
export class MockAuth implements FirebaseAuth {
  private user: User;
  private listeners: Array<((user: User) => void)>;

  /**
   * Initializes the mock Auth instance.
   *
   * @param {string=} tenantId The optional tenant ID.
   * @constructor
   */
  constructor(public tenantId?: string) {
    this.listeners = [];
  }

  /**
   * @return {User|null} The current user instance.
   */
  public get currentUser(): User | null {
    return this.user || null;
  }

  /**
   * Subscribes a listener to user state changes on the current Auth instance.
   *
   * @param {function(User)} cb The listener to trigger on user state change.
   */
  public onAuthStateChanged(cb: ((user: User) => void)): Unsubscribe {
    this.listeners.push(cb);
    // onAuthStateChanged triggers when new listener is added.
    Promise.resolve().then(() => {
      cb(this.currentUser);
    });
    return () => {
      const size = this.listeners.length;
      for (let i = size - 1; i >= 0; i--) {
        if (cb === this.listeners[i]) {
          this.listeners.splice(i, 1);
        }
      }
    };
  }

  /**
   * Simulates a mock user signing in. This will trigger any existing Auth state listeners.
   *
   * @param {User} mockUser The mock user signing in.
   */
  public setCurrentMockUser(mockUser: User) {
    if (this.user !== mockUser) {
      this.user = mockUser;
      this.listeners.forEach((cb: (user: User) => void) => {
        cb(mockUser);
      });
    }
  }

  /**
   * Signs out the current user. This will trigger any existing Auth state listeners.
   *
   * @return {Promise<void>} A promise that resolves on user sign out.
   */
  public signOut(): Promise<void> {
    if (this.user !== null) {
      this.user = null;
      this.listeners.forEach((cb: (user: User) => void) => {
        cb(null);
      });
    }
    return Promise.resolve();
  }
}

/** Defines the mock User class. */
export class MockUser {
  /**
   * Initializes the mock user.
   *
   * @param {string} uid The mock user's uid.
   * @param {string} idToken The mock user's ID token.
   * @constructor
   */
  constructor(public readonly uid: string, private idToken: string) {}

  /**
   * Updates the user's current ID token.
   *
   * @param {string} newIdToken The new ID token to return on getIdToken().
   */
  public updateIdToken(newIdToken: string) {
    this.idToken = newIdToken;
  }

  /**
   * @return {Promise<string>} A promise that resolves with the ID token
   */
  public getIdToken(): Promise<string> {
    return Promise.resolve(this.idToken);
  }
}

/** Defines the Mock AuthenticationHandler builder. */
export class MockAuthenticationHandler implements AuthenticationHandler {
  private progressBarVisible: boolean;

  /**
   * Initializes the mock AuthenticationHandler instance with the provided tenant ID to Auth map.
   *
   * @param {Object<string, FirebaseAuth>} tenant2Auth The tenant to FirebaseAuth map.
   * @param {function()=} onStartSignIn The optional callback to run when startSignIn is triggered.
   * @constructor
   */
  constructor(
      private readonly tenant2Auth: {[key: string]: FirebaseAuth},
      private readonly onStartSignIn?: () => void) {
    this.progressBarVisible = false;
  }

  /**
   * @param {string} tenantId the tenant identifier whose FirebaseAuth instance is to be
   *     returned.
   * @return {FirebaseAuth|null} The Auth instance for the corresponding tenant.
   */
  public getAuth(tenantId: string): FirebaseAuth | null {
    return this.tenant2Auth[tenantId];
  }

  /**
   * Starts sign in with the corresponding Auth instance. Developer is expected to show
   * the corresponding sign in options based on auth.tenantId.
   *
   * @param {FirebaseAuth} auth The Auth instance to sign in with.
   * @return {Promise<UserCredential>} A promise that resolves with the UserCredential on sign-in success.
   */
  public startSignIn(auth: FirebaseAuth): Promise<UserCredential> {
    return new Promise((resolve, reject) => {
      auth.onAuthStateChanged((user) => {
        // Resolve promise if the user is signed in.
        if (user) {
          resolve({user});
        }
      });
      // Run onStartSignIn callback if available.
      runIfDefined(this.onStartSignIn);
    });
  }

  /** @return {Promise<void>} A promise that resolves on developer sign out completion handling. */
  public completeSignOut(): Promise<void> {
    return Promise.resolve();
  }

  /** Displays the progress bar. */
  public showProgressBar(): void {
    this.progressBarVisible = true;
  }

  /** Hides the progress bar. */
  public hideProgressBar(): void {
    this.progressBarVisible = false;
  }

  /** @return {boolean} Whether the progress bar is visible or not. */
  public isProgressBarVisible(): boolean {
    return this.progressBarVisible;
  }
}

/**
 * Generates a mock user with the provided properties.
 *
 * @param {string} uid The mock user uid.
 * @param {string} idToken The ID token for the mock user.
 * @return {User} A mock user instance with the corresponding properties.
 */
export function createMockUser(uid: string, idToken: string): MockUser {
  return new MockUser(uid, idToken);
}

/**
 * @param {string=} tenantId The optional tenant ID to set on the FirebaseAuth instance.
 * @return {FirebaseAuth} A mock FirebaseAuth instance.
 */
export function createMockAuth(tenantId?: string): MockAuth {
  return new MockAuth(tenantId);
}

/**
 * Creates a mock AuthenticationHandler instance.
 *
 * @param {Object<string, FirebaseAuth>} tenant2Auth The tenant to FirebaseAuth map.
 * @return {AuthenticationHandler} The mock AuthenticationHandler instance.
 */
export function createMockAuthenticationHandler(
    tenant2Auth: {[key: string]: FirebaseAuth},
    onStartSignIn?: () => void): MockAuthenticationHandler {
  return new MockAuthenticationHandler(tenant2Auth, onStartSignIn);
}

/**
 * Creates a mock LowLevelError using the parameters provided.
 *
 * @param {string} message The error message.
 * @param {number} status The HTTP error code.
 * @param {object|string=} response The low level response.
 * @param {HttpRequestConfig=} config The original HTTP request configuration.
 * @param {Request=} request The original Request object.
 * @return {LowLevelError} The corresponding mock LowLevelError.
 */
export function createMockLowLevelError(
    message: string, status: number, response?: {data: string | object},
    config?: HttpRequestConfig, request?: RequestInit): LowLevelError {
  const error = new Error(message);
  addReadonlyGetter(error, 'status', status);
  addReadonlyGetter(error, 'config', config);
  addReadonlyGetter(error, 'request', request);
  addReadonlyGetter(error, 'response', response);
  return error as LowLevelError;
}

/** @return {StorageManager} A StorageManager instance with mock localStorage/sessionStorage. */
export function createMockStorageManager() {
  const mockWin = {
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage(),
  };
  return new StorageManager(new Factory(mockWin as any));
}
