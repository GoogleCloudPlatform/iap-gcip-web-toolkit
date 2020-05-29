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
  IapSettingsHandler, IapSettings, BackendServicesList,
} from '../../../../server/api/iap-settings-handler';

describe('IapSettingsHandler', () => {
  let stubs: sinon.SinonStub[] = [];
  const PROJECT_ID = 'awesome-app';
  const PROJECT_NUMBER = '1029384756';
  const ZONE = 'us-east1';
  const ACCESS_TOKEN = 'ACCESS_TOKEN';
  let accessTokenManager: AccessTokenManager;
  let app: ApplicationData;
  let iapSettingsHandler: IapSettingsHandler
  let mockedRequests: nock.Scope[] = [];
  const errorResponse = {
    error: {
      code: 400,
      message: 'Invalid request',
      status: 'INVALID_ARGUMENT',
      details: [{
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
      }],
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
      log: sinon.stub(),
    };
    iapSettingsHandler = new IapSettingsHandler(app, accessTokenManager);
  });

  afterEach(() => {
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('getIapSettings()', () => {
    it('should call expected endpoint with expected parameters on success', () => {
      const id = 'compute/services/BACKEND_SERVICE_ID';
      const iapSettingsResponse: IapSettings = {
        name: 'RESOURCE_NAME',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant1', 'tenant2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      };
      const scope = nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/${id}:iapSettings`)
        .reply(200, iapSettingsResponse);
      mockedRequests.push(scope);

      return iapSettingsHandler.getIapSettings(id)
        .then((iapSettings) => {
          expect(app.log).to.have.been.calledTwice;
          expect((app.log as sinon.SinonStub).firstCall).to.be.calledWith(
            `GET to https://iap.googleapis.com/v1/projects/${PROJECT_NUMBER}/iap_web/${id}:iapSettings`);
          expect((app.log as sinon.SinonStub).secondCall).to.be.calledWith('200 response');
          expect(iapSettings).to.deep.equal(iapSettingsResponse);
        });
    });

    it('should fail with expected error when underlying call fails', () => {
      const id = 'compute/services/BACKEND_SERVICE_ID';
      const iapSettingsResponse: IapSettings = {
        name: 'RESOURCE_NAME',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant1', 'tenant2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      };
      const scope = nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/${id}:iapSettings`)
        .reply(400, errorResponse);
      mockedRequests.push(scope);

      return iapSettingsHandler.getIapSettings(id)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('Invalid request');
        });
    });

    it('should fail with expected error when project number is not determined', () => {
      const id = 'compute/services/BACKEND_SERVICE_ID';
      const expectedError = new Error('Project number not determined');
      const stub = sinon.stub(app, 'getProjectNumber').rejects(expectedError);
      stubs.push(stub);

      return iapSettingsHandler.getIapSettings(id)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const id = 'compute/services/BACKEND_SERVICE_ID';
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return iapSettingsHandler.getIapSettings(id)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });

  describe('listIapSettings()', () => {
    it('should call expected endpoints with expected parameters on success', () => {
      const computeBackendServiceIdsResponse: BackendServicesList = {
        items: [
          {id: 'BACKEND_SERVICE_ID1'},
          {id: 'BACKEND_SERVICE_ID2'},
          {id: 'BACKEND_SERVICE_ID3'},
        ],
      };
      // Corresponds to IAP enabled GAE app.
      const iapSettingsResponse1: IapSettings = {
        name: 'RESOURCE_NAME1',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant1', 'tenant2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      };
      // Corresponds to IAP enabled GCE BACKEND_SERVICE_ID1.
      const iapSettingsResponse2: IapSettings = {
        name: 'RESOURCE_NAME2',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant3', 'tenant4'],
            loginPageUri: 'https://other.example.com/login',
          },
        },
      };
      // Corresponds to IAP enabled GCE BACKEND_SERVICE_ID3.
      const iapSettingsResponse3: IapSettings = {
        name: 'RESOURCE_NAME3',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant5'],
            loginPageUri: 'https://example.com/login',
          },
        },
      };
      // 3 compute backend service IDs return. 2 of which are enabled in IAP.
      // In addition to the GAE app.
      mockedRequests.push(nock('https://compute.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/compute/v1/projects/${PROJECT_ID}/global/backendServices`)
        .reply(200, computeBackendServiceIdsResponse));
      // RPC to look up GAE app.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/appengine-${PROJECT_ID}:iapSettings`)
        .reply(200, iapSettingsResponse1));
      // RPC to look up compute backend service 1.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID1:iapSettings`)
        .reply(200, iapSettingsResponse2));
      // RPC to look up compute backend service 2.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID2:iapSettings`)
        .reply(404));
      // RPC to look up compute backend service 3.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID3:iapSettings`)
        .reply(200, iapSettingsResponse3));

      return iapSettingsHandler.listIapSettings()
        .then((iapSettingsList) => {
          // Confirm expected information logged.
          expect(app.log).to.have.callCount(5 * 2);
          expect((app.log as sinon.SinonStub).getCall(0)).to.be.calledWith(
            `GET to https://compute.googleapis.com` +
            `/compute/v1/projects/${PROJECT_ID}/global/backendServices`);
          expect((app.log as sinon.SinonStub).getCall(1)).to.be.calledWith('200 response');
          expect((app.log as sinon.SinonStub).getCall(2)).to.be.calledWith(
            `GET to https://iap.googleapis.com` +
            `/v1/projects/${PROJECT_NUMBER}/iap_web/appengine-${PROJECT_ID}:iapSettings`);
          expect((app.log as sinon.SinonStub).getCall(3)).to.be.calledWith('200 response');
          expect((app.log as sinon.SinonStub).getCall(4)).to.be.calledWith(
            `GET to https://iap.googleapis.com` +
            `/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID1:iapSettings`);
          expect((app.log as sinon.SinonStub).getCall(5)).to.be.calledWith('200 response');
          expect((app.log as sinon.SinonStub).getCall(6)).to.be.calledWith(
            `GET to https://iap.googleapis.com` +
            `/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID2:iapSettings`);
          expect((app.log as sinon.SinonStub).getCall(7)).to.be.calledWith(
            '404 Response:', undefined);
          expect((app.log as sinon.SinonStub).getCall(8)).to.be.calledWith(
            `GET to https://iap.googleapis.com` +
            `/v1/projects/${PROJECT_NUMBER}/iap_web/compute/services/BACKEND_SERVICE_ID3:iapSettings`);
          expect((app.log as sinon.SinonStub).getCall(9)).to.be.calledWith('200 response');
          expect(iapSettingsList.length).to.be.equal(3);
          expect(iapSettingsList[0]).to.deep.equal(iapSettingsResponse1);
          expect(iapSettingsList[1]).to.deep.equal(iapSettingsResponse2);
          expect(iapSettingsList[2]).to.deep.equal(iapSettingsResponse3);
        });
    });

    it('should fail with expected error when underlying call fails', () => {
      mockedRequests.push(nock('https://compute.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/compute/v1/projects/${PROJECT_ID}/global/backendServices`)
        .reply(500, errorResponse));

      return iapSettingsHandler.listIapSettings()
        .then((iapSettingsList) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('Invalid request');
        });
    });

    it('should ignore GCE API not being enabled', () => {
      const apiNotEnabledErrorResponse = {
        error: {
          code: 403,
          message: 'Access Not Configured.',
          status: 'INVALID_ARGUMENT',
          details: [{
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          }],
        }
      };

      const iapSettingsResponse1: IapSettings = {
        name: 'RESOURCE_NAME1',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenant1', 'tenant2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      };
      mockedRequests.push(nock('https://compute.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/compute/v1/projects/${PROJECT_ID}/global/backendServices`)
        .reply(403, apiNotEnabledErrorResponse));
      // RPC to look up GAE app.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/appengine-${PROJECT_ID}:iapSettings`)
        .reply(200, iapSettingsResponse1));

      return iapSettingsHandler.listIapSettings()
        .then((iapSettingsList) => {
          expect(iapSettingsList.length).to.be.equal(1);
          expect(iapSettingsList[0]).to.deep.equal(iapSettingsResponse1);
        });
    });

    it('should resolve with empty array when no resources are found', () => {
      mockedRequests.push(nock('https://compute.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/compute/v1/projects/${PROJECT_ID}/global/backendServices`)
        .reply(200, {}));
      // RPC to look up GAE app.
      mockedRequests.push(nock('https://iap.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/v1/projects/${PROJECT_NUMBER}/iap_web/appengine-${PROJECT_ID}:iapSettings`)
        .reply(404));

      return iapSettingsHandler.listIapSettings()
        .then((iapSettingsList) => {
          expect(iapSettingsList.length).to.be.equal(0);
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return iapSettingsHandler.listIapSettings()
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

      return iapSettingsHandler.listIapSettings()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });
});
