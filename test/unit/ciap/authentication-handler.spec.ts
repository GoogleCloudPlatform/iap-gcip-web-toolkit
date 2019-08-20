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
import { isAuthenticationHandler, AuthenticationHandler } from '../../../src/ciap/authentication-handler';
import { createMockAuth } from '../../resources/utils';

describe('isAuthenticationHandler()', () => {
  const providerMatch = {
    tenantId: 'tenant-1',
  };
  const apiKey = 'API_KEY';
  const auth = createMockAuth(apiKey);
  const nonFunctions = [null, NaN, 0, 1, '', 'a', true, false, {}, [], { a: 1 }];
  const mockAuthenticationHandler: AuthenticationHandler = {
    getAuth: (tenantId: string) => auth,
    startSignIn: () => Promise.resolve({} as any),
    completeSignOut: () => Promise.resolve(),
  };

  it('should return true for valid AuthenticationHandler', () => {
    const handler = mockAuthenticationHandler;
    delete handler.showProgressBar;
    delete handler.hideProgressBar;
    delete handler.processUser;
    delete handler.selectProvider;
    expect(isAuthenticationHandler(handler)).to.be.true;
  });

  it('should return true for a valid AuthenticationHandler with all optional parameters', () => {
    const handler = mockAuthenticationHandler;
    // Add all additional optional parameters.
    handler.showProgressBar = () => {/** Null function. */};
    handler.hideProgressBar = () => {/** Null function. */};
    handler.processUser = (user) => Promise.resolve(user);
    handler.selectProvider = (projectConfig, tenantIds) => Promise.resolve(providerMatch);
    expect(isAuthenticationHandler(handler)).to.be.true;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid getAuth: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.getAuth = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  it('should return false when getAuth is not provided', () => {
    const handler = mockAuthenticationHandler;
    delete handler.getAuth;
    expect(isAuthenticationHandler(handler)).to.be.false;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid startSignIn: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.startSignIn = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  it('should return false when startSignIn is not provided', () => {
    const handler = mockAuthenticationHandler;
    delete handler.startSignIn;
    expect(isAuthenticationHandler(handler)).to.be.false;
  });

  it('should return false when completeSignOut is not provided', () => {
    const handler = mockAuthenticationHandler;
    delete handler.completeSignOut;
    expect(isAuthenticationHandler(handler)).to.be.false;
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid showProgressBar: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.showProgressBar = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid hideProgressBar: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.hideProgressBar = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid processUser: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.processUser = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });

  nonFunctions.forEach((nonFunction) => {
    it('should return false when provided with an invalid selectProvider: ' + JSON.stringify(nonFunction), () => {
      const handler = mockAuthenticationHandler;
      handler.selectProvider = nonFunction as any;
      expect(isAuthenticationHandler(handler)).to.be.false;
    });
  });
});
