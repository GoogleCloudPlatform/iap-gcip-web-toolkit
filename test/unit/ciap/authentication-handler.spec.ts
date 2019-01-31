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

import {expect} from 'chai';
import { isAuthenticationHandler } from '../../../src/ciap/authentication-handler';
import {
  createMockAuth, createMockAuthenticationHandler,
} from '../../resources/utils';

describe('isAuthenticationHandler()', () => {
  const auth = createMockAuth();
  const nonFunctions = [null, NaN, 0, 1, '', 'a', true, false, {}, [], { a: 1 }];
  const getAuth = (tenantId: string) => auth;

  it('should return true for valid AuthenticationHandler', () => {
    const handler = createMockAuthenticationHandler(getAuth);
    delete handler.completeSignout;
    delete handler.showProgressBar;
    delete handler.hideProgressBar;
    expect(isAuthenticationHandler(handler)).to.be.true;
  });

  it('should return true for a valid AuthenticationHandler with all optional parameters', () => {
    const handler = createMockAuthenticationHandler(getAuth);
    // Add all additional optional parameters.
    handler.completeSignout = () => Promise.resolve();
    handler.showProgressBar = () => {/** Null function. */};
    handler.hideProgressBar = () => {/** Null function. */};
    expect(isAuthenticationHandler(handler)).to.be.true;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid getAuth: ' + JSON.stringify(nonFunction), () => {
      const handler = createMockAuthenticationHandler(getAuth);
      handler.getAuth = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  it('should return false when getAuth is not provided', () => {
    const handler = createMockAuthenticationHandler(getAuth);
    delete handler.getAuth;
    expect(isAuthenticationHandler(handler)).to.be.false;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid startSignIn: ' + JSON.stringify(nonFunction), () => {
      const handler = createMockAuthenticationHandler(getAuth);
      handler.startSignIn = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  it('should return false when startSignIn is not provided', () => {
    const handler = createMockAuthenticationHandler(getAuth);
    delete handler.startSignIn;
    expect(isAuthenticationHandler(handler)).to.be.false;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid showProgressBar: ' + JSON.stringify(nonFunction), () => {
      const handler = createMockAuthenticationHandler(getAuth);
      handler.showProgressBar = 'invalid' as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid hideProgressBar: ' + JSON.stringify(nonFunction), () => {
      const handler = createMockAuthenticationHandler(getAuth);
      handler.hideProgressBar = 'invalid' as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid completeSignout: ' + JSON.stringify(nonFunction), () => {
      const handler = createMockAuthenticationHandler(getAuth);
      handler.completeSignout = 'invalid' as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });
});
