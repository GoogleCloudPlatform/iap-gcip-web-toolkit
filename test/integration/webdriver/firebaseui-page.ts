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

/**
 * The FirebaseUI page where the web driver test will be run from.
 * This is redirected to from the main page.
 */
export class FirebaseUiPage extends SignInPage {
  /** The class name of the sign in with email button. */
  private readonly searchSignInWithEmailButtonClass = 'firebaseui-idp-password';
  /** The class name of the email input element. */
  private readonly searchEmailInputClass = 'firebaseui-id-email';
  /** The class name of the search email button element. */
  private readonly searchEmailButtonClass = 'firebaseui-id-submit';
  /** The class name of the password input element. */
  private readonly searchPasswordInputClass = 'firebaseui-id-password';
  /** The class name of the password sign-in button element. */
  private readonly searchSignInButtonClass = 'firebaseui-id-submit';

  /**
   * Selects the tenant corresponding to the index provided from the list of visible tenants.
   * @param index The index of the tenant to select from the list of buttons presented.
   * @return A promise that resolves with the tenant ID of the selected tenant button.
   */
  selectTenant(index: number): Promise<string | null> {
    return Promise.resolve(null);
  }

  /**
   * Starts email sign-in.
   * @return A promise that resolves after clicking the "Sign in with Email" button.
   */
  startSignInWithEmail(): Promise<void> {
    return this.findByClassName(this.searchSignInWithEmailButtonClass)
      .then((searchSignInWithEmailButton) => {
        searchSignInWithEmailButton.click();
      });
  }

  /**
   * Inputs the specified email and clicks next.
   * @param email The email string to input.
   * @return A promise that resolves after clicking the next button.
   */
  inputEmailAndSubmit(email: string): Promise<void> {
    return this.findByClassName(this.searchEmailInputClass)
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
    return this.findByClassName(this.searchPasswordInputClass)
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
}