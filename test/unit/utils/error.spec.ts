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
  CIAPError, HttpCIAPError, HTTP_ERROR_CODE, CLIENT_ERROR_CODES,
  RECOVERABLE_ERROR_CODES, isRecoverableError,
} from '../../../src/utils/error';
import { addReadonlyGetter } from '../../../src/utils/index';

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

  it('should initialize successfully with error info and custom message specified', () => {
    const error = new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'custom message');
    expect(error.code).to.be.equal('invalid-argument');
    expect(error.message).to.be.equal('custom message');
    expect(error.reason).to.be.undefined;
  });

  it('should initialize successfully with error info and reason specified', () => {
    const error = new CIAPError(errorInfo, undefined, reason);
    expect(error.code).to.be.equal(code);
    expect(error.message).to.be.equal(message);
    expect(error.reason).to.be.equal(reason);
  });

  it('should initialize successfully with error info, custom message and reason specified', () => {
    const error = new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'custom message', reason);
    expect(error.code).to.be.equal('invalid-argument');
    expect(error.message).to.be.equal('custom message');
    expect(error.reason).to.be.equal(reason);
  });

  it('should throw if no error info is specified', () => {
    expect(() => {
      const errorAny: any = CIAPError;
      return new errorAny();
    }).to.throw();
  });

  describe('toJSON()', () => {
    it('should resolve with the expected object excluding reason if not provided', () => {
      const error = new CIAPError(errorInfo);
      expect(error.toJSON()).to.deep.equal({code, message});
    });

    it('should resolve with the expected object including reason if provided', () => {
      const error = new CIAPError(errorInfo, undefined, reason);
      expect(error.toJSON()).to.deep.equal({code, message, reason: JSON.stringify(reason)});
    });

    it('should resolve with the expected object including reason and custom message if provided', () => {
      const error = new CIAPError(errorInfo, 'custom message', reason);
      expect(error.toJSON()).to.deep.equal({
        code, message: 'custom message', reason: JSON.stringify(reason),
      });
    });
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

describe('CLIENT_ERROR_CODES' , () => {
  it('should map to expected values in HTTP_ERROR_CODE', () => {
    Object.keys(HTTP_ERROR_CODE).forEach((key: string) => {
      const code = key;
      const message = HTTP_ERROR_CODE[key].message;
      expect(CLIENT_ERROR_CODES[key]).to.deep.equal({
        code, message,
      });
    });
  });
});

describe('isRecoverableError()', () => {
  Object.keys(HTTP_ERROR_CODE).forEach((code) => {
    const isRecoverable = RECOVERABLE_ERROR_CODES.indexOf(code) !== -1;
    it(`should return ${isRecoverable} for CIAP error code ${code}` , () => {
      const error = new HttpCIAPError(
          HTTP_ERROR_CODE[code].code, HTTP_ERROR_CODE[code].status, HTTP_ERROR_CODE[code].message);
      if (isRecoverable) {
        expect(isRecoverableError(error)).to.be.true;
      } else {
        expect(isRecoverableError(error)).to.be.false;
      }
    });
  });

  RECOVERABLE_ERROR_CODES.forEach((code) => {
    if (typeof HTTP_ERROR_CODE[code] === 'undefined') {
      it(`should return true for non-CIAP error code ${code}` , () => {
        const error: {code?: string, message: string} = new Error('message');
        addReadonlyGetter(error, 'code', code);
        expect(isRecoverableError(error)).to.be.true;
      });
    }
  });
});
