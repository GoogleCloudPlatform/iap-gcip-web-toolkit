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
  HttpClient, HttpResponse, HttpRequestConfig,
} from '../../../src/utils/http-client';
import {CICPRequestHandler} from '../../../src/ciap/cicp-request';
import {deepCopy} from '../../../src/utils/deep-copy';
import { isNonNullObject } from '../../../src/utils/validator';

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

describe('CICPRequestHandler', () => {
  const httpClient = new HttpClient();
  const apiKey = 'API_KEY';
  const stubs: sinon.SinonStub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  describe('Constructor', () => {
    const invalidKeys = [null, NaN, 0, 1, true, false, '', [], [1, 'a'], {}, { a: 1 }, _.noop, undefined];
    invalidKeys.forEach((invalidKey) => {
      it('should throw given invalid API key: ' + JSON.stringify(invalidKey), () => {
        expect(() => {
          return new (CICPRequestHandler as any)(invalidKey);
        }).to.throw();
      });
    });

    const invalidHttpClients = [
      null, NaN, 0, 1, true, false, '', 'a', [], [1, 'a'], {}, { a: 1 }, _.noop, undefined,
    ];
    invalidHttpClients.forEach((invalidHttpClient) => {
      it('should throw given invalid http client: ' + JSON.stringify(invalidHttpClient), () => {
        expect(() => {
          return new (CICPRequestHandler as any)(apiKey, invalidHttpClient);
        }).to.throw();
      });
    });

    it('should not throw when initialized with valid parameters', () => {
      expect(() => {
        return new CICPRequestHandler(apiKey, httpClient);
      }).to.not.throw();
    });
  });

  describe('isAuthorizedDomain()', () => {
    const url = 'https://www.example.com/path/api?a=1&n=2#hash';
    const requestHandler = new CICPRequestHandler(apiKey, httpClient);
    const expectedConfigRequest = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': 'Browser/CIAP/<XXX_SDK_VERSION_XXX>',
      },
      url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
      timeout: 30000,
    };
    const jsonResponse = {
      authorizedDomains: ['example.com'],
    };
    const expectedResp = createMockHttpResponse({'Content-Type': 'application/json'}, jsonResponse);

    it('should resolve with true on authorized domain match', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.isAuthorizedDomain(url)
        .then((status: boolean) => {
          expect(status).to.be.true;
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should resolve with false on authorized domain mismatch', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.isAuthorizedDomain('https://mismatch.com')
        .then((status: boolean) => {
          expect(status).to.be.false;
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.isAuthorizedDomain('invalid')
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid URL');
          expect(stub).to.not.have.been.called;
        });
    });

    it('should reject on invalid underlying API response', () => {
      // Create response with empty content.
      const invalidResponse = createMockHttpResponse({'Content-Type': 'application/json'}, {});
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.isAuthorizedDomain(url)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on underlying API error', () => {
      // Simulate RPC rejects with a server side error.
      const expectedError = new Error('server side error');
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);
      return requestHandler.isAuthorizedDomain(url)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });
});
