/*!
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as _ from 'lodash';
import {expect} from 'chai';
import {
  DefaultUiConfigBuilder, TENANT_ICON_URL, SELECT_TENANT_LOGO_URL,
  SIGN_IN_UI_LOGO_URL,
} from '../../../server/config-builder';

describe('DefaultUiConfigBuilder', () => {
  describe('build()', () => {
    const PROJECT_ID = 'project-id';
    const API_KEY = 'API_KEY';
    const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
    const tenantUiConfigMap = {
      _: {
        displayName: 'ABCD',
        signInOptions: [
          {provider: 'facebook.com'},
          {provider: 'twitter.com'},
          {
            provider: 'saml.idp1',
            providerName: 'saml-display-name-1',
          },
          {
            provider: 'oidc.idp1',
            providerName: 'oidc-display-name-1',
          },
        ],
      },
      tenantId1: {
        displayName: 'Tenant-display-name-1',
        signInOptions: [
          {provider: 'password'},
          {
            provider: 'saml.idp2',
            providerName: 'saml-display-name-2',
          },
          {
            provider: 'oidc.idp2',
            providerName: 'oidc-display-name-2',
          },
        ],
      },
      tenantId2: {
        displayName: 'Tenant-display-name-2',
        signInOptions: [
          {provider: 'microsoft.com'},
          {
            provider: 'saml.idp3',
            providerName: 'saml-display-name-3',
          },
          {
            provider: 'oidc.idp3',
            providerName: 'oidc-display-name-3',
          },
        ],
      },
    };
    const gcipConfig = {
      apiKey: API_KEY,
      authDomain: `${AUTH_SUBDOMAIN}.firebasepp.com`,
    }
    const expectedUiConfig = {
      [API_KEY]: {
        authDomain: gcipConfig.authDomain,
        displayMode: 'optionFirst',
        selectTenantUiTitle: PROJECT_ID,
        selectTenantUiLogo: SELECT_TENANT_LOGO_URL,
        styleUrl: '',
        tenants: {
          _: {
            displayName: 'ABCD',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'facebook.com'},
              {provider: 'twitter.com'},
              {
                provider: 'saml.idp1',
                providerName: 'saml-display-name-1',
              },
              {
                provider: 'oidc.idp1',
                providerName: 'oidc-display-name-1',
              },
            ],
          },
          tenantId1: {
            displayName: 'Tenant-display-name-1',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'password'},
              {
                provider: 'saml.idp2',
                providerName: 'saml-display-name-2',
              },
              {
                provider: 'oidc.idp2',
                providerName: 'oidc-display-name-2',
              },
            ],
          },
          tenantId2: {
            displayName: 'Tenant-display-name-2',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'microsoft.com'},
              {
                provider: 'saml.idp3',
                providerName: 'saml-display-name-3',
              },
              {
                provider: 'oidc.idp3',
                providerName: 'oidc-display-name-3',
              },
            ],
          },
        },
        tosUrl: '',
        privacyPolicyUrl: '',
      },
    };
    const tenantUiConfigMapWithoutDisplayNames = {
      _: {
        signInOptions: [
          {provider: 'facebook.com'},
          {provider: 'twitter.com'},
          {
            provider: 'saml.idp1',
            providerName: 'saml-display-name-1',
          },
          {
            provider: 'oidc.idp1',
            providerName: 'oidc-display-name-1',
          },
        ],
      },
      tenantId1: {
        signInOptions: [
          {provider: 'password'},
          {
            provider: 'saml.idp2',
            providerName: 'saml-display-name-2',
          },
          {
            provider: 'oidc.idp2',
            providerName: 'oidc-display-name-2',
          },
        ],
      },
      tenantId2: {
        signInOptions: [
          {provider: 'microsoft.com'},
          {
            provider: 'saml.idp3',
            providerName: 'saml-display-name-3',
          },
          {
            provider: 'oidc.idp3',
            providerName: 'oidc-display-name-3',
          },
        ],
      },
    };
    const expectedUiConfigWithPopulatedDefaultDisplayNames = {
      [API_KEY]: {
        authDomain: gcipConfig.authDomain,
        displayMode: 'optionFirst',
        selectTenantUiTitle: PROJECT_ID,
        selectTenantUiLogo: SELECT_TENANT_LOGO_URL,
        styleUrl: '',
        tenants: {
          _: {
            displayName: 'My Company',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'facebook.com'},
              {provider: 'twitter.com'},
              {
                provider: 'saml.idp1',
                providerName: 'saml-display-name-1',
              },
              {
                provider: 'oidc.idp1',
                providerName: 'oidc-display-name-1',
              },
            ],
          },
          tenantId1: {
            displayName: 'Company A',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'password'},
              {
                provider: 'saml.idp2',
                providerName: 'saml-display-name-2',
              },
              {
                provider: 'oidc.idp2',
                providerName: 'oidc-display-name-2',
              },
            ],
          },
          tenantId2: {
            displayName: 'Company B',
            iconUrl: TENANT_ICON_URL,
            logoUrl: SIGN_IN_UI_LOGO_URL,
            buttonColor: '#007bff',
            tosUrl: '',
            privacyPolicyUrl: '',
            signInOptions: [
              {provider: 'microsoft.com'},
              {
                provider: 'saml.idp3',
                providerName: 'saml-display-name-3',
              },
              {
                provider: 'oidc.idp3',
                providerName: 'oidc-display-name-3',
              },
            ],
          },
        },
        tosUrl: '',
        privacyPolicyUrl: '',
      },
    };

    it('should return expected populated UiConfig', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, gcipConfig, tenantUiConfigMap);

      expect(configBuilder.build()).to.deep.equal(expectedUiConfig);
    });

    it('should return expected populated UiConfig with default displayNames', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, gcipConfig, tenantUiConfigMapWithoutDisplayNames);

      expect(configBuilder.build()).to.deep.equal(expectedUiConfigWithPopulatedDefaultDisplayNames);
    });

    it('should return null when no tenants are determined', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, gcipConfig, {});

      expect(configBuilder.build()).to.be.null;
    });
  });
});
