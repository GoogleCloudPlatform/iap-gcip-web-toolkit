/*
 * Copyright 2019 Google Inc. All Rights Reserved.
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

import { Component, Input } from '@angular/core';

@Component({
  selector: 'sign-in',
  template: `
    <div class="card">
      <div class="card-header sign-in-header">
        Authentication UI for IAP external identities
      </div>
      <div class="card-body">
        <h5 class="card-title">Sign in</h5>
        <form id="enter-email-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input #email class="form-control"
                type="text"
                placeholder="Email"
                name="email"
                id="email">
          </div>
          <button (click)="onSignInWithEmail(email.value)"
              type="submit"
              class="btn btn-primary mb-2 search-email">
            Next
          </button>
          <div class="padded-div">
            <h3 class="line-through">OR</h3>
            <ng-template [ngIf]="saml" [ngIfElse]="notSaml">
              <button id="sign-in-saml"
                  type="button"
                  class="btn btn-primary btn-block"
                  (click)="onSignInWithSaml()">
                Sign in with SAML
              </button>
            </ng-template>
            <ng-template #notSaml>
              <button id="sign-in-google"
                  type="button"
                  class="btn btn-primary btn-block"
                  (click)="onSignInWithGoogle()">
                Sign in with Google
              </button>
              <button id="sign-in-facebook"
                  type="button"
                  class="btn btn-primary btn-block"
                  (click)="onSignInWithFacebook()">
                Sign in with Facebook
              </button>
            </ng-template>
          </div>
          <div id="error"></div>
        </form>
      </div>
    </div>
    `,
})
export class SignInComponent {
  @Input() public saml: boolean;
  @Input() public onSignInWithSaml: () => boolean;
  @Input() public onSignInWithGoogle: () => boolean;
  @Input() public onSignInWithFacebook: () => boolean;
  @Input() public onSignInWithEmail: (email: string) => boolean;
}
