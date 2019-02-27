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

import { FirebaseAuth } from './firebase-auth';
import { AuthenticationHandler } from './authentication-handler';
import { Config } from './config';
import { HttpClient } from '../utils/http-client';
import { CICPRequestHandler } from './cicp-request';
import { IAPRequestHandler } from './iap-request';
import { runIfDefined } from '../utils/index';
import { AuthTenantsStorageManager } from './auth-tenants-storage';
import { globalStorageManager } from '../storage/manager';

/** Interface defining IAP/CICP operation handler for sign-in, sign-out and re-auth flows. */
export interface OperationHandler {
  type: string;
  start(): Promise<void>;
}

/**
 * Enum for the operation type.
 * @enum {string}
 */
export enum OperationType {
  SignIn = 'SIGN_IN',
  SignOut = 'SIGN_OUT',
}

/**
 * Base abstract class used for authentication operation handling.
 * All common authentication operation logic and variables are initialized/handled in this class.
 * The abstract class is used to factor out common logic in subclasses.
 */
export abstract class BaseOperationHandler implements OperationHandler {
  protected readonly cicpRequest: CICPRequestHandler;
  protected readonly iapRequest: IAPRequestHandler;
  protected readonly auth: FirebaseAuth;
  protected readonly redirectUrl: string;
  protected readonly tenantId: string;
  protected readonly state: string;
  protected readonly languageCode: string;
  private readonly authTenantsStorageManager: AuthTenantsStorageManager;
  private readonly httpClient: HttpClient;
  private progressBarVisible: boolean;

  /**
   * Initializes an operation handler for a specific Auth operation.
   * It will also initialize all underlying dependencies needed to get the current
   * Auth state, CICP and IAP request handlers, etc.
   *
   * @param {Config} config The current operation configuration.
   * @param {AuthenticationHandler} handler The Authentication handler instance.
   * @constructor
   */
  constructor(
      protected readonly config: Config,
      protected readonly handler: AuthenticationHandler) {
    // Initialize the CICP and IAP request handlers.
    this.httpClient = new HttpClient();
    this.cicpRequest = new CICPRequestHandler(this.config.apiKey, this.httpClient);
    this.iapRequest = new IAPRequestHandler(this.httpClient);
    // Initialize the corresponding Auth instance for the requested tenant ID if available.
    this.auth = this.handler.getAuth(this.config.tid);
    // The redirect URL if available.
    this.redirectUrl = config.redirectUrl;
    // The tenant ID if available.
    this.tenantId = config.tid;
    // The state JWT if available.
    this.state = config.state;
    // The language code if available.
    this.languageCode = config.hl;
    // Progress bar initially not visible.
    this.progressBarVisible = false;
    // Initialize auth tenants storage manager. Note that API key should be available at this point,
    // otherwise an error would be thrown.
    this.authTenantsStorageManager = new AuthTenantsStorageManager(globalStorageManager, config.apiKey);
  }

  /** @return {OperationType} The corresponding operation type. */
  public abstract get type(): OperationType;

  /** @return {Promise<void>} A promise that resolves when the operation handler is initialized. */
  public abstract start(): Promise<void>;

  /** Shows progress bar if hidden. */
  protected showProgressBar() {
    if (!this.progressBarVisible) {
      this.progressBarVisible = true;
      runIfDefined(this.handler.showProgressBar, this.handler);
    }
  }

  /** Hides progress bar if visible. */
  protected hideProgressBar() {
    if (this.progressBarVisible) {
      this.progressBarVisible = false;
      runIfDefined(this.handler.hideProgressBar, this.handler);
    }
  }

  /** @return {boolean} Whether the progress bar is visible. */
  protected isProgressBarVisible(): boolean {
    return this.progressBarVisible;
  }

  /** @return {Promise<Array<string>} A promise that resolves with the list of stored tenant IDs. */
  protected listAuthTenants(): Promise<string[]> {
    return this.authTenantsStorageManager.listTenants();
  }

  /**
   * Removes a tenant ID from the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to remove.
   * @return {Promise<void>} A promise that resolves on successful removal.
   */
  protected removeAuthTenant(tenantId: string): Promise<void> {
    return this.authTenantsStorageManager.removeTenant(tenantId);
  }

  /**
   * Adds a tenant ID to the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to add.
   * @return {Promise<void>} A promise that resolves on successful addition.
   */
  protected addAuthTenant(tenantId: string): Promise<void> {
    return this.authTenantsStorageManager.addTenant(tenantId);
  }

  /**
   * Clears list of stored authenticated tenants.
   *
   * @return {Promise<void>} A promise that resolves on successful clearing of all authenticated tenants.
   */
  protected clearAuthTenants(): Promise<void> {
    return this.authTenantsStorageManager.clearTenants();
  }
}
