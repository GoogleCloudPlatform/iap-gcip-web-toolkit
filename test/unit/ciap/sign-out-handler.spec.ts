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
import { Config } from '../../../src/ciap/config';
import { SignOutOperationHandler } from '../../../src/ciap/sign-out-handler';
import { OperationType } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler,
} from '../../resources/utils';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';

describe('SignOutOperationHandler', () => {
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  const config = new Config(createMockUrl('signout', apiKey, tid, redirectUri, state, hl));
  const auth = createMockAuth(tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  tenant2Auth[tid] = auth;
  const authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
  const operationHandler = new SignOutOperationHandler(config, authenticationHandler);

  it('should not throw on initialization', () => {
    expect(() => {
      return new SignOutOperationHandler(config, authenticationHandler);
    }).not.to.throw;
  });

  describe('type', () => {
    it('should return OperationType.SignOut', () => {
      expect(operationHandler.type).to.equal(OperationType.SignOut);
    });
  });

  describe('start()', () => {
    it('should eventually be fullfilled', () => {
      expect(operationHandler.start()).to.be.fulfilled;
    });
  });
});
