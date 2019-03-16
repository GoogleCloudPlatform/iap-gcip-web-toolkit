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

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  HttpClient, HttpResponse, HttpRequestConfig,
} from '../../../src/utils/http-client';
import {ApiRequester} from '../../../src/utils/api-requester';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('ApiRequester', () => {
  const stubs: sinon.SinonStub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  describe('process()', () => {
    const httpClient = new HttpClient();
    const baseConfig: HttpRequestConfig = {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'other-header': 'original-header-value',
      },
      url: 'https://www.example.com/{version}/path/api?a={field1}&b={field2}',
      timeout: 30000,
      data: {
        'fixed': 'fixed_value',
        'other-data': 'original-data-value',
      },
    };
    const urlParams = {version: 'v1', field1: 'value1', field2: 'value2'};
    const headers = {'other-header': 'header-override', 'new-header': 'new-header-value'};
    const data = {'other-data': 'data-override', 'd1': 'value1', 'd2': 'value2'};

    const jsonResponse = {a: '1', b: '2'};
    const expectedResp: HttpResponse = {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      text: JSON.stringify(jsonResponse),
      data: jsonResponse,
      request: {},
      isJson: () => true,
    };
    // This contains the base config, overridden fields and new additional fields for
    // headers and data. It also includes substituted URL parameters.
    const expectedConfigRequest = {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'other-header': 'header-override',
        'new-header': 'new-header-value',
      },
      url: 'https://www.example.com/v1/path/api?a=value1&b=value2',
      timeout: 30000,
      data: {
        'fixed': 'fixed_value',
        'other-data': 'data-override',
        'd1': 'value1',
        'd2': 'value2',
      },
    };
    const expectedError = new Error('something went wrong');

    it('should make successful http client request with expected configuration', () => {
      const apiHandler = new ApiRequester(baseConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
      });
    });

    it('should not modify base config if no additional data, headers or URL parameters are passed', () => {
      const unmodifiedBaseConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'other-header': 'original-header-value',
        },
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: 30000,
        data: {
          'fixed': 'fixed_value',
          'other-data': 'original-data-value',
        },
      };
      const apiHandler = new ApiRequester(unmodifiedBaseConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(unmodifiedBaseConfig);
      });
    });

    it('should set data and headers if not provided in base configuration', () => {
      const noDataOrHeadersConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: 30000,
      };
      const expectedModifiedConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: 30000,
        // data and headers populated from process parameters.
        data: expectedConfigRequest.data,
        headers: expectedConfigRequest.headers,
      };
      const apiHandler = new ApiRequester(noDataOrHeadersConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(
          httpClient, null, expectedConfigRequest.data, expectedConfigRequest.headers,
      ).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedModifiedConfig);
      });
    });

    it('should overwrite base config data when data is not an object', () => {
      const toBeOverwrittenDataConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: 30000,
        data: 'overwrite me',
      };
      const expectedModifiedConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: 30000,
        // data and headers populated from process parameters.
        data: 'input data',
      };
      const apiHandler = new ApiRequester(toBeOverwrittenDataConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, null, 'input data').then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedModifiedConfig);
      });
    });

    it('should overwrite base config timeout when it is specified in process()', () => {
      const customTimeout = 40000;
      const toBeOverwrittenDataConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        // Overwritten with value specified in process() call.
        timeout: 30000,
        data: 'input data',
      };
      const expectedModifiedConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        url: 'https://www.example.com/v1/api?key=HARDCODED_KEY',
        timeout: customTimeout,
        data: 'input data',
      };
      const apiHandler = new ApiRequester(toBeOverwrittenDataConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, null, null, null, customTimeout).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedModifiedConfig);
      });
    });

    it('should reject when http client request returns an error', () => {
      const apiHandler = new ApiRequester(baseConfig);
      const stub = sinon.stub(HttpClient.prototype, 'send').rejects(expectedError);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers)
        .then(() => {
          throw new Error('unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should run successful request validator before sending request', () => {
      const requestValidator = sinon.stub();
      const apiHandler = new ApiRequester(baseConfig).setRequestValidator(requestValidator);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        // Confirm request validator called once with expected params before sending request.
        expect(requestValidator).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        expect(requestValidator).to.have.been.calledBefore(stub);
      });
    });

    it('should rethrow errors thrown by request validator', () => {
      const requestValidator = sinon.stub().throws(expectedError);
      const apiHandler = new ApiRequester(baseConfig).setRequestValidator(requestValidator);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers)
        .then(() => {
          throw new Error('unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.not.have.been.called;
          // Confirm request validator called once with expected params before sending request.
          expect(requestValidator).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        });
    });

    it('should run successful response validator before returning response', () => {
      const responseValidator = sinon.stub();
      const apiHandler = new ApiRequester(baseConfig).setResponseValidator(responseValidator);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        // Confirm response validator called once with expected params after sending request.
        expect(responseValidator).to.have.been.calledOnce.and.calledWith(expectedResp);
        expect(responseValidator).to.have.been.calledAfter(stub);
      });
    });

    it('should rethrow errors thrown by response validator', () => {
      const responseValidator = sinon.stub().throws(expectedError);
      const apiHandler = new ApiRequester(baseConfig).setResponseValidator(responseValidator);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers)
        .then(() => {
          throw new Error('unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          // Confirm response validator called once with expected params after sending request.
          expect(responseValidator).to.have.been.calledOnce.and.calledWith(expectedResp);
          expect(responseValidator).to.have.been.calledAfter(stub);
        });
    });

    it('should apply request and response validator and handle successful http request', () => {
      const responseValidator = sinon.stub();
      const requestValidator = sinon.stub();
      const apiHandler = new ApiRequester(baseConfig)
        .setRequestValidator(requestValidator)
        .setResponseValidator(responseValidator);
      const stub = sinon.stub(HttpClient.prototype, 'send').resolves(expectedResp);
      stubs.push(stub);

      return apiHandler.process(httpClient, urlParams, data, headers).then((resp) => {
        expect(resp).to.equal(expectedResp);
        expect(stub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        // Confirm response validator called once with expected params after sending request.
        expect(responseValidator).to.have.been.calledOnce.and.calledWith(expectedResp);
        expect(responseValidator).to.have.been.calledAfter(stub);
        // Confirm request validator called once with expected params before sending request.
        expect(requestValidator).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
        expect(requestValidator).to.have.been.calledBefore(stub);
      });
    });
  });
});
