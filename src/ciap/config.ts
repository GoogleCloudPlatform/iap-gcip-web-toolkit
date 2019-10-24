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

import { sanitizeUrl } from '../utils/index';
import { isEmail, isArray, isNonEmptyString, isProviderId, isString } from '../utils/validator';
import { SelectedTenantInfo } from './authentication-handler';

/** The REGEX used to retrieve the SelectedTenantInfo from the URL hash. */
const SELECTED_TENANT_INFO_REGEXP = /#hint=([^;]*);(.*)$/;

/**
 * Enum for the configuration mode.
 */
export enum ConfigMode {
  Login = 'login',
  Reauth = 'reauth',
  Signout = 'signout',
  SelectAuthSession = 'selectAuthSession',
  Unknown = 'unknown',
}

/**
 * Defines the configuration for the authentication operation.
 * This is provided via the current URL where the sign-in UI is hosted.
 */
export class Config {
  public readonly mode: ConfigMode;
  public readonly apiKey: string | null;
  public readonly tid: string | null;
  public readonly redirectUrl: string | null;
  public readonly state: string | null;
  public readonly hl: string | null;
  public readonly selectedTenantInfo: SelectedTenantInfo | null;
  private readonly parsedUrl: URL;

  /**
   * Initializes the authentication configuration using the URL provided.
   *
   * @param url The configuration URL.
   * @param historyState The optional current history.state.
   */
  constructor(url: string, historyState?: any) {
    this.parsedUrl = new URL(url);
    this.mode = this.getMode(this.parsedUrl.searchParams.get('mode') || '');
    this.apiKey = this.parsedUrl.searchParams.get('apiKey') || null;
    this.tid = this.parsedUrl.searchParams.get('tid') || null;
    this.redirectUrl = this.parsedUrl.searchParams.get('redirect_uri') || null;
    // Sanitize redirect URL if provided.
    if (this.redirectUrl) {
      this.redirectUrl = sanitizeUrl(this.redirectUrl);
    }
    this.state = this.parsedUrl.searchParams.get('state') || null;
    this.hl = this.parsedUrl.searchParams.get('hl') || null;

    this.selectedTenantInfo = this.getSelectedTenantInfo(this.parsedUrl.hash, historyState);
  }

  /**
   * Returns the configuration SelectedTenantInfo if available.
   * @param hash The current URL hash fragment.
   * @param historyState The current history.state if available.
   * @return The configuration SelectedTenantInfo if available.
   */
  private getSelectedTenantInfo(hash: string, historyState?: any): SelectedTenantInfo | null {
    let selectedTenantInfo: SelectedTenantInfo | null = null;
    // Older browsers that do not support history API will use hash to pass SelectedTenantInfo.
    // history.state should have higher priority over hash.
    if (!this.tid) {
      selectedTenantInfo = null;
    } else if (historyState) {
      // Populate from history.state.
      selectedTenantInfo = !!historyState && historyState.state === 'signIn' ?
          historyState.selectedTenantInfo : null;
    } else if (hash) {
      // Populate from hash.
      const matches = SELECTED_TENANT_INFO_REGEXP.exec(hash);
      if (matches.length > 1) {
        selectedTenantInfo = {
          email: matches[1].trim(),
          providerIds: (matches[2] || '').split(','),
          tenantId: this.tid,
        };
      }
    }

    // Validate selectedTenantInfo.
    if (selectedTenantInfo) {
      let trimmedProviderId: string;
      const providerIds: string[] = [];
      // Validate email.
      if (!isEmail(selectedTenantInfo.email)) {
        delete selectedTenantInfo.email;
      }
      // Validate providerIds.
      if (!isArray(selectedTenantInfo.providerIds)) {
        selectedTenantInfo.providerIds = [];
      } else {
        // Trim providerId strings.
        selectedTenantInfo.providerIds.forEach((providerId) => {
          if (isString(providerId)) {
            trimmedProviderId = providerId.trim();
            if (isProviderId(trimmedProviderId)) {
              providerIds.push(trimmedProviderId);
            }
          }
          selectedTenantInfo.providerIds = providerIds;
        });
      }
      // Validate tenantId.
      // When tid is set to top level project ID, set to null.
      const realTenantId = this.tid && this.tid.charAt(0) === '_' ? null : this.tid;
      if (selectedTenantInfo.tenantId !== realTenantId) {
        selectedTenantInfo = null;
      }
    }
    return selectedTenantInfo;
  }

  /**
   * @param mode The operation mode.
   * @return The corresponding operation ConfigMode enum.
   */
  private getMode(mode: string): ConfigMode {
    switch (mode) {
      case 'login':
        return ConfigMode.Login;
      case 'reauth':
        return ConfigMode.Reauth;
      case 'signout':
        return ConfigMode.Signout;
      case 'selectAuthSession':
        return ConfigMode.SelectAuthSession;
      default:
        return ConfigMode.Unknown;
    }
  }
}
