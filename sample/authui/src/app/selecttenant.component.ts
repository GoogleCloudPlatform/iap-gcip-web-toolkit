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
  selector: 'select-tenant',
  template: `
    <div class="card">
      <div class="card-header sign-in-header">
        Authentication UI for IAP external identities
      </div>
      <div class="card-body">
        <h5 class="card-title">Select Company</h5>
        <form id="select-tenant-form">
          <div class="padded-div" >
            <button
              *ngFor="let tenant of tenants"
              id="sign-in-{{tenant.tenantId}}"
              attr.data-tenant-id="{{tenant.tenantId}}"
              type="button"
              (click)="onclick(tenant.tenantId)"
              class="sign-in-with-tenant-btn btn btn-primary btn-block">
              Sign in with {{tenant.tenantDisplayName}}
            </button>
          </div>
          <div id="error"></div>
        </form>
      </div>
    </div>
    `,
})
export class SelectTenantComponent {
  @Input() public tenants: Array<{tenantId: string, tenantDisplayName: string}>;
  @Input() public onclick: (tenantId: string) => void;
}
