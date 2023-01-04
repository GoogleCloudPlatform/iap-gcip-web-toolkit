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
  DefaultUiConfigBuilder, TENANT_ICON_URL} from '../../../common/config-builder';
import {UiConfig} from '../../../common/config';
import { deepCopy } from '../../../common/deep-copy';

describe('DefaultUiConfigBuilder', () => {
  const PROJECT_ID = 'project-id';
  const API_KEY = 'API_KEY';
  const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
  const HOST_NAME = 'gcip-iap-hosted-ui-xyz.uc.run.app';
  const tenantUiConfigMap = {
    _: {
      fullLabel: 'ABCD Portal',
      displayName: 'ABCD',
      signInOptions: [
        {provider: 'facebook.com'},
        {provider: 'twitter.com'},
        {
          provider: 'saml.idp1',
          providerName: 'saml-display-name-1',
          fullLabel: 'Contractor Portal',
        },
        {
          provider: 'oidc.idp1',
          providerName: 'oidc-display-name-1',
        },
      ],
    },
    tenantId1: {
      fullLabel: 'Tenant 1',
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
          fullLabel: 'Employee Login',
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
    tenantId3: {
      displayName: 'Tenant-display-name-3',
      signInOptions: [
        {
          provider: 'password',
          disableSignUp: {
            status: true,
            adminEmail: 'admin@example.com',
            helpLink: 'https://www.example.com/trouble_signing_in',
          }
        },
      ],
    },
    tenantId4: {
      displayName: 'Tenant-display-name-4',
      signInOptions: [
        {
          provider: 'google.com',
          scopes: ['scope1', 'scope2', 'https://example.com/scope3'],
          loginHintKey: 'login_hint',
          customParameters: {
            prompt: 'consent',
          },
        },
      ],
      adminRestrictedOperation: {
        status: true,
        adminEmail: 'admin@example.com',
        helpLink: 'https://www.example.com/trouble_signing_in',
      }
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
      selectTenantUiLogo: '',
      styleUrl: '',
      tenants: {
        _: {
          fullLabel: 'ABCD Portal',
          displayName: 'ABCD',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {provider: 'facebook.com'},
            {provider: 'twitter.com'},
            {
              provider: 'saml.idp1',
              providerName: 'saml-display-name-1',
              fullLabel: 'Contractor Portal',
            },
            {
              provider: 'oidc.idp1',
              providerName: 'oidc-display-name-1',
            },
          ],
        },
        tenantId1: {
          fullLabel: 'Tenant 1',
          displayName: 'Tenant-display-name-1',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
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
              fullLabel: 'Employee Login',
            },
          ],
        },
        tenantId2: {
          displayName: 'Tenant-display-name-2',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
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
        tenantId3: {
          displayName: 'Tenant-display-name-3',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {
              provider: 'password',
              disableSignUp: {
                status: true,
                adminEmail: 'admin@example.com',
                helpLink: 'https://www.example.com/trouble_signing_in',
              }
            },
          ],
        },
        tenantId4: {
          displayName: 'Tenant-display-name-4',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {
              provider: 'google.com',
              scopes: ['scope1', 'scope2', 'https://example.com/scope3'],
              loginHintKey: 'login_hint',
              customParameters: {
                prompt: 'consent',
              },
            },
          ],
          adminRestrictedOperation: {
            status: true,
            adminEmail: 'admin@example.com',
            helpLink: 'https://www.example.com/trouble_signing_in',
          }
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
          fullLabel: 'Contractor Portal',
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
          fullLabel: 'Employee Login',
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
      selectTenantUiLogo: '',
      styleUrl: '',
      tenants: {
        _: {
          displayName: 'My Company',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {provider: 'facebook.com'},
            {provider: 'twitter.com'},
            {
              provider: 'saml.idp1',
              providerName: 'saml-display-name-1',
              fullLabel: 'Contractor Portal',
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
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
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
              fullLabel: 'Employee Login',
            },
          ],
        },
        tenantId2: {
          displayName: 'Company B',
          iconUrl: TENANT_ICON_URL,
          logoUrl: '',
          buttonColor: '#007bff',
          immediateFederatedRedirect: true,
          signInFlow: 'redirect',
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
  const fullUiConfig: UiConfig = {
    [API_KEY]: {
      authDomain: gcipConfig.authDomain,
      displayMode: 'optionFirst',
      selectTenantUiTitle: PROJECT_ID,
      selectTenantUiLogo: 'https://example.com/img/tenant-select.png',
      styleUrl: 'https://example.com/styles/stylesheet.css',
      tosUrl: 'https://example.com/about/tos',
      privacyPolicyUrl: 'https://example.com/about/privacyPolicyUrl',
      tenants: {
        _: {
          fullLabel: 'My Company Portal',
          displayName: 'My Company',
          iconUrl: TENANT_ICON_URL,
          logoUrl: 'https://example.com/img/tenant-0.png',
          buttonColor: '#007bff',
          tosUrl: 'https://example.com/about/tos',
          privacyPolicyUrl: 'https://example.com/about/privacyPolicyUrl',
          immediateFederatedRedirect: false,
          signInFlow: 'popup',
          signInOptions: [
            {
              provider: 'google.com',
              scopes: ['scope1', 'scope2', 'https://example.com/scope3'],
              loginHintKey: 'login_hint',
              customParameters: {
                prompt: 'consent',
              },
            },
            {provider: 'twitter.com'},
            'apple.com',
            {
              requireDisplayName: true,
              provider: 'password',
            },
            {
              provider: 'phone',
              recaptchaParameters: {
                type: 'image',
                size: 'invisible',
                badge: 'inline',
              },
              defaultCountry: 'us',
              defaultNationalNumber: '1234567890',
              loginHint: '+12223334444',
              whitelistedCountries: ['+44', 'us'],
              blacklistedCountries: ['+44', 'GB'],
            },
            {
              hd: 'example.com',
              buttonColor: '#ff00ff',
              iconUrl: 'https://example.com/img/icon.png',
              provider: 'saml.idp1',
              providerName: 'saml-display-name-1',
              fullLabel: 'Contractor Portal',
            },
            {
              provider: 'oidc.idp1',
              providerName: 'oidc-display-name-1',
            },
          ],
        },
        tenantId1: {
          fullLabel: 'Company A Portal',
          displayName: 'Company A',
          iconUrl: TENANT_ICON_URL,
          logoUrl: 'https://example.com/img/tenant-1.png',
          buttonColor: '#007bff',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInFlow: 'redirect',
          signInOptions: [
            {provider: 'password'},
            {
              provider: 'saml.idp2',
              providerName: 'saml-display-name-2',
            },
            {
              provider: 'oidc.idp2',
              providerName: 'oidc-display-name-2',
              fullLabel: 'Employee Login',
            },
          ],
        },
        tenantId2: {
          fullLabel: 'Company B Portal',
          displayName: 'Company B',
          iconUrl: TENANT_ICON_URL,
          logoUrl: 'https://example.com/img/tenant-2.png',
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
    },
  };
  describe('validateConfig()', () => {
    it('should not throw on valid config', () => {
      expect(() => {
        DefaultUiConfigBuilder.validateConfig(fullUiConfig);
      }).not.to.throw();
    });

    it('should not throw on valid empty signInOptions array type', () => {
      expect(() => {
        const validConfig: any = deepCopy(expectedUiConfig);
        validConfig[API_KEY].tenants.tenantId2.signInOptions = [];
        DefaultUiConfigBuilder.validateConfig(validConfig);
      }).not.to.throw();
    });

    it('should not throw on valid multiple signInOptions type values', () => {
      expect(() => {
        const validConfig: any = deepCopy(expectedUiConfig);
        validConfig[API_KEY].tenants.tenantId2.signInOptions = ['facebook.com' , {provider: 'twitter.com'}];
        DefaultUiConfigBuilder.validateConfig(validConfig);
      }).not.to.throw();
    });

    it('should not throw on empty *.selectTenantUiLogo', () => {
      expect(() => {
        const validConfig: any = deepCopy(expectedUiConfig);
        validConfig[API_KEY].selectTenantUiLogo = '';
        DefaultUiConfigBuilder.validateConfig(validConfig);
      }).not.to.throw();
    });

    it('should not throw on empty *.tenants.*.logoUrl', () => {
      expect(() => {
        const validConfig: any = deepCopy(expectedUiConfig);
        validConfig[API_KEY].tenants.tenantId1.logoUrl = '';
        DefaultUiConfigBuilder.validateConfig(validConfig);
      }).not.to.throw();
    });

    it('should throw on missing authDomain', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].authDomain;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.authDomain"`);
    });

    it('should throw on missing displayMode', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].displayMode;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.displayMode"`);
    });

    it('should throw on missing tenant *.tenants.*.displayName', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].tenants.tenantId1.displayName;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.tenants.*.displayName"`);
    });

    it('should throw on missing tenant *.tenants.*.iconUrl', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].tenants.tenantId1.iconUrl;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.tenants.*.iconUrl"`);
    });

    it('should throw on missing tenant *.tenants.*.buttonColor', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].tenants.tenantId1.buttonColor;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.tenants.*.buttonColor"`);
    });

    it('should throw on missing tenant *.tenants.*.signInOptions[]', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        delete invalidConfig[API_KEY].tenants.tenantId1.signInOptions;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Missing required field "*.tenants.*.signInOptions[]"`);
    });

    it('should throw on invalid key', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId2.foo = 'bar';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Invalid key or type "${API_KEY}.tenants.tenantId2.foo"`);
    });

    it('should throw on invalid signInOptions array value', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId2.signInOptions[0] = true;
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(
        `"${API_KEY}.tenants.tenantId2.signInOptions[]" should be a valid providerId string or provider object.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId2.signInOptions = {};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`Invalid key or type "${API_KEY}.tenants.tenantId2.signInOptions"`);
    });

    it('should throw on invalid *.authDomain type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].authDomain = '<h1>Domain</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.authDomain" should be a valid string.`);
    });

    it('should throw on invalid *.displayMode type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].displayMode = 'other';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.displayMode" should be either "optionFirst" or "identifierFirst".`);
    });

    it('should throw on invalid *.selectTenantUiTitle type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].selectTenantUiTitle = '<h1>Title</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.selectTenantUiTitle" should be a valid string.`);
    });

    it('should throw on invalid *.selectTenantUiLogo type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].selectTenantUiLogo = 'javascript:doEvil()';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.selectTenantUiLogo" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.styleUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].styleUrl = 'javascript:doEvil()';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.styleUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tosUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tosUrl = 'javascript:doEvil()';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tosUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.privacyPolicyUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].privacyPolicyUrl = 'javascript:doEvil()';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.privacyPolicyUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.fullLabel type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.fullLabel = '<h1>Label</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.fullLabel" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.displayName type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.displayName = '<h1><Name/h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.displayName" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.iconUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.iconUrl = 'http://localhost/icon.png';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.iconUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.logoUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.logoUrl = 'http://localhost/icon.png';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.logoUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.buttonColor type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.buttonColor = '#invalid';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.buttonColor" should be a valid color string of format #xxxxxx.`);
    });

    it('should throw on invalid *.tenants.*.tosUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.tosUrl = 'http://localhost/icon.png';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.tosUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.privacyPolicyUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.privacyPolicyUrl = 'http://localhost/icon.png';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.privacyPolicyUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.immediateFederatedRedirect type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.immediateFederatedRedirect = '0';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.immediateFederatedRedirect" should be a valid boolean.`);
    });

    it('should throw on invalid *.tenants.*.signInFlow type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInFlow = 'other';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInFlow" should be either "popup" or "redirect".`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[] type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0] = 'invalid provider';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(
        `"${API_KEY}.tenants.tenantId1.signInOptions[]" should be a valid providerId string or provider object.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].provider type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].provider = 'invalid provider';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].provider" should be a valid providerId string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].providerName type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].providerName = '<h2>Provider Name</h2>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].providerName" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].fullLabel type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].fullLabel = '<h2>Employee Login</h2>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].fullLabel" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].hd type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].hd = '<h2>Provider Name</h2>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].hd" should be a valid domain string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].buttonColor type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].buttonColor = 'ff00ff';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(
        `"${API_KEY}.tenants.tenantId1.signInOptions[].buttonColor" should be a valid color string of format #xxxxxx.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].iconUrl type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].iconUrl = 'http://localhost/icon.png';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].iconUrl" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].scopes[] type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].scopes = ['javascript:doEvil()'];
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].scopes[]" should be a valid array of OAuth scopes.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].customParameters.a type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].customParameters = {a: 'javascript:doEvil()'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].customParameters.a" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].loginHintKey type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].loginHintKey = '<h2>hint</h2>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].loginHintKey" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].requireDisplayName type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].requireDisplayName = 'true';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].requireDisplayName" should be a valid boolean.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].recaptchaParameters.type type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].recaptchaParameters = {type: 'invalid'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].recaptchaParameters.type" should be either "image" or "audio".`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].recaptchaParameters.size type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].recaptchaParameters = {size: 'invalid'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(
        `"${API_KEY}.tenants.tenantId1.signInOptions[].recaptchaParameters.size" should be one of ` +
        `["invisible", "compact", "normal"].`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].recaptchaParameters.badge type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].recaptchaParameters = {badge: 'invalid'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(
        `"${API_KEY}.tenants.tenantId1.signInOptions[].recaptchaParameters.badge" should be one of ` +
        `["bottomright", "bottomleft", "inline"].`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].defaultCountry type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].defaultCountry = '<h1>US</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].defaultCountry" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].defaultNationalNumber type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].defaultNationalNumber = '<h1>1234567890</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].defaultNationalNumber" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].loginHint type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].loginHint = '<h1>+12223334444</h1>';
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].loginHint" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].whitelistedCountries[] type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].whitelistedCountries = ['\\+44'];
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].whitelistedCountries[]" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].blacklistedCountries[] type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].blacklistedCountries = ['\\+44'];
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].blacklistedCountries[]" should be a valid string.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].disableSignUp.status type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].disableSignUp = {status: 'true'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].disableSignUp.status" should be a boolean.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].disableSignUp.adminEmail type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].disableSignUp = {status: true, adminEmail: 123};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].disableSignUp.adminEmail" should be a valid email.`);
    });

    it('should throw on invalid *.tenants.*.signInOptions[].disableSignUp.helpLink type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.signInOptions[0].disableSignUp = {status: true, helpLink: true};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.signInOptions[].disableSignUp.helpLink" should be a valid HTTPS URL.`);
    });

    it('should throw on invalid *.tenants.*.adminRestrictedOperation.status type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.adminRestrictedOperation = {status: 'true'};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.adminRestrictedOperation.status" should be a boolean.`);
    });

    it('should throw on invalid *.tenants.*.adminRestrictedOperation.adminEmail type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.adminRestrictedOperation = {status: true, adminEmail: 123};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.adminRestrictedOperation.adminEmail" should be a valid email.`);
    });

    it('should throw on invalid *.tenants.*.adminRestrictedOperation.helpLink type', () => {
      expect(() => {
        const invalidConfig: any = deepCopy(expectedUiConfig);
        invalidConfig[API_KEY].tenants.tenantId1.adminRestrictedOperation = {status: true, helpLink: true};
        DefaultUiConfigBuilder.validateConfig(invalidConfig);
      }).to.throw(`"${API_KEY}.tenants.tenantId1.adminRestrictedOperation.helpLink" should be a valid HTTPS URL.`);
    });
  });

  describe('build()', () => {
    it('should return expected populated UiConfig', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, '', gcipConfig, tenantUiConfigMap);

      expect(configBuilder.build()).to.deep.equal(expectedUiConfig);
    });

    it('should return expected populated UiConfig with default displayNames and default AuthDomain', () => {
      const configBuilder = new DefaultUiConfigBuilder(
        PROJECT_ID, '', gcipConfig, tenantUiConfigMapWithoutDisplayNames);

      expect(configBuilder.build()).to.deep.equal(expectedUiConfigWithPopulatedDefaultDisplayNames);
    });

    it('should return null when no tenants are determined', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, '', gcipConfig, {});

      expect(configBuilder.build()).to.be.null;
    });

    it('should return null when empty signInOptions are provided', () => {
      const emptyConfigMap = {
        _: {
          signInOptions: [],
        },
        tenantId1: {
          signInOptions: [],
        },
        tenantId2: {
          signInOptions: [],
        },
      };
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, '', gcipConfig, emptyConfigMap);

      expect(configBuilder.build()).to.be.null;
    });
    it('should override the authDomain when main UI hostname is specified', () => {
      const configBuilder = new DefaultUiConfigBuilder(PROJECT_ID, HOST_NAME, gcipConfig, tenantUiConfigMap);
      const expectedUiConfigWithHostName = deepCopy(expectedUiConfig) as any;
      expectedUiConfigWithHostName[API_KEY].authDomain = HOST_NAME;

      expect(configBuilder.build()).to.deep.equal(expectedUiConfigWithHostName);
    });
  });
});
