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
  selector: 'alert',
  template: `
    <ng-template [ngIf]="!!message">
      <div class="alert alert-danger alert-dismissible fade show" role="alert">
        <strong>Error</strong> {{code}} - {{message}}
        <ng-template [ngIf]="!!retry">
          <a href="#" class="alert-link" (click)="runRetry()">Try again</a>.
        </ng-template>
      </div>
    </ng-template>
    `,
})
export class AlertComponent {
  @Input() public code?: string;
  @Input() public message?: string;
  @Input() public retry?: () => any;

  /** Triggers the retry if the error is recoverable. */
  public runRetry() {
    if (this.retry) {
      (this.retry as any)();
    }
  }
}
