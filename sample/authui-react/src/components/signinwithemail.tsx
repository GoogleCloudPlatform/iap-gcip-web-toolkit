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

export interface SignInWithEmailParameters {
  email: string;
  onSignInWithEmailAndPassword: (password: string) => boolean;
}

export class SignInWithEmail extends React.Component<SignInWithEmailParameters, {password: string}> {
  constructor(props: SignInWithEmailParameters) {
    super(props);
    this.state = {
      password: '',
    };
  }

  handleChange = (event: any) => {
    this.setState({
      password: event.target.value,
    });
  };

  render(): JSX.Element {
    return (
      <div className="card">
        <div className="card-header sign-in-header">
          Authentication UI for IAP external identities
        </div>
        <div className="card-body">
          <h5 className="card-title">Sign in</h5>
          <form id="sign-in-form"
              onSubmit={(e) => {
                this.props.onSignInWithEmailAndPassword(this.state.password);
                e.preventDefault();
              }}>
            <div className="form-group">
              <p className="card-text">Enter password for <b>{this.props.email}</b></p>
              <label htmlFor="password">Password</label>
              <input className="form-control"
                  type="password"
                  placeholder="Password"
                  name="password"
                  onChange={this.handleChange}
                  value={this.state.password}
                  id="password" />
            </div>
            <button type="submit" className="btn btn-primary mb-2 password-sign-in">
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }
}
