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

import * as nock from 'nock';
import * as sinon from 'sinon';
import {HttpServerRequestHandler} from '../../../../server/utils/http-server-request-handler';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('HttpServerRequest', () => {
  let mockedRequests: nock.Scope[] = [];
  let logger: sinon.SinonStub;
  const httpServerRequestHandler = new HttpServerRequestHandler({
    method: 'GET',
    url: 'http://www.example.com:5000/path/to/api',
    headers: {
      'Metadata-Flavor': 'Google',
    },
    timeout: 10000,
  });
  const expectedResponse = {
    foo: 'bar',
    success: true,
  };

  beforeEach(() => {
    logger = sinon.stub();
  });

  afterEach(() => {
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('send()', () => {
    it('will pass the expected parameters for a GET request with no parameters', () => {
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/path/to/api')
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return httpServerRequestHandler.send()
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will pass the expected parameters for a GET request with parameters', () => {
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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
      return httpServerRequestHandler.send(requestParams)
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will substitute urlParams for a GET request with parameters', () => {
      const urlParams = {
        projectId: 'PROJECT_ID',
        api: 'process',
        query: 'QUERY_VAL',
      };
      const requestHandler = new HttpServerRequestHandler({
        method: 'GET',
        url: 'http://www.example.com:5000/{projectId}/{api}?query={query}',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'Metadata-Flavor': 'Google',
        },
      }).get('/PROJECT_ID/process?query=QUERY_VAL&a=1&b=2&c=false')
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        urlParams,
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

    it('will reject when given invalid GET parameters', () => {
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: 'invalid',
      };

      // Send parameters with request.
      return expect(httpServerRequestHandler.send(requestParams as any))
        .to.be.rejectedWith('Invalid GET request data');
    });

    it('will pass the expected parameters for a POST request with no parameters', () => {
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      });
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

    it('will log expected data for a POST request with no parameters', () => {
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      }, logger);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).post('/path/to/api', undefined)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return postHandler.send()
        .then((response) => {
          expect(logger).to.have.been.calledTwice;
          expect(logger.firstCall).to.be.calledWith(
            'POST to http://www.example.com:5000/path/to/api');
          expect(logger.secondCall).to.be.calledWith('200 response');
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will pass the expected parameters for a POST request with parameters', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      });
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

    it('will log expected data for a POST request with parameters', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      }, logger);
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

    it('will substitute urlParams for a POST request with parameters', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const urlParams = {
        projectId: 'PROJECT_ID',
        api: 'process',
        query: 'QUERY_VAL',
      };
      const requestHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/{projectId}/{api}?query={query}',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10000,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'Metadata-Flavor': 'Google',
        },
      }).post('/PROJECT_ID/process?query=QUERY_VAL', data)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        urlParams,
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      // Send parameters with request.
      return requestHandler.send(requestParams)
        .then((response) => {
          expect(response.statusCode).to.be.equal(200);
          expect(response.body).to.deep.equal(expectedResponse);
        });
    });

    it('will reject with parsed error for non-200 status code', () => {
      const expectedError = {
        error: {
          code: 500,
          message: 'Internal server error',
        },
      };
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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
          expect(error.rawResponse).to.deep.equal(expectedError);
          expect(error.statusCode).to.equal(500);
          expect(error.cloudCompliant).to.be.true;
        });
    });

    it('will log parsed error for non-200 status code', () => {
      const expectedError = {
        error: {
          code: 500,
          message: 'Internal server error',
        },
      };
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, logger);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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
        .then(() => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(logger).to.have.been.calledThrice;
          expect(logger.firstCall).to.be.calledWith(
            'POST to http://www.example.com:5000/path/to/api');
          expect(logger.secondCall).to.be.calledWith(
            'Request body:', requestParams.body);
          expect(logger.thirdCall).to.be.calledWith(
            '500 Response:', expectedError);
          expect(error.message).to.deep.equal(expectedError.error.message);
          expect(error.rawResponse).to.deep.equal(expectedError);
          expect(error.statusCode).to.equal(500);
          expect(error.cloudCompliant).to.be.true;
        });
    });

    it('will reject with default error message for unexpected non-200 status code', () => {
      const defaultMessage = 'Unexpected error';
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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
          expect(error.rawResponse).to.deep.equal({error: 'unexpected'});
          expect(error.statusCode).to.equal(500);
          expect(error.cloudCompliant).to.be.false;
        });
    });

    it('will reject with response body error message string for non-200 status code', () => {
      const responseBodyErrorString = 'Resource not found';
      const defaultMessage = 'Unexpected error';
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        .delay(10)
        .reply(404, responseBodyErrorString);
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
          expect(error.message).to.deep.equal(responseBodyErrorString);
          expect(error.rawResponse).to.deep.equal(responseBodyErrorString);
          expect(error.statusCode).to.equal(404);
          expect(error.cloudCompliant).to.be.false;
        });
    });

    it('will reject when request delay exceeds expected timeout', () => {
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      }, logger);
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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

      return postHandler.send(requestParams)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(logger).to.have.been.calledThrice;
          expect(logger.firstCall).to.be.calledWith(
            'POST to http://www.example.com:5000/path/to/api');
          expect(logger.secondCall).to.be.calledWith(
            'Request body:', requestParams.body);
          expect(logger.thirdCall).to.be.calledWith(
            'Error encountered:', error);
          expect(error.message).to.be.equal('ESOCKETTIMEDOUT');
        });
    });

    it('will resolve when request delay does not exceed expected timeout', () => {
      const timeoutDelay = 10;
      const data = {
        a: 1,
        b: 2,
        c: false,
      };
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: timeoutDelay,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
          other: 'some-header-value',
          'more-headers': 'another-value',
          'metadata-flavor': 'Google',
        },
      }).post('/path/to/api', data)
        // Set exact timeout duration.
        .delay(timeoutDelay)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);
      const requestParams = {
        headers: {
          other: 'some-header-value',
          'more-headers': 'another-value',
        },
        body: data,
      };

      return expect(postHandler.send(requestParams)).to.be.fulfilled;
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
      const postHandler = new HttpServerRequestHandler({
        method: 'POST',
        url: 'http://www.example.com:5000/path/to/api',
        headers: {
          'Metadata-Flavor': 'Google',
        },
        timeout: 10,
      });
      const scope = nock('http://www.example.com:5000', {
        reqheaders: {
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
