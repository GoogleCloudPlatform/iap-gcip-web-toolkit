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
import * as sinon from 'sinon';
import { Config } from '../../../src/ciap/config';
import { BaseOperationHandler, OperationType } from '../../../src/ciap/base-operation-handler';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuthenticationHandler,
  createMockStorageManager,
} from '../../resources/utils';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';

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
  constructor(config: Config, handler: MockAuthenticationHandler) {
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
    expect(this.isProgressBarVisible()).to.be.false;
    expect((this.handler as MockAuthenticationHandler).isProgressBarVisible()).to.be.false;
    this.showProgressBar();
    expect(this.isProgressBarVisible()).to.be.true;
    expect((this.handler as MockAuthenticationHandler).isProgressBarVisible()).to.be.true;
    this.showProgressBar();
    expect(this.isProgressBarVisible()).to.be.true;
    expect((this.handler as MockAuthenticationHandler).isProgressBarVisible()).to.be.true;
    this.hideProgressBar();
    expect(this.isProgressBarVisible()).to.be.false;
    expect((this.handler as MockAuthenticationHandler).isProgressBarVisible()).to.be.false;
    this.hideProgressBar();
    expect(this.isProgressBarVisible()).to.be.false;
    expect((this.handler as MockAuthenticationHandler).isProgressBarVisible()).to.be.false;
  }

  /**
   * Runs all Auth tenants storage related tests.
   * @param {authTenantsStorage.AuthTenantsStorageManager} authTenantsStorageManager The expected
   *     authTenantsStorageManager to compare with.
   * @return {Promise<any>} A promise that resolves on test completion.
   */
  public runAuthTenantsStorageTests(
      authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager): Promise<any> {
    return Promise.all([this.listAuthTenants(), authTenantsStorageManager.listTenants()])
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal([]);
        expect(values[1]).to.deep.equal(values[0]);
        return Promise.all([
          this.addAuthTenant('TENANT_ID1'),
          this.addAuthTenant('TENANT_ID2'),
          this.addAuthTenant('TENANT_ID3'),
          this.addAuthTenant('TENANT_ID4'),
        ]);
      })
      .then(() => {
        return Promise.all([this.listAuthTenants(), authTenantsStorageManager.listTenants()]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal(['TENANT_ID1', 'TENANT_ID2', 'TENANT_ID3', 'TENANT_ID4']);
        expect(values[1]).to.deep.equal(values[0]);
        return Promise.all([
          this.removeAuthTenant('TENANT_ID3'),
          this.removeAuthTenant('TENANT_ID4'),
        ]);
      })
      .then(() => {
        return Promise.all([this.listAuthTenants(), authTenantsStorageManager.listTenants()]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal(['TENANT_ID1', 'TENANT_ID2']);
        expect(values[1]).to.deep.equal(values[0]);
        return this.clearAuthTenants();
      })
      .then(() => {
        return Promise.all([this.listAuthTenants(), authTenantsStorageManager.listTenants()]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal([]);
        expect(values[1]).to.deep.equal(values[0]);
      });
  }
}

describe('BaseOperationHandler', () => {
  const stubs: sinon.SinonStub[] = [];
  let mockStorageManager: storageManager.StorageManager;
  let authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager;
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  // Dummy FirebaseAuth instance.
  const auth = createMockAuth(tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  tenant2Auth[tid] = auth;

  beforeEach(() => {
    mockStorageManager = createMockStorageManager();
    // Stub globalStorageManager getter.
    stubs.push(
        sinon.stub(storageManager, 'globalStorageManager').get(() => mockStorageManager));
    authTenantsStorageManager =
        new authTenantsStorage.AuthTenantsStorageManager(mockStorageManager, apiKey);
    // Stub AuthTenantsStorageManager constructor.
    stubs.push(
      sinon.stub(authTenantsStorage, 'AuthTenantsStorageManager')
        .callsFake((manager: storageManager.StorageManager, appId: string) => {
          expect(manager).to.equal(mockStorageManager);
          expect(appId).to.equal(apiKey);
          return authTenantsStorageManager;
        }));
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  it('should initialize all underlying parameters as expected', () => {
    // Dummy authentication handler.
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

    const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

    concreteInstance.runTests(auth, config);
    return concreteInstance.runAuthTenantsStorageTests(authTenantsStorageManager);
  });

  it('should throw when no API key is provided', () => {
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    // Create config with no API key.
    const config = new Config(createMockUrl('login', null, tid, redirectUri, state, hl));

    expect(() => {
      return new ConcreteOperationHandler(config, authenticationHandler);
    }).to.throw();
  });
});
