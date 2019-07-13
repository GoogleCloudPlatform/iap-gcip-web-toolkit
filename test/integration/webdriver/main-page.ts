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

/** The redirect wait time in millisecond before timing out. */
const REDIRECT_WAIT_TIME = 10000;

/**
 * The main page where the web driver test will be run from.
 */
export class MainPage extends BasePage {
  /** The ID of the email input element. */
  private readonly searchEmailInputId = 'email';
  /** The class name of the search email button element. */
  private readonly searchEmailButtonClass = 'search-email';
  /** The ID of the password input element. */
  private readonly searchPasswordInputId = 'password';
  /** The class name of the password sign-in button element. */
  private readonly searchSignInButtonClass = 'password-sign-in';
  /** The ID of the IAP claims element. */
  private readonly searchClaimsResultId = 'iap-claims';
  /** The ID of the sign out button element. */
  private readonly searchSignOutButtonId = 'sign-out';

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
   * Returns the sign-in result in the application page. This will be the
   * IAP token payload.
   * @return A promise that resolves with the claims object.
   */
  getSignInResult(): Promise<any> {
    return this.driver.wait(() => {
     return this.findById(this.searchClaimsResultId)
      .then((claimsResult) => {
        return claimsResult.getText();
      })
      .then((claimsResultText) => {
        return JSON.parse(claimsResultText);
      });
    }, REDIRECT_WAIT_TIME);
  }

  /**
   * Clicks the sign-out button and waits for the browser to redirect to
   * the specified URL.
   * @param signInPageUrl The sign-in page URL where the browser is expected
   *     to redirect to.
   * @return A promise that resolves after the successful redirect.
   */
  clickSignOutAndWaitForRedirect(signInPageUrl: string): Promise<any> {
    return this.findById(this.searchSignOutButtonId)
      .then((signOutButton) => {
        signOutButton.click();
        return this.waitUntilUrlContains(signInPageUrl);
      });
  }

  /**
   * @return A promise that resolves with the current URL string.
   */
  getCurrentUrl(): Promise<string> {
    return this.driver.getCurrentUrl();
  }
}
