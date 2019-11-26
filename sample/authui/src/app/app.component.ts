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

import {
  Component, ComponentFactory, ComponentRef, ComponentFactoryResolver,
  ViewContainerRef, ViewChild,
} from '@angular/core';
import {SelectTenantComponent} from './selecttenant.component';
import {SignInComponent} from './signin.component';
import {SignInWithEmailComponent} from './signinwithemail.component';
import {SignUpWithEmailComponent} from './signupwithemail.component';
import {SignOutComponent} from './signout.component';
import {ProgressBarComponent} from './progressbar.component';

// Import Firebase dependencies.
import * as firebase from 'firebase/app';
import 'firebase/auth';
// Import GCIP/IAP module.
import * as ciap from '../../../../builds/ciap/index.esm';
import * as $ from 'jquery';
import * as bootstrap from 'bootstrap';

const SAML_PROVIDER_ID = 'saml.okta-cicp-app';

@Component({
  selector: 'my-app',
  template: `
    <div class="main-container">
      <navbar link="{{link}}" originalUrl="{{originalUrl}}"></navbar>
      <div id="sign-in-ui-container">
        <template #ciapContainer></template>
        <alert code="{{code}}" message="{{message}}" retry="{{retry}}"></alert>
      </div>
    </div>
  `,
})
export class AppComponent {
  @ViewChild('ciapContainer', { read: ViewContainerRef, static: false }) private container: ViewContainerRef;
  private componentRef: ComponentRef<any>;
  private progressBarTimer: any;
  private config: any;
  private link: string;
  private originalUrl: string;
  private ciapInstance: ciap.Authentication;
  private code?: string;
  private message?: string;
  private retry?: any;

  constructor(private resolver: ComponentFactoryResolver) {
    this.progressBarTimer = null;
    // Fetch configuration via reserved Firebase Hosting URL.
    fetch('/__/firebase/init.json').then((response) => {
      return response.json();
    })
    .then((config) => {
      this.config = config;
      this.ciapInstance = new ciap.Authentication(this);
      this.ciapInstance.start();
      this.ciapInstance.getOriginalURL().then((originalUrl) => {
        this.link = `/${window.location.search}`;
        this.originalUrl = originalUrl;
      }).catch((error) => {
        this.link = `/${window.location.search}`;
        this.originalUrl = 'N/A';
      });
    });
  }

  public getAuth(apiKey, tenantId) {
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
    return auth;
  }

  public handleError(error) {
    this.updateError(error);
  }

  public selectTenant(projectConfig, tenantIds) {
    const topLevelProject = `_${projectConfig.projectId}`;
    const tenants = [];
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
          (selectedTenantId) => {
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

  public startSignIn(auth, selectedTenantInfo) {
    return new Promise((resolve, reject) => {
      this.signIn(
          !!auth.tenantId,
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new (firebase.auth.SAMLAuthProvider as any)(SAML_PROVIDER_ID))
              .catch((error) => {
                this.updateError(error);
              });
            return false;
          },
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider())
              .catch((error) => {
                this.updateError(error);
              });
            return false;
          },
          () => {
            this.updateError(null);
            auth.signInWithRedirect(new firebase.auth.FacebookAuthProvider())
              .catch((error) => {
                this.updateError(error);
              });
            return false;
          },
          (email) => {
            this.updateError(null);
            auth.fetchSignInMethodsForEmail(email)
              .then((signInMethods) => {
                if (signInMethods.length) {
                  // Show password sign in.
                  this.signInWithEmail(
                      email,
                      (password) => {
                        this.updateError(null);
                        auth.signInWithEmailAndPassword(email, password)
                          .then((userCredential) => {
                            resolve(userCredential);
                          })
                          .catch((error) => {
                            this.updateError(error);
                          });
                        return false;
                      });
                } else {
                  // Show password sign up.
                  this.signUpWithEmail(
                      email,
                      (displayName, password) => {
                        this.updateError(null);
                        auth.createUserWithEmailAndPassword(email, password)
                          .then((userCredential) => {
                            return userCredential.user.updateProfile({displayName})
                              .then(() => {
                                resolve(userCredential);
                              });
                          })
                          .catch((error) => {
                            this.updateError(error);
                          });
                        return false;
                      });
                }
              })
              .catch((error) => {
                this.updateError(error);
              });
            return false;
          });
    });
  }

  public completeSignOut() {
    this.signOut();
    return Promise.resolve();
  }

  public showProgressBar() {
    // Show progress bar only if it takes longer than a certain delay.
    // This prevents flicker effects when a transition is quick and a spinner
    // is shown in between.
    this.progressBarTimer = setTimeout(() => {
      this.renderProgressBar();
    }, 1000);
  }

  public hideProgressBar() {
    clearTimeout(this.progressBarTimer);
    this.hideContainer();
  }

  private ngOnDestroy() {
    this.componentRef.destroy();
  }

  private updateError(error: {code?: string, message?: string, retry?: any}) {
    this.code = error && error.code;
    this.message = error && error.message;
    this.retry = error && error.retry;
  }

  private renderSelectTenant(
      tenants: Array<{tenantId: string, tenantDisplayName: string}>,
      onclick: (tenantId: string) => void) {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(SelectTenantComponent);

    this.componentRef = this.container.createComponent(factory);

    this.componentRef.instance.tenants = tenants;
    this.componentRef.instance.onclick = onclick;
  }

  private signIn(
      saml: boolean,
      onSignInWithSaml: () => boolean,
      onSignInWithGoogle: () => boolean,
      onSignInWithFacebook: () => boolean,
      onSignInWithEmail: (email: string) => boolean) {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(SignInComponent);
    this.componentRef = this.container.createComponent(factory);
    this.componentRef.instance.saml = saml;
    this.componentRef.instance.onSignInWithSaml = onSignInWithSaml;
    this.componentRef.instance.onSignInWithGoogle = onSignInWithGoogle;
    this.componentRef.instance.onSignInWithFacebook = onSignInWithFacebook;
    this.componentRef.instance.onSignInWithEmail = onSignInWithEmail;
  }

  private signInWithEmail(
      email: string,
      onSignInWithEmailAndPassword: (password: string) => boolean) {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(SignInWithEmailComponent);
    this.componentRef = this.container.createComponent(factory);
    this.componentRef.instance.email = email;
    this.componentRef.instance.onSignInWithEmailAndPassword = onSignInWithEmailAndPassword;
  }

  private signUpWithEmail(
      email: string,
      onSignUpWithEmailAndPassword: (displayName: string, password: string) => boolean) {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(SignUpWithEmailComponent);
    this.componentRef = this.container.createComponent(factory);
    this.componentRef.instance.email = email;
    this.componentRef.instance.onSignUpWithEmailAndPassword = onSignUpWithEmailAndPassword;
  }

  private signOut() {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(SignOutComponent);
    this.componentRef = this.container.createComponent(factory);
  }

  private renderProgressBar() {
    this.hideContainer();
    const factory: ComponentFactory<any> = this.resolver.resolveComponentFactory(ProgressBarComponent);
    this.componentRef = this.container.createComponent(factory);
  }

  private hideContainer() {
    this.updateError(null);
    this.container.clear();
  }
}
