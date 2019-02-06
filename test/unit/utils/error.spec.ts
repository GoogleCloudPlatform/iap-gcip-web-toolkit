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

'use strict';

import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  CIAPError, HttpCIAPError, HTTP_ERROR_CODE,
} from '../../../src/utils/error';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('CIAPError', () => {
  const code = 'code';
  const message = 'message';
  const errorInfo = {code, message};
  const reason = new Error('underlying reason');

  it('should initialize successfully with error info specified', () => {
    const error = new CIAPError(errorInfo);
    expect(error.code).to.be.equal(code);
    expect(error.message).to.be.equal(message);
    expect(error.reason).to.be.undefined;
  });

  it('should initialize successfully with error info and reason specified', () => {
    const error = new CIAPError(errorInfo, reason);
    expect(error.code).to.be.equal(code);
    expect(error.message).to.be.equal(message);
    expect(error.reason).to.be.equal(reason);
  });

  it('should throw if no error info is specified', () => {
    expect(() => {
      const errorAny: any = CIAPError;
      return new errorAny();
    }).to.throw();
  });

  it('toJSON() should resolve with the expected object excluding reason if not provided', () => {
    const error = new CIAPError(errorInfo);
    expect(error.toJSON()).to.deep.equal({code, message});
  });

  it('toJSON() should resolve with the expected object including reason if provided', () => {
    const error = new CIAPError(errorInfo, reason);
    expect(error.toJSON()).to.deep.equal({code, message, reason: JSON.stringify(reason)});
  });
});

describe('HttpCIAPError', () => {
  const reason = new Error('underlying reason');

  it('should initialize successfully with http error code specified', () => {
    const error = new HttpCIAPError(400, undefined, undefined, reason);
    expect(error.code).to.equal('invalid-argument');
    expect(error.message).to.equal(HTTP_ERROR_CODE['invalid-argument'].message);
    expect(error.httpErrorCode).to.equal(400);
    expect(error.reason).to.equal(reason);
  });

  it('should initialize successfully with status code specified', () => {
    const error = new HttpCIAPError(400, 'FAILED_PRECONDITION', undefined, reason);
    expect(error.code).to.equal('failed-precondition');
    expect(error.message).to.equal(HTTP_ERROR_CODE['failed-precondition'].message);
    expect(error.httpErrorCode).to.equal(400);
    expect(error.reason).to.equal(reason);
  });

  it('should initialize successfully and override default message if a custom message is specified', () => {
    const error = new HttpCIAPError(400, undefined, 'Custom message', reason);
    expect(error.code).to.equal('invalid-argument');
    expect(error.message).to.equal('Custom message');
    expect(error.httpErrorCode).to.equal(400);
    expect(error.reason).to.equal(reason);
  });

  it('should initialize successfully with custom status code specified', () => {
    const error = new HttpCIAPError(400, 'UNEXPECTED_STATUS_CODE', 'Custom message', reason);
    expect(error.code).to.equal('unexpected-status-code');
    expect(error.message).to.equal('Custom message');
    expect(error.httpErrorCode).to.equal(400);
    expect(error.reason).to.equal(reason);
  });

  it('should initialize successfully with fallback code when http error code is not found', () => {
    // 402 is not documented in our errors.
    const error = new HttpCIAPError(402, undefined, 'Custom message', reason);
    expect(error.code).to.equal('unknown');
    expect(error.message).to.equal('Custom message');
    expect(error.httpErrorCode).to.equal(402);
    expect(error.reason).to.equal(reason);
  });

  it('should initialize successfully with when http error code and status codes are not found', () => {
    // 402 and UNEXPECTED_STATUS_CODE are not documented in our errors.
    const error = new HttpCIAPError(402, 'UNEXPECTED_STATUS_CODE', undefined, reason);
    expect(error.code).to.equal('unexpected-status-code');
    expect(error.message).to.equal(HTTP_ERROR_CODE.unknown.message);
    expect(error.httpErrorCode).to.equal(402);
    expect(error.reason).to.equal(reason);
  });

  it('toJSON() should resolve with the expected object', () => {
    const error = new HttpCIAPError(403, 'PERMISSION_DENIED', 'Custom message', reason);
    expect(error.toJSON()).to.deep.equal({
      httpErrorCode: 403,
      code: 'permission-denied',
      message: 'Custom message',
      reason: JSON.stringify(reason),
    });
  });
});
