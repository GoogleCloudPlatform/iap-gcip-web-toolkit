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

import {BasePage} from './base-page';
import {AppPage} from './app-page';

/** The App page URL regex. */
const APP_PAGE_URL_REGEX = /\.appspot\.com/;

/**
 * The Abstract sign-in page class used to handle sign and redirect to app page.
 */
export abstract class SignInPage extends BasePage {
  /** The class name of the button element to get the original URL. */
  private readonly searchGetOriginalButtonClass = 'get-original-url';
  /** The class name of the element containing the original URL. */
  private readonly searchOriginalUrlClass = 'original-url';
  /** The class name of the button to close the original URL modal. */
  private readonly searchCloseModalButtonClass = 'close-original-url-modal';
  /** The class of the sign-in page header container. */
  private readonly searchSignInPageHeaderClass = 'sign-in-header';

  /**
   * Selects the tenant corresponding to the index provided from the list of visible tenants.
   * @param index The index of the tenant to select from the list of buttons presented.
   * @return A promise that resolves with the tenant ID of the selected tenant button.
   */
  abstract selectTenant(index: number): Promise<string | null>;

  /**
   * Starts email sign-in.
   * @return A promise that resolves after starting email sign-in
   */
  abstract startSignInWithEmail(): Promise<void>;

  /**
   * Inputs the specified email and clicks next.
   * @param email The email string to input.
   * @return A promise that resolves after clicking the next button.
   */
  abstract inputEmailAndSubmit(email: string): Promise<void>;

  /**
   * Inputs the specified password and clicks the sign-in button.
   * @param password The password string to input.
   * @return A promise that resolves after the sign-in button is clicked.
   */
  abstract inputPasswordAndSignIn(password: string): Promise<void>;

  /**
   * @return A promise that resolves with the AppPage redirected to after sign-in.
   */
  getAppPage(): Promise<AppPage> {
    return this.waitUntilUrlMatches(APP_PAGE_URL_REGEX)
      .then(() => {
        return new AppPage(this.driver);
      });
  }

  /**
   * @return A promise that resolves with the original URL string.
   */
  getOriginalUrl(): Promise<string> {
    let originalUrl: string;
    // Wait for ciap instance to be initialized.
    return this.findByClassName(this.searchSignInPageHeaderClass)
      .then(() => {
        // Lookup get original URL button.
        return this.findByClassName(this.searchGetOriginalButtonClass)
      })
      .then((getOriginalUrlButton) => {
        // Click button to open modal.
        getOriginalUrlButton.click();
        // Get the original URL container element.
        return this.findByClassName(this.searchOriginalUrlClass);
      })
      .then((originalUrlElement) => {
        // Get text in element.
        return originalUrlElement.getText();
      })
      .then((text) => {
        originalUrl = text;
        // Get modal close button.
        return this.findByClassName(this.searchCloseModalButtonClass);
      })
      .then((closeButton) => {
        // Click close button and return the retrieved URL.
        closeButton.click();
        return originalUrl;
      });
  }
}