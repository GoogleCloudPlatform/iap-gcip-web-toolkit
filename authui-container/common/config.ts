/*
 * Copyright 2021 Google Inc. All Rights Reserved.
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

export interface GcipConfig {
  apiKey: string;
  authDomain: string;
}

export interface TenantUiConfigSignInOption {
  provider: string;
  providerName?: string;
}

interface DisableSignUpConfig {
  status: boolean;
  adminEmail?: string;
  helpLink?: string;
}

export interface TenantUiConfig {
  fullLabel?: string;
  displayName?: string;
  signInOptions: TenantUiConfigSignInOption[];
  adminRestrictedOperation?: DisableSignUpConfig;
}

export interface SignInOption {
  provider: string;
  fullLabel?: string;
  providerName?: string;
  hd?: string;
  buttonColor?: string;
  iconUrl?: string;
  scopes?: string[];
  customParameters?: {[key: string]: any};
  loginHintKey?: string;
  requireDisplayName?: boolean;
  recaptchaParameters?: {
    type?: string;
    size?: string;
    badge?: string;
  };
  defaultCountry?: string;
  defaultNationalNumber?: string;
  loginHint?: string;
  whitelistedCountries?: string[];
  blacklistedCountries?: string[];
  disableSignUp?: DisableSignUpConfig;
}

export interface ExtendedTenantUiConfig {
  fullLabel?: string;
  displayName: string;
  iconUrl: string;
  logoUrl?: string;
  buttonColor: string;
  signInOptions: (SignInOption | string)[];
  tosUrl?: string;
  privacyPolicyUrl?: string;
  immediateFederatedRedirect?: boolean;
  signInFlow?: 'redirect' | 'popup';
  adminRestrictedOperation?: DisableSignUpConfig;
}

export interface UiConfig {
  [key: string]: {
    authDomain?: string;
    displayMode: string;
    selectTenantUiTitle?: string;
    selectTenantUiLogo?: string;
    styleUrl?: string;
    tenants: {
      [key: string]: ExtendedTenantUiConfig;
    };
    tosUrl?: string,
    privacyPolicyUrl?: string,
  };
}
