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
import { BaseOperationHandler, OperationType } from '../../../src/ciap/base-operation-handler';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { AuthenticationHandler } from '../../../src/ciap/authentication-handler';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler,
} from '../../resources/utils';

/**
 * Concrete subclass of the abstract BaseOperationHandler class used to
 * test underlying class logic.
 */
class ConcreteOperationHandler extends BaseOperationHandler {
   /**
    * @param {Config} config The current operation configuration.
    * @param {AuthenticationHandler} handler The Authentication handler instance.
    * @constructor
    */
  constructor(config: Config, handler: AuthenticationHandler) {
    super(config, handler);
  }

  /**
   * @return {OperationType} The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignIn;
  }

  /**
   * @return {Promise<void>} A promise that resolves when the operation handler is initialized.
   * @override
   */
  public start(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Runs all tests to assert expected behavior.
   *
   * @param {FirebaseAuth} auth The FirebaseAuth instance to assert.
   * @param {Config} config The operation configuration to assert.
   */
  public runTests(auth: FirebaseAuth, config: Config): void {
    expect(this.cicpRequest).to.be.instanceOf(CICPRequestHandler);
    expect(this.iapRequest).to.be.instanceOf(IAPRequestHandler);
    expect(this.auth).to.equal(auth);
    expect(this.redirectUrl).to.equal(config.redirectUrl);
    expect(this.tenantId).to.equal(config.tid);
    expect(this.state).to.equal(config.state);
    expect(this.languageCode).to.equal(config.hl);
    expect(this.config).to.equal(config);
  }
}

describe('BaseOperationHandler', () => {
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  // Dummy FirebaseAuth instance.
  const auth = createMockAuth(tid);

  it('should initialize all underlying parameters as expected', () => {
    // Dummy authentication handler.
    const authenticationHandler = createMockAuthenticationHandler((actualTenantId: string) => {
      // Confirm expected tid passed to getAuth.
      expect(actualTenantId).to.equal(tid);
      return auth;
    });
    const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

    const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

    concreteInstance.runTests(auth, config);
  });
});
