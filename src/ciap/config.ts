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
import { ProviderMatch } from './authentication-handler';

/** The REGEX used to retrieve the ProviderMatch from the URL hash. */
const PROVIDER_MATCH_REGEXP = /#hint=([^;]*);(.*)$/;

/**
 * Enum for the configuration mode.
 * @enum {string}
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
  public readonly providerMatch: ProviderMatch | null;
  private readonly parsedUrl: URL;

  /**
   * Initializes the authentication configuration using the URL provided.
   *
   * @param url The configuration URL.
   * @param historyState The optional current history.state.
   * @constructor
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

    this.providerMatch = this.getProviderMatch(this.parsedUrl.hash, historyState);
  }

  /**
   * Returns the configuration ProviderMatch if available.
   * @param hash The current URL hash fragment.
   * @param historyState The current history.state if available.
   * @return The configuration ProviderMatch if available.
   */
  private getProviderMatch(hash: string, historyState?: any): ProviderMatch | null {
    let providerMatch: ProviderMatch | null = null;
    // Older browsers that do not support history API will use hash to pass ProviderMatch.
    // history.state should have higher priority over hash.
    if (!this.tid) {
      providerMatch = null;
    } else if (historyState) {
      // Populate from history.state.
      providerMatch = !!historyState && historyState.state === 'signIn' ?
          historyState.providerMatch : null;
    } else if (hash) {
      // Populate from hash.
      const matches = PROVIDER_MATCH_REGEXP.exec(hash);
      if (matches.length > 1) {
        providerMatch = {
          email: matches[1].trim(),
          providerIds: (matches[2] || '').split(','),
          tenantId: this.tid,
        };
      }
    }

    // Validate providerMatch.
    if (providerMatch) {
      let trimmedProviderId: string;
      const providerIds: string[] = [];
      // Validate email.
      if (!isEmail(providerMatch.email)) {
        delete providerMatch.email;
      }
      // Validate providerIds.
      if (!isArray(providerMatch.providerIds)) {
        providerMatch.providerIds = [];
      } else {
        // Trim providerId strings.
        providerMatch.providerIds.forEach((providerId) => {
          if (isString(providerId)) {
            trimmedProviderId = providerId.trim();
            if (isProviderId(trimmedProviderId)) {
              providerIds.push(trimmedProviderId);
            }
          }
          providerMatch.providerIds = providerIds;
        });
      }
      // Validate tenantId.
      // When tid is set to top level project ID, set to null.
      const realTenantId = this.tid && this.tid.charAt(0) === '_' ? null : this.tid;
      if (providerMatch.tenantId !== realTenantId) {
        providerMatch = null;
      }
    }
    return providerMatch;
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
