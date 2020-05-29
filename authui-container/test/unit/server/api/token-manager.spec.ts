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

import {expect} from 'chai';
import * as nock from 'nock';
import * as sinon from 'sinon';
import {TokenManager, OFFSET} from '../../../../server/api/token-manager';

describe('TokenManager', () => {
  const now = new Date();
  let clock: sinon.SinonFakeTimers;
  let mockedRequests: nock.Scope[] = [];
  let tokenManager: TokenManager;
  const expectedResponse = {
    access_token: 'ACCESS_TOKEN',
    expires_in: 3600,
    token_type: 'Bearer',
  };
  const expectedResponse2 = {
    access_token: 'ACCESS_TOKEN2',
    expires_in: 3600,
    token_type: 'Bearer',
  };
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
    clock = sinon.useFakeTimers(now.getTime());
    tokenManager = new TokenManager();
  });

  afterEach(() => {
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('getAccessToken()', () => {
    it('retrieves a fresh OAuth access token with default scope and refreshes on expiration', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse)
        .get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse2);
      mockedRequests.push(scope);

      return tokenManager.getAccessToken()
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse.expires_in);
          // Simulate 10 seconds.
          clock.tick(10000);
          // Cached token should be returned.
          return tokenManager.getAccessToken();
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse.expires_in - 10);
          // Simulate OFFSET duration before expiration.
          clock.tick(expectedResponse.expires_in * 1000 - 10000 - OFFSET);
          // Cached token should be returned.
          return tokenManager.getAccessToken();
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(OFFSET / 1000);
          // Clock tick by 1 millisecond should force token refresh.
          clock.tick(1);
          // Cached token should be returned.
          return tokenManager.getAccessToken();
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse2.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse2.expires_in);
        });
    });

    it('retrieves a fresh OAuth access token with multiple scopes', () => {
      const multiScopeTokenManager = new TokenManager(
        [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/identitytoolkit',
        ]);
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform,' +
          'https://www.googleapis.com/auth/identitytoolkit')
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return multiScopeTokenManager.getAccessToken()
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse.expires_in);
        });
    });

    it('forces token refresh when forceRefresh=true', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse)
        .get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse2);
      mockedRequests.push(scope);

      return tokenManager.getAccessToken()
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse.expires_in);
          // Token refresh should be forced.
          return tokenManager.getAccessToken(true);
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse2.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse2.expires_in);
        });
    });

    it('forces token refresh when reset() is called', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse)
        .get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse2);
      mockedRequests.push(scope);

      return tokenManager.getAccessToken()
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse.expires_in);
          tokenManager.reset();
          // New access token should be retrieved.
          return tokenManager.getAccessToken();
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse2.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse2.expires_in);
        });
    });

    it('rejects with underlying OAuth access token', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(400, errorResponse)
        .get(
          '/computeMetadata/v1/instance/service-accounts/default/' +
          'token?scopes=https://www.googleapis.com/auth/cloud-platform')
        .reply(200, expectedResponse2);
      mockedRequests.push(scope);

      return tokenManager.getAccessToken()
        .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(errorResponse.error.message);
          // Next call should succeed.
          return tokenManager.getAccessToken();
        })
        .then((response) => {
          expect(response.access_token).to.be.equal(expectedResponse2.access_token);
          expect(response.expires_in).to.deep.equal(expectedResponse2.expires_in);
        });
    });
  });
});
