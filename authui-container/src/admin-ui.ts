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

import {deepCopy, copyTextAreaContent} from './utils/index';
import {UiConfig} from './sign-in-ui';
import {HttpClient, HttpRequestConfig, HttpResponse} from './utils/http-client';
import {DefaultUiConfigBuilder} from '../common/config-builder';
// Import Firebase dependencies.
// tslint:disable-next-line
import * as firebase from 'firebase/app';
// tslint:disable-next-line
import 'firebase/auth';
import 'bootstrap';
// Import codemirror dependencies.
import '../node_modules/codemirror/lib/codemirror.css';
import * as CodeMirror from '../node_modules/codemirror/lib/codemirror.js';
import '../node_modules/codemirror/mode/javascript/javascript.js';

import '../node_modules/codemirror/addon/lint/lint.css';
import '../node_modules/codemirror/addon/lint/lint';
import '../node_modules/codemirror/addon/lint/json-lint';

interface GcipConfig {
  apiKey: string;
  authDomain?: string;
}

// The alert status type.
type AlertStatus = 'success' | 'error';
// The message to show when the Google provider is not enabled.
export const MSG_GOOGLE_PROVIDER_NOT_CONFIGURED = 'The Google identity provider configuration is not found. ' +
    'Google should be enabled at the Identity Platform project-level IdPs in order to facilitate retrieval of ' +
    'Google Admin user OAuth access tokens for customization of the sign-in UI configuration.';
// The message to show when a configuration is successfully saved.
export const MSG_CONFIGURATION_SAVED = 'Configuration successfully saved.';
// The message to show when an invalid configuration is provided.
export const MSG_INVALID_CONFIGURATION = 'Invalid JSON configuration!';
// The message to show when no user is signed in.
export const MSG_NO_USER_LOGGED_IN = 'No user currently logged in. Refresh the page to sign-in.';
// The message to show when the configuration is copied to clipboard.
export const MSG_CONFIGURATION_COPIED = 'Configuration copied to clipboard';
// The message to show when re-authentication is required.
export const MSG_INVALID_CREDENTIALS = 'Invalid or expired credentials. Re-authenticate to continue.';
// Alert message title on success.
const MSG_ALERT_SUCCESS = 'Success';
// Alert message title on error.
const MSG_ALERT_ERROR = 'Error';
// The expected network timeout duration in milliseconds.
export const TIMEOUT_DURATION = 30000;
// The OAuth scopes needed to call Google APIs needed for managing config.
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/devstorage.read_write',
  'https://www.googleapis.com/auth/cloud-platform',
];
// The HTTP parameters needed for the get GCIP web config.
const GET_GCIP_CONFIG_PARAMS: HttpRequestConfig = {
  method: 'GET',
  url: '/gcipConfig',
  mode: 'same-origin',
  cache: 'no-cache',
  timeout: TIMEOUT_DURATION,
  headers: {
    'Content-Type': 'application/json',
  },
};
// The HTTP parameters needed to read the default or custom config stored in GCS.
const GET_ADMIN_CONFIG_PARAMS: HttpRequestConfig = {
  method: 'GET',
  url: '/get_admin_config',
  mode: 'same-origin',
  cache: 'no-cache',
  timeout: TIMEOUT_DURATION,
  headers: {
    'Content-Type': 'application/json',
  },
};
// The HTTP parameters needed to write the custom admin config to GCS.
const SET_ADMIN_CONFIG_PARAMS: HttpRequestConfig = {
  method: 'POST',
  url: '/set_admin_config',
  mode: 'same-origin',
  cache: 'no-cache',
  timeout: TIMEOUT_DURATION,
  headers: {
    'Content-Type': 'application/json',
  },
};
// The codeMirror configuration. This is optimized for JSON input and applies linting too.
export const CODE_MIRROR_CONFIG = {
  lineNumbers: true,
  mode: 'application/json',
  autoCloseBrackets: true,
  gutters: ['CodeMirror-lint-markers'],
  // tslint:disable-next-line
  lint: !!window['jsonlint'],
};

/**
 * Returns the first element within the container that matches the provided class name.
 * @param className The class name of the element to lookup.
 * @param container The container element where the lookup will be performed.
 * @return The element to lookup if found. Null otherwise.
 */
function getElementByClass(className: string, container: Element): Element | null {
  const elements = container.getElementsByClassName(className);
  if (elements.length) {
    return elements[0];
  }
  return null;
}

/**
 * Initializes a GoogleAuthProvider.
 * @param email The optional email to set as login hint.
 * @param scopes The optional OAuth scopes to set.
 * @return The GoogleAuthProvider object to sign in with.
 */
function initializeProvider(email?: string, scopes: string[] = []): firebase.auth.GoogleAuthProvider {
  // Require user to select an account.
  const customParameters = {
    login_hint: email,
    prompt: 'select_account',
  };
  const provider = new firebase.auth.GoogleAuthProvider();
  scopes.forEach((scope) => {
    provider.addScope(scope);
  });
  provider.setCustomParameters(customParameters);
  return provider;
}

/**
 * Utility for handling administrative operations for the authentication UI.
 * This currently allows admins to customize the default sign-in UI configuration.
 */
export class AdminUi {
  private accessToken: string | null;
  private httpClient: HttpClient;
  private loadingSpinnerElement: HTMLElement | null;
  private containerElement: HTMLElement;
  private reauthElement: HTMLElement;
  private copyToClipboardElement: HTMLElement;
  private textAreaElement: HTMLTextAreaElement;
  private alertStatusElement: HTMLElement;
  private alertMessageElement: HTMLElement;
  private adminFormElement: HTMLElement;
  private auth: firebase.auth.Auth;
  private editor: CodeMirror.EditorFromTextArea;

  /**
   * Instantiates a AdminUi instance to facilitate customization of the sign-in UI configuration.
   * @param container The container element / identifier where the UI will be rendered.
   * @param showToast Callback to show a toast message.
   */
  constructor(container: string | HTMLElement, private readonly showToast: () => void) {
    this.httpClient = new HttpClient();
    this.containerElement = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.containerElement) {
      throw new Error(`Container element ${container} not found`);
    }
    this.loadingSpinnerElement = document.getElementById('loading-spinner');
    this.adminFormElement = getElementByClass('admin-form', this.containerElement) as HTMLElement;
    if (!this.adminFormElement) {
      throw new Error(`.admin-form element not found`);
    }
    this.reauthElement = getElementByClass('reauth', this.containerElement) as HTMLElement;
    if (!this.reauthElement) {
      throw new Error(`.reauth element not found`);
    }
    this.copyToClipboardElement = getElementByClass('copy-to-clipboard', this.containerElement) as HTMLElement;
    if (!this.copyToClipboardElement) {
      throw new Error(`.copy-to-clipboard element not found`);
    }
    this.textAreaElement = getElementByClass('config', this.containerElement) as HTMLTextAreaElement;
    if (!this.textAreaElement) {
      throw new Error(`.config element not found`);
    }
    // Alert elements.
    this.alertStatusElement = document.getElementById('alert-status');
    if (!this.alertStatusElement) {
      throw new Error(`#alert-status element not found`);
    }
    this.alertMessageElement = document.getElementById('alert-message');
    if (!this.alertMessageElement) {
      throw new Error(`#alert-message element not found`);
    }
  }

  /**
   * @return A promise that resolves when the Admin UI is rendered.
   */
  render(): Promise<void> {
    // Get GCIP config to initialize the Auth instance.
    return this.getGcipConfig()
      .then((gcipConfig) => {
        // Initialize Auth instance using in-memory persistence.
        const app = firebase.initializeApp(gcipConfig);
        this.auth = app.auth();
        this.auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
        // Get redirect result.
        return this.auth.getRedirectResult();
      })
      .then((authResult) => {
        // Get Google Oauth access token.
        if (authResult &&
            authResult.credential &&
            (authResult.credential as any).accessToken) {
          this.accessToken = (authResult.credential as any).accessToken;
          // Load saved config using admin's OAuth access token.
          return this.getAdminConfig()
            .then((adminConfig) => {
              // Populate config in textarea.
              this.textAreaElement.value = JSON.stringify(adminConfig, undefined, 2);
              // Remove spinner if available.
              if (this.loadingSpinnerElement) {
                this.loadingSpinnerElement.remove();
              }
              // Show admin panel.
              this.containerElement.style.display = 'block';
              this.editor = CodeMirror.fromTextArea(this.textAreaElement, CODE_MIRROR_CONFIG);
              // Set editor size.
              this.editor.setSize('auto', 600);
              // On editor change, reflect changes in textarea.
              this.editor.on('change', (cm) => {
                // Reflect Editor text in textArea.
                this.textAreaElement.value = cm.getValue();
              });
              // Attach copy button to editor top right corner.
              const parentNode = this.copyToClipboardElement.parentNode;
              if (parentNode) {
                // Detach from parent.
                parentNode.removeChild(this.copyToClipboardElement);
                this.copyToClipboardElement.style.display = 'flex';
                // Reattach to editor.
                const editorContainer = getElementByClass('CodeMirror', this.containerElement);
                if (editorContainer) {
                  editorContainer.appendChild(this.copyToClipboardElement);
                }
              }
              // Initialize Admin UI event handlers.
              this.initEventHandlers();
            })
        } else {
          // No access token available. Trigger sign-in with redirect.
          return this.auth.signInWithRedirect(initializeProvider(undefined, OAUTH_SCOPES));
        }
      })
      .catch((error) => {
        // Unrecoverable error.
        this.handleUnrecoverableError(error);
        throw error;
      })
  }

  /** Initializes all Admin UI event handlers. */
  private initEventHandlers() {
    // Copy to clipboard click handler.
    this.addCopyToClipboardClickHandler();
    // Reauth click handler.
    this.addReauthClickHandler();
    // Save config click handler.
    this.addSaveConfigClickHandler();
  }

  /** Adds click handler to copy-to-clipboard button. */
  private addCopyToClipboardClickHandler() {
    this.copyToClipboardElement.addEventListener('click', (e) => {
      this.textAreaElement.value = this.editor.getValue();
      if (this.validateConfig(this.editor.getValue())) {
        // CodeMirror hides the textarea after rendering.
        const previousDisplay = this.textAreaElement.style.display;
        // Copy does not seem to work on hidden content.
        this.textAreaElement.style.display = 'block';
        copyTextAreaContent(this.textAreaElement);
        // Restore previous state.
        this.textAreaElement.style.display = previousDisplay;
        this.showToastMessage('success', MSG_CONFIGURATION_COPIED);
      }
      e.preventDefault();
      return false;
    });
  }

  /**
   * Validates the provided configuration and displays an error message
   * if any error is detected. Return true on successful validation or false otherwise.
   * @param configString The provided configuration string.
   * @return Whether the config is valid or not.
   */
  private validateConfig(configString: string): boolean {
    let newConfig: UiConfig;
    try {
      // Parse config string first.
      newConfig = JSON.parse(configString);
    } catch (e) {
      this.showToastMessage('error', MSG_INVALID_CONFIGURATION);
      return false;
    }
    // Validate provided config.
    try {
      DefaultUiConfigBuilder.validateConfig(newConfig);
    } catch (e) {
      this.showToastMessage('error', e.message);
      return false;
    }
    return true;
  }

  /**
   * Adds click handler to re-authenticate button.
   * This will re-authenticate the in-memory user with a popup to get a new OAuth access token.
   */
  private addReauthClickHandler() {
    this.reauthElement.addEventListener('click', (e) => {
      if (this.auth.currentUser) {
        const email = this.auth.currentUser.email;
        this.auth.currentUser.reauthenticateWithPopup(initializeProvider(email, OAUTH_SCOPES))
          .then((result) => {
            this.accessToken = (result.credential as any).accessToken;
            this.reauthElement.style.display = 'none';
          })
          .catch((error) => {
            this.showToastMessage('error', error.message);
          });
      } else {
        this.showToastMessage('error', MSG_NO_USER_LOGGED_IN);
      }
      e.preventDefault();
      return false;
    });
  }

  /**
   * Adds click handler to save the custom configuration to GCS.
   */
  private addSaveConfigClickHandler() {
    this.adminFormElement.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.validateConfig(this.textAreaElement.value)) {
        this.setAdminConfig(JSON.parse(this.textAreaElement.value));
      }
      return false;
    });
  }

  /**
   * Updates the admin configuration using the provided configuration.
   * @param newConfig The new configuration to save.
   * @return A promise that resolves on successful write.
   */
  private setAdminConfig(newConfig: UiConfig): Promise<void> {
    return this.sendAuthenticatedRequest(SET_ADMIN_CONFIG_PARAMS, newConfig)
      .then(() => {
        this.showToastMessage('success', MSG_CONFIGURATION_SAVED);
      })
      .catch((error) => {
        const resp = error.response;
        const errorData = resp.data;
        // Seems like the error is being constructed as Invalid Credentials:
        // {"error":{"code":500,"status":"UNKNOWN","message":"Invalid Credentials"}}
        if (errorData &&
            errorData.error &&
            (errorData.error.code === 401 ||
             errorData.error.code === 403 ||
             errorData.error.message.match(/invalid\scredentials/i))) {
          // Show re-auth button.
          this.reauthElement.style.display = 'inline-block';
          this.showToastMessage('error', MSG_INVALID_CREDENTIALS);
        } else {
          this.showToastMessage('error', errorData.error.message);
        }
      });
  }

  /**
   * @return A promise that resolves with the loaded admin UI config.
   */
  private getAdminConfig(): Promise<UiConfig> {
    return this.sendAuthenticatedRequest(GET_ADMIN_CONFIG_PARAMS)
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
   * @return A promise that resolves with the loaded GCIP config.
   */
  private getGcipConfig(): Promise<GcipConfig> {
    return this.httpClient.send(GET_GCIP_CONFIG_PARAMS)
      .then((httpResponse) => {
        return httpResponse.data as GcipConfig;
      })
      .catch((error) => {
        const resp = error.response;
        const errorData = resp.data;
        throw new Error(errorData.error.message);
      });
  }

  /**
   * Sends an authenticated request using the provided params.
   * @param params The HttpRequestConfig to construct the request.
   * @param data The optional data to send along request.
   * @return A promise that resolves with the HttpResponse.
   */
  private sendAuthenticatedRequest(params: HttpRequestConfig, data?: any): Promise<HttpResponse> {
    const updatedParams = deepCopy(params);
    // Inject OAuth access token.
    updatedParams.headers.Authorization = `Bearer ${this.accessToken}`;
    if (typeof data !== 'undefined') {
      updatedParams.data = data;
    }
    return this.httpClient.send(updatedParams);
  }

  /**
   * Displays a toast message.
   * @param status The status of the message.
   * @param message The error message.
   */
  private showToastMessage(status: AlertStatus, message: string) {
    this.alertStatusElement.innerText = (status === 'success') ? MSG_ALERT_SUCCESS : MSG_ALERT_ERROR;
    this.alertMessageElement.innerText = message;
    this.showToast();
  }

  /**
   * Displays the unrecoverable error message to the end user.
   * @param error The error to handle.
   */
  private handleUnrecoverableError(error: Error) {
    // Remove spinner if available.
    if (this.loadingSpinnerElement) {
      this.loadingSpinnerElement.remove();
    }
    this.containerElement.style.display = 'block';
    // Use a more informative/actionable error message than the default one.
    this.containerElement.innerText =
        error && (error as any).code && (error as any).code === 'auth/operation-not-allowed' ?
            MSG_GOOGLE_PROVIDER_NOT_CONFIGURED : error.message;
  }
}
