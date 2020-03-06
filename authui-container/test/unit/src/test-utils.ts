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

import { addReadonlyGetter } from '../../../src/utils/index';
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
  private listeners: Array<((user: User) => void)>;

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
      addReadonlyGetter(this, key, stubbedMethods[key]);
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
      addReadonlyGetter(this, key, stubbedMethods[key]);
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
