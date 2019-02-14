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
import { BaseOperationHandler, OperationType } from './base-operation-handler';
import { Config } from './config';
import { setCurrentUrl } from './../utils/index';

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
      throw new Error('Invalid request!');
    }
    // Single tenant with redirect but no state.
    if (this.auth && this.redirectUrl && !this.state) {
      throw new Error('Invalid request!');
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
   * Starts the sign-out operation handler. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @return {Promise<void>} A promise that resolves when the operation handler is initialized.
   * @override
   */
  public start(): Promise<void> {
    this.showProgressBar();
    // Check redirectUrl if available.
    const initialCheck = this.redirectUrl ?
        this.cicpRequest.isAuthorizedDomain(this.redirectUrl) :
        Promise.resolve(true);
    return initialCheck.then((authorized: boolean) => {
      // Fail if redirect URL exists and is not authorized.
      if (!authorized) {
        throw new Error('unauthorized');
      }
      // Clear internal Auth state.
      return this.signOut();
    }).then(() => {
      // Single tenant sign-out with redirect URL.
      if (this.auth && this.redirectUrl) {
        // Redirect back to IAP resource.
        return this.iapRequest.getOriginalUrlForSignOut(this.redirectUrl, this.tenantId, this.state)
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
    })
    .catch((error) => {
      this.hideProgressBar();
      // TODO: pass error to developer.
      throw error;
    });
  }

  /**
   * @return {Promise<void>} A promise that resolves after sign out from specified tenant or
   *     all tenants are resolved.
   */
  private signOut(): Promise<void> {
    // Single tenant instance identified.
    if (this.auth) {
      return this.auth.signOut();
    }
    // TODO: Sign out from all tenant flows. This will require remembering all tenants
    // previously signed in with.
    return Promise.resolve();
  }
}
