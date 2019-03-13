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
import {
  BaseOperationHandler, OperationType, CacheDuration,
} from '../../../src/ciap/base-operation-handler';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuthenticationHandler,
  createMockStorageManager,
} from '../../resources/utils';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';
import { getCurrentUrl } from '../../../src/utils';
import { CLIENT_ERROR_CODES, CIAPError } from '../../../src/utils/error';
import { PromiseCache } from '../../../src/utils/promise-cache';

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
  constructor(
      config: Config,
      handler: MockAuthenticationHandler,
      private readonly processor: (() => Promise<void>) = (() => Promise.resolve())) {
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
  public process(): Promise<void> {
    return this.processor();
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
    // Confirm all Auth tenants storage access fail before start().
    expect(() => this.listAuthTenants()).to.throw().with.property('code', 'internal');
    expect(() => this.removeAuthTenant('TENANT_ID')).to.throw().with.property('code', 'internal');
    expect(() => this.addAuthTenant('TENANT_ID')).to.throw().with.property('code', 'internal');
    expect(() => this.clearAuthTenants()).to.throw().with.property('code', 'internal');
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
  const projectId = 'PROJECT_ID';
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const currentUrl = getCurrentUrl(window);
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  // Dummy FirebaseAuth instance.
  const auth = createMockAuth(apiKey, tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  tenant2Auth[tid] = auth;
  let checkAuthorizedDomainsAndGetProjectIdStub: sinon.SinonStub;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let cacheAndReturnResultSpy: sinon.SinonSpy;

  beforeEach(() => {
    checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
        CICPRequestHandler.prototype,
        'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
    stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
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
          expect(appId).to.equal(projectId);
          return authTenantsStorageManager;
        }));
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    cacheAndReturnResultSpy = sinon.spy(PromiseCache.prototype, 'cacheAndReturnResult');
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    cacheAndReturnResultSpy.restore();
  });

  it('should initialize all underlying parameters as expected', () => {
    // Dummy authentication handler.
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

    const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

    concreteInstance.runTests(auth, config);
  });

  it('should throw when no API key is provided', () => {
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    // Create config with no API key.
    const config = new Config(createMockUrl('login', null, tid, redirectUri, state, hl));

    expect(() => {
      return new ConcreteOperationHandler(config, authenticationHandler);
    }).to.throw().with.property('code', 'invalid-argument');
  });

  it('should throw when Auth instance API key does not match config API key', () => {
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    // Create config with API key that does not match getAuth() returned API key.
    const config = new Config(createMockUrl('login', 'NOT_FOUND_API_KEY', tid, redirectUri, state, hl));

    expect(() => {
      return new ConcreteOperationHandler(config, authenticationHandler);
    }).to.throw().with.property('code', 'invalid-argument');
  });

  describe('start()', () => {
    it('should initialize AuthTenantsStorageManager', () => {
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

      return concreteInstance.start()
        .then(() => {
          return concreteInstance.runAuthTenantsStorageTests(authTenantsStorageManager);
        });
    });

    it('should resolve on successful domain validation', () => {
      const processorStub = sinon.stub().resolves();
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, processorStub);

      return concreteInstance.start()
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrl, config.redirectUrl])
            .and.calledBefore(processorStub);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(processorStub).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Expect result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledOnce;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(CICPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2]).to.deep.equal([[currentUrl, config.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Second call should return cached result.
          return concreteInstance.start();
        })
        .then(() => {
          // No additional call. Cached result should be used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
        });
    });

    it('should reject on unsuccessful domain validation', () => {
      const processorStub = sinon.stub().resolves();
      const unauthorizedDomainError = new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'Unauthorized domain');
      checkAuthorizedDomainsAndGetProjectIdStub.restore();
      checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId');
      checkAuthorizedDomainsAndGetProjectIdStub.onFirstCall().rejects(unauthorizedDomainError);
      checkAuthorizedDomainsAndGetProjectIdStub.onSecondCall().resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, processorStub);

      return concreteInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(unauthorizedDomainError);
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrl, config.redirectUrl]);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(processorStub).to.not.have.been.called;
          expect(authenticationHandler.getLastHandledError()).to.equal(unauthorizedDomainError);
          // Error should not be cached.
          return concreteInstance.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledTwice;
          expect(checkAuthorizedDomainsAndGetProjectIdStub.getCalls()[1].args)
            .to.deep.equal([[currentUrl, config.redirectUrl]]);
        });
    });

    it('should reject on OperationHandler.process() rejection', () => {
      const expectedError = new Error('Processing error');
      const processorStub = sinon.stub().rejects(expectedError);
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, processorStub);

      return concreteInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrl, config.redirectUrl]);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(processorStub);
          expect(processorStub).to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(authenticationHandler.getLastHandledError()).to.equal(expectedError);
        });
    });
  });
});
