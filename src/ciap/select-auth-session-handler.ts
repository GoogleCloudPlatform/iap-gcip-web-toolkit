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

import { AuthenticationHandler, ProviderMatch } from './authentication-handler';
import { BaseOperationHandler, OperationType } from './base-operation-handler';
import { Config, ConfigMode } from './config';
import {
  setCurrentUrl, getCurrentUrl, isHistoryAndCustomEventSupported, pushHistoryState,
} from '../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';
import { SessionInfoResponse } from './iap-request';
import { SharedSettings } from './shared-settings';

/**
 * Defines the select auth session operation handler.
 */
export class SelectAuthSessionOperationHandler extends BaseOperationHandler {
  private tenantIds: string[];

  /**
   * Initializes a select auth session operation handler. This will present a UI to the end
   * user to select a tenant out of a list of other tenants to sign in with.
   *
   * @param config The current operation configuration.
   * @param handler The Authentication handler instance.
   * @param sharedSettings The shared settings to use for caching RPC requests.
   */
  constructor(
      config: Config,
      handler: AuthenticationHandler,
      sharedSettings?: SharedSettings) {
    super(config, handler, sharedSettings);
    if (!this.redirectUrl || !this.state) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  }

  /**
   * @return The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SelectAuthSession;
  }

  /**
   * Starts the select auth session operation handler processing. This will result in a
   * UI being presented to the end user to pick a tenant from.
   *
   * @return A promise that resolves when the internal operation handler processing is completed.
   * @override
   */
  protected process(): Promise<void> {
    let providerMatch: ProviderMatch;
    // This will resolve with the tenants associated with the current sign-in session.
    return this.getSessionInformation()
      .then((sessionInfo: SessionInfoResponse) => {
        const projectConfig = {
          projectId: this.projectId,
          apiKey: this.config.apiKey,
        };
        this.tenantIds = sessionInfo.tenantIds.concat();
        // This should never happen.
        if (this.tenantIds.length === 0) {
            throw new CIAPError(CLIENT_ERROR_CODES.internal, 'No tenants configured on resource.');
        }
        this.hideProgressBar();
        return typeof this.handler.selectProvider === 'function' ?
            // Ask the user to select the desired tenant.
            this.handler.selectProvider(projectConfig, this.tenantIds) :
            // Select first option if no selectProvider is available.
            // This makes it easier to upgrade without breaking apps.
            Promise.resolve({tenantId: sessionInfo.tenantIds[0]});
      })
      .then((match: ProviderMatch) => {
        providerMatch = match;
        // If null is returned as tenantId, project level flow is selected.
        const selectedTenantId = match.tenantId || `_${this.projectId}`;
        if (this.tenantIds.indexOf(selectedTenantId) === -1) {
          // Selected tenant ID is not associated with the current resource.
          throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Mismatching tenant ID');
        }
        return selectedTenantId;
      })
      .then((tenantId: string) => {
        // Parse current URL. Update query string with API key, state, redirect URL and the select tenant ID.
        const parsedUrl = new URL(getCurrentUrl(window));
        const authUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
        const key = encodeURIComponent(this.config.apiKey);
        const state = encodeURIComponent(this.state);
        const redirectUrl = encodeURIComponent(this.redirectUrl);
        const tid = encodeURIComponent(tenantId);
        const signInUrl =
            `${authUrl}?mode=${ConfigMode.Login}&apiKey=${key}&tid=${tid}&state=${state}&redirect_uri=${redirectUrl}`;
        // Redirect to sign in page.
        if (isHistoryAndCustomEventSupported(window)) {
          const data = {
            state: 'signIn',
            providerMatch,
          };
          pushHistoryState(
            window,
            data,
            // Keep the same title.
            window.document.title,
            // Update URL to sign-in URL.
            signInUrl,
          );
          // Only popstate is supported natively. Create custom pushstate event to
          // notify Authentication instance of this change.
          const event = new CustomEvent('pushstate', {
            bubbles: true,
            detail: {
              data,
            },
          });
          window.dispatchEvent(event);
          return Promise.resolve();
        } else {
          // Old browser that does not support history API.
          // ProviderMatch needs to be passed via hash.
          const hash = providerMatch.email || providerMatch.providerIds ?
            `#hint=${providerMatch.email};${(providerMatch.providerIds || []).join(',')}` : '';
          this.showProgressBar();
          setCurrentUrl(window, `${signInUrl}${hash}`);
        }
      });
  }
}
