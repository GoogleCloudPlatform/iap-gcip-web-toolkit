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
  selector: 'navbar',
  template: `
    <nav class="navbar navbar-expand-lg">
        <ul class="navbar-nav ml-auto">
        <li class="nav-item">
            <a class="nav-link get-original-url" (click)="showModal()" href="javascript:void(0)">
            Original URL
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link switch-to-firebaseui" href="{{link}}">Switch to FirebaseUI</a>
        </li>
        </ul>
    </nav>
    <!-- Modal -->
    <div class="modal" id="originalUrlModal" tabindex="-1"
        role="dialog" aria-labelledby="original-url-modal-label"
        aria-hidden="true">
        <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
            <h5 class="modal-title" id="original-url-modal-label">Original URL</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
            </button>
            </div>
            <div class="modal-body">
              <div class="original-url">{{originalUrl}}</div>
            </div>
            <div class="modal-footer">
            <button type="button" class="close-original-url-modal btn btn-secondary"
                    data-dismiss="modal">
                Close
            </button>
            </div>
        </div>
        </div>
    </div>
    `,
})
export class NavBarComponent {
  @Input() public originalUrl: string;
  @Input() public link: string;

  constructor() {
      // On get original URL button click, call getOriginalURL() and populate the
    // result in the opened modal.
  }

  /** Displays the dialog with the original URL. */
  public showModal() {
    $('#originalUrlModal').modal('show');
  }
}
