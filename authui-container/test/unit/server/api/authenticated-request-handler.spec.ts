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
import {AuthenticatedRequestHandler} from '../../../../server/api/authenticated-request-handler';
import { AccessTokenManager } from '../../../../server/api/token-manager';

describe('AuthenticatedRequestHandler', () => {
  let logger: sinon.SinonStub;
  let stubs: sinon.SinonStub[] = [];
  const ACCESS_TOKEN = 'ACCESS_TOKEN';
  let accessTokenManager: AccessTokenManager;
  let mockedRequests: nock.Scope[] = [];
  let requestHandler: AuthenticatedRequestHandler;
  const expectedResponse = {
    foo: 'bar',
    success: true,
  };

  beforeEach(() => {
    logger = sinon.stub();
    accessTokenManager = {
      getAccessToken: () => Promise.resolve(ACCESS_TOKEN),
    };
    requestHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: 'http://www.example.com:5000/path/to/api',
      headers: {
        'Metadata-Flavor': 'Google',
      },
      timeout: 10000,
    }, accessTokenManager);
  });

  afterEach(() => {
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('send()', () => {
    it('will inject authorization header or funnel error based on underlying access token manager', () => {
      const expectedError = new Error()
      const stub = sinon.stub(accessTokenManager, 'getAccessToken');
      stub.onFirstCall().resolves('ACCESS_TOKEN1');
      stub.onSecondCall().resolves('ACCESS_TOKEN2');
      stub.onThirdCall().rejects(expectedError);
      stubs.push(stub);

      const scope1 = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected first access token.
          'Authorization': `Bearer ACCESS_TOKEN1`,
          'Metadata-Flavor': 'Google',
        },
      }).get('/path/to/api')
        .reply(200, expectedResponse);
      mockedRequests.push(scope1);
      const scope2 = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected second access token.
          'Authorization': `Bearer ACCESS_TOKEN2`,
          'Metadata-Flavor': 'Google',
        },
      }).get('/path/to/api')
        .reply(200, expectedResponse);
      mockedRequests.push(scope2);

      // First access token injected.
      return requestHandler.send()
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
          expect(stub).to.have.been.calledOnce;
          // Second access token injected.
          return requestHandler.send();
        })
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
          expect(stub).to.have.been.calledTwice;
          // This will funnel the underlying access token error.
          return requestHandler.send();
        })
        .then((response) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
          expect(stub).to.have.been.calledThrice;
        });
    });

    it('will inject authorization header for a GET request with parameters', () => {
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          other: 'some-header-value',
          'more-headers': 'another-value',
          'Metadata-Flavor': 'Google',
        },
      }).get('/path/to/api?a=1&b=2&c=false')
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: {
          a: 1,
          b: 2,
          c: false,
        },
      };

      // Send parameters with request.
      return requestHandler.send(requestParams)
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will inject authorization header for a POST request with no parameters', () => {
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).post('/path/to/api', undefined)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return postHandler.send()
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will inject authorization header for a POST request with parameters', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return postHandler.send(requestParams)
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will not log authorization header for a POST request with parameters', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      }, accessTokenManager, logger);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return postHandler.send(requestParams)
        .then((response) => {
          expect(logger).to.have.been.calledThrice;
          expect(logger.firstCall).to.be.calledWith(
            'POST to http://www.example.com:5000/path/to/api');
          expect(logger.secondCall).to.be.calledWith(
            'Request body:', requestParams.body);
          expect(logger.thirdCall).to.be.calledWith('200 response');
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will reject with parsed error for non-200 status code', () => {
      const expectedError = {
        error: {
          message: 'Internal server error',
        },
      };
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        .delay(10)
        .reply(500, expectedError);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return postHandler.send(requestParams)
        .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.deep.equal(expectedError.error.message);
        });
    });

    it('will reject with default error message for unexpected non-200 status code', () => {
      const defaultMessage = 'Unexpected error';
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        .delay(10)
        .reply(500, {error: 'unexpected'});
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return postHandler.send(requestParams, defaultMessage)
        .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.deep.equal(defaultMessage);
        });
    });

    it('will reject when request delay exceeds expected timeout', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        // Exceed timeout delay.
        .delay(11)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return expect(postHandler.send(requestParams)).to.be.rejectedWith('ESOCKETTIMEDOUT');
    });

    it('will resolve with result and not cache previous results', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const firstResult = {
        id: '123',
      };
      const secondResult = {
        id: '456',
      };
      const postHandler = new AuthenticatedRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, accessTokenManager);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          // Injected access token.
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api')
        // First result.
        .delay(10)
        .reply(200, firstResult)
        .post('/path/to/api')
        // Second result
        .delay(10)
        .reply(200, secondResult)
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return postHandler.send(requestParams)
        .then((response) => {
          // Expected first response.
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(firstResult);
          // Send second request.
          return postHandler.send(requestParams);
        })
        .then((response) => {
          // Expected second response.
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(secondResult);
        });
    });
  });
});
