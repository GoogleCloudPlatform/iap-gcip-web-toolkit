/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {deepCopy, setStyleSheet} from './utils/index';
import {HttpClient, HttpRequestConfig} from './utils/http-client';
import {getBrowserName, BrowserName} from './utils/browser';
// Import Firebase dependencies.
// tslint:disable-next-line
import * as firebase from 'firebase/app';
// tslint:disable-next-line
import 'firebase/auth';
// Import FirebaseUI dependencies.
import * as firebaseui from 'firebaseui';
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';

interface SignInOption {
  provider: string;
  providerName?: string;
  hd?: string;
  buttonColor?: string;
  iconUrl?: string;
  scopes?: string[];
  customParameters?: {[key: string]: any};
  loginHintKey?: string;
  requireDisplayName?: boolean;
  recaptchaParameters?: {
    type?: string;
    size?: string;
    badge?: string;
  };
  defaultCountry?: string;
  defaultNationalNumber?: string;
  loginHint?: string;
  whitelistedCountries?: string[];
  blacklistedCountries?: string[];
  [key: string]: any;
}

interface ExtendedTenantUiConfig {
  displayName: string;
  iconUrl: string;
  logoUrl: string;
  buttonColor: string;
  signInOptions: (SignInOption | string)[];
  tosUrl?: string;
  privacyPolicyUrl?: string;
  immediateFederatedRedirect?: boolean;
  signInFlow?: 'redirect' | 'popup';
}

export interface UiConfig {
  [key: string]: {
    authDomain?: string;
    displayMode: string;
    selectTenantUiTitle?: string;
    selectTenantUiLogo?: string;
    styleUrl?: string;
    tenants: {
      [key: string]: ExtendedTenantUiConfig;
    };
    tosUrl?: string,
    privacyPolicyUrl?: string,
  };
}

// The expected network timeout duraiton in milliseconds.
const TIMEOUT_DURATION = 30000;
// The /config HTTP request configuration.
const GET_CONFIG_PARAMS: HttpRequestConfig = {
  method: 'GET',
  url: '/config',
  timeout: TIMEOUT_DURATION,
};
// The current version of the hosted UI.
export const HOSTED_UI_VERSION = '__XXX_HOSTED_UI_VERSION_XXX__';

/** Utility for handling sign-in with IAP external identities. */
export class SignInUi {
  private containerElement: HTMLElement;
  private titleElement: HTMLElement;
  private img: HTMLImageElement;
  private loadingSpinnerElement: HTMLElement | null;
  private separatorElement: HTMLElement;
  private ciapAuth: ciap.Authentication;
  private mainContainer: Element;
  private httpClient: HttpClient;

  /**
   * Instantiates a SignInUi instance for handling IAP external identities authentication.
   * @param container The container element / identifier where the UI will be rendered.
   */
  constructor(private readonly container: string | HTMLElement) {
    this.httpClient = new HttpClient();
    this.containerElement = typeof container === 'string' ? document.querySelector(container) : container;
    this.loadingSpinnerElement = document.getElementById('loading-spinner');
    const elements = document.getElementsByClassName('main-container');
    if (elements.length > 0 && elements[0]) {
      this.mainContainer = elements[0];
    } else {
      throw new Error(`.main-container element not found`);
    }
    if (!this.containerElement) {
      throw new Error(`Container element ${container} not found`);
    }
    this.titleElement = document.getElementById('title');
    if (!this.titleElement) {
      throw new Error(`#title element not found`);
    }
    this.separatorElement = document.getElementById('separator');
    if (!this.separatorElement) {
      throw new Error(`#separator element not found`);
    }
    this.img = document.getElementById('logo') as HTMLImageElement;
    if (!this.img) {
      throw new Error(`#logo element not found`);
    }
  }

  /** @return A promise that resolves after the authenticaiton instance is started. */
  render() {
    return this.getConfig()
      .then((configs) => {
        // Remove spinner if available.
        if (this.loadingSpinnerElement) {
          this.loadingSpinnerElement.remove();
        }
        this.setCustomStyleSheet(configs);
        const config = this.generateFirebaseUiHandlerConfig(configs);
        // This will handle the underlying handshake for sign-in, sign-out,
        // token refresh, safe redirect to callback URL, etc.
        const handler = new firebaseui.auth.FirebaseUiHandler(
            this.container, config);
        // Log the hosted UI version.
        this.ciapAuth = new (ciap.Authentication as any)(handler, undefined, HOSTED_UI_VERSION);
        return this.ciapAuth.start();
      })
      .catch((error) => {
        this.handlerError(error);
        throw error;
      });
  }

  /**
   * @return A promise that resolves with the loaded configuration file from /config.
   */
  private getConfig(): Promise<UiConfig> {
    return this.httpClient.send(GET_CONFIG_PARAMS)
      .then((httpResponse) => {
        return httpResponse.data as UiConfig;
      })
      .catch((error) => {
        const resp = error.response;
        const errorData = resp.data;
        throw new Error(errorData.error.message);
      });
  }

  /**
   * Sets any custom CSS URL in the loaded configs to the current document.
   * @param configs The loaded configuration from /config.
   */
  private setCustomStyleSheet(configs) {
    for (const apiKey in configs) {
      if (configs.hasOwnProperty(apiKey) && configs[apiKey].styleUrl) {
        setStyleSheet(document, configs[apiKey].styleUrl);
        break;
      }
    }
  }

  /**
   * Generates the CIAPHandlerConfig from the loaded config.
   * @param configs The loaded configuration from /config.
   * @return The generate object containing the associated CIAPHandlerConfig.
   */
  private generateFirebaseUiHandlerConfig(
      configs): {[key: string]: firebaseui.auth.CIAPHandlerConfig} {
    // For prototyping purposes, only one API key should be available in the configuration.
    for (const apiKey in configs) {
      if (configs.hasOwnProperty(apiKey)) {
        const config = deepCopy(configs[apiKey]);
        const selectTenantUiTitle = config.selectTenantUiTitle;
        const selectTenantUiLogo = config.selectTenantUiLogo;
        config.callbacks = {
          selectTenantUiShown: () => {
            this.mainContainer.classList.remove('blend');
            this.titleElement.innerText = selectTenantUiTitle;
            if (selectTenantUiLogo) {
              this.img.style.display = 'block';
              this.img.src = selectTenantUiLogo;
              this.separatorElement.style.display = 'block';
            } else {
              this.img.style.display = 'none';
              this.separatorElement.style.display = 'none';
            }
          },
          selectTenantUiHidden: () => {
            this.titleElement.innerText = '';
          },
          signInUiShown: (tenantId) => {
            this.mainContainer.classList.remove('blend');
            const key = tenantId || '_';
            this.titleElement.innerText =
                config &&
                config.tenants &&
                config.tenants[key] &&
                config.tenants[key].displayName;
            if (config.tenants[key].logoUrl) {
              this.img.style.display = 'block';
              this.img.src = config.tenants[key].logoUrl;
            } else {
              this.img.style.display = 'none';
            }
            this.separatorElement.style.display = 'block';
          },
        };
        // Do not trigger immediate redirect in Safari without some user
        // interaction.
        for (const tenantId in (config.tenants || {})) {
          if (config.tenants[tenantId].hasOwnProperty('immediateFederatedRedirect')) {
            config.tenants[tenantId].immediateFederatedRedirect =
                config.tenants[tenantId].immediateFederatedRedirect && getBrowserName() !== BrowserName.Safari;
          }
        }
        // Remove unsupported FirebaseUI configs.
        delete config.selectTenantUiLogo;
        delete config.selectTenantUiTitle;
        delete config.styleUrl;
        return {
          [apiKey]: config,
        };
      }
    }
    return null;
  }

  /**
   * Displays the error message to the end user.
   * @param error The error to handle.
   */
  private handlerError(error: Error) {
    // Remove spinner if available.
    if (this.loadingSpinnerElement) {
      this.loadingSpinnerElement.remove();
    }
    // Show error message: errorData.error.message.
    this.mainContainer.classList.remove('blend');
    this.separatorElement.style.display = 'none';
    this.titleElement.innerText = '';
    this.img.style.display = 'none';
    this.containerElement.innerText = error.message;
  }
}
