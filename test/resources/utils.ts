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

import {
  FirebaseAuth, FirebaseApp, User, Unsubscribe, UserCredential, IdTokenResult,
} from '../../src/ciap/firebase-auth';
import { addReadonlyGetter, runIfDefined } from '../../src/utils/index';
import {
  AuthenticationHandler, ProjectConfig, SelectedTenantInfo,
} from '../../src/ciap/authentication-handler';
import { LowLevelError, HttpRequestConfig } from '../../src/utils/http-client';
import { Factory } from '../../src/storage/storage';
import { StorageManager } from '../../src/storage/manager';

 /**
  * Creates the mock URL for testing configuration URLs.
  *
  * @param mode The optional operation mode.
  * @param apiKey The optional API key.
  * @param tid The optional tenant ID.
  * @param redirectUri The optional redirect URL.
  * @param state The optional state.
  * @param hl The optional language code.
  * @return A mock configuration URL built with requested parameters.
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
   * @param isAvailable Whether storage is available. Throws an error on access if not.
   * @param noop Whether storage operations are no-ops.
   */
  constructor(private readonly isAvailable: boolean = true, private readonly noop: boolean = false) {
    this.map = {};
  }

  /**
   * Returns the value corresponding to the key provided.
   * @param key The key whose value is to be returned.
   * @return The value corresponding to the key.
   */
  public getItem(key: string): string {
    this.checkIsAvailable();
    return this.map[key] || null;
  }

  /**
   * Saves the key/value pair in storage.
   * @param key The key of the entry to save.
   * @param value The value corresponding to the entry.
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
   * @param key The key whose entry is to be removed.
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

  /** @return The number of entries currently stored. */
  public get length() {
    return Object.keys(this.map).length;
  }

  /**
   * Returns the value associated with the entry index.
   * @param index The index of the entry whose value is to be returned.
   * @return The value corresponding to the entry identified by the index.
   */
  public key(index: number): string {
    this.checkIsAvailable();
    return Object.keys(this.map)[index];
  }

  /**
   * @return The list of keys of the entries stored.
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

/** Defines the mock FirebaseApp class. */
class MockApp implements FirebaseApp {
  constructor(private readonly apiKey: string) {}

  public get options() {
    return {
      apiKey: this.apiKey,
    };
  }
}

/** Defines the mock FirebaseAuth class. */
export class MockAuth implements FirebaseAuth {
  public readonly app: MockApp;
  /* tslint:disable:variable-name */
  public readonly INTERNAL: {logFramework: (string) => void};
  /* tslint:enable:variable-name */
  private user: User;
  private listeners: Array<((user: User) => void)>;
  private frameworks: string[];

  /**
   * Initializes the mock Auth instance.
   *
   * @param apiKey The Auth instance API key.
   * @param tenantId The optional tenant ID.
   */
  constructor(private readonly apiKey: string, public tenantId?: string) {
    this.frameworks = [];
    this.listeners = [];
    this.app = new MockApp(apiKey);
    this.INTERNAL = {
      logFramework: (framework: string) => {
        if (this.frameworks.indexOf(framework) === -1) {
          this.frameworks.push(framework);
        }
      },
    };
  }

  /**
   * @return The current user instance.
   */
  public get currentUser(): User | null {
    return this.user || null;
  }

  /**
   * @return The logged frameworks.
   */
  public get loggedFrameworks(): string[] {
    return this.frameworks.slice();
  }

  /** Clears logged frameworks. */
  public clearLoggedFrameworks() {
    this.frameworks = [];
  }

  /**
   * Subscribes a listener to user state changes on the current Auth instance.
   *
   * @param cb The listener to trigger on user state change.
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
   * @param mockUser The mock user signing in.
   */
  public setCurrentMockUser(mockUser: MockUser) {
    // Set Auth instance on the user. This makes it easy for an expired or disabled user to
    // remove itself as currentUser from the corresponding Auth instance.
    mockUser.auth = this;
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
   * @return A promise that resolves on user sign out.
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
  public auth: MockAuth;
  public processed: boolean;
  private expiredToken: boolean;
  private disabledUser: boolean;
  private issuedAtDate: Date | null;

  /**
   * Initializes the mock user.
   *
   * @param uid The mock user's uid.
   * @param idToken The mock user's ID token.
   * @param tenantId The optional mock user's tenant ID.
   */
  constructor(
      public readonly uid: string,
      private idToken: string,
      public readonly tenantId: string | null = null) {
    this.processed = false;
    this.expiredToken = false;
    this.disabledUser = false;
  }

  /**
   * Updates the user's current ID token.
   *
   * @param newIdToken The new ID token to return on getIdToken().
   */
  public updateIdToken(newIdToken: string) {
    this.idToken = newIdToken;
  }

  /**
   * Updates the user's current ID token dates.
   *
   * @param newIssuedAtDate The new issued-at date.
   */
  public updateIdTokenDates(newIssuedAtDate?: Date) {
    this.issuedAtDate = newIssuedAtDate || null;
  }

  /**
   * @param forceRefresh Whether to force token refresh.
   * @return A promise that resolves with the ID token.
   */
  public getIdToken(forceRefresh: boolean = false): Promise<string> {
    const error = new Error('message');
    if (this.expiredToken) {
      addReadonlyGetter(error, 'code', 'auth/user-token-expired');
      // Auth will auto-signout the user when its refresh token is expired.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else if (this.disabledUser) {
      addReadonlyGetter(error, 'code', 'auth/user-disabled');
      // Auth will auto-signout the user when it is disabled.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else {
      // Append user processed / refresh status on ID token. This helps confirm the
      // ID token was generated after the user was processed or refreshed.
      return Promise.resolve(
        this.idToken +
        (this.processed ? '-processed' : '') +
        (forceRefresh ? '-refreshed' : ''));
      }
  }

  /**
   * @param forceRefresh Whether to force token refresh.
   * @return A promise that resolves with the ID token result.
   */
  public getIdTokenResult(forceRefresh: boolean = false): Promise<IdTokenResult> {
    const error = new Error('message');
    if (this.expiredToken) {
      addReadonlyGetter(error, 'code', 'auth/user-token-expired');
      // Auth will auto-signout the user when its refresh token is expired.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else if (this.disabledUser) {
      addReadonlyGetter(error, 'code', 'auth/user-disabled');
      // Auth will auto-signout the user when it is disabled.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else {
      // Append user processed / refresh status on ID token. This helps confirm the
      // ID token was generated after the user was processed or refreshed.
      const modifiedToken = this.idToken +
          (this.processed ? '-processed' : '') +
          (forceRefresh ? '-refreshed' : '');
      const issuedAtDate = this.issuedAtDate || new Date();

      return Promise.resolve({
        authTime: issuedAtDate.toUTCString(),
        claims: {},
        // Expiration is always 1 hour from the issued at time.
        expirationTime: new Date(issuedAtDate.getTime() + 3600 * 1000).toUTCString(),
        issuedAtTime: issuedAtDate.toUTCString(),
        signInProvider: null,
        token: modifiedToken,
      });
    }
  }

  /** Expires the user's refresh token. */
  public expireToken() {
    this.expiredToken = true;
  }

  /** Disables the current user. */
  public disableUser() {
    this.disabledUser = true;
  }
}

/** Defines the Mock AuthenticationHandler builder. */
export class MockAuthenticationHandler implements AuthenticationHandler {
  public languageCode: string;
  private progressBarVisible: boolean;
  private lastHandledError: Error;

  /**
   * Initializes the mock AuthenticationHandler instance with the provided tenant ID to Auth map.
   *
   * @param tenant2Auth The tenant to FirebaseAuth map.
   * @param onStartSignIn The optional callback to run when startSignIn is triggered.
   * @param selectedTenantInfo The optional SelectedTenantInfo to return on selectTenant call. If
   *     not provided, the first option in the list of tenant IDs is returned.
   */
  constructor(
      private readonly tenant2Auth: {[key: string]: FirebaseAuth},
      private readonly onStartSignIn?: () => void,
      private readonly selectedTenantInfo?: SelectedTenantInfo) {
    this.progressBarVisible = false;
  }

  /**
   * Returns the FirebaseAuth instance corresponding to the requested API key and tenant ID.
   *
   * @param apiKey The API key whose FirebaseAuth instance is to be returned.
   * @param tenantId the tenant identifier whose FirebaseAuth instance is to be
   *     returned.
   * @return The Auth instance for the corresponding tenant.
   */
  public getAuth(apiKey: string, tenantId: string | null): FirebaseAuth | null {
    // Simulate agent configuration identifier by underscore key.
    return this.tenant2Auth[tenantId || '_'];
  }

  /**
   * Starts sign in with the corresponding Auth instance. Developer is expected to show
   * the corresponding sign in options based on auth.tenantId.
   *
   * @param auth The Auth instance to sign in with.
   * @return A promise that resolves with the UserCredential on sign-in success.
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

  /** @return A promise that resolves on developer sign out completion handling. */
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

  /**
   * Handler for any error thrown by Authentication object.
   *
   * @param error The error thrown and passed to handler.
   */
  public handleError(error: Error): void {
    this.lastHandledError = error;
  }

  /**
   * Applies additional processing to the signed in user if necessary.
   *
   * @param user The signed in user that may need additional processing.
   * @return A promise that resolves with the processed user.
   */
  public processUser(user: User): Promise<User> {
    (user as MockUser).processed = true;
    return Promise.resolve(user);
  }

  /**
   * Selects `SelectedTenantInfo` based on the list of tenant IDs provided.
   *
   * @param projectConfig The project configuration associated with the tenants.
   * @param tenantIds The list of IDs of the tenants associated with the IAP resource.
   * @return A promise that resolves with the `SelectedTenantInfo` based on the user selection.
   */
  public selectTenant(projectConfig: ProjectConfig, tenantIds: string[]): Promise<SelectedTenantInfo> {
    if (this.selectedTenantInfo) {
      return Promise.resolve(this.selectedTenantInfo);
    }
    return Promise.resolve({
      tenantId: tenantIds[0],
    });
  }

  /** @return Whether the progress bar is visible or not. */
  public isProgressBarVisible(): boolean {
    return this.progressBarVisible;
  }

  /** @return The last handled error if available. */
  public getLastHandledError(): Error | null {
    return this.lastHandledError || null;
  }
}

/**
 * Generates a mock user with the provided properties.
 *
 * @param uid The mock user uid.
 * @param idToken The ID token for the mock user.
 * @param tenantId The optional tenant ID for the mock user.
 * @return A mock user instance with the corresponding properties.
 */
export function createMockUser(
    uid: string, idToken: string, tenantId?: string | null): MockUser {
  return new MockUser(uid, idToken, tenantId);
}

/**
 * @param apiKey The FirebaseAuth instance's API key.
 * @param tenantId The optional tenant ID to set on the FirebaseAuth instance.
 * @return A mock FirebaseAuth instance.
 */
export function createMockAuth(apiKey: string, tenantId?: string): MockAuth {
  return new MockAuth(apiKey, tenantId);
}

/**
 * Creates a mock AuthenticationHandler instance.
 *
 * @param tenant2Auth The tenant to FirebaseAuth map.
 * @param onStartSignIn The optional callback to run when startSignIn is triggered.
 * @param selectedTenantInfo The optional SelectedTenantInfo to return on selectTenant call. If not
 *     provided, the first option in the list of tenant IDs is returned.
 * @return The mock AuthenticationHandler instance.
 */
export function createMockAuthenticationHandler(
    tenant2Auth: {[key: string]: FirebaseAuth},
    onStartSignIn?: () => void,
    selectedTenantInfo?: SelectedTenantInfo): MockAuthenticationHandler {
  return new MockAuthenticationHandler(tenant2Auth, onStartSignIn, selectedTenantInfo);
}

/**
 * Creates a mock LowLevelError using the parameters provided.
 *
 * @param message The error message.
 * @param status The HTTP error code.
 * @param response The low level response.
 * @param config The original HTTP request configuration.
 * @param request The original Request object.
 * @return The corresponding mock LowLevelError.
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

/** @return A StorageManager instance with mock localStorage/sessionStorage. */
export function createMockStorageManager() {
  const mockWin = {
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage(),
  };
  return new StorageManager(new Factory(mockWin as any));
}

/** A map of user agents for different browsers used for testing. */
export const USER_AGENTS = {
  opera: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHT' +
      'ML, like Gecko) Chrome/49.0.2623.110 Safari/537.36 OPR/36.0.2130.74',
  ie: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0;' +
      ' SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; ' +
      'Media Center PC 6.0; .NET4.0C)',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10240',
  firefox: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:46.0) Gecko/201' +
      '00101 Firefox/46.0',
  silk: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, li' +
      'ke Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11-4) AppleWebKit' +
      '/601.5.17 (KHTML, like Gecko) Version/9.1 Safari/601.5.17',
  chrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, ' +
      'like Gecko) Chrome/50.0.2661.94 Safari/537.36',
  iOS8iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) A' +
      'ppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12A366 Safar' +
      'i/600.1.4',
  iOS7iPod: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 7_0_3 like Mac OS ' +
      'X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11B511 ' +
      'Safari/9537.53',
  iOS7iPad: 'Mozilla/5.0 (iPad; CPU OS 7_0 like Mac OS X) AppleWebKit/' +
      '537.51.1 (KHTML, like Gecko) CriOS/30.0.1599.12 Mobile/11A465 Safari/8' +
      '536.25 (3B92C18B-D9DE-4CB7-A02A-22FD2AF17C8F)',
  iOS7iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 7_0_4 like Mac OS X)' +
      'AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11B554a Sa' +
      'fari/9537.53',
  android: 'Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Buil' +
      'd/IML74K) AppleWebkit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Sa' +
      'fari/534.30',
  blackberry: 'Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleW' +
      'ebKit/534.11+ (KHTML, like Gecko) Version/7.1.0.346 Mobile Safari/534.' +
      '11+',
  webOS: 'Mozilla/5.0 (webOS/1.3; U; en-US) AppleWebKit/525.27.1 (KHTM' +
      'L, like Gecko) Version/1.0 Safari/525.27.1 Desktop/1.0',
  windowsPhone: 'Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0' +
      ';Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 920)',
  chrios: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 5_1_1 like Mac OS X; ' +
      'en) AppleWebKit/534.46.0 (KHTML, like Gecko) CriOS/19.0.1084.60 Mobile' +
      '/9B206 Safari/7534.48.3',
  iOS9iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_2 like Mac OS X) A' +
      'ppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13C75 Safar' +
      'i/601.1',
  // This user agent is manually constructed and not copied from a production
  // user agent.
  chrome55iOS10: 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 10_2_0 like Ma' +
      'c OS X; en) AppleWebKit/534.46.0 (KHTML, like Gecko) CriOS/55.0.2883.7' +
      '9 Mobile/9B206 Safari/7534.48.3',
};