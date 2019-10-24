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
import { GCIPRequestHandler } from '../../../src/ciap/gcip-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuthenticationHandler,
  createMockStorageManager, createMockUser,
} from '../../resources/utils';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';
import { getCurrentUrl } from '../../../src/utils';
import {
  CLIENT_ERROR_CODES, CIAPError, HttpCIAPError, RECOVERABLE_ERROR_CODES,
} from '../../../src/utils/error';
import { PromiseCache } from '../../../src/utils/promise-cache';
import { SharedSettings } from '../../../src/ciap/shared-settings';

/**
 * Concrete subclass of the abstract BaseOperationHandler class used to
 * test underlying class logic.
 */
class ConcreteOperationHandler extends BaseOperationHandler {
   /**
    * @param config The current operation configuration.
    * @param handler The Authentication handler instance.
    */
  constructor(
      config: Config,
      handler: MockAuthenticationHandler,
      sharedSettings?: SharedSettings,
      private readonly processor: (() => Promise<void>) = (() => Promise.resolve())) {
    super(config, handler, sharedSettings);
  }

  /**
   * @return The corresponding operation type.
   */
  public get type(): OperationType {
    return OperationType.SignIn;
  }

  /**
   * @return A promise that resolves when the operation handler is initialized.
   */
  public process(): Promise<void> {
    return this.processor();
  }

  /**
   * Runs all tests to assert expected behavior.
   *
   * @param auth The FirebaseAuth instance to assert.
   * @param config The operation configuration to assert.
   */
  public runTests(auth: FirebaseAuth, config: Config): void {
    expect(this.gcipRequest).to.be.instanceOf(GCIPRequestHandler);
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
    // Confirm userHasMatchingTenantId behavior.
    if (config.tid.charAt(0) === '_') {
      // Agent flow.
      expect(this.userHasMatchingTenantId(createMockUser('UID1', 'ID_TOKEN1', null))).to.be.true;
    } else {
      // Tenant flow.
      expect(this.userHasMatchingTenantId(createMockUser('UID1', 'ID_TOKEN1', config.tid))).to.be.true;
    }
    expect(this.userHasMatchingTenantId(createMockUser('UID1', 'ID_TOKEN1', 'mismatchTenantId'))).to.be.false;
  }

  /**
   * Runs all Auth tenants storage related tests.
   * @param authTenantsStorageManager The expected authTenantsStorageManager to compare with.
   * @return A promise that resolves on test completion.
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
  let sharedSettings: SharedSettings;
  let popstateCallbacks: sinon.SinonSpy[] = [];
  const stubs: sinon.SinonStub[] = [];
  let mockStorageManager: storageManager.StorageManager;
  let authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager;
  const originalUri = 'https://www.example.com/path/main';
  const projectId = 'PROJECT_ID';
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const agentId = `_${projectId}`;
  const sessionInfo = {
    originalUri,
    tenantIds: [tid],
  };
  const currentUrlOrigin = new URL(getCurrentUrl(window)).origin;
  const redirectUri = `https://iap.googleapis.com/v1alpha1/gcip/resources/RESOURCE_HASH:handleRedirect`;
  // Dummy FirebaseAuth instance.
  const auth = createMockAuth(apiKey, tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  tenant2Auth[tid] = auth;
  tenant2Auth._ = createMockAuth(apiKey, null);
  let checkAuthorizedDomainsAndGetProjectIdStub: sinon.SinonStub;
  let getSessionInfoStub: sinon.SinonStub;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let cacheAndReturnResultSpy: sinon.SinonSpy;
  let startSpy: sinon.SinonSpy;

  beforeEach(() => {
    sharedSettings = new SharedSettings(apiKey);
    checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
        GCIPRequestHandler.prototype,
        'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
    stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
    getSessionInfoStub = sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfo);
    stubs.push(getSessionInfoStub);
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
    startSpy = sinon.spy(ConcreteOperationHandler.prototype, 'start');
  });

  afterEach(() => {
    popstateCallbacks.forEach((callback) => {
      window.removeEventListener('popstate', callback);
    });
    popstateCallbacks = [];
    stubs.forEach((s) => s.restore());
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    cacheAndReturnResultSpy.restore();
    startSpy.restore();
  });

  it('should initialize all underlying parameters as expected for tenant flow', () => {
    // Dummy authentication handler.
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

    const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

    concreteInstance.runTests(auth, config);
  });

  it('should initialize all underlying parameters as expected for agent flow', () => {
    // Dummy authentication handler.
    const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    const config = new Config(createMockUrl('login', apiKey, agentId, redirectUri, state, hl));

    const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

    concreteInstance.runTests(tenant2Auth._, config);
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
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      return concreteInstance.start()
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl])
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
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, config.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Second call should return cached result.
          return concreteInstance.start();
        })
        .then(() => {
          // No additional call. Cached result should be used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
        });
    });

    it('should use expected SharedSettings reference for caching and making GCIP requests', () => {
      const processorStub = sinon.stub().resolves();
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, sharedSettings, processorStub);

      return concreteInstance.start()
        .then(() => {
          // Confirm SharedSettings cache used.
          expect(cacheAndReturnResultSpy.getCall(0).thisValue)
            .to.equal(sharedSettings.cache);
          // Confirm SharedSettings gcipRequest used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub.getCall(0).thisValue)
            .to.equal(sharedSettings.gcipRequest);
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl])
            .and.calledBefore(processorStub);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(processorStub).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
        });
    });

    it('should reject on unsuccessful domain validation', () => {
      const processorStub = sinon.stub().resolves();
      const unauthorizedDomainError = new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'Unauthorized domain');
      checkAuthorizedDomainsAndGetProjectIdStub.restore();
      checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId');
      checkAuthorizedDomainsAndGetProjectIdStub.onFirstCall().rejects(unauthorizedDomainError);
      checkAuthorizedDomainsAndGetProjectIdStub.onSecondCall().resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      return concreteInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(unauthorizedDomainError);
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl]);
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
            .to.deep.equal([[currentUrlOrigin, config.redirectUrl]]);
        });
    });

    it('should reject on agent project mismatch', () => {
      const mismatchAgentId = '_mismatchProjectId';
      const processorStub = sinon.stub().resolves();
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, mismatchAgentId, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      return concreteInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Mismatching project numbers');
          expect(error).to.have.property('code', 'invalid-argument');
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl]);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(processorStub).to.not.have.been.called;
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should resolve on successful domain validation and agent project ID match', () => {
      const processorStub = sinon.stub().resolves();
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, agentId, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      return concreteInstance.start()
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl])
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
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, config.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Second call should return cached result.
          return concreteInstance.start();
        })
        .then(() => {
          // No additional call. Cached result should be used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
        });
    });

    it('should immediately resolve on popstate event', () => {
      const popstateCallback = sinon.spy();
      const processorStub = sinon.stub().callsFake(() => {
        // Simulate this promise never resolves.
        return new Promise((resolve) => {/** Never resolve. */});
      });
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, agentId, redirectUri, state, hl));
      window.addEventListener('popstate', popstateCallback);
      // Keep track of callback so it can be removed after each test.
      popstateCallbacks.push(popstateCallback);

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      const startRef = concreteInstance.start();
      // Simulate popstate event. This should force the promise to immediately resolve.
      const event = new CustomEvent('popstate', {
        bubbles: true,
      });
      window.dispatchEvent(event);
      // Even though process never resolves, this should still resolve due to popstate event.
      return startRef.then(() => {
        expect(popstateCallback).to.have.been.calledOnce;
        expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
          .and.calledWith([currentUrlOrigin, config.redirectUrl])
          .and.calledBefore(processorStub);
        expect(showProgressBarSpy).to.have.been.calledOnce
          .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
        expect(processorStub).to.have.been.calledOnce;
        // Progress bar should be hidden after popstate event.
        expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(popstateCallback);
        // Dispatch event again to confirm handler removed.
        window.dispatchEvent(event);
        // Progress bar should not be hidden again.
        expect(hideProgressBarSpy).to.have.been.calledOnce;
      });
    });

    it('should reject on OperationHandler.process() rejection', () => {
      const expectedError = new Error('Processing error');
      const processorStub = sinon.stub().rejects(expectedError);
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

      const concreteInstance =
          new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

      return concreteInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin, config.redirectUrl]);
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(processorStub);
          expect(processorStub).to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(authenticationHandler.getLastHandledError()).to.equal(expectedError);
          expect(error).to.not.haveOwnProperty('retry');
        });
    });

    it('should inject retry on the Error when OperationHandler.process() throws a recoverable error', () => {
      RECOVERABLE_ERROR_CODES.forEach((code) => {
        const expectedError = new CIAPError({
          code,
          message: 'message',
        });
        const processorStub = sinon.stub();
        processorStub.onFirstCall().rejects(expectedError);
        processorStub.onSecondCall().resolves();
        const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
        const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));

        const concreteInstance =
            new ConcreteOperationHandler(config, authenticationHandler, undefined, processorStub);

        return concreteInstance.start()
          .then(() => {
            throw new Error('Unexpected success');
          })
          .catch((error) => {
            expect(error).to.equal(expectedError);
            expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
              .and.calledWith([currentUrlOrigin, config.redirectUrl]);
            expect(showProgressBarSpy).to.have.been.calledOnce
              .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
            expect(hideProgressBarSpy).to.have.been.calledOnce
              .and.calledAfter(processorStub);
            expect(processorStub).to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
            expect(authenticationHandler.getLastHandledError()).to.equal(expectedError);
            expect(error).to.haveOwnProperty('retry');
            expect(startSpy).to.be.calledOnce;
            return error.retry();
          })
          .then(() => {
            expect(startSpy).to.be.calledTwice;
            expect(startSpy.getCall(0).thisValue).to.equal(concreteInstance);
          });
      });
    });
  });

  describe('getOriginalURL()', () => {
    it('should resolve with expected underlying getSessionInformation() successful response', () => {
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, null, redirectUri, state, hl));

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

      return concreteInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          expect(getSessionInfoStub).to.have.been.calledOnce.and.calledWith(redirectUri, state);
          // Expect result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy).to.be.calledOnce;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].getSessionInfo);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2]).to.deep.equal([config.redirectUrl, config.state]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.GetSessionInfo);
          // Second call should return cached result.
          return concreteInstance.getOriginalURL();
        })
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          expect(getSessionInfoStub).to.have.been.calledOnce;
        });
    });

    it('should use expected SharedSettings reference for caching and making IAP requests', () => {
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, null, redirectUri, state, hl));

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler, sharedSettings);

      return concreteInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          // Confirm SharedSettings cache used.
          expect(cacheAndReturnResultSpy.getCall(0).thisValue)
            .to.equal(sharedSettings.cache);
          // Confirm SharedSettings iapRequest used.
          expect(getSessionInfoStub.getCall(0).thisValue).to.equal(sharedSettings.iapRequest);
          expect(getSessionInfoStub).to.have.been.calledOnce.and.calledWith(redirectUri, state);
        });
    });

    it('should resolve with null when no state is available', () => {
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      // Initialize config with null state.
      const config = new Config(createMockUrl('signout', apiKey, tid, redirectUri, null, hl));

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

      return concreteInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.be.null;
          expect(getSessionInfoStub).to.not.have.been.called;
        });
    });

    it('should resolve with null when no redirectUrl is available', () => {
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      // Initialize config with null redirectUrl.
      const config = new Config(createMockUrl('signout', apiKey, tid, null, state, hl));

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

      return concreteInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.be.null;
          expect(getSessionInfoStub).to.not.have.been.called;
        });
    });

    it('should reject with expected underlying getSessionInformation() error', () => {
      const expectedError = new HttpCIAPError(504);
      const authenticationHandler: MockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth);
      const config = new Config(createMockUrl('login', apiKey, null, redirectUri, state, hl));
      getSessionInfoStub.onFirstCall().rejects(expectedError);
      getSessionInfoStub.onSecondCall().resolves(sessionInfo);

      const concreteInstance = new ConcreteOperationHandler(config, authenticationHandler);

      return concreteInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(getSessionInfoStub).to.have.been.calledOnce.and.calledWith(redirectUri, state);
          return concreteInstance.getOriginalURL();
        })
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          expect(getSessionInfoStub).to.have.been.calledTwice;
          expect(getSessionInfoStub.getCalls()[1].args)
            .to.deep.equal([config.redirectUrl, config.state]);
        });
    });
  });
});
