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
import { SelectTenant, SelectTenantParameters } from './selecttenant';
import { SignIn, SignInParameters } from './signin';
import { SignInWithEmail, SignInWithEmailParameters } from './signinwithemail';
import { SignUpWithEmail, SignUpWithEmailParameters } from './signupwithemail';
import SignOut from './signout';
import ProgressBar from './progressbar';
import { Navbar, NavbarParameters } from './navbar';
import { Alert, AlertParameters } from './alert';
// Import Firebase dependencies.
import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'jquery/dist/jquery.min.js'
import 'bootstrap/dist/js/bootstrap.min.js'
import 'bootstrap/dist/css/bootstrap.min.css';
import { UserCredential, FirebaseAuth } from '@firebase/auth-types';
// Import GCIP/IAP module.
import * as ciap from 'gcip-iap';

const SAML_PROVIDER_ID = 'saml.okta-cicp-app';

interface AppState {
  mode?: 'SIGN_IN' | 'SIGN_IN_WITH_EMAIL' | 'SIGN_UP_WITH_EMAIL' |
      'SIGN_OUT' | 'PROGRESS_BAR' | 'SELECT_TENANT' | 'NONE';
  navbar: NavbarParameters;
  alertParams?: AlertParameters;
  selectTenant?: SelectTenantParameters;
  signIn?: SignInParameters;
  signInWithEmail?: SignInWithEmailParameters;
  signUpWithEmail?: SignUpWithEmailParameters;
}

class App extends React.Component<{}, AppState> implements ciap.AuthenticationHandler {
  private progressBarTimer: any;
  private ciapInstance: any;
  private config: any;

  constructor(props: {}) {
    super(props);
    this.progressBarTimer = null;
    this.state = {
      navbar: {
        link: `/${window.location.search}`,
        originalUrl: 'N/A',
      },
    };
  }

  componentDidMount() {
    // Fetch configuration via reserved Firebase Hosting URL.
    fetch('/__/firebase/init.json').then((response) => {
      return response.json();
    })
    .then((config: any) => {
      this.config = config;
      this.ciapInstance = new ciap.Authentication(this);
      const p = this.ciapInstance.start();
      this.ciapInstance.getOriginalURL().then((originalUrl: string | null) => {
        this.setState({
          navbar: {
            link:  `/${window.location.search}`,
            originalUrl: originalUrl || 'N/A',
          },
        })
      })
      .catch(() => {
        // Suppress getOriginalURL() errors as this currently only works for multi-tenant
        // use case only.
        this.setState({
          navbar: {
            link: `/${window.location.search}`,
            originalUrl:  'N/A',
          },
        })
      });
      return p;
    })
    .catch((error: any) => {
      this.updateError(error);
    });
  }

  render(): JSX.Element {
    const navbar = this.state.navbar || {};
    const alertParams = this.state.alertParams || {};
    return (
      <div className="main-container">
        <Navbar link={navbar.link} originalUrl={navbar.originalUrl} />
        <div id="sign-in-ui-container">
          {this.renderCiapComponent()}
          <Alert code={alertParams.code} message={alertParams.message} retry={alertParams.retry} />
        </div>
      </div>
    );
  }

  public getAuth(apiKey: string, tenantId: string | null): FirebaseAuth {
    let auth = null;
    if (apiKey !== this.config.apiKey) {
      throw new Error('Invalid project!');
    }
    try {
      auth = firebase.app(tenantId || undefined).auth();
      // Tenant ID should be already set on initialization below.
    } catch (e) {
      const app = firebase.initializeApp(this.config, tenantId || '[DEFAULT]');
      auth = app.auth();
      auth.tenantId = tenantId || null;
    }
    return auth as any;
  }

  public handleError(error: any) {
    this.updateError(error);
  }

  public selectTenant(
      projectConfig: {projectId: string}, tenantIds: string[]): Promise<ciap.SelectedTenantInfo> {
    const topLevelProject = `_${projectConfig.projectId}`;
    const tenants: Array<{tenantId: string, tenantDisplayName: string}> = [];
    let charCode = 'A'.charCodeAt(0);
    tenantIds.forEach((tenantId) => {
      tenants.push({
        tenantId: tenantId || topLevelProject,
        tenantDisplayName: `Company ${String.fromCharCode(charCode)}`,
      });
      charCode++;
    });
    return new Promise((resolve, reject) => {
      this.renderSelectTenant(
          tenants,
          (selectedTenantId: string | null) => {
            this.updateError(null);
            if (selectedTenantId === topLevelProject) {
              selectedTenantId = null;
            }
            resolve({
              tenantId: selectedTenantId,
              providerIds: [],
            });
          });
    });
  }

  public startSignIn(auth: FirebaseAuth): Promise<UserCredential> {
    return new Promise((resolve, reject) => {
      this.signIn(
          !!auth.tenantId,
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new (firebase.auth.SAMLAuthProvider as any)(SAML_PROVIDER_ID))
              .catch((error: any) => {
                this.updateError(error);
              });
            return false;
          },
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider())
              .catch((error: any) => {
                this.updateError(error);
              });
            return false;
          },
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new firebase.auth.FacebookAuthProvider())
              .catch((error: any) => {
                this.updateError(error);
              });
            return false;
          },
          (email: string) => {
            this.updateError(null);
            auth.fetchSignInMethodsForEmail(email)
              .then((signInMethods: string[]) => {
                if (signInMethods.length) {
                  // Show password sign in.
                  this.signInWithEmail(
                      email,
                      (password: string) => {
                        this.updateError(null);
                        auth.signInWithEmailAndPassword(email, password)
                          .then((userCredential: any) => {
                            resolve(userCredential);
                          })
                          .catch((error: any) => {
                            this.updateError(error);
                          });
                        return false;
                      });
                } else {
                  // Show password sign up.
                  this.signUpWithEmail(
                      email,
                      (displayName: string, password: string) => {
                        this.updateError(null);
                        auth.createUserWithEmailAndPassword(email, password)
                          .then((userCredential: any) => {
                            return userCredential.user.updateProfile({displayName})
                              .then(() => {
                                resolve(userCredential);
                              });
                          })
                          .catch((error: any) => {
                            this.updateError(error);
                          });
                        return false;
                      });
                }
              })
              .catch((error: any) => {
                this.updateError(error);
              });
            return false;
          });
    });
  }

  public completeSignOut(): Promise<void> {
    this.signOut();
    return Promise.resolve();
  }

  public hideProgressBar() {
    clearTimeout(this.progressBarTimer);
    this.hideContainer();
  }

  public showProgressBar() {
    // Show progress bar only if it takes longer than a certain delay.
    // This prevents flicker effects when a transition is quick and a spinner
    // is shown in between.
    this.progressBarTimer = setTimeout(() => {
      this.renderProgressBar();
    }, 1000);
  }

  private updateError(error: {code?: string, message?: string, retry?: any} | null) {
    const modifiedState: AppState = {
      alertParams: {
        code: (error && error.code) || undefined,
        message: (error && error.message) || undefined,
        retry: (error && error.retry) || undefined,
      },
      // Keep existing values for the rest of the state.
      mode: this.state.mode,
      navbar: this.state.navbar,
      signIn: this.state.signIn,
      signInWithEmail: this.state.signInWithEmail,
      signUpWithEmail: this.state.signUpWithEmail,
      selectTenant: this.state.selectTenant,
    };
    this.setState(modifiedState);
  }

  private renderSelectTenant(
      tenants: Array<{tenantId: string, tenantDisplayName: string}>,
      onSelectTenant: (tenantId: string) => void) {
    this.setState({
      mode: 'SELECT_TENANT',
      selectTenant: {
        tenants,
        onSelectTenant,
      },
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private signIn(
      saml: boolean,
      onSignInWithSaml: () => boolean,
      onSignInWithGoogle: () => boolean,
      onSignInWithFacebook: () => boolean,
      onSignInWithEmail: (email: string) => boolean) {
    this.setState({
      mode: 'SIGN_IN',
      signIn: {
        saml,
        onSignInWithSaml,
        onSignInWithGoogle,
        onSignInWithFacebook,
        onSignInWithEmail,
      },
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private signUpWithEmail(
      email: string,
      onSignUpWithEmailAndPassword: (displayName: string, password: string) => boolean) {
    this.setState({
      mode: 'SIGN_UP_WITH_EMAIL',
      signUpWithEmail: {
        email,
        onSignUpWithEmailAndPassword,
      },
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private signInWithEmail(
      email: string,
      onSignInWithEmailAndPassword: (password: string) => boolean) {
    this.setState({
      mode: 'SIGN_IN_WITH_EMAIL',
      signInWithEmail: {
        email,
        onSignInWithEmailAndPassword,
      },
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private signOut() {
    this.setState({
      mode: 'SIGN_OUT',
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private renderProgressBar() {
    this.setState({
      mode: 'PROGRESS_BAR',
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private hideContainer() {
    this.setState({
      mode: 'NONE',
      navbar: {
        link: this.state.navbar.link,
        originalUrl: this.state.navbar.originalUrl,
      },
    });
  }

  private renderCiapComponent = (): JSX.Element => {
    switch (this.state.mode) {
      case 'SIGN_IN':
        const signIn = this.state.signIn as SignInParameters;
        return <SignIn
          saml={signIn.saml}
          onSignInWithSaml={signIn.onSignInWithSaml}
          onSignInWithGoogle={signIn.onSignInWithGoogle}
          onSignInWithFacebook={signIn.onSignInWithFacebook}
          onSignInWithEmail={signIn.onSignInWithEmail}
        />;
      case 'SIGN_IN_WITH_EMAIL':
        const signInWithEmail = this.state.signInWithEmail as SignInWithEmailParameters;
        return <SignInWithEmail
          email={signInWithEmail.email}
          onSignInWithEmailAndPassword={signInWithEmail.onSignInWithEmailAndPassword}
        />;
      case 'SIGN_UP_WITH_EMAIL':
        const signUpWithEmail = this.state.signUpWithEmail as SignUpWithEmailParameters;
        return <SignUpWithEmail
          email={signUpWithEmail.email}
          onSignUpWithEmailAndPassword={signUpWithEmail.onSignUpWithEmailAndPassword}
        />;
      case 'SELECT_TENANT':
        const selectTenant = this.state.selectTenant as SelectTenantParameters;
        return <SelectTenant
          tenants={selectTenant.tenants}
          onSelectTenant={selectTenant.onSelectTenant}
        />;
      case 'SIGN_OUT':
        return <SignOut />;
      case 'PROGRESS_BAR':
        return <ProgressBar />;
      default:
        return <div></div>;
    }
  }
}

export default App;
