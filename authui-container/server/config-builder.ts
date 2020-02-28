/*
 * Copyright 2020 Google Inc. All Rights Reserved.
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

import {TenantUiConfig, GcipConfig} from './api/gcip-handler';

// TODO: Temporary URLs for now. Replace with production ones when ready.
// This is the icon for each tenant button in the tenant selection screen.
export const TENANT_ICON_URL = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png';
// Select tenant screen logo. This is the logo on the tenant selection screen.
export const SELECT_TENANT_LOGO_URL =
    'https://lh3.googleusercontent.com/AdcgmqzXjd7-Vpo478h7TzTkyagFycEvT38zSxFOQRFbyGUgtdraQe5fAtTlqsWx3FJN' +
    '-rlkYYZNeSjm8xRd=w80-h40';
// Sign in UI screen logo. This is the logo on the sign-in UI screen after a tenant is already selected.
export const SIGN_IN_UI_LOGO_URL = 'https://img.icons8.com/cotton/2x/cloud.png';

interface SignInOption {
  provider: string;
  providerName?: string;
  [key: string]: any;
}

interface ExtendedTenantUiConfig {
  displayName: string;
  iconUrl: string;
  logoUrl: string;
  buttonColor: string;
  signInOptions: (SignInOption | string)[];
  tosUrl?: string;
  privacyPolicyUrl?: string;
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

/** Utility for building the default UI config object. */
export class DefaultUiConfigBuilder {
  /**
   * Instantiates a default UI config builder instance.
   * @param projectId The project ID to use.
   * @param gcipConfig The GCIP web config.
   * @param tenantUiConfigMap The map of tenant IDs to TenantUiConfig object.
   */
  constructor(
      private readonly projectId: string,
      private readonly gcipConfig: GcipConfig,
      private readonly tenantUiConfigMap: {[key: string]: TenantUiConfig}) {}

  /**
   * @return The generated UiConfig object if available, null otherwise.
   */
  build(): UiConfig | null {
    const tenantConfigs: {[key: string]: ExtendedTenantUiConfig} = {};
    let charCode = 'A'.charCodeAt(0);
    const optionsMap = this.tenantUiConfigMap;
    const tenantIds: string[] = [];

    for (const tenantId in optionsMap) {
      if (optionsMap.hasOwnProperty(tenantId)) {
        tenantIds.push(tenantId);
      }
    }
    tenantIds.forEach((tenantId) => {
      let key;
      let displayName;
      if (tenantId.charAt(0) === '_') {
        key = '_';
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            'My Company';
      } else {
        key = tenantId;
        displayName = (optionsMap[key] && optionsMap[key].displayName) ||
            `Company ${String.fromCharCode(charCode)}`;
        charCode++;
      }

      tenantConfigs[key] = {
        displayName,
        iconUrl: TENANT_ICON_URL,
        logoUrl: SIGN_IN_UI_LOGO_URL,
        buttonColor: '#007bff',
        signInOptions: (optionsMap[key] && optionsMap[key].signInOptions) || [],
        tosUrl: '',
        privacyPolicyUrl: '',
      };
    });
    // IAP not yet configured.
    if (tenantIds.length === 0) {;
      return null;
    }

    return {
      [this.gcipConfig.apiKey]: {
        authDomain: this.gcipConfig.authDomain,
        displayMode: 'optionFirst',
        selectTenantUiTitle: this.projectId,
        selectTenantUiLogo: SELECT_TENANT_LOGO_URL,
        styleUrl: '',
        tenants: tenantConfigs,
        tosUrl: '',
        privacyPolicyUrl: '',
      },
    };
  }
}
