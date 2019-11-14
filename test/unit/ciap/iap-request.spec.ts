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
import {
  IAPRequestHandler, RedirectServerResponse, SessionInfoResponse,
} from '../../../src/ciap/iap-request';
import * as validator from '../../../src/utils/validator';
import { createMockLowLevelError } from '../../resources/utils';
import { HttpCIAPError } from '../../../src/utils/error';
import * as browser from '../../../src/utils/browser';
import { deepCopy } from '../../../src/utils/deep-copy';
import * as utils from '../../../src/utils/index';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

/**
 * Generates a mock 200 HttpResponse with corresponding headers and data.
 *
 * @param headers The headers to include in the mock HttpResponse.
 * @param response The optional raw HTTP body response.
 * @return The corresponding mock HttpResponse.
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
  const iapRedirectServerUrl = `https://iap.googleapis.com/v1alpha1/gcip/tenantIds/${tenantId}:handleRedirect`;
  const targetUri = 'https://www.example.com/path/main/_gcp_iap/gcip_authenticate';
  const originalUri = 'https://www.example.com/path/main';
  const redirectToken = 'REDIRECT_TOKEN';
  const tenantIds = ['TENANT_ID1', 'TENANT_ID2'];
  const httpClient = new HttpClient();
  const apiKey = 'API_KEY';
  const stubs: sinon.SinonStub[] = [];
  let isLocalhostOrHttpsUrlSpy: sinon.SinonSpy;
  let isSafeUrlSpy: sinon.SinonSpy;

  beforeEach(() => {
    isLocalhostOrHttpsUrlSpy = sinon.spy(validator, 'isLocalhostOrHttpsURL');
    isSafeUrlSpy = sinon.spy(utils, 'isSafeUrl');
  });

  afterEach(() => {
    isLocalhostOrHttpsUrlSpy.restore();
    isSafeUrlSpy.restore();
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
        }).to.throw().to.have.property('code', 'invalid-argument');
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

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then((response: RedirectServerResponse) => {
          expect(response).to.deep.equal(jsonResponse);
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

      const mobileRequestHandler = new IAPRequestHandler(httpClient);
      return mobileRequestHandler
        .exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then((response: RedirectServerResponse) => {
          expect(response).to.deep.equal(jsonResponse);
          expect(stub).to.have.been.calledOnce.and.calledWith(mobileConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const invalidUrl = 'invalid';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(invalidUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isLocalhostOrHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(stub).to.not.have.been.called;
        });
    });

    it('should reject on unsafe URL', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(unsafeUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isSafeUrlSpy).to.have.been.calledOnce
            .and.calledWith(unsafeUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
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
            state).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(error).to.have.property('code', 'invalid-argument');
              expect(stub).to.not.have.been.called;
            });
      });

      it('should reject on invalid state: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(
            iapRedirectServerUrl,
            idToken,
            invalidNonEmptyString as any).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(error).to.have.property('code', 'invalid-argument');
              expect(stub).to.not.have.been.called;
            });
      });
    });

    it('should reject on invalid underlying API response', () => {
      // Create response with empty content, missing required response parameters.
      const invalidResponse = createMockHttpResponse({'Content-Type': 'application/json'}, {});
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on unsafe originalUri response', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const invalidResponse = createMockHttpResponse(
        {'Content-Type': 'application/json'},
        {
          redirectToken,
          originalUri: unsafeUrl,
          targetUri,
        });
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(isSafeUrlSpy).to.have.been.calledWith(unsafeUrl).and.returned(false);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on unsafe targetUri response', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const invalidResponse = createMockHttpResponse(
        {'Content-Type': 'application/json'},
        {
          redirectToken,
          targetUri: unsafeUrl,
          originalUri,
        });
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(isSafeUrlSpy).to.have.been.calledWith(unsafeUrl).and.returned(false);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on underlying API error', () => {
      // Simulate RPC rejects with a server side error.
      const expectedError = new Error('server side error');
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);
      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError to expected HttpCIAPError error', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'Request contains an invalid argument.',
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.DebugInfo',
              'detail': '[ORIGINAL ERROR] generic::invalid_argument: state_jwt cannot be empty',
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
          400, 'INVALID_ARGUMENT', jsonError.error.details[0].detail, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should override with GCIP error if it requires restart process', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'An issue was encountered when authenticating your request. ' +
              'Please visit the URL that redirected you to this page again to ' +
              'restart the authentication process.',
          status: 'FAILED_PRECONDITION',
        },
      };
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 400',
          400,
          {data: jsonError});
      // Expected translated error to be thrown.
      const expectedError = new HttpCIAPError(
          400, 'RESTART_PROCESS', jsonError.error.message, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.exchangeIdTokenAndGetOriginalAndTargetUrl(iapRedirectServerUrl, idToken, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });

  describe('setCookieAtTargetUrl()', () => {
    const requestHandler = new IAPRequestHandler(httpClient);
    const expectedConfigRequest: HttpRequestConfig = {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
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

    it('should use long timeout for mobile browsers', () => {
      // Mobile browsers should use long timeout.
      stubs.push(sinon.stub(browser, 'isMobileBrowser').returns(true));
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      const mobileConfigRequest = deepCopy(expectedConfigRequest);
      mobileConfigRequest.timeout = 60000;

      const mobileRequestHandler = new IAPRequestHandler(httpClient);
      return mobileRequestHandler
        .setCookieAtTargetUrl(targetUri, redirectToken)
        .then((response: any) => {
          expect(response).to.be.undefined;
          expect(stub).to.have.been.calledOnce.and.calledWith(mobileConfigRequest);
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
          expect(isLocalhostOrHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(stub).to.not.have.been.called;
        });
    });

    it('should reject on unsafe URL', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.setCookieAtTargetUrl(unsafeUrl, redirectToken)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isSafeUrlSpy).to.have.been.calledOnce
            .and.calledWith(unsafeUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
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
              expect(error).to.have.property('code', 'invalid-argument');
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

    it('should translate underlying LowLevelError to expected HttpCIAPError error', () => {
      const serverMessage = 'An internal server error occurred while authorizing your request. Error 37 code.';
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 403',
          403,
          {data: serverMessage});
      // Expected translated error to be thrown.
      const expectedError = new HttpCIAPError(
          403, 'GCIP_TOKEN_INVALID', serverMessage, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.setCookieAtTargetUrl(targetUri, redirectToken)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError with unknown error code to expected HttpCIAPError error', () => {
      // Simulate unknown error code.
      const serverMessage = 'An internal server error occurred while authorizing your request. Error 101 code.';
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 403',
          403,
          {data: serverMessage});
      // Expected translated error to be thrown with default status code used since the code was not found in
      // our mapping.
      const expectedError = new HttpCIAPError(
          403, 'PERMISSION_DENIED', serverMessage, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.setCookieAtTargetUrl(targetUri, redirectToken)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });
  });

  describe('getSessionInfo()', () => {
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
        state,
      },
    };
    const jsonResponse = {
      originalUri,
      tenantIds,
      targetUri,
    };
    const expectedResp = createMockHttpResponse({'Content-Type': 'application/json'}, jsonResponse);

    it('should resolve with expected response on success', () => {
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
        .then((response: SessionInfoResponse) => {
          expect(response).to.deep.equal(jsonResponse);
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

      const mobileRequestHandler = new IAPRequestHandler(httpClient);
      return mobileRequestHandler
        .getSessionInfo(iapRedirectServerUrl, state)
        .then((response: SessionInfoResponse) => {
          expect(response).to.deep.equal(jsonResponse);
          expect(stub).to.have.been.calledOnce.and.calledWith(mobileConfigRequest);
        });
    });

    it('should reject on invalid URL', () => {
      const invalidUrl = 'invalid';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.getSessionInfo(invalidUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isLocalhostOrHttpsUrlSpy).to.have.been.calledOnce
            .and.calledWith(invalidUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(stub).to.not.have.been.called;
        });
    });

    it('should reject on unsafe URL', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return requestHandler.getSessionInfo(unsafeUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(isSafeUrlSpy).to.have.been.calledOnce
            .and.calledWith(unsafeUrl)
            .and.returned(false);
          expect(error).to.have.property('message', 'Invalid URL');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(stub).to.not.have.been.called;
        });
    });

    const invalidNonEmptyStrings = [null, NaN, 0, 1, true, false, [], '', ['a'], {}, { a: 1 }, _.noop];
    invalidNonEmptyStrings.forEach((invalidNonEmptyString) => {
      it('should reject on invalid state: ' + JSON.stringify(invalidNonEmptyString), () => {
        const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
        stubs.push(stub);

        return requestHandler.getSessionInfo(
            iapRedirectServerUrl,
            invalidNonEmptyString as any).then(() => {
              throw new Error('Unexpected success');
            })
            .catch((error) => {
              expect(error).to.have.property('message', 'Invalid request');
              expect(error).to.have.property('code', 'invalid-argument');
              expect(stub).to.not.have.been.called;
            });
      });
    });

    it('should reject on invalid underlying API response', () => {
      // Create response with empty content, missing required response parameters.
      const invalidResponse = createMockHttpResponse({'Content-Type': 'application/json'}, {});
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on unsafe originalUri response', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const invalidResponse = createMockHttpResponse(
        {'Content-Type': 'application/json'},
        {
          originalUri: unsafeUrl,
          tenantIds,
        });
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(invalidResponse);
      stubs.push(stub);

      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Invalid response');
          expect(error).to.have.property('code', 'unknown');
          expect(isSafeUrlSpy).to.have.been.calledWith(unsafeUrl).and.returned(false);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should reject on underlying API error', () => {
      // Simulate RPC rejects with a server side error.
      const expectedError = new Error('server side error');
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);
      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should translate underlying LowLevelError to expected HttpCIAPError error', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'Request contains an invalid argument.',
          status: 'INVALID_ARGUMENT',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.DebugInfo',
              'detail': '[ORIGINAL ERROR] generic::invalid_argument: state_jwt cannot be empty',
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
          400, 'INVALID_ARGUMENT', jsonError.error.details[0].detail, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.toJSON()).to.deep.equal(expectedError.toJSON());
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should override with GCIP error if it requires restart process', () => {
      const jsonError = {
        error: {
          code: 400,
          message: 'An issue was encountered when authenticating your request. ' +
              'Please visit the URL that redirected you to this page again to ' +
              'restart the authentication process.',
          status: 'FAILED_PRECONDITION',
        },
      };
      // Simulate RPC rejects with LowLevelError.
      const serverLowLevelError = createMockLowLevelError(
          'Server responded with status 400',
          400,
          {data: jsonError});
      // Expected translated error to be thrown.
      const expectedError = new HttpCIAPError(
          400, 'RESTART_PROCESS', jsonError.error.message, serverLowLevelError);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(serverLowLevelError);
      stubs.push(stub);

      return requestHandler.getSessionInfo(iapRedirectServerUrl, state)
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
