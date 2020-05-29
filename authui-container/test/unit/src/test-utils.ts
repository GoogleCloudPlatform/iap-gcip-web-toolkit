/*
 * Copyright 2020 Google Inc.
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

import { isNonNullObject } from '../../../src/utils/validator';
import {
  HttpResponse, HttpRequestConfig, LowLevelError,
} from '../../../src/utils/http-client';
import * as utils from '../../../src/utils/index';

export type Unsubscribe = () => void;

interface AppOptions {
  apiKey: string;
  authDomain: string;
}

export interface User {
  uid: string;
  tenantId?: string | null;
  getIdToken(forceRefresh?: boolean): Promise<string>;
  [key: string]: any;
}

export interface FirebaseApp {
  options: {
    apiKey: string;
    authDomain?: string;
  };
  auth(): MockAuth;
}

export interface FirebaseAuth {
  app: FirebaseApp;
  currentUser: User | null;
  tenantId?: string;
  /* tslint:enable:variable-name */
  onAuthStateChanged(
    nextOrObserver: ((a: User | null) => any),
    error?: (a: Error) => any,
    completed?: Unsubscribe,
  ): Unsubscribe;
  signOut(): Promise<void>;
  [key: string]: any;
}

/**
 * Creates a MockApp with the provided parameters.
 * @param config The FirebaseApp configuration.
 * @param authStubbedMethods The stubbed Auth methods.
 * @param tenantId The optional tenant ID.
 * @return The generated MockApp instance.
 */
export function createMockApp(
    config: AppOptions,
    authStubbedMethods?: {[key: string]: any},
    tenantId?: string) {
  const mockApp = new MockApp(config);
  const mockAuth = new MockAuth(mockApp, authStubbedMethods, tenantId);
  mockApp.setMockAuth(mockAuth);
  return mockApp;
}

/** Defines the mock FirebaseApp class. */
export class MockApp implements FirebaseApp {
  private mockAuth: MockAuth;
  constructor(private readonly appOptions: AppOptions) {}

  /** @return The MockApp options. */
  public get options() {
    return this.appOptions;
  }

  /** @return The underlying MockAuth instance. */
  public auth() {
    return this.mockAuth;
  }

  /**
   * Sets the associated MockAuth instance.
   * @param auth The MockAuth instance to set.
   */
  public setMockAuth(auth: MockAuth) {
    this.mockAuth = auth;
  }
}

/** Defines the mock FirebaseAuth class. */
export class MockAuth implements FirebaseAuth {
  /* tslint:enable:variable-name */
  private user: User;
  private listeners: ((user: User) => void)[];

  /**
   * Initializes the mock Auth instance.
   *
   * @param app The associated MockApp instance.
   * @param stubbedMethods The optional Auth stubbed methods.
   * @param tenantId The optional tenant ID.
   */
  constructor(
      public readonly app: MockApp,
      stubbedMethods?: {[key: string]: any},
      public tenantId?: string) {
    this.listeners = [];
    this.app = app;
    for (const key in stubbedMethods) {
      if (stubbedMethods.hasOwnProperty(key)) {
        utils.addReadonlyGetter(this, key, stubbedMethods[key]);
      }
    }
  }

  /**
   * @return The current user instance.
   */
  public get currentUser(): User | null {
    return this.user || null;
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

  /**
   * Initializes the mock user.
   *
   * @param uid The mock user's uid.
   * @param idToken The mock user's ID token.
   * @param stubbedMethods The mock user's stubbed methods.
   * @param tenantId The optional mock user's tenant ID.
   */
  constructor(
      public readonly uid: string,
      private idToken: string,
      stubbedMethods?: {[key: string]: any},
      public readonly tenantId: string | null = null) {
    this.processed = false;
    this.expiredToken = false;
    this.disabledUser = false;
    for (const key in stubbedMethods) {
      if (stubbedMethods.hasOwnProperty(key)) {
        utils.addReadonlyGetter(this, key, stubbedMethods[key]);
      }
    }
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
   * @return A promise that resolves with the ID token
   */
  public getIdToken(): Promise<string> {
    const error = new Error('message');
    if (this.expiredToken) {
      utils.addReadonlyGetter(error, 'code', 'auth/user-token-expired');
      // Auth will auto-signout the user when its refresh token is expired.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else if (this.disabledUser) {
      utils.addReadonlyGetter(error, 'code', 'auth/user-disabled');
      // Auth will auto-signout the user when it is disabled.
      return (this.auth ? this.auth.signOut() : Promise.resolve())
        .then(() => {
          throw error;
        });
    } else {
      // Append user processed status on ID token. This helps confirm the ID token was
      // generated after the user was processed.
      return Promise.resolve(
          this.idToken + (this.processed ? '-processed' : ''));
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
  utils.addReadonlyGetter(error, 'status', status);
  utils.addReadonlyGetter(error, 'config', config);
  utils.addReadonlyGetter(error, 'request', request);
  utils.addReadonlyGetter(error, 'response', response);
  return error as LowLevelError;
}

/**
 * Generates a mock 200 HttpResponse with corresponding headers and data.
 *
 * @param headers The headers to include in the mock HttpResponse.
 * @param response The optional raw HTTP body response.
 * @return The corresponding mock HttpResponse.
 */
export function createMockHttpResponse(headers: object, response?: any): HttpResponse {
  let data: any;
  let text: any;
  if (isNonNullObject(response)) {
    data = response;
    text = JSON.stringify(response);
  } else {
    text = response;
  }
  return {
    status: 200,
    headers,
    text,
    data,
    request: {},
    isJson: () => isNonNullObject(response),
  };
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
