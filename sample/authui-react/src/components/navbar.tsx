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
import React from 'react';

export interface NavbarParameters {
  link?: string;
  originalUrl?: string;
}

export class Navbar extends React.Component<NavbarParameters, {}> {
  render(): JSX.Element {
    return (
      <React.Fragment>
        <nav className="navbar navbar-expand-lg">
          <ul className="navbar-nav ml-auto">
            <li className="nav-item">
              <a className="nav-link get-original-url"
                  href="#originalUrlModal"
                  data-toggle="modal">
                Original URL
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link switch-to-firebaseui" href={this.props.link}>Switch to FirebaseUI</a>
            </li>
          </ul>
        </nav>
        <div className="modal" id="originalUrlModal"
            role="dialog" aria-labelledby="original-url-modal-label"
            aria-hidden="true" >
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="original-url-modal-label">Original URL</h5>
                <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="original-url">{this.props.originalUrl}</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="close-original-url-modal btn btn-secondary"
                    data-dismiss="modal">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
