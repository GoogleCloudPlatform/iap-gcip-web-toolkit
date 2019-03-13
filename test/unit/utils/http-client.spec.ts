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
  HttpClient, HttpRequestConfig,
} from '../../../src/utils/http-client';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

const mockUrl = 'https://www.example.com/foo/bar';

describe('HttpClient', () => {
  const now = new Date();
  let clock: sinon.SinonFakeTimers;
  const stubs: sinon.SinonStub[] = [];
  const client = new HttpClient();

  beforeEach(() => {
    clock = sinon.useFakeTimers(now.getTime());
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  describe('send', () => {
    it('should be fulfilled for a 2xx response with a json payload', () => {
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'GET',
        mode: 'no-cors',
        cache: 'default',
        credentials: 'same-origin',
        url: mockUrl,
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl,
            {
              method: 'GET',
              mode: 'no-cors',
              cache: 'default',
              credentials: 'same-origin',
            });
      });
    });

    it('should be fulfilled for a 2xx response with a text payload', () => {
      const respData = 'foo bar';
      const expectedResp = new Response(
        respData,
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'text/plain'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('text/plain');
        expect(resp.text).to.equal(respData);
        expect(resp.data).to.equal(respData);
        expect(resp.isJson()).to.be.false;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl,
            {
              method: 'GET',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
            });
      });
    });

    it('should make a POST request with the provided JSON headers and data', () => {
      const reqData = {request: 'data'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        cache: 'no-cache',
        url: mockUrl,
        data: reqData,
        headers: {
          'Content-Type': 'application/json',
          'My-Custom-Header': 'CustomValue',
        },
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl,
            {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
              body: JSON.stringify(reqData),
              headers: {
                'Content-Type': 'application/json',
                'My-Custom-Header': 'CustomValue',
              },
            });
      });
    });

    it('should make a POST request with the provided form url-encoded headers and data', () => {
      const reqData = {key1: 'value1', key2: 'value2'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
        data: reqData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'My-Custom-Header': 'CustomValue',
        },
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl,
            {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
              body: 'key1=value1&key2=value2',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'My-Custom-Header': 'CustomValue',
              },
            });
      });
    });

    it('should make a GET request with the provided headers and data', () => {
      const reqData = {key1: 'value1', key2: 'value2'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
        data: reqData,
        headers: {
          'Content-Type': 'application/json',
          'My-Custom-Header': 'CustomValue',
        },
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl + '?key1=value1&key2=value2',
            {
              method: 'GET',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'My-Custom-Header': 'CustomValue',
              },
            });
      });
    });

    it('should fail with a GET request containing non-object data', () => {
      const err = 'GET requests cannot have a body.';
      return client.send({
        method: 'GET',
        url: mockUrl,
        timeout: 50,
        data: 'non-object-data',
      }).should.eventually.be.rejectedWith(err);
    });

    it('should make a HEAD request with the provided headers and data', () => {
      const reqData = {key1: 'value1', key2: 'value2'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);

      return client.send({
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
        data: reqData,
        headers: {
          'Content-Type': 'application/json',
          'My-Custom-Header': 'CustomValue',
        },
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl + '?key1=value1&key2=value2',
            {
              method: 'HEAD',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'My-Custom-Header': 'CustomValue',
              },
            });
      });
    });

    it('should fail with a HEAD request containing non-object data', () => {
      const err = 'HEAD requests cannot have a body.';
      return client.send({
        method: 'HEAD',
        url: mockUrl,
        data: 'non-object-data',
      }).should.eventually.be.rejectedWith(err);
    });

    it('should timeout when the response is delayed', () => {
      const timeout = 10000;
      const reqData = {request: 'data'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').callsFake(() => {
        return new Promise((resolve, reject) => {
          // Trigger timeout.
          clock.tick(timeout);
          // Even if fetch resolves after timeout, it will still be ignored.
          resolve(expectedResp);
        });
      });
      stubs.push(stub);

      return client.send({
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
        data: reqData,
        timeout,
      }).should.eventually.be.rejectedWith(`Error while making request: timeout of ${timeout}ms exceeded`);
    });

    it('should succeed as long as timeout is not exceeded', () => {
      const timeout = 10000;
      const reqData = {request: 'data'};
      const respData = {foo: 'bar'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 200,
          statusText: 'OK',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').callsFake(() => {
        return new Promise((resolve, reject) => {
          // Trigger timeout minus one millisecond.
          clock.tick(timeout - 1);
          // Request should resolve.
          resolve(expectedResp);
        });
      });
      stubs.push(stub);

      return client.send({
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'include',
        url: mockUrl,
        data: reqData,
        timeout,
      }).then((resp) => {
        expect(resp.status).to.equal(200);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.text).to.equal(JSON.stringify(respData));
        expect(resp.data).to.deep.equal(respData);
        expect(resp.isJson()).to.be.true;
        expect(stub).to.have.been.calledOnce.and.calledWith(
            mockUrl,
            {
              method: 'POST',
              mode: 'cors',
              cache: 'no-cache',
              credentials: 'include',
              body: JSON.stringify(reqData),
            });
      });
    });

    it('should fail on underlying fetch error', () => {
      const err = new Error('random error');
      const stub = sinon.stub(window, 'fetch').rejects(err);
      stubs.push(stub);

      return client.send({
        method: 'GET',
        url: mockUrl,
      }).should.eventually.be.rejectedWith(err);
    });

    it('should fail with a non-2xx response', () => {
      const reqData = {foo: 'bar'};
      const respData = {error: 'bad response'};
      const expectedResp = new Response(
        JSON.stringify(respData),
        {
          status: 400,
          statusText: 'Bad Request',
          headers: {'Content-Type': 'application/json'},
        });
      const stub = sinon.stub(window, 'fetch').resolves(expectedResp);
      stubs.push(stub);
      const expectedConfig: HttpRequestConfig = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        url: mockUrl,
        data: reqData,
        headers: {
          'Content-Type': 'application/json',
          'My-Custom-Header': 'CustomValue',
        },
      };
      const expectedRequestInit = {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'My-Custom-Header': 'CustomValue',
        },
        body: JSON.stringify(reqData),
      };

      return client.send(expectedConfig).then((resp) => {
        throw new Error('Unexpected success');
      }).catch((err) => {
        const resp = err.response;
        expect(err.message).to.equal(`Server responded with status 400`);
        expect(err.status).to.equal(400);
        expect(err.config).to.deep.equal(expectedConfig);
        expect(err.request).to.deep.equal(expectedRequestInit);

        expect(resp.status).to.equal(400);
        expect(resp.headers.get('content-type')).to.equal('application/json');
        expect(resp.data).to.deep.equal(respData);
        expect(resp.request).to.deep.equal(expectedRequestInit);
        expect(resp.config).to.deep.equal(expectedConfig);
      });
    });
  });
});
