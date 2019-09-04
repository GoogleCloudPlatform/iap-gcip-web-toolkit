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

import {SignInPage} from './sign-in-page';
import {FirebaseUiPage} from './firebaseui-page';
import {WebElement} from 'selenium-webdriver';
import {URL} from 'url';

/**
 * The main page where the web driver test will be run from.
 */
export class MainPage extends SignInPage {
  /** The ID of the email input element. */
  private readonly searchEmailInputId = 'email';
  /** The class name of the search email button element. */
  private readonly searchEmailButtonClass = 'search-email';
  /** The ID of the password input element. */
  private readonly searchPasswordInputId = 'password';
  /** The class name of the password sign-in button element. */
  private readonly searchSignInButtonClass = 'password-sign-in';
  /** The class name of the switch to FirebaseUI button element. */
  private readonly searchSwitchToFirebaseUiButtonClass = 'switch-to-firebaseui';
  /** The class name of the sign in with tenant button elements. */
  private readonly searchSelectTenantButtonClass = 'sign-in-with-tenant-btn';

  /**
   * Initializes a main page instance for running web driver tests.
   * @param initialUrl The initial main page URL to redirect to.
   */
  constructor(private readonly initialUrl: string) {
    super();
  }

  /** @return A promise that resolves after redirecting to the initial main page URL. */
  start(): Promise<void> {
    return this.visit(this.initialUrl);
  }

  /**
   * Selects the tenant corresponding to the index provided from the list of visible tenants.
   * @param index The index of the tenant to select from the list of buttons presented.
   * @return A promise that resolves with the tenant ID of the selected tenant button.
   */
  selectTenant(index: number): Promise<string | null> {
    let selectedTenantId: string;
    let selectedElement: WebElement;
    return this.findElementsByClassName(this.searchSelectTenantButtonClass)
      .then((elements) => {
        selectedElement = elements[index];
        // Get selected tenant ID.
        return selectedElement.getAttribute('data-tenant-id');
      })
      .then((tenantId) => {
        selectedTenantId = tenantId && tenantId.charAt(0) === '_' ? null: tenantId;
        selectedElement.click();
        // Wait for email input field to appear before resolving with select tenant ID.
        return this.findById(this.searchEmailInputId);
      })
      .then(() => {
        return selectedTenantId;
      });
  }

  /**
   * Starts email sign-in. In the custom sign-in page, this does nothing.
   * @return A promise that resolves after starting email sign-in.
   */
  startSignInWithEmail(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Inputs the specified email and clicks next.
   * @param email The email string to input.
   * @return A promise that resolves after clicking the next button.
   */
  inputEmailAndSubmit(email: string): Promise<void> {
    return this.findById(this.searchEmailInputId)
      .then((emailInput) => {
        return this.write(emailInput, email);
      })
      .then(() => {
        return this.findByClassName(this.searchEmailButtonClass);
      })
      .then((emailButton) => {
        emailButton.click();
      });
  }

  /**
   * Inputs the specified password and clicks the sign-in button.
   * @param password The password string to input.
   * @return A promise that resolves after the sign-in button is clicked.
   */
  inputPasswordAndSignIn(password: string): Promise<void> {
    return this.findById(this.searchPasswordInputId)
      .then((passwordInput) => {
        return this.write(passwordInput, password);
      })
      .then(() => {
        return this.findByClassName(this.searchSignInButtonClass);
      })
      .then((signInButton) => {
        signInButton.click();
      });
  }

  /**
   * @return A promise that resolves with the FirebaseUiPage redirected to.
   */
  getFirebaseUiPage(): Promise<FirebaseUiPage> {
    let firebaseUiUrl: string;
    return this.getCurrentUrl()
      .then((url) => {
        firebaseUiUrl = url.replace('/custom', '/');
        return this.visit(firebaseUiUrl);
      })
      .then(() => {
        return this.waitUntilUrlContains(firebaseUiUrl);
      })
      .then(() => {
        return new FirebaseUiPage(this.driver);
      });
  }
}
