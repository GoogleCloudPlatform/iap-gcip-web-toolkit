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

import * as HandleBars from '../node_modules/handlebars/dist/handlebars';

export const selectProvider = HandleBars.compile(`
  <div class="card">
    <div class="card-header sign-in-header">
      IAP/GCIP Sample App
    </div>
    <div class="card-body">
      <h5 class="card-title">Select Company</h5>
      <form id="select-tenant-form">
        <div class="padded-div">
          {{#each tenants}}
            <button
                id="sign-in-{{tenantId}}"
                data-tenant-id="{{tenantId}}"
                type="button"
                class="sign-in-with-tenant-btn btn btn-primary btn-block">
              Sign in with {{tenantDisplayName}}
            </button>
          {{/each}}
        </div>
        <div id="error"></div>
      </form>
    </div>
  </div>
`);

export const signIn = HandleBars.compile(`
  <div class="card">
    <div class="card-header sign-in-header">
      IAP/GCIP Sample App
    </div>
    <div class="card-body">
      <h5 class="card-title">Sign in</h5>
      <form id="enter-email-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input class="form-control" type="text" placeholder="Email" name="email" id="email">
        </div>
        <button type="submit" class="btn btn-primary mb-2 search-email">Next</button>
        <div class="padded-div">
          <h3 class="line-through">OR</h3>
          {{#if saml}}
            <button id="sign-in-saml" type="button" class="btn btn-primary btn-block">Sign in with SAML</button>
          {{else}}
            <button id="sign-in-google" type="button" class="btn btn-primary btn-block">Sign in with Google</button>
            <button id="sign-in-facebook" type="button" class="btn btn-primary btn-block">Sign in with Facebook</button>
          {{/if}}
        </div>
        <div id="error"></div>
      </form>
    </div>
  </div>
`);

export const signInWithEmail = HandleBars.compile(`
  <div class="card">
    <div class="card-header sign-in-header">
      IAP/GCIP Sample App
    </div>
    <div class="card-body">
      <h5 class="card-title">Sign in</h5>
      <form id="sign-in-form">
        <div class="form-group">
          <p class="card-text">Enter password for <b>{{email}}</b></p>
          <label for="password">Password</label>
          <input class="form-control" type="password" placeholder="Password" name="password" id="password">
        </div>
        <button type="submit" class="btn btn-primary mb-2 password-sign-in">Sign in</button>
        <div id="error"></div>
      </form>
    </div>
  </div>
`);

export const signUpWithEmail = HandleBars.compile(`
  <div class="card">
    <div class="card-header sign-in-header">
      IAP/GCIP Sample App
    </div>
    <div class="card-body">
      <h5 class="card-title">Sign up</h5>
      <form id="sign-up-form">
        <div class="form-group">
          <p class="card-text">Create account for <b>{{email}}</b></p>
          <label for="displayName">Name</label>
          <input class="form-control" type="text" placeholder="Name" name="displayName" id="displayName">
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input class="form-control" type="password" placeholder="Password" name="password" id="password">
        </div>
        <button type="submit" class="btn btn-primary mb-2 password-sign-up">Sign Up</button>
        <div id="error"></div>
      </form>
    </div>
  </div>
`);

export const showAlert = HandleBars.compile(`
  <div class="alert alert-danger alert-dismissible fade show" role="alert">
    <strong>Error</strong> {{code}} - {{message}}
    {{#if retry}}
      <a href="#" class="alert-link">Try again</a>.
    {{/if}}
    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
`);

export const signOut = HandleBars.compile(`
  <div class="alert alert-success" role="alert">
    <strong>Success!</strong> You are now signed out.
  </div>
`);

export const showProgressBar = HandleBars.compile(`
  <div class="d-flex justify-content-center">
    <div class="spinner-border m-5 text-primary" role="status">
      <span class="sr-only">Loading...</span>
    </div>
  </div>
`);

export const hideProgressBar = HandleBars.compile(`
  <div></div>
`);

export const showNavbar = HandleBars.compile(`
  <nav class="navbar navbar-default navbar-fixed-top">
    <ul class="navbar-nav ml-auto">
      <li class="nav-item">
        <a class="nav-link switch-to-firebaseui" href="{{link}}">Switch to FirebaseUI</a>
      </li>
    </ul>
  </nav>
`);
