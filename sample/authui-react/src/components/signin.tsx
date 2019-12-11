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

export interface SignInParameters {
  saml: boolean;
  onSignInWithSaml: () => boolean;
  onSignInWithGoogle: () => boolean;
  onSignInWithFacebook: () => boolean;
  onSignInWithEmail: (email: string) => boolean;
}

export class SignIn extends React.Component<SignInParameters, {email: string}> {
  constructor(props: SignInParameters) {
    super(props);
    this.state = {
      email: '',
    };
  }

  handleChange = (event: any) => {
    this.setState({
      email: event.target.value,
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
          <form id="enter-email-form"
              onSubmit={(e) => {
                this.props.onSignInWithEmail(this.state.email);
                e.preventDefault();
              }}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input className="form-control"
                  type="text"
                  placeholder="Email"
                  name="email"
                  onChange={this.handleChange}
                  value={this.state.email}
                  id="email" />
            </div>
            <button
                type="submit"
                className="btn btn-primary mb-2 search-email">
              Next
            </button>
            <div className="padded-div">
              <h3 className="line-through">OR</h3>
              {this.props.saml ? (
                <button id="sign-in-saml"
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={this.props.onSignInWithSaml}>
                  Sign in with SAML
                </button>
              ) : (
                <React.Fragment>
                  <button id="sign-in-google"
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={this.props.onSignInWithGoogle}>
                    Sign in with Google
                  </button>
                  <button id="sign-in-facebook"
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={this.props.onSignInWithFacebook}>
                    Sign in with Facebook
                  </button>
                </React.Fragment>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }
}
