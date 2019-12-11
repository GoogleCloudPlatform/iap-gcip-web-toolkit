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
  selector: 'sign-in-with-email',
  template: `
    <div class="card">
      <div class="card-header sign-in-header">
        Authentication UI for IAP external identities
      </div>
      <div class="card-body">
        <h5 class="card-title">Sign in</h5>
        <form id="sign-in-form">
          <div class="form-group">
            <p class="card-text">Enter password for <b>{{email}}</b></p>
            <label for="password">Password</label>
            <input #password class="form-control"
                type="password"
                placeholder="Password"
                name="password"
                id="password">
          </div>
          <button type="submit" class="btn btn-primary mb-2 password-sign-in"
              (click)="onSignInWithEmailAndPassword(password.value)">
            Sign in
          </button>
        </form>
      </div>
    </div>
    `,
})
export class SignInWithEmailComponent {
  @Input() public email: string;
  @Input() public onSignInWithEmailAndPassword: (password: string) => boolean;
}
