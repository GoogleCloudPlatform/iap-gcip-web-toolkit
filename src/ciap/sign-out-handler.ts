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

import { AuthenticationHandler } from './authentication-handler';
import { BaseOperationHandler, OperationType, CacheDuration } from './base-operation-handler';
import { Config } from './config';
import { setCurrentUrl, isCrossOriginIframe } from './../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';
import { SharedSettings } from './shared-settings';

/**
 * Defines the sign-out operation handler.
 */
export class SignOutOperationHandler extends BaseOperationHandler {
  private originalUri?: string;
  /**
   * Initializes an sign-out operation handler. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @param config The current operation configuration.
   * @param handler The Authentication handler instance.
   * @param sharedSettings The shared settings to use for caching RPC requests.
   */
  constructor(config: Config, handler: AuthenticationHandler, sharedSettings?: SharedSettings) {
    super(config, handler, sharedSettings);
    // Single tenant signout but tenant not found.
    if (this.tenantId && !this.auth) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
    // Single tenant with redirect but no state.
    if (this.auth && this.redirectUrl && !this.state) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  }

  /**
   * @return The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignOut;
  }

  /**
   * Starts the sign-out operation handler processing. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @return A promise that resolves when the internal operation handler processing is completed.
   * @override
   */
  protected process(): Promise<void> {
    // Do not allow signout in a cross origin iframe.
    if (isCrossOriginIframe(window)) {
      this.hideProgressBar();
      return Promise.reject(new CIAPError(
          CLIENT_ERROR_CODES['permission-denied'],
          'The page is displayed in a cross origin iframe.'));
    }
    // Clear internal Auth state.
    return this.signOut().then(() => {
      // Single tenant sign-out with redirect URL.
      if (this.auth && this.redirectUrl) {
        // Redirect back to IAP resource.
        return this.cache.cacheAndReturnResult<string>(
            this.iapRequest.getOriginalUrlForSignOut,
            this.iapRequest,
            [this.redirectUrl, this.tenantId, this.state],
            CacheDuration.GetOriginalUrl,
        )
        .then((originalUrl: string) => {
          // Redirect to original URI.
          setCurrentUrl(window, originalUrl);
        });
      } else if (this.state && this.redirectUrl && this.originalUri) {
        // Used to redirect to original URI when state and redirect URL are provided but
        // no single tenant ID is specified in the URL query string.
        setCurrentUrl(window, this.originalUri);
      } else {
        // For multi-tenant signout, do not redirect.
        this.hideProgressBar();
        // No redirect URL to go back to. Let developer handle completion.
        return this.handler.completeSignOut();
      }
    });
  }

  /**
   * @return A promise that resolves after sign out from specified tenant or all tenants are resolved.
   */
  private signOut(): Promise<void> {
    // Single tenant instance identified.
    if (this.auth) {
      return this.auth.signOut().then(() => {
        // Remove tenant ID from storage.
        return this.removeAuthTenant(this.tenantId);
      });
    } else if (this.state && this.redirectUrl) {
      // When state and IAP redirect URL are provided, we can determine list of tenants
      // associated with the current resource that needs to be signed out from.
      return this.getSessionInformation().then((sessionInfoResponse) => {
        const signoutPromises: Array<Promise<void>> = [];
        // Save original URI. It will be redirected to later.
        this.originalUri = sessionInfoResponse.originalUri;
        sessionInfoResponse.tenantIds.forEach((tenantId: string) => {
          // Get corresponding auth instance.
          const auth = this.getAuth(tenantId);
          if (auth) {
            // Sign out the current user an remove its tenant ID from list of authenticated tenants.
            signoutPromises.push(auth.signOut().then(() => this.removeAuthTenant(tenantId)));
          }
        });
        // Sign out from all instances.
        return Promise.all(signoutPromises);
      })
      .then(() => {
        // Do nothing to resolve promise with void.
      });
    } else {
      // Sign out from all previously authenticated tenants.
      // Get all signed in tenants.
      return this.listAuthTenants()
        .then((tenantList: string[]) => {
          const signoutPromises: Array<Promise<void>> = [];
          tenantList.forEach((tenantId: string) => {
            // Get corresponding auth instance.
            const auth = this.getAuth(tenantId);
            if (auth) {
              // Sign out the current user an remove its tenant ID from list of authenticated tenants.
              signoutPromises.push(auth.signOut().then(() => this.removeAuthTenant(tenantId)));
            }
          });
          // Sign out from all instances.
          return Promise.all(signoutPromises);
        })
        .then(() => {
          // Clear all authenticated tenants. This will clear tenants that were not found.
          return this.clearAuthTenants();
        });
    }
  }
}
