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
import * as nock from 'nock';
import * as sinon from 'sinon';
import {AccessTokenManager} from '../../../../server/api/token-manager';
import {ApplicationData} from '../../../../server/api/metadata-server';
import {
  GcipHandler, Config, DEFAULT_ERROR_GET_GCIP_CONFIG,
} from '../../../../server/api/gcip-handler';

describe('GcipHandler', () => {
  let stubs: sinon.SinonStub[] = [];
  const API_KEY = 'API_KEY';
  const APP_SUBDOMAIN = 'my-app';
  const PROJECT_ID = 'awesome-app';
  const PROJECT_NUMBER = '1029384756';
  const ZONE = 'us-east1';
  const ACCESS_TOKEN = 'ACCESS_TOKEN';
  let accessTokenManager: AccessTokenManager;
  let app: ApplicationData;
  let gcipsHandler: GcipHandler
  let mockedRequests: nock.Scope[] = [];
  const errorResponse = {
    error: {
      code: 400,
      message: 'Invalid request',
    }
  };

  beforeEach(() => {
    accessTokenManager = {
      getAccessToken: () => Promise.resolve(ACCESS_TOKEN),
    };
    app = {
      getProjectId: () => Promise.resolve(PROJECT_ID),
      getProjectNumber: () => Promise.resolve(PROJECT_NUMBER),
      getZone: () => Promise.resolve(ZONE),
    };
    gcipsHandler = new GcipHandler(app, accessTokenManager);
  });

  afterEach(() => {
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('getGcipConfig()', () => {
    it('should call expected endpoint with expected parameters on success', () => {
      const expectedGcipConfig = {
        apiKey: API_KEY,
        authDomain: `${APP_SUBDOMAIN}.firebaseapp.com`,
      };
      const config: Config = {
        client: {
          apiKey: API_KEY,
          firebaseSubdomain: APP_SUBDOMAIN,
        },
        signIn: {
          email: {
            enabled: true,
          },
          phoneNumber: {
            enabled: true,
          },
        },
      };
      const scope = nock('https://identitytoolkit.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
        .reply(200, config);
      mockedRequests.push(scope);

      return gcipsHandler.getGcipConfig()
         .then((result) => {
           expect(result).to.deep.equal(expectedGcipConfig);
         });
    });

    it('should fail when response is missing required data', () => {
      const config: Config = {
        client: {
          apiKey: API_KEY,
        },
        signIn: {
          email: {
            enabled: true,
          },
          phoneNumber: {
            enabled: true,
          },
        },
      };
      const scope = nock('https://identitytoolkit.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
        .reply(200, config);
      mockedRequests.push(scope);

      return gcipsHandler.getGcipConfig()
         .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal(DEFAULT_ERROR_GET_GCIP_CONFIG);
        });
    });

    it('should fail with expected error when underlying call fails', () => {
      const scope = nock('https://identitytoolkit.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
        .reply(400, errorResponse);
      mockedRequests.push(scope);

      return gcipsHandler.getGcipConfig()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('Invalid request');
        });
    });

    it('should fail with expected error when project ID is not determined', () => {
      const expectedError = new Error('Project ID not determined');
      const stub = sinon.stub(app, 'getProjectId').rejects(expectedError);
      stubs.push(stub);

      return gcipsHandler.getGcipConfig()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return gcipsHandler.getGcipConfig()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });

  describe('getTenantUiConfig()', () => {
    describe('for non-tenant', () => {
      it('should call expected endpoints with expected parameters on success', () => {
        const gcipConfigResponse = {
          client: {
            apiKey: API_KEY,
            firebaseSubdomain: APP_SUBDOMAIN,
          },
          signIn: {
            email: {
              enabled: true,
            },
            phoneNumber: {
              enabled: true,
            },
          },
        };
        const expectedTenantUiConfig = {
          displayName: PROJECT_ID,
          signInOptions: [
            {provider: 'password'},
            {provider: 'phone'},
            {provider: 'facebook.com'},
            {
              provider: 'saml.provider1',
              providerName: 'SAMLProvider1',
            },
            {
              provider: 'oidc.provider1',
              providerName: 'OIDCProvider1',
            },
          ],
        };

        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(200, gcipConfigResponse));
        // Default IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/facebook.com`,
                enabled: true,
              }
            ],
          }));
        // SAML IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/inboundSamlConfigs?pageSize=100`)
          .reply(200, {
            inboundSamlConfigs: [
              {
                name: `projects/${PROJECT_ID}/inboundSamlConfigs/saml.provider1`,
                displayName: 'SAMLProvider1',
                enabled: true,
              },
            ],
          }));
        // OIDC IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/oauthIdpConfigs?pageSize=100`)
          .reply(200, {
            oauthIdpConfigs: [
            {
              name: `projects/${PROJECT_ID}/oauthIdpConfigs/oidc.provider1`,
              displayName: 'OIDCProvider1',
              enabled: true,
            },
          ],
        }));

        return gcipsHandler.getTenantUiConfig('_')
          .then((tenantUiConfig) => {
            expect(tenantUiConfig).to.deep.equal(expectedTenantUiConfig);
          });
      });

      it('should fail with expected error when underlying gcip config call fails', () => {
        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying default IdP call fails', () => {
        const gcipConfigResponse = {
          client: {
            apiKey: API_KEY,
            firebaseSubdomain: APP_SUBDOMAIN,
          },
          signIn: {
            email: {
              enabled: true,
            },
            phoneNumber: {
              enabled: true,
            },
          },
        };

        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(200, gcipConfigResponse));
        // Default IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying SAML IdP call fails', () => {
        const gcipConfigResponse = {
          client: {
            apiKey: API_KEY,
            firebaseSubdomain: APP_SUBDOMAIN,
          },
          signIn: {
            email: {
              enabled: true,
            },
            phoneNumber: {
              enabled: true,
            },
          },
        };

        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(200, gcipConfigResponse));
        // Default IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/facebook.com`,
                enabled: true,
              }
            ],
          }));
        // SAML IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/inboundSamlConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying OIDC IdP call fails', () => {
        const gcipConfigResponse = {
          client: {
            apiKey: API_KEY,
            firebaseSubdomain: APP_SUBDOMAIN,
          },
          signIn: {
            email: {
              enabled: true,
            },
            phoneNumber: {
              enabled: true,
            },
          },
        };

        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(200, gcipConfigResponse));
        // Default IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/defaultSupportedIdpConfigs/facebook.com`,
                enabled: true,
              }
            ],
          }));
        // SAML IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/inboundSamlConfigs?pageSize=100`)
          .reply(200, {
            inboundSamlConfigs: [
              {
                name: `projects/${PROJECT_ID}/inboundSamlConfigs/saml.provider1`,
                displayName: 'SAMLProvider1',
                enabled: true,
              },
            ],
          }));
        // OIDC IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/oauthIdpConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should resolve with empty signInOptions when no IdPs are enabled', () => {
        const gcipConfigResponse = {
          client: {
            apiKey: API_KEY,
            firebaseSubdomain: APP_SUBDOMAIN,
          },
          signIn: {
            email: {
              enabled: false,
            },
            phoneNumber: {
              enabled: false,
            },
          },
        };
        const expectedTenantUiConfig = {
          displayName: PROJECT_ID,
          signInOptions: [],
        };

        // Mock GCIP project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/admin/v2/projects/${PROJECT_ID}/config`)
          .reply(200, gcipConfigResponse));
        // Default IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {}));
        // SAML IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/inboundSamlConfigs?pageSize=100`)
          .reply(200, {}));
        // OIDC IdPs for project level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/oauthIdpConfigs?pageSize=100`)
          .reply(200, {}));

        return gcipsHandler.getTenantUiConfig('_')
          .then((tenantUiConfig) => {
            expect(tenantUiConfig).to.deep.equal(expectedTenantUiConfig);
          });
      });

      it('should fail with expected error when access token is not determined', () => {
        const expectedError = new Error('Invalid credentials');
        const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
        stubs.push(stub);

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error).to.be.equal(expectedError);
          });
      });

      it('should fail with expected error when project ID is not determined', () => {
        const expectedError = new Error('Project ID not determined');
        const stub = sinon.stub(app, 'getProjectId').rejects(expectedError);
        stubs.push(stub);

        return gcipsHandler.getTenantUiConfig('_')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error).to.be.equal(expectedError);
          });
      });
    });

    describe('for tenant', () => {
      it('should call expected endpoints with expected parameters on success', () => {
        const expectedTenantUiConfig = {
          displayName: 'tenant-display-name1',
          signInOptions: [
            {provider: 'password'},
            {provider: 'microsoft.com'},
            {
              provider: 'saml.provider1',
              providerName: 'SAMLProvider1',
            },
            {
              provider: 'saml.provider2',
              providerName: 'SAMLProvider2',
            },
            {
              provider: 'oidc.provider1',
              providerName: 'OIDCProvider1',
            },
            {
              provider: 'oidc.provider2',
              providerName: 'OIDCProvider2',
            },
          ],
        };

        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(200, {
            allowPasswordSignup: true,
            displayName: 'tenant-display-name1',
          }));
        // Default IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs/microsoft.com`,
                enabled: true,
              },
            ],
          }));
        // SAML IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs?pageSize=100`)
          .reply(200, {
            inboundSamlConfigs: [
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs/saml.provider1`,
                displayName: 'SAMLProvider1',
                enabled: true,
              },
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs/saml.provider2`,
                displayName: 'SAMLProvider2',
                enabled: true,
              },
            ],
          }));
        // OIDC IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/oauthIdpConfigs?pageSize=100`)
          .reply(200, {
            oauthIdpConfigs: [
            {
              name: `projects/${PROJECT_ID}/tenants/tenantId1/oauthIdpConfigs/oidc.provider1`,
              displayName: 'OIDCProvider1',
              enabled: true,
            },
            {
              name: `projects/${PROJECT_ID}/tenants/tenantId1/oauthIdpConfigs/oidc.provider2`,
              displayName: 'OIDCProvider2',
              enabled: true,
            },
          ],
        }));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then((tenantUiConfig) => {
            expect(tenantUiConfig).to.deep.equal(expectedTenantUiConfig);
          });
      });

      it('should fail with expected error when underlying tenant config call fails', () => {
        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying default IdP call fails', () => {
        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(200, {
            allowPasswordSignup: true,
            displayName: 'tenant-display-name1',
          }));
        // Default IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying SAML IdP call fails', () => {
        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(200, {
            allowPasswordSignup: true,
            displayName: 'tenant-display-name1',
          }));
        // Default IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs/microsoft.com`,
                enabled: true,
              },
            ],
          }));
        // SAML IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should fail with expected error when underlying OIDC IdP call fails', () => {
        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(200, {
            allowPasswordSignup: true,
            displayName: 'tenant-display-name1',
          }));
        // Default IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs/microsoft.com`,
                enabled: true,
              },
            ],
          }));
        // SAML IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs?pageSize=100`)
          .reply(200, {
            inboundSamlConfigs: [
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs/saml.provider1`,
                displayName: 'SAMLProvider1',
                enabled: true,
              },
              {
                name: `projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs/saml.provider2`,
                displayName: 'SAMLProvider2',
                enabled: true,
              },
            ],
          }));
        // OIDC IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/oauthIdpConfigs?pageSize=100`)
          .reply(400, errorResponse));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error.message).to.be.equal(errorResponse.error.message);
          });
      });

      it('should resolve with empty signInOptions when no IdPs are enabled', () => {
        const expectedTenantUiConfig = {
          displayName: 'tenant-display-name1',
          signInOptions: [],
        };

        // Mock tenant settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1`)
          .reply(200, {
            allowPasswordSignup: false,
            displayName: 'tenant-display-name1',
          }));
        // Default IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/defaultSupportedIdpConfigs?pageSize=100`)
          .reply(200, {
            defaultSupportedIdpConfigs: [],
          }));
        // SAML IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/inboundSamlConfigs?pageSize=100`)
          .reply(200, {
            inboundSamlConfigs: [],
          }));
        // OIDC IdPs for tenant level settings.
        mockedRequests.push(nock('https://identitytoolkit.googleapis.com', {
          reqheaders: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
          },
        }).get(`/v2/projects/${PROJECT_ID}/tenants/tenantId1/oauthIdpConfigs?pageSize=100`)
          .reply(200, {
            oauthIdpConfigs: [],
        }));

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then((tenantUiConfig) => {
            expect(tenantUiConfig).to.deep.equal(expectedTenantUiConfig);
          });
      });

      it('should fail with expected error when access token is not determined', () => {
        const expectedError = new Error('Invalid credentials');
        const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
        stubs.push(stub);

        return gcipsHandler.getTenantUiConfig('tenantId1')
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error).to.be.equal(expectedError);
          });
      });

      it('should fail with expected error when project ID is not determined', () => {
        it('should fail with expected error when project ID is not determined', () => {
          const expectedError = new Error('Project ID not determined');
          const stub = sinon.stub(app, 'getProjectId').rejects(expectedError);
          stubs.push(stub);

          return gcipsHandler.getTenantUiConfig('tenantId1')
            .then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.be.equal(expectedError);
            });
        });
      });
    });
  });
});
