/*!
 * Copyright 2019 Google Inc.
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
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  HttpClient, HttpResponse,
} from '../../../src/utils/http-client';
import { GCIPRequestHandler } from '../../../src/ciap/gcip-request';
import { isNonNullObject } from '../../../src/utils/validator';
import { createMockLowLevelError } from '../../resources/utils';
import { HttpCIAPError } from '../../../src/utils/error';
import * as browser from '../../../src/utils/browser';
import { deepCopy } from '../../../src/utils/deep-copy';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

/**
 * Generates a mock 200 HttpResponse with corresponding headers and data.
 *
 * @param {object} headers The headers to include in the mock HttpResponse.
 * @param (any=} response The optional raw HTTP body response.
 * @return {HttpResponse} The corresponding mock HttpResponse.
 */
function createMockHttpResponse(headers: object, response?: any): HttpResponse {
  let data: any;
  let text: any;
  if (isNonNullObject(response)) {
    data = response;
    text = JSON.stringify(response);
  } else {
    text = response;
  }
  return {
    status: 200,
    headers,
    text,
    data,
    request: {},
    isJson: () => isNonNullObject(response),
  };
}

describe('GCIPRequestHandler', () => {
  const httpClient = new HttpClient();
  const apiKey = 'API_KEY';
  const stubs: sinon.SinonStub[] = [];
  const clientVersion = browser.getClientVersion();

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  describe('Constructor', () => {
    const invalidKeys = [null, NaN, 0, 1, true, false, '', [], [1, 'a'], {}, { a: 1 }, _.noop, undefined];
    invalidKeys.forEach((invalidKey) => {
      it('should throw given invalid API key: ' + JSON.stringify(invalidKey), () => {
        expect(() => {
          return new (GCIPRequestHandler as any)(invalidKey);
        }).to.throw().with.property('code', 'invalid-argument');
      });
    });

    const invalidHttpClients = [
      null, NaN, 0, 1, true, false, '', 'a', [], [1, 'a'], {}, { a: 1 }, _.noop, undefined,
    ];
    invalidHttpClients.forEach((invalidHttpClient) => {
      it('should throw given invalid http client: ' + JSON.stringify(invalidHttpClient), () => {
        expect(() => {
          return new (GCIPRequestHandler as any)(apiKey, invalidHttpClient);
        }).to.throw().with.property('code', 'invalid-argument');
      });
    });

    it('should not throw when initialized with valid parameters', () => {
      expect(() => {
        return new GCIPRequestHandler(apiKey, httpClient);
      }).to.not.throw();
    });
  });

  describe('checkAuthorizedDomainsAndGetProjectId()', () => {
    const url = 'https://www.example.com/path/api?a=1&n=2#hash';
    const requestHandler = new GCIPRequestHandler(apiKey, httpClient);
    const expectedConfigRequest = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': clientVersion,
      },
      url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
      timeout: 30000,
    };
    const projectId = 'PROJECT_ID';
    const jsonResponse = {
      projectId,
      authorizedDomains: ['example.com', 'authorized.com'],
    };
    const expectedResp = createMockHttpResponse({'Content-Type': 'application/json'}, jsonResponse);

    it('should resolve with project ID when the single URL array has a matching authorized domain', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then((actualProjectId: string) => {
          expect(actualProjectId).to.equal(projectId);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should resolve with project ID when entire URL array has matching authorized domains', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId(['https://example.com', 'https://authorized.com'])
        .then((actualProjectId: string) => {
          expect(actualProjectId).to.equal(projectId);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should use long timeout for mobile browsers', () => {
      // Mobile browsers should use long timeout.
      stubs.push(sinon.stub(browser, 'isMobileBrowser').returns(true));
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      const mobileConfigRequest = deepCopy(expectedConfigRequest);
      mobileConfigRequest.timeout = 60000;

      const mobileRequestHandler = new GCIPRequestHandler(apiKey, httpClient);
      return mobileRequestHandler
        .checkAuthorizedDomainsAndGetProjectId(['https://example.com', 'https://authorized.com'])
        .then((actualProjectId: string) => {
          expect(actualProjectId).to.equal(projectId);
          expect(stub).to.have.been.calledOnce.and.calledWith(mobileConfigRequest);
        });
    });

    it('should reject when the single URL array has an unauthorized domain', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId(['https://mismatch.com'])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Unauthorized domain');
          expect(error).to.have.property('code', 'permission-denied');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject when the URL array contains at least one unauthorized domain', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId(['https://example.com', 'https://mismatch.com'])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Unauthorized domain');
          expect(error).to.have.property('code', 'permission-denied');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId(['https://example.com', 'invalid'])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(stub).to.not.have.been.called;
        });
    });

    it('should reject on invalid underlying API response', () => {
      // Create response with empty content.
      const invalidResponse = createMockHttpResponse({'Content-Type': 'application/json'}, {});
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on underlying API error', () => {
      // Simulate RPC rejects with a server side error.
      const expectedError = new Error('server side error');
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError without custom message to expected HttpCIAPError error', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'TOO_MANY_ATTEMPTS_TRY_LATER',
          errors: [
            {
              message: 'TOO_MANY_ATTEMPTS_TRY_LATER',
              domain: 'global',
              reason: 'invalid',
            },
          ],
        },
      };
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 400',
          400,
          {data: jsonError});
      // Expected translated error to be thrown.
      const expectedError = new HttpCIAPError(
          400, 'TOO_MANY_ATTEMPTS_TRY_LATER', undefined, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError with custom message to expected HttpCIAPError error', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'TOO_MANY_ATTEMPTS_TRY_LATER : custom error message',
          errors: [
            {
              message: 'TOO_MANY_ATTEMPTS_TRY_LATER : custom error message',
              domain: 'global',
              reason: 'invalid',
            },
          ],
        },
      };
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 400',
          400,
          {data: jsonError});
      // Expected translated error to be thrown with custom message populated.
      const expectedError = new HttpCIAPError(
          400, 'TOO_MANY_ATTEMPTS_TRY_LATER', 'custom error message', serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);
      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError with status field to expected HttpCIAPError error', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          errors: [
            {
              message: 'API key not valid. Please pass a valid API key.',
              domain: 'global',
              reason: 'badRequest',
            },
          ],
          status: 'INVALID_ARGUMENT',
        },
      };
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 400',
          400,
          {data: jsonError});
      // Expected translated error to be thrown with INVALID_ARGUMENT status and response.error.message
      // populated as error message.
      const expectedError = new HttpCIAPError(
          400, 'INVALID_ARGUMENT', jsonError.error.message, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);
      return requestHandler.checkAuthorizedDomainsAndGetProjectId([url])
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });
});
