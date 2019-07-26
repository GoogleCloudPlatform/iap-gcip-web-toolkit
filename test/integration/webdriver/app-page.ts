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
 * The application page where the web driver test will be run from.
 * User should be already authenticated on this page.
 */
export class AppPage extends BasePage {
  /** The ID of the IAP claims element. */
  private readonly searchClaimsResultId = 'iap-claims';
  /** The ID of the sign out button element. */
  private readonly searchSignOutButtonId = 'sign-out';
  /** The ID of the email input element. */
  private readonly searchEmailInputId = 'email';

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
      })
      .then(() => {
        // Wait for email input element to be visible, signaling signout
        // processing is complete. Otherwise, if a test ends before this
        // completes, the user will remain signed in in the next test.
        return this.findById(this.searchEmailInputId)
      });
  }
}