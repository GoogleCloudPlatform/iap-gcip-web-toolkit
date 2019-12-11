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

export interface SignUpWithEmailParameters {
  email: string;
  onSignUpWithEmailAndPassword: (displayName: string, password: string) => boolean;
}

interface SignUpWithEmailState {
  password: string;
  displayName?: string;
}

export class SignUpWithEmail extends React.Component<SignUpWithEmailParameters, SignUpWithEmailState> {
  constructor(props: SignUpWithEmailParameters) {
    super(props);
    this.state = {
      password: '',
    };
  }

  handlePasswordChange = (event: any) => {
    this.setState({
      displayName: this.state.displayName,
      password: event.target.value,
    });
  };

  handleDisplayNameChange = (event: any) => {
    this.setState({
      displayName: event.target.value,
      password: this.state.password,
    });
  };

  handleSignUpWithEmailAndPassword = () => {
    this.props.onSignUpWithEmailAndPassword(
        this.state.displayName || '', this.state.password);
  };

  render(): JSX.Element {
    return (
      <div className="card">
        <div className="card-header sign-in-header">
          Authentication UI for IAP external identities
        </div>
        <div className="card-body">
          <h5 className="card-title">Sign up</h5>
          <form id="sign-up-form"
              onSubmit={(e) => {
                this.handleSignUpWithEmailAndPassword();
                e.preventDefault();
              }}>
            <div className="form-group">
              <p className="card-text">Create account for <b>{this.props.email}</b></p>
              <label htmlFor="displayName">Name</label>
              <input className="form-control"
                  type="text"
                  placeholder="Name"
                  name="displayName"
                  onChange={this.handleDisplayNameChange}
                  value={this.state.displayName}
                  id="displayName" />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input className="form-control"
                  type="password"
                  placeholder="Password"
                  name="password"
                  onChange={this.handlePasswordChange}
                  value={this.state.password}
                  id="password" />
            </div>
            <button type="submit" className="btn btn-primary mb-2 password-sign-up">
              Sign Up
            </button>
          </form>
        </div>
      </div>
    );
  }
}
