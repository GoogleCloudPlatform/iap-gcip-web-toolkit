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
  private readonly parsedUrl: URL;

  /**
   * Initializes the authentication configuration using the URL provided.
   *
   * @param {string} url The configuration URL.
   * @constructor
   */
  constructor(url: string) {
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
  }

  /**
   * @param {string} mode The operation mode.
   * @return {ConfigMode} The corresponding operation ConfigMode enum.
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
