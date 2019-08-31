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
import { SignOutOperationHandler } from '../../../src/ciap/sign-out-handler';
import { OperationType, CacheDuration } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuth,
  createMockUser, MockAuthenticationHandler, createMockStorageManager,
} from '../../resources/utils';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { GCIPRequestHandler } from '../../../src/ciap/gcip-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import { HttpCIAPError, CLIENT_ERROR_CODES, CIAPError } from '../../../src/utils/error';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';
import { PromiseCache } from '../../../src/utils/promise-cache';
import { SharedSettings } from '../../../src/ciap/shared-settings';

describe('SignOutOperationHandler', () => {
  let sharedSettings: SharedSettings;
  const stubs: sinon.SinonStub[] = [];
  const projectId = 'PROJECT_ID';
  const apiKey = 'API_KEY';
  const tid1 = 'TENANT_ID1';
  const tid2 = 'TENANT_ID2';
  const tid3 = 'TENANT_ID3';
  const state = 'STATE';
  const hl = 'en-US';
  const originalUri = 'https://www.example.com/path/main';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/gcip/resources/RESOURCE_HASH:handleRedirect`;
  const agentId = `_${projectId}`;
  const singleSignOutConfig = new Config(createMockUrl('signout', apiKey, tid1, redirectUri, state, hl));
  const multiSignOutConfig = new Config(createMockUrl('signout', apiKey, null, null, null, hl));
  const agentConfig = new Config(createMockUrl('signout', apiKey, agentId, redirectUri, state, hl));
  // redirectUrl and state specified. No tenantId is specified.
  const unifiedSignOutConfig = new Config(createMockUrl('signout', apiKey, null, redirectUri, state, hl));
  let auth1: MockAuth;
  let auth2: MockAuth;
  let auth3: MockAuth;
  let agentAuth: MockAuth;
  let authenticationHandler: MockAuthenticationHandler;
  let singleSignOutOperationHandler: SignOutOperationHandler;
  let multiSignOutOperationHandler: SignOutOperationHandler;
  let agentSignOutOperationHandler: SignOutOperationHandler;
  let unifiedSignOutOperationHandler: SignOutOperationHandler;
  let tenant2Auth: {[key: string]: FirebaseAuth};
  let completeSignOutSpy: sinon.SinonSpy;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let cacheAndReturnResultSpy: sinon.SinonSpy;
  let signOutSpy: sinon.SinonSpy;
  let mockStorageManager: storageManager.StorageManager;
  let authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager;
  const currentUrlOrigin = new URL(utils.getCurrentUrl(window)).origin;
  let startSpy: sinon.SinonSpy;

  beforeEach(() => {
    sharedSettings = new SharedSettings(apiKey);
    mockStorageManager = createMockStorageManager();
    // Stub globalStorageManager getter.
    stubs.push(
        sinon.stub(storageManager, 'globalStorageManager').get(() => mockStorageManager));
    authTenantsStorageManager =
        new authTenantsStorage.AuthTenantsStorageManager(mockStorageManager, projectId);
    // Stub AuthTenantsStorageManager constructor.
    stubs.push(
        sinon.stub(authTenantsStorage, 'AuthTenantsStorageManager')
          .callsFake((manager: storageManager.StorageManager, appId: string) => {
            expect(manager).to.equal(mockStorageManager);
            expect(appId).to.equal(projectId);
            return authTenantsStorageManager;
          }));
    // Listen to auth.signOut calls.
    signOutSpy = sinon.spy(MockAuth.prototype, 'signOut');
    // Listen to completeSignOut, showProgressBar and hideProgressBar.
    completeSignOutSpy = sinon.spy(MockAuthenticationHandler.prototype, 'completeSignOut');
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    cacheAndReturnResultSpy = sinon.spy(PromiseCache.prototype, 'cacheAndReturnResult');
    startSpy = sinon.spy(SignOutOperationHandler.prototype, 'start');
    auth1 = createMockAuth(apiKey, tid1);
    auth2 = createMockAuth(apiKey, tid2);
    auth3 = createMockAuth(apiKey, tid3);
    agentAuth = createMockAuth(apiKey, null);
    // Simulate user already signed in on each instance.
    auth1.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid1));
    auth2.setCurrentMockUser(createMockUser('UID2', 'ID_TOKEN2', tid2));
    auth3.setCurrentMockUser(createMockUser('UID3', 'ID_TOKEN3', tid3));
    agentAuth.setCurrentMockUser(createMockUser('UID_AGENT', 'ID_TOKEN_AGENT', null));
    tenant2Auth = {};
    tenant2Auth[tid1] = auth1;
    tenant2Auth[tid2] = auth2;
    tenant2Auth[tid3] = auth3;
    tenant2Auth._ = agentAuth;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    singleSignOutOperationHandler = new SignOutOperationHandler(singleSignOutConfig, authenticationHandler);
    multiSignOutOperationHandler = new SignOutOperationHandler(multiSignOutConfig, authenticationHandler);
    agentSignOutOperationHandler = new SignOutOperationHandler(agentConfig, authenticationHandler);
    unifiedSignOutOperationHandler = new SignOutOperationHandler(unifiedSignOutConfig, authenticationHandler);
    // Simulate tenant previously signed in and saved in storage.
    return authTenantsStorageManager.addTenant(tid1);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    completeSignOutSpy.restore();
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    signOutSpy.restore();
    cacheAndReturnResultSpy.restore();
    startSpy.restore();
  });

  it('should not throw on initialization', () => {
    expect(() => {
      return new SignOutOperationHandler(singleSignOutConfig, authenticationHandler);
    }).not.to.throw;
  });

  it('should throw on initialization with invalid tenant ID', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('signout', apiKey, 'invalidTenantId', redirectUri, state, hl));
      return new SignOutOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  it('should throw on single tenant with redirect initialization with no state', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('signout', apiKey, tid1, redirectUri, null, hl));
      return new SignOutOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  describe('type', () => {
    it('should return OperationType.SignOut', () => {
      expect(singleSignOutOperationHandler.type).to.equal(OperationType.SignOut);
    });
  });

  describe('start()', () => {
    const unauthorizedDomainError = new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'Unauthorized domain');
    it('should fail on unauthorized redirect URL for single tenant', () => {
      // Mock domains are not authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(unauthorizedDomainError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return singleSignOutOperationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          // Confirm completeSignOut not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // User should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should sign out from single tenant and redirect when tenant ID and redirectUrl are specified', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate another tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return singleSignOutOperationHandler.start();
        })
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledTwice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, singleSignOutConfig.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getOriginalUrlForSignOut result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].getOriginalUrlForSignOut);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([singleSignOutConfig.redirectUrl, singleSignOutConfig.tid, singleSignOutConfig.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.GetOriginalUrl);

          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // Progress bar should not be hidden.
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.called
            .and.calledOn(auth1)
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm getOriginalUrlForSignOutStub called.
          expect(getOriginalUrlForSignOutStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(singleSignOutConfig.redirectUrl, singleSignOutConfig.tid, singleSignOutConfig.state);
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub)
            .and.calledWith(window, originalUri);
          // User should be signed out.
          expect(auth1.currentUser).to.be.null;
          // Confirm only specified tenant is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Other tenant should remain in storage.
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID']);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return singleSignOutOperationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(getOriginalUrlForSignOutStub).to.be.calledOnce;
        });
    });

    it('should sign out from agent and redirect when agent ID and redirectUrl are specified', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate agent previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant(agentId)
        .then(() => {
          return agentSignOutOperationHandler.start();
        })
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledTwice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, agentConfig.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getOriginalUrlForSignOut result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].getOriginalUrlForSignOut);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([agentConfig.redirectUrl, agentId, agentConfig.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.GetOriginalUrl);

          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, agentConfig.redirectUrl]);
          // Progress bar should not be hidden.
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.called
            .and.calledOn(agentAuth)
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm getOriginalUrlForSignOutStub called.
          expect(getOriginalUrlForSignOutStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(agentConfig.redirectUrl, agentId, agentConfig.state);
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub)
            .and.calledWith(window, originalUri);
          // Agent user should be signed out.
          expect(agentAuth.currentUser).to.be.null;
          expect(auth1.currentUser).to.not.be.null;
          expect(auth2.currentUser).to.not.be.null;
          expect(auth3.currentUser).to.not.be.null;
          // Confirm only specified agent ID is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Other tenant should remain in storage.
          expect(tenantList).to.deep.equal([tid1]);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return agentSignOutOperationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(getOriginalUrlForSignOutStub).to.be.calledOnce;
        });
    });

    it('should sign out from single tenant and not redirect when tenant ID and no redirectUrl are specified', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Use config with no redirect URL.
      const config = new Config(createMockUrl('signout', apiKey, tid1, null, state, hl));
      const operationHandler = new SignOutOperationHandler(config, authenticationHandler);

      return operationHandler.start()
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(signOutSpy);
          // signOut should be called after progress bar is shown.
          expect(signOutSpy).to.have.been.called
            .and.calledOn(auth1)
            .and.calledAfter(showProgressBarSpy);
          // Confirm current URL is checked.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin])
            .and.calledBefore(signOutSpy);
          // Confirm getOriginalUrlForSignOutStub not called due to missing redirect URL.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Progress bar should be hidden before handing control back to developer.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(signOutSpy);
          // Confirm completeSignOut called.
          expect(completeSignOutSpy)
            .to.have.been.calledOnce.and.calledAfter(hideProgressBarSpy);
          // User should be signed out.
          expect(auth1.currentUser).to.be.null;
          // Confirm stored tenant ID is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([]);
        });
    });

    it('should sign out from agent and not redirect when agent ID and no redirectUrl are specified', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Use config with no redirect URL.
      const config = new Config(createMockUrl('signout', apiKey, agentId, null, state, hl));
      const operationHandler = new SignOutOperationHandler(config, authenticationHandler);

      return authTenantsStorageManager.addTenant(agentId)
        .then(() => operationHandler.start())
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(signOutSpy);
          // signOut should be called after progress bar is shown.
          expect(signOutSpy).to.have.been.called
            .and.calledOn(agentAuth)
            .and.calledAfter(showProgressBarSpy);
          // Confirm current URL is checked.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin])
            .and.calledBefore(signOutSpy);
          // Confirm getOriginalUrlForSignOutStub not called due to missing redirect URL.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Progress bar should be hidden before handing control back to developer.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(signOutSpy);
          // Confirm completeSignOut called.
          expect(completeSignOutSpy)
            .to.have.been.calledOnce.and.calledAfter(hideProgressBarSpy);
          // User should be signed out.
          expect(agentAuth.currentUser).to.be.null;
          // Confirm stored agent ID is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should reject when isAuthorizedDomain rejects', () => {
      const expectedError = new HttpCIAPError(504);
      // Mock domain authorization check throws an error.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(expectedError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return singleSignOutOperationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // signOut should not be called.
          expect(signOutSpy).to.not.have.been.called;
          // getOriginalUrlForSignOutStub should not be called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // User should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should reject for single tenant signout when auth.signOut() rejects', () => {
      const expectedError = new Error('signout error');
      // Mock domain authorization succeeds.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      // Remove signOut spy and re-stub to reject with an error.
      signOutSpy.restore();
      const signOutStub = sinon.stub(MockAuth.prototype, 'signOut').rejects(expectedError);
      stubs.push(signOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return singleSignOutOperationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // signOut should have been called once.
          expect(signOutStub).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // getOriginalUrlForSignOutStub should not be called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should reject when getOriginalUrlForSignOutStub rejects', () => {
      let caughtError: CIAPError;
      // Simulate recoverable error.
      const expectedError = new HttpCIAPError(504);
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut');
      // Fail on first try and succeed on second.
      getOriginalUrlForSignOutStub.onFirstCall().rejects(expectedError);
      getOriginalUrlForSignOutStub.onSecondCall().resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate another tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return singleSignOutOperationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          caughtError = error;
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.called
            .and.calledOn(auth1)
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm getOriginalUrlForSignOutStub called.
          expect(getOriginalUrlForSignOutStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(singleSignOutConfig.redirectUrl, singleSignOutConfig.tid, singleSignOutConfig.state);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // User should be signed out.
          expect(auth1.currentUser).to.be.null;
          // Progress bar should be hidden when the error is detected.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Other tenant ID should remain in storage.
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID']);
          expect(startSpy).to.be.calledOnce;
          expect(caughtError).to.haveOwnProperty('retry');
          // Try again to confirm caching behavior.
          return (caughtError as any).retry();
        })
        .then(() => {
          expect(startSpy).to.be.calledTwice;
          expect(startSpy.getCall(0).thisValue).to.equal(singleSignOutOperationHandler);
          // Only getOriginalUrlForSignOut call should retry.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
          expect(getOriginalUrlForSignOutStub).to.have.been.calledTwice;
          expect(getOriginalUrlForSignOutStub.getCalls()[1].args)
            .to.deep.equal([singleSignOutConfig.redirectUrl, singleSignOutConfig.tid, singleSignOutConfig.state]);
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub)
            .and.calledWith(window, originalUri);
        });
    });

    it('should sign out from all tenants and agents when no tenant ID is specified', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate 2 tenants and agent signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(agentId),
      ];

      return Promise.all(addTenantsList)
        .then(() => {
          // Users should be signed in initially.
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          expect(agentAuth.currentUser.uid).to.equal('UID_AGENT');
          return multiSignOutOperationHandler.start();
        })
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(signOutSpy);
          // Confirm signOut is called after showing progress bar.
          expect(signOutSpy).to.have.been.calledThrice.and.calledAfter(showProgressBarSpy);
          // Progress bar should be hidden before compleSignOut is called.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(signOutSpy);
          // Confirm completeSignOut is called after progress bar is hidden.
          expect(completeSignOutSpy).to.have.been.calledOnce.and.calledAfter(hideProgressBarSpy);
          // Confirm current URL is checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin])
            .and.calledBefore(signOutSpy);
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // Confirm no redirect to originalUri occurs.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Users should be signed out.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          expect(agentAuth.currentUser).to.be.null;
          // Confirm all tenants/agent are cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // All tenants should be cleared.
          expect(tenantList).to.deep.equal([]);
        });
    });

    it('should not redirect to redirectUrl on multi-tenant signout', () => {
      // Mock domain is authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate 3 tenants signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(tid3),
        // This should be ignored.
        authTenantsStorageManager.addTenant('NOT_FOUND_TENANT'),
      ];

      // Create multi-tenant signout config with redirect URL.
      const config = new Config(createMockUrl('signout', apiKey, null, redirectUri, null, hl));
      multiSignOutOperationHandler = new SignOutOperationHandler(config, authenticationHandler);

      return Promise.all(addTenantsList)
        .then(() => {
          // Users should be signed in initially.
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          expect(auth3.currentUser.uid).to.equal('UID3');
          return multiSignOutOperationHandler.start();
        })
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, config.redirectUrl]);
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.calledThrice
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden before calling completeSignOut.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(signOutSpy);
          // Confirm completeSignOut is called after progress bar is hidden.
          expect(completeSignOutSpy).to.have.been.calledOnce.and.calledAfter(hideProgressBarSpy);
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // Confirm no redirect to originalUri occurs.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Users should be signed out.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          expect(auth3.currentUser).to.be.null;
          // Confirm all stored tenants are cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // All tenants should be cleared.
          expect(tenantList).to.deep.equal([]);
        });
    });

    it('should fail on unauthorized redirect URL for multiple tenants', () => {
      // Mock domains are not authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(unauthorizedDomainError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      stubs.push(getOriginalUrlForSignOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate 3 tenants signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(tid3),
      ];

      // Create multi-tenant signout config with redirect URL.
      const config = new Config(createMockUrl('signout', apiKey, null, redirectUri, state, hl));
      multiSignOutOperationHandler = new SignOutOperationHandler(config, authenticationHandler);

      return Promise.all(addTenantsList)
        .then(() => {
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          expect(auth3.currentUser.uid).to.equal('UID3');
          return multiSignOutOperationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, singleSignOutConfig.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          // No signout should occur.
          expect(signOutSpy).to.not.have.been.called;
          // Confirm completeSignOut not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Users should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          expect(auth2.currentUser).to.not.be.null;
          expect(auth3.currentUser).to.not.be.null;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm all stored tenants remain.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1, tid2, tid3]);
        });
    });

    it('should reject for multi-tenant signout when auth.signOut() rejects', () => {
      const expectedError = new Error('signout error');
      // Mock domain authorization succeeds.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').resolves(originalUri);
      // Remove signOut spy and re-stub to reject with an error on second call.
      signOutSpy.restore();
      // Simulate second call fails.
      const signOutStub = sinon.stub(MockAuth.prototype, 'signOut');
      signOutStub.onCall(0).resolves();
      signOutStub.onCall(1).rejects(expectedError);
      signOutStub.onCall(2).resolves();
      stubs.push(signOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate 3 tenants signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(tid3),
      ];

      return Promise.all(addTenantsList)
        .then(() => {
          return multiSignOutOperationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(signOutStub);
          // Confirm current URL checked as no redirect URL is available.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce
            .and.calledWith([currentUrlOrigin]);
          // Confirm signOut is called after showing progress bar.
          expect(signOutStub).to.have.been.calledThrice.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // getOriginalUrlForSignOutStub should not be called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm only tenants corresponding to succeeding signOut calls are cleared.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Second tenant remains in storage due to signOut failure on second call.
          // Depending on order, tid1 and tid3 may or may not be removed.
          expect(tenantList).to.include(tid2);
        });
    });

    it('should fail on unauthorized redirect URL when redirectUrl and state are passed', () => {
      // Mock domains are not authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(unauthorizedDomainError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo');
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return unifiedSignOutOperationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, unifiedSignOutConfig.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          // Confirm completeSignOut not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm getSessionInfoStub not called.
          expect(getSessionInfoStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // User should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should sign out from multiple tenants or agent and redirect when state and redirectUrl are specified', () => {
      const sessionInfo = {
        originalUri,
        // Users from each of these tenants will be signed out at the end of the flow.
        tenantIds: [tid1, tid2, agentId],
      };
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfo);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate 3 tenant and one top level project users signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(agentId),
        authTenantsStorageManager.addTenant(tid3),
      ];

      return Promise.all(addTenantsList)
        .then(() => {
          // Users should be signed in initially.
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          expect(auth3.currentUser.uid).to.equal('UID3');
          expect(agentAuth.currentUser.uid).to.equal('UID_AGENT');
          return unifiedSignOutOperationHandler.start();
        })
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledTwice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, unifiedSignOutConfig.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getSessionInfo result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].getSessionInfo);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.GetSessionInfo);

          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, unifiedSignOutConfig.redirectUrl]);
          // Progress bar should not be hidden.
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.calledThrice
            .and.calledAfter(getSessionInfoStub);

          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledBefore(signOutSpy)
            .and.calledWith(unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state);
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(window, originalUri);
          // Users should be signed out except for 4th tenant.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          expect(agentAuth.currentUser).to.be.null;
          expect(auth3.currentUser.uid).to.equal('UID3');
          // Confirm only resource associated tenants are cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Only one tenant not associated with current resource should remain in storage.
          expect(tenantList).to.deep.equal([tid3]);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return unifiedSignOutOperationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(getSessionInfoStub).to.be.calledOnce;
        });
    });

    it('should use expected SharedSettings reference', () => {
      const sessionInfo = {
        originalUri,
        // Users from each of these tenants will be signed out at the end of the flow.
        tenantIds: [tid1, tid2, agentId],
      };
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfo);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate 3 tenant and one top level project users signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(agentId),
        authTenantsStorageManager.addTenant(tid3),
      ];

      unifiedSignOutOperationHandler = new SignOutOperationHandler(
          unifiedSignOutConfig, authenticationHandler, sharedSettings);

      return Promise.all(addTenantsList)
        .then(() => {
          // Users should be signed in initially.
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          expect(auth3.currentUser.uid).to.equal('UID3');
          expect(agentAuth.currentUser.uid).to.equal('UID_AGENT');
          return unifiedSignOutOperationHandler.start();
        })
        .then(() => {
          // Confirm SharedSettings cache used.
          expect(cacheAndReturnResultSpy.getCall(0).thisValue)
            .to.equal(sharedSettings.cache);
          // Confirm SharedSettings gcipRequest used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub.getCall(0).thisValue)
            .to.equal(sharedSettings.gcipRequest);
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, unifiedSignOutConfig.redirectUrl]);
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.calledThrice
            .and.calledAfter(getSessionInfoStub);

          // Confirm SharedSettings iapRequest used.
          expect(getSessionInfoStub.getCall(0).thisValue).to.equal(sharedSettings.iapRequest);
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledBefore(signOutSpy)
            .and.calledWith(unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state);
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(window, originalUri);
          // Users should be signed out except for 4th tenant.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          expect(agentAuth.currentUser).to.be.null;
          expect(auth3.currentUser.uid).to.equal('UID3');
        });
    });

    it('should reject when state and redirectUrl are specified but getSessionInfo rejects', () => {
      const sessionInfo = {
        originalUri,
        // Users from each of these tenants will be signed out at the end of the flow.
        tenantIds: [tid1, tid2],
      };
      let caughtError: CIAPError;
      // Simulate recoverable error.
      const expectedError = new HttpCIAPError(504);
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo');
      // Fail on first try and succeed on second.
      getSessionInfoStub.onFirstCall().rejects(expectedError);
      getSessionInfoStub.onSecondCall().resolves(sessionInfo);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant('OTHER_TENANT_ID'),
      ];

      // Simulate another tenant previously signed in and saved in storage.
      return Promise.all(addTenantsList)
        .then(() => {
          expect(auth1.currentUser.uid).to.equal('UID1');
          expect(auth2.currentUser.uid).to.equal('UID2');
          return unifiedSignOutOperationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          caughtError = error;
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, unifiedSignOutConfig.redirectUrl]);
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is not called yet.
          expect(signOutSpy).to.not.have.been.called;
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Users should not be signed out.
          expect(auth1.currentUser).to.not.be.null;
          expect(auth2.currentUser).to.not.be.null;
          // Progress bar should be hidden when the error is detected.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(getSessionInfoStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          expect(startSpy).to.be.calledOnce;
          expect(caughtError).to.haveOwnProperty('retry');
          // Confirm expected tenant IDs are not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1, tid2, 'OTHER_TENANT_ID']);
          // Try again to confirm caching behavior.
          return (caughtError as any).retry();
        })
        .then(() => {
          expect(startSpy).to.be.calledTwice;
          expect(startSpy.getCall(0).thisValue).to.equal(unifiedSignOutOperationHandler);
          // Only getSessionInfoStub call should retry.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
          expect(getSessionInfoStub).to.have.been.calledTwice;
          expect(getSessionInfoStub.getCalls()[1].args)
            .to.deep.equal([unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state]);
          expect(signOutSpy).to.have.been.calledTwice;
          // Users should be signed out.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          // Confirm redirect to originalUri.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(window, originalUri);
          // Confirm expected tenant IDs are cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
         // Other tenant ID should remain in storage.
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID']);
        });
    });

    it('should reject for signout with redirect URL and state when auth.signOut() rejects', () => {
      const sessionInfo = {
        originalUri,
        // Users from each of these tenants will be signed out at the end of the flow.
        tenantIds: [tid1, tid2, tid3],
      };
      const expectedError = new Error('signout error');
      // Mock domain authorization succeeds.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfo);
      // Remove signOut spy and re-stub to reject with an error on second call.
      signOutSpy.restore();
      // Simulate second call fails.
      const signOutStub = sinon.stub(MockAuth.prototype, 'signOut');
      signOutStub.onCall(0).resolves();
      signOutStub.onCall(1).rejects(expectedError);
      signOutStub.onCall(2).resolves();
      stubs.push(signOutStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate 2 tenants signed in and saved in storage.
      const addTenantsList = [
        authTenantsStorageManager.addTenant(tid1),
        authTenantsStorageManager.addTenant(tid2),
        authTenantsStorageManager.addTenant(tid3),
      ];

      return Promise.all(addTenantsList)
        .then(() => {
          return unifiedSignOutOperationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(getSessionInfoStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, unifiedSignOutConfig.redirectUrl]);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // getSessionInfo should be called once.
          expect(getSessionInfoStub).to.have.been.calledOnce.and.calledWith(
              unifiedSignOutConfig.redirectUrl, unifiedSignOutConfig.state);
          // signOut should have been called thrice.
          expect(signOutStub).to.have.been.calledThrice
            .and.calledAfter(getSessionInfoStub);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Second tenant remains in storage due to signOut failure on second call.
          // Depending on order, tid1 and tid3 may or may not be removed.
          expect(tenantList).to.include(tid2);
        });
    });
  });
});
