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
import {IAPRequestHandler, RedirectServerResponse} from '../../../src/ciap/iap-request';
import * as validator from '../../../src/utils/validator';
import * as utils from '../../../src/utils/index';

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
  if (validator.isNonNullObject(response)) {
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
    isJson: () => validator.isNonNullObject(response),
  };
}

describe('IAPRequestHandler', () => {
  const idToken = 'ID_TOKEN';
  const tenantId = 'TENANT_ID';
  const state = 'STATE';
  const iapRedirectServerUrl = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tenantId}:handleRedirect`;
  const targetUri = 'https://www.example.com/path/main/_gcp_iap/cicp_auth';
  const originalUri = 'https://www.example.com/path/main';
  const redirectToken = 'REDIRECT_TOKEN';
  const httpClient = new HttpClient();
  const apiKey = 'API_KEY';
  const stubs: sinon.SinonStub[] = [];
  let isHttpsUrlSpy: sinon.SinonSpy;

  beforeEach(() => {
    isHttpsUrlSpy = sinon.spy(validator, 'isHttpsURL');
  });

  afterEach(() => {
    isHttpsUrlSpy.restore();
    stubs.forEach((s) => s.restore());
  });

  describe('Constructor', () => {
    const invalidHttpClients = [
      null, NaN, 0, 1, true, false, '', 'a', [], [1, 'a'], {}, { a: 1 }, _.noop, undefined,
    ];
    invalidHttpClients.forEach((invalidHttpClient) => {
      it('should throw given invalid http client: ' + JSON.stringify(invalidHttpClient), () => {
        expect(() => {
          return new (IAPRequestHandler as any)(apiKey, invalidHttpClient);
        }).to.throw();
      });
    });

    it('should not throw when initialized with valid parameters', () => {
      expect(() => {
        return new IAPRequestHandler(httpClient);
      }).to.not.throw();
    });
  });

  describe('exchangeIdTokenAndGetOriginalAndTargetUrl()', () => {
    const requestHandler = new IAPRequestHandler(httpClient);
    const expectedConfigRequest: HttpRequestConfig = {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      },
      url: iapRedirectServerUrl,
      timeout: 30000,
      data: {
        id_token: idToken,
        state,
        id_token_tenant_id: tenantId,
      },
    };
    const jsonResponse = {
      redirectToken,
      originalUri,
      targetUri,
    };
    const expectedResp = createMockHttpResponse({'Content-Type': 'application/json'}, jsonResponse);

    it('should resolve with expected response on success', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, tenantId, state)
        .then((response: RedirectServerResponse) => {
          expect(response).to.deep.equal(jsonResponse);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const invalidUrl = 'invalid';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(invalidUrl, idToken, tenantId, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(stub).to.not.have.been.called;
        });
    });

    const invalidNonEmptyStrings = [null, NaN, 0, 1, true, false, [], '', ['a'], {}, { a: 1 }, _.noop];
    invalidNonEmptyStrings.forEach((invalidNonEmptyString) => {
      it('should reject on invalid idToken: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(
            iapRedirectServerUrl,
            invalidNonEmptyString as any,
            tenantId,
            state).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });

      it('should reject on invalid tenantId: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(
            iapRedirectServerUrl,
            idToken,
            invalidNonEmptyString as any,
            state).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });

      it('should reject on invalid state: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(
            iapRedirectServerUrl,
            idToken,
            tenantId,
            invalidNonEmptyString as any).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });
    });

    it('should reject on invalid underlying API response', () => {
      // Create response with empty content, missing required response parameters.
      const invalidResponse = createMockHttpResponse({'Content-Type': 'application/json'}, {});
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, tenantId, state)
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
      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, tenantId, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });

  describe('setCookieAtTargetUrl()', () => {
    const requestHandler = new IAPRequestHandler(httpClient);
    const expectedConfigRequest: HttpRequestConfig = {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'x-iap-3p-token': redirectToken,
      },
      url: targetUri,
      timeout: 30000,
    };
    const jsonResponse = {};
    const expectedResp = createMockHttpResponse({'Content-Type': 'application/json'}, jsonResponse);

    it('should resolve on success', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.setCookieAtTargetUrl(targetUri, redirectToken)
        .then((response: any) => {
          expect(response).to.be.undefined;
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const invalidUrl = 'invalid';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.setCookieAtTargetUrl(invalidUrl, redirectToken)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(stub).to.not.have.been.called;
        });
    });

    const invalidNonEmptyStrings = [null, NaN, 0, 1, true, false, [], '', ['a'], {}, { a: 1 }, _.noop];
    invalidNonEmptyStrings.forEach((invalidNonEmptyString) => {
      it('should reject on invalid redirectToken: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.setCookieAtTargetUrl(
            targetUri,
            invalidNonEmptyString as any).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });
    });

    it('should reject on underlying API error', () => {
      // Simulate RPC rejects with a server side error.
      const expectedError = new Error('server side error');
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);
      return requestHandler.setCookieAtTargetUrl(targetUri, redirectToken)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });

  describe('signOutWithRedirect()', () => {
    const requestHandler = new IAPRequestHandler(httpClient);
    const expectedData = {
      id_token_tenant_id: tenantId,
      state,
    };

    it('should resolve on success', () => {
      const stub = sinon.stub(utils, 'formSubmitWithRedirect');
      stubs.push(stub);

      return requestHandler.signOutWithRedirect(iapRedirectServerUrl, tenantId, state)
        .then((response: any) => {
          expect(response).to.be.undefined;
          expect(stub).to.have.been.calledOnce.and
            .calledWith(document, iapRedirectServerUrl, 'POST', expectedData);
        });
    });

    it('should reject on invalid URL', () => {
      const invalidUrl = 'invalid';
      const stub = sinon.stub(utils, 'formSubmitWithRedirect');
      stubs.push(stub);

      return requestHandler.signOutWithRedirect(invalidUrl, tenantId, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(stub).to.not.have.been.called;
        });
    });

    const invalidNonEmptyStrings = [null, NaN, 0, 1, true, false, [], '', ['a'], {}, { a: 1 }, _.noop];
    invalidNonEmptyStrings.forEach((invalidNonEmptyString) => {
      it('should reject on invalid tenantId: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(utils, 'formSubmitWithRedirect');
        stubs.push(stub);

        return requestHandler.signOutWithRedirect(
            iapRedirectServerUrl,
            invalidNonEmptyString as any,
            state).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });

      it('should reject on invalid state: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(utils, 'formSubmitWithRedirect');
        stubs.push(stub);

        return requestHandler.signOutWithRedirect(
            iapRedirectServerUrl,
            tenantId,
            invalidNonEmptyString as any).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(stub).to.not.have.been.called;
            });
      });
    });

    it('should reject on underlying form submit error', () => {
      const expectedError = new Error('server side error');
      const stub = sinon.stub(utils, 'formSubmitWithRedirect').throws(expectedError);
      stubs.push(stub);
      return requestHandler.signOutWithRedirect(iapRedirectServerUrl, tenantId, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and
            .calledWith(document, iapRedirectServerUrl, 'POST', expectedData);
        });
    });
  });
});
