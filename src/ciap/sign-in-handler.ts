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
import { RedirectServerResponse } from './iap-request';
import { UserCredential, User, IdTokenResult } from './firebase-auth';
import { setCurrentUrl, isCrossOriginIframe } from '../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';
import { SharedSettings } from './shared-settings';

/**
 * The threshold to force token refresh in milliseconds.
 * Currently this is 2 minutes.
 */
export const FORCE_REFRESH_THRESHOLD = 1000 * 60 * 2;

/**
 * Defines the sign-in operation handler.
 */
export class SignInOperationHandler extends BaseOperationHandler {
  /**
   * Initializes a sign-in operation handler. This will either present the sign-in
   * UI for the specified tenant ID or get an ID token for a user already signed in with
   * that specific tenant.
   *
   * @param config The current operation configuration.
   * @param handler The Authentication handler instance.
   * @param sharedSettings The shared settings to use for caching RPC requests.
   * @param forceReauth Whether to force re-authentication or not. When this is true,
   *     even if a user is already signed in, they will still be required to re-authenticate via
   *     the sign-in UI.
   */
  constructor(
      config: Config,
      handler: AuthenticationHandler,
      sharedSettings?: SharedSettings,
      private readonly forceReauth: boolean = false) {
    super(config, handler, sharedSettings);
    if (!this.auth || !this.redirectUrl || !this.state) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  }

  /**
   * @return The corresponding operation type.
   */
  public get type(): OperationType {
    return OperationType.SignIn;
  }

  /**
   * Starts the sign-in operation handler processing. This either results in the sign-in UI being presented, or
   * the ID token being retrieved for an already signed in user that does not require
   * re-authentication.
   *
   * @return A promise that resolves when the internal operation handler processing is completed.
   */
  protected process(): Promise<void> {
    // This will validate URLs and initialize auth tenant storage manager.
    return this.getUser()
      .then((user: User | null) => {
        // User available and re-auth not required.
        if (user && !this.forceReauth) {
          // Pass user back.
          return this.finishSignIn(user);
        } else {
          // Do not allow sign-in in a cross origin iframe.
          // Only allow silent re-authentication.
          if (isCrossOriginIframe(window)) {
            this.hideProgressBar();
            throw new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'The page is displayed in a cross origin iframe.');
          }
          // No user available, start sign-in flow.
          return this.startSignIn();
        }
      });
  }

  /**
   * @return A promise that resolves with the signed in user if available or null otherwise.
   */
  private getUser(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        unsubscribe();
        // If the existing user doesn't match the expected tenant ID, trigger sign-in flow.
        // This is possible since it is possible currentUser and Auth instance tenant ID do not match.
        if (user && this.userHasMatchingTenantId(user)) {
          resolve(user);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Handles additional processing on the user if needed by the developer.
   *
   * @param user The user to process.
   * @return The processed user.
   */
  private processUser(user: User): Promise<User> {
    let resolveProcessedUser: Promise<User> = Promise.resolve(user);
    if (typeof this.handler.processUser === 'function') {
      // In some cases like signInWithRedirect, on return back to page, the user will be automatically
      // signed in and the onAuthStateChanged listener will trigger with a user.
      // However, the developer may want to do some additional processing on the user, such as
      // linking a provider, updating profile, or ask user for additional information to store
      // separately.
      resolveProcessedUser = this.handler.processUser(user);
    }
    return resolveProcessedUser
      .then((processedUser: User) => {
        // Sanity check user tenant ID once again.
        if (this.userHasMatchingTenantId(processedUser)) {
          return processedUser;
        } else {
          throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Mismatching tenant ID');
        }
      });
  }

  /**
   * Starts sign-in UI flow when no ID token is available.
   *
   * @return A promise that resolves when sign-in UI is successfully started.
   */
  private startSignIn(): Promise<void> {
    return Promise.resolve()
      .then(() => {
        this.hideProgressBar();
        // Pass the SelectedTenantInfo, if available, to startSignIn as it will help determine the best IdP
        // to sign in the current user.
        return this.handler.startSignIn(this.auth, this.config.selectedTenantInfo || undefined)
          .then((result: UserCredential) => {
            // On successful sign-in, get ID token and complete sign-in.
            this.showProgressBar();
            // Sanity check signed in user tenant ID matches the expected config tenant ID.
            if (!this.userHasMatchingTenantId(result.user)) {
              throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Mismatching tenant ID');
            }
            return this.finishSignIn(result.user);
          });
      });
  }

  /**
   * Completes sign-in using the provided user.
   *
   * @param user The current signed in user.
   * @return A promise that resolves on sign-in completion and redirect back to
   *    original URI.
   */
  private finishSignIn(user: User): Promise<void> {
    let originalUrl: string;
    let currentUser: User;
    // Process user first.
    return this.processUser(user)
      .then((processedUser) => {
        currentUser = processedUser;
        // Get ID token of processed user.
        return processedUser.getIdTokenResult();
      })
      .then((result: IdTokenResult) => {
        const issuedAtTime = new Date(result.issuedAtTime).getTime();
        const delta = new Date().getTime() - issuedAtTime;
        // If token is within refresh threshold, do not force refresh.
        if (delta <= FORCE_REFRESH_THRESHOLD) {
          return result.token;
        }
        // Force refresh. This makes it possible to refresh the token before it's expired
        // to ensure a fresh token with a predictable expiration is available at all times.
        // By doing so, this makes the iframe session refresher which refreshes every 45 minutes
        // easier to use.
        return currentUser.getIdToken(true);
      })
      .then((idToken: string) => {
        // Exchange ID token for redirect token and get back original URL.
        return this.cache.cacheAndReturnResult<RedirectServerResponse>(
            this.iapRequest.exchangeIdTokenAndGetOriginalAndTargetUrl,
            this.iapRequest,
            [this.redirectUrl, idToken, this.state],
            CacheDuration.ExchangeIdToken);
      })
      .then((response: RedirectServerResponse) => {
        originalUrl = response.originalUri;
        // Set cookie in targetUri.
        return this.cache.cacheAndReturnResult<void>(
            this.iapRequest.setCookieAtTargetUrl,
            this.iapRequest,
            [response.targetUri, response.redirectToken],
            CacheDuration.SetCookie);
      })
      .then(() => {
        // Store tenant ID for signed in user. This will be used to make sign out from all
        // signed in tenants possible.
        return this.addAuthTenant(this.tenantId);
      })
      .then(() => {
        // Redirect to original URI.
        setCurrentUrl(window, originalUrl);
      })
      .catch((error) => {
        // Check if error thrown due to user being disabled, deleted or token revoked
        // (big account change). This error will be thrown on getIdToken().
        // In that case, core SDK will automatically sign out the user.
        // We should just trigger sign-in flow again.
        if (error.code === 'auth/user-disabled' || error.code === 'auth/user-token-expired') {
          // User should be automatically signed out.
          // Restart sign-in flow.
          return this.removeAuthTenant(this.tenantId)
            .then(() => {
              // Progress bar should still be visible at this point.
              return this.startSignIn();
            });
        }
        // Rethrow error for all other errors.
        throw error;
      });
  }
}
