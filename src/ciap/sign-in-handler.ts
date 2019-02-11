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
import { RedirectServerResponse } from './iap-request';
import { UserCredential } from './firebase-auth';
import { setCurrentUrl } from '../utils/index';

/**
 * Defines the sign-in operation handler.
 */
export class SignInOperationHandler extends BaseOperationHandler {
  private isAuthorizedRedirectUrl: Promise<boolean>;
  /**
   * Initializes a sign-in operation handler. This will either present the sign-in
   * UI for the specified tenant ID or get an ID token for a user already signed in with
   * that specific tenant.
   *
   * @param {Config} config The current operation configuration.
   * @param {AuthenticationHandler} handler The Authentication handler instance.
   * @param {boolean=} forceReauth Whether to force re-authentication or not. When this is true,
   *     even if a user is already signed in, they will still be required to re-authenticate via
   *     the sign-in UI.
   * @constructor
   * @extends {BaseOperationHandler}
   * @implements {OperationHandler}
   */
  constructor(
      config: Config,
      handler: AuthenticationHandler,
      private readonly forceReauth: boolean = false) {
    super(config, handler);
    if (!this.auth || !this.redirectUrl || !this.state) {
      throw new Error('Invalid request!');
    }
  }

  /**
   * @return {OperationType} The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignIn;
  }

  /**
   * Starts the sign-in operation handler. This either results in the sign-in UI being presented, or
   * the ID token being retrieved for an already signed in user that does not require
   * re-authentication.
   *
   * @return {Promise<void>} A promise that resolves when the operation handler is initialized.
   * @override
   */
  public start(): Promise<void> {
    this.showProgressBar();
    return this.getIdToken()
      .then((idToken: string | null) => {
        this.isAuthorizedRedirectUrl = this.cicpRequest.isAuthorizedDomain(this.redirectUrl);
        // ID token available and re-auth not required.
        if (idToken && !this.forceReauth) {
          // Pass ID token back.
          return this.finishSignIn(idToken);
        } else {
          // No ID token available, start sign-in flow.
          return this.startSignIn();
        }
      })
      .catch((error) => {
        this.hideProgressBar();
        // TODO: pass error to developer.
        throw error;
      });
  }

  /**
   * @return {Promise<string|null>} A promise that resolves with an ID token string if
   *     available or null otherwise.
   */
  private getIdToken(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        unsubscribe();
        if (user) {
          return user.getIdToken().then(resolve, reject);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Starts sign-in UI flow when no ID token is available.
   *
   * @return {Promise<void>} A promise that resolves when sign-in UI is successfully started.
   */
  private startSignIn(): Promise<void> {
    return this.isAuthorizedRedirectUrl
      .then((authorized: boolean) => {
        if (!authorized) {
          throw new Error('unauthorized');
        }
        this.hideProgressBar();
        return this.handler.startSignIn(this.auth, this.languageCode).then((result: UserCredential) => {
          // On successful sign-in, get ID token and complete sign-in.
          this.showProgressBar();
          return result.user.getIdToken().then((idToken: string) => {
            return this.finishSignIn(idToken);
          });
        });
      });
  }

  /**
   * Completes sign-in using the provided ID token.
   *
   * @param {string} idToken The current user's ID token.
   * @return {Promise<void>} A promise that resolves on sign-in completion and redirect back to
   *    original URI.
   */
  private finishSignIn(idToken: string): Promise<void> {
    let originalUrl: string;
    // TODO: Store tenant ID for signed in user. This will be used to make sign out from all
    // signed in tenants possible.
    return this.isAuthorizedRedirectUrl
      .then((authorized: boolean) => {
        if (!authorized) {
          throw new Error('unauthorized');
        }
        // Exchange ID token for redirect token and get back original URL.
        return this.iapRequest.exchangeIdTokenAndGetOriginalAndTargetUrl(
            this.redirectUrl, idToken, this.tenantId, this.state);
      })
      .then((response: RedirectServerResponse) => {
        originalUrl = response.originalUri;
        // Set cookie in targetUri.
        return this.iapRequest.setCookieAtTargetUrl(response.targetUri, response.redirectToken);
      })
      .then(() => {
        // Redirect to original URI.
        setCurrentUrl(window, originalUrl);
      });
  }
}
