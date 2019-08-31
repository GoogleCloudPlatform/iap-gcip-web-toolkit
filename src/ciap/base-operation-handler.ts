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

import { FirebaseAuth, User } from './firebase-auth';
import { AuthenticationHandler } from './authentication-handler';
import { Config } from './config';
import { GCIPRequestHandler } from './gcip-request';
import { IAPRequestHandler, SessionInfoResponse } from './iap-request';
import { runIfDefined, getCurrentUrl, addReadonlyGetter } from '../utils/index';
import { AuthTenantsStorageManager } from './auth-tenants-storage';
import { globalStorageManager } from '../storage/manager';
import { CLIENT_ERROR_CODES, CIAPError, isRecoverableError } from '../utils/error';
import { PromiseCache } from '../utils/promise-cache';
import { SharedSettings } from './shared-settings';

/** Interface defining IAP/GCIP operation handler for sign-in, sign-out and re-auth flows. */
export interface OperationHandler {
  type: string;
  start(): Promise<void>;
  getOriginalURL(): Promise<string | null>;
}

/**
 * Enum for the operation type.
 * @enum
 */
export enum OperationType {
  SignIn = 'SIGN_IN',
  SignOut = 'SIGN_OUT',
  SelectAuthSession = 'SELECT_AUTH_SESSION',
}

/**
 * Enum for the caching timeouts for sign-in RPCs.
 * @enum
 */
export enum CacheDuration {
  CheckAuthorizedDomains = 30 * 60 * 1000,
  ExchangeIdToken = 5 * 60 * 1000,
  GetOriginalUrl = 5 * 60 * 1000,
  GetSessionInfo = 5 * 60 * 1000,
  SetCookie = 5 * 60 * 1000,
}

/**
 * Base abstract class used for authentication operation handling.
 * All common authentication operation logic and variables are initialized/handled in this class.
 * The abstract class is used to factor out common logic in subclasses.
 */
export abstract class BaseOperationHandler implements OperationHandler {
  protected readonly gcipRequest: GCIPRequestHandler;
  protected readonly iapRequest: IAPRequestHandler;
  protected readonly auth: FirebaseAuth | null;
  protected readonly redirectUrl: string;
  protected readonly tenantId: string;
  protected readonly state: string;
  protected readonly languageCode: string;
  protected readonly cache: PromiseCache;
  protected projectId: string;
  private readonly realTenantId: string | null;
  private authTenantsStorageManager: AuthTenantsStorageManager;
  private progressBarVisible: boolean;

  /**
   * Initializes an operation handler for a specific Auth operation.
   * It will also initialize all underlying dependencies needed to get the current
   * Auth state, GCIP and IAP request handlers, etc.
   *
   * @param config The current operation configuration.
   * @param handler The Authentication handler instance.
   * @param sharedSettings The shared settings to use for caching RPC requests.
   */
  constructor(
      protected readonly config: Config,
      protected readonly handler: AuthenticationHandler,
      sharedSettings?: SharedSettings) {
    if (!sharedSettings) {
      sharedSettings = new SharedSettings(config.apiKey);
    }
    // Initialize the GCIP and IAP request handlers.
    this.gcipRequest = sharedSettings.gcipRequest;
    this.iapRequest = sharedSettings.iapRequest;
    // Initialize promise cache.
    this.cache = sharedSettings.cache;
    // This is the real tenant ID. For an agent flow, this is null.
    this.realTenantId = this.getRealTenantId(this.config.tid);
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
  }

  /** @return The corresponding operation type. */
  public abstract get type(): OperationType;

  /**
   * @return A promise that resolves with the original URL that the user was trying to access
   *     before being asked to authenticate.
   */
  public getOriginalURL(): Promise<string | null> {
    if (this.state && this.redirectUrl) {
      // originalUri may not always be available. For example, the signout from all project related
      // sessions does not require the user to visit IAP first.
      return this.getSessionInformation()
        .then((sessionInfo: SessionInfoResponse) => {
          return sessionInfo.originalUri;
        });
    } else {
      // When no originalUri is available, resolve with null.
      return Promise.resolve(null);
    }
  }

  /** @return A promise that resolves when the internal operation handler processing is completed. */
  protected abstract process(): Promise<void>;

  /** @return A promise that resolves when the operation handler is initialized. */
  public start(): Promise<void> {
    // Show progress bar. This should be hidden in process, unless an error is thrown.
    this.showProgressBar();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.removeEventListener('popstate', historyEventHandler, true);
      };
      const historyEventHandler = (event) => {
        // On popstate events, hide progress bar, remove event listener and resolve promise.
        // This will be detected by parent Auth instance which will initialize a new OperationHandler to
        // handle the new state.
        this.hideProgressBar();
        cleanup();
        // Provide enough time for nextAuth instance to be initialized by resolving asynchronously.
        Promise.resolve().then(resolve);
      };
      // Listen to popstate events.
      window.addEventListener('popstate', historyEventHandler, true);
      // Validate URLs and get project ID.
      return this.validateAppAndGetProjectId()
        .then((projectId: string) => {
          this.projectId = projectId;
          // Validate agent flow has matching project ID.
          // This will not run when no tid is available (tenant has to be selected first).
          if (this.tenantId &&
              !this.realTenantId &&
              `_${projectId}` !== this.tenantId) {
            throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Mismatching project numbers');
          }
          // Initialize auth tenants storage manager if not yet initialized. Use project ID as identifier as
          // this is more unique than API key.
          if (!this.authTenantsStorageManager) {
            this.authTenantsStorageManager = new AuthTenantsStorageManager(globalStorageManager, projectId);
          }
          return this.process();
        })
        .then(() => {
          // On resolution, remove popstate event listener.
          cleanup();
          resolve();
        })
        .catch((error) => {
          // On error, remove popstate event listener.
          cleanup();
          this.hideProgressBar();
          // Allow retrial if the error is recoverable.
          if (isRecoverableError(error)) {
            // Inject retry on the error. This allows the handler to recover without any reference to the
            // CIAPAuthentication instance.
            // By passing the retry function in the error, it also provides access to it for developers
            // catching the error in the catch block of the start() call.
            addReadonlyGetter(error, 'retry', () => {
              return this.start();
            });
          }
          // While the developer can catch the error, the handler may also need to handle it. For example FirebaseUI
          // handler can catch the error and take the appropriate action or show an error message to the user.
          // FirebaseUI also comes with the benefit of error localization.
          // Since the error is still thrown after, the developer can still override FirebaseUI handling if
          // they want to do so.
          runIfDefined(this.handler.handleError, this.handler, [error]);
          reject(error);
        });
    });
  }

  /**
   * @return A promise that resolves with the current session information. This is used to retrieve
   *     the list of tenant IDs and the original URL associated with the current IAP resource being
   *     accessed.
   */
  protected getSessionInformation(): Promise<SessionInfoResponse> {
    return this.cache.cacheAndReturnResult<SessionInfoResponse>(
        this.iapRequest.getSessionInfo,
        this.iapRequest,
        [this.redirectUrl, this.state],
        CacheDuration.GetSessionInfo);
  }

  /**
   * @return A promise that resolves when current URL and optional redirect URL
   *      are validated for the configuration API key, and returns the corresponding project ID.
   */
  protected validateAppAndGetProjectId(): Promise<string> {
    const urls: string[] = [];
    const currentUrl = new URL(getCurrentUrl(window));
    // Since API key is provided externally, we need to confirm current URL is authorized for provided API key.
    // To take full advantage of caching, only check the origin of the request. The path and query string do not
    // matter.
    urls.push(currentUrl.origin);
    // Signout from all flows does not have a redirect URL.
    if (this.redirectUrl) {
      urls.push(this.redirectUrl);
    }
    return this.cache.cacheAndReturnResult<string>(
        this.gcipRequest.checkAuthorizedDomainsAndGetProjectId,
        this.gcipRequest,
        [urls],
        CacheDuration.CheckAuthorizedDomains);
  }

  /**
   * Returns the Auth instance corresponding to tenant ID.
   *
   * @param tenantId The requested tenant ID. For agent flows, this is "_<ProjectNumber>".
   *     For tenant flows, this is "<TenantId>".
   * @return The corresponding Auth instance.
   */
  protected getAuth(tenantId: string): FirebaseAuth | null {
    // For sign out from all flow, no tenant ID or agent ID will be available.
    if (!tenantId) {
      return null;
    }
    // Pass API key to handler. It is possible the developer may be using same URL for multiple projects.
    const auth = this.handler.getAuth(this.config.apiKey, this.getRealTenantId(tenantId));
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

  /** @return Whether the progress bar is visible. */
  protected isProgressBarVisible(): boolean {
    return this.progressBarVisible;
  }

  /** @return A promise that resolves with the list of stored tenant IDs. */
  protected listAuthTenants(): Promise<string[]> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.listTenants();
  }

  /**
   * Removes a tenant ID from the list of stored authenticated tenants.
   *
   * @param tenantId The tenant to remove.
   * @return A promise that resolves on successful removal.
   */
  protected removeAuthTenant(tenantId: string): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.removeTenant(tenantId);
  }

  /**
   * Adds a tenant ID to the list of stored authenticated tenants.
   *
   * @param tenantId The tenant to add.
   * @return A promise that resolves on successful addition.
   */
  protected addAuthTenant(tenantId: string): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.addTenant(tenantId);
  }

  /**
   * Clears list of stored authenticated tenants.
   *
   * @return A promise that resolves on successful clearing of all authenticated tenants.
   */
  protected clearAuthTenants(): Promise<void> {
    this.checkAuthTenantsStorageManagerInitialized();
    return this.authTenantsStorageManager.clearTenants();
  }

  /**
   * Returns whether the provided user has a tenant ID matching current configuration.
   *
   * @param user The user whose tenant ID should match the current instance's.
   * @return Whether the user matches the configuration tenant ID.
   */
  protected userHasMatchingTenantId(user: User): boolean {
    // If both user tenant ID and config tid are null or undefined, skip check.
    if ((user.tenantId || this.realTenantId) &&
        user.tenantId !== this.realTenantId) {
      return false;
    }
    return true;
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

  /**
   * @param tenantId The configuration tenant ID.
   * @return The real tenant ID from Auth SDK perspective.
   *     For agent flows, this is null.
   */
  private getRealTenantId(tenantId: string): string | null {
    // Agent flow.
    if (tenantId && tenantId.charAt(0) === '_') {
      return null;
    }
    // Tenant flow.
    return tenantId;
  }
}
