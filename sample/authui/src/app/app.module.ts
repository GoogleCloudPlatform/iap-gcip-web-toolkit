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

import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {BrowserModule} from '@angular/platform-browser';
import {SelectTenantComponent} from './selecttenant.component';
import {SignInComponent} from './signin.component';
import {SignInWithEmailComponent} from './signinwithemail.component';
import {SignUpWithEmailComponent} from './signupwithemail.component';
import {SignOutComponent} from './signout.component';
import {AlertComponent} from './alert.component';
import {ProgressBarComponent} from './progressbar.component';
import {NavBarComponent} from './navbar.component';
import {PageNotFoundComponent} from './pagenotfound.component';
import {FirebaseUiComponent} from './firebaseui.component';
import {RootComponent} from './root.component';
import {PrivacyPolicyComponent} from './privacypolicy.component';
import {AppComponent} from './app.component';

const appRoutes: Routes = [
  { path: '', component: FirebaseUiComponent },
  { path: 'custom', component: AppComponent },
  { path: 'tos', component: PrivacyPolicyComponent },
  { path: 'privacypolicy', component: PrivacyPolicyComponent },
  { path: '**', component: PageNotFoundComponent },
];

@NgModule({
  imports: [
    BrowserModule,
    RouterModule.forRoot(
      appRoutes,
      {
        enableTracing: false,
      },
    ),
  ],
  declarations: [
    AppComponent, NavBarComponent, SelectTenantComponent, SignInComponent,
    SignInWithEmailComponent, SignUpWithEmailComponent, SignOutComponent,
    AlertComponent, ProgressBarComponent, PageNotFoundComponent,
    FirebaseUiComponent, RootComponent, PrivacyPolicyComponent,
  ],
  entryComponents: [
    AppComponent, NavBarComponent, SelectTenantComponent, SignInComponent,
    SignInWithEmailComponent, SignUpWithEmailComponent, SignOutComponent,
    AlertComponent, ProgressBarComponent, PageNotFoundComponent,
    FirebaseUiComponent, RootComponent, PrivacyPolicyComponent,
  ],
  bootstrap: [
    RootComponent,
  ],
})
export class AppModule {}
