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

export interface AlertParameters {
  message?: string;
  code?: string;
  retry?: () => void;
}

export class Alert extends React.Component<AlertParameters, {}> {
  render(): JSX.Element {
    return (
      <React.Fragment>
        {this.props.message &&
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error</strong> {this.props.code} - {this.props.message}
            {!!this.props.retry &&
              <a href="#" className="alert-link" onClick={this.props.retry}>Try again</a>
            }
          </div>
        }
      </React.Fragment>
    );
  }
}
