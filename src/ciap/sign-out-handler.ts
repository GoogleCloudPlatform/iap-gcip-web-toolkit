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
import { setCurrentUrl } from './../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';

/**
 * Defines the sign-out operation handler.
 */
export class SignOutOperationHandler extends BaseOperationHandler {

  /**
   * Initializes an sign-out operation handler. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @param {Config} config The current operation configuration.
   * @param {AuthenticationHandler} handler The Authentication handler instance.
   * @constructor
   * @extends {BaseOperationHandler}
   * @implements {OperationHandler}
   */
  constructor(config: Config, handler: AuthenticationHandler) {
    super(config, handler);
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
   * @return {OperationType} The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignOut;
  }

  /**
   * Starts the sign-out operation handler processing. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @return {Promise<void>} A promise that resolves when the internal operation handler processing is completed.
   * @override
   */
  protected process(): Promise<void> {
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
      } else {
        // For multi-tenant signout, do not redirect.
        this.hideProgressBar();
        // No redirect URL to go back to. Let developer handle completion.
        return this.handler.completeSignOut();
      }
    });
  }

  /**
   * @return {Promise<void>} A promise that resolves after sign out from specified tenant or
   *     all tenants are resolved.
   */
  private signOut(): Promise<void> {
    // Single tenant instance identified.
    if (this.auth) {
      return this.auth.signOut().then(() => {
        // Remove tenant ID from storage.
        return this.removeAuthTenant(this.tenantId);
      });
    }
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
