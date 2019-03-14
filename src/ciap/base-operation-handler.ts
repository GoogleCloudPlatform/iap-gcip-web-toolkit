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
import { runIfDefined, getCurrentUrl } from '../utils/index';
import { AuthTenantsStorageManager } from './auth-tenants-storage';
import { globalStorageManager } from '../storage/manager';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';
import { PromiseCache } from '../utils/promise-cache';

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
 * Enum for the caching timeouts for sign-in RPCs.
 * @enum {number}
 */
export enum CacheDuration {
  CheckAuthorizedDomains = 30 * 60 * 1000,
  ExchangeIdToken = 5 * 60 * 1000,
  GetOriginalUrl = 5 * 60 * 1000,
  SetCookie = 5 * 60 * 1000,
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
  protected readonly cache: PromiseCache;
  private authTenantsStorageManager: AuthTenantsStorageManager;
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
    this.auth = this.getAuth(this.config.tid);
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
    // Initialize promise cache.
    this.cache = new PromiseCache();
  }

  /** @return {OperationType} The corresponding operation type. */
  public abstract get type(): OperationType;

  /** @return {Promise<void>} A promise that resolves when the internal operation handler processing is completed. */
  protected abstract process(): Promise<void>;

  /** @return {Promise<void>} A promise that resolves when the operation handler is initialized. */
  public start(): Promise<void> {
    // Show progress bar. This should be hidden in process, unless an error is thrown.
    this.showProgressBar();
    // Validate URLs and get project ID.
    return this.validateAppAndGetProjectId()
      .then((projectId: string) => {
        // Initialize auth tenants storage manager if not yet initialized. Use project ID as identifier as this is more
        // unique than API key.
        if (!this.authTenantsStorageManager) {
          this.authTenantsStorageManager = new AuthTenantsStorageManager(globalStorageManager, projectId);
        }
        return this.process();
      })
      .catch((error) => {
        this.hideProgressBar();
        // While the developer can catch the error, the handler may also need to handle it. For example FirebaseUI
        // handler can catch the error and take the appropriate action or show an error message to the user.
        // FirebaseUI also comes with the benefit of error localization.
        // Since the error is still thrown after, the developer can still override FirebaseUI handling if
        // they want to do so.
        runIfDefined(this.handler.handleError, this.handler, [error]);
        throw error;
      });
  }

  /**
   * @return {Promise<string>} A promise that resolves when current URL and optional redirect URL
   *      are validated for the configuration API key, and returns the corresponding project ID.
   */
  protected validateAppAndGetProjectId(): Promise<string> {
    const urls: string[] = [];
    // Since API key is provided externally, we need to confirm current URL is authorized for provided API key.
    urls.push(getCurrentUrl(window));
    // Signout from all flows does not have a redirect URL.
    if (this.redirectUrl) {
      urls.push(this.redirectUrl);
    }
    return this.cache.cacheAndReturnResult<string>(
        this.cicpRequest.checkAuthorizedDomainsAndGetProjectId,
        this.cicpRequest,
        [urls],
        CacheDuration.CheckAuthorizedDomains);
  }

  /**
   * Returns the Auth instance corresponding to tenant ID.
   *
   * @param {string} tenantId The requested tenant ID.
   * @return {?FirebaseAuth} The corresponding Auth instance.
   */
  protected getAuth(tenantId: string): FirebaseAuth | null {
    // Pass API key to handler. It is possible the developer may be using same URL for multiple projects.
    const auth = this.handler.getAuth(this.config.apiKey, tenantId);
    // It is critical that requested API key aligns with handler API key.
    // This is important as we could end up checking authorized domain using config API key
    // whose project allows usage of requested domain.
    // However Auth API key of developer Auth instance does not whitelist the requested domain.
    // This is an excessive check as 2 API keys could be different but still belong to same
    // project. Ideally we should compared project IDs. Getting project ID from API key is
    // possible but can be quite expensive. For now we can use this logic.
    if (auth && auth.app.options.apiKey !== this.config.apiKey) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'API key mismatch');
    }
    return auth;
  }

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
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.listTenants();
  }

  /**
   * Removes a tenant ID from the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to remove.
   * @return {Promise<void>} A promise that resolves on successful removal.
   */
  protected removeAuthTenant(tenantId: string): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.removeTenant(tenantId);
  }

  /**
   * Adds a tenant ID to the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to add.
   * @return {Promise<void>} A promise that resolves on successful addition.
   */
  protected addAuthTenant(tenantId: string): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.addTenant(tenantId);
  }

  /**
   * Clears list of stored authenticated tenants.
   *
   * @return {Promise<void>} A promise that resolves on successful clearing of all authenticated tenants.
   */
  protected clearAuthTenants(): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.clearTenants();
  }

  /**
   * Confirms AuthTenantsStorageManager is initialized and ready to use.
   * This is needed to access related operations for managing Auth tenants.
   */
  private checkAuthTenantsStorageManagerInitialized() {
    if (!this.authTenantsStorageManager) {
      throw new CIAPError(CLIENT_ERROR_CODES.internal, 'Instance not started');
    }
  }
}
