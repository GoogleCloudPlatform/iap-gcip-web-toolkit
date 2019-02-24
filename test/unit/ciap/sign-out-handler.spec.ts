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
import { OperationType } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuth,
  createMockUser, MockAuthenticationHandler, createMockStorageManager,
} from '../../resources/utils';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import { HttpCIAPError } from '../../../src/utils/error';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';

describe('SignOutOperationHandler', () => {
  const stubs: sinon.SinonStub[] = [];
  const apiKey = 'API_KEY';
  const tid1 = 'TENANT_ID1';
  const tid2 = 'TENANT_ID2';
  const tid3 = 'TENANT_ID3';
  const state = 'STATE';
  const hl = 'en-US';
  const originalUri = 'https://www.example.com/path/main';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid1}:handleRedirect`;
  const singleSignOutConfig = new Config(createMockUrl('signout', apiKey, tid1, redirectUri, state, hl));
  const multiSignOutConfig = new Config(createMockUrl('signout', apiKey, null, null, null, hl));
  let auth1: MockAuth;
  let auth2: MockAuth;
  let auth3: MockAuth;
  let authenticationHandler: MockAuthenticationHandler;
  let singleSignOutOperationHandler: SignOutOperationHandler;
  let multiSignOutOperationHandler: SignOutOperationHandler;
  let tenant2Auth: {[key: string]: FirebaseAuth};
  let completeSignOutSpy: sinon.SinonSpy;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let signOutSpy: sinon.SinonSpy;
  let mockStorageManager: storageManager.StorageManager;
  let authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager;

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
    // Listen to auth.signOut calls.
    signOutSpy = sinon.spy(MockAuth.prototype, 'signOut');
    // Listen to completeSignOut, showProgressBar and hideProgressBar.
    completeSignOutSpy = sinon.spy(MockAuthenticationHandler.prototype, 'completeSignOut');
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    auth1 = createMockAuth(tid1);
    auth2 = createMockAuth(tid2);
    auth3 = createMockAuth(tid3);
    // Simulate user already signed in on each instance.
    auth1.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
    auth2.setCurrentMockUser(createMockUser('UID2', 'ID_TOKEN2'));
    auth3.setCurrentMockUser(createMockUser('UID3', 'ID_TOKEN3'));
    tenant2Auth = {};
    tenant2Auth[tid1] = auth1;
    tenant2Auth[tid2] = auth2;
    tenant2Auth[tid3] = auth3;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    singleSignOutOperationHandler = new SignOutOperationHandler(singleSignOutConfig, authenticationHandler);
    multiSignOutOperationHandler = new SignOutOperationHandler(multiSignOutConfig, authenticationHandler);
    // Simulate tenant previously signed in and saved in storage.
    return authTenantsStorageManager.addTenant(tid1);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    completeSignOutSpy.restore();
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    signOutSpy.restore();
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
    }).to.throw();
  });

  it('should throw on single tenant with redirect initialization with no state', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('signout', apiKey, tid1, redirectUri, null, hl));
      return new SignOutOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw();
  });

  describe('type', () => {
    it('should return OperationType.SignOut', () => {
      expect(singleSignOutOperationHandler.type).to.equal(OperationType.SignOut);
    });
  });

  describe('start()', () => {
    it('should fail on unauthorized redirect URL for single tenant', () => {
      // Mock domain is not authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(false);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
          // Expected error should be thrown.
          expect(error).to.have.property('message', 'unauthorized');
          // Confirm completeSignOut not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // User should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should sign out from single tenant and redirect when tenant ID and redirectUrl are specified', () => {
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
          // Progress bar should not be hidden.
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.called.and.calledAfter(isAuthorizedDomainStub);
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
        });
    });

    it('should sign out from single tenant and not redirect when tenant ID and no redirectUrl are specified', () => {
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          expect(signOutSpy).to.have.been.called.and.calledAfter(showProgressBarSpy);
          // Confirm redirect URL check is skipped.
          expect(isAuthorizedDomainStub).to.not.have.been.called;
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

    it('should reject when isAuthorizedDomain rejects', () => {
      const expectedError = new HttpCIAPError(504);
      // Mock domain authorization check throws an error.
      const isAuthorizedDomainStub =
          sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').rejects(expectedError);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
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
      const isAuthorizedDomainStub =
          sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // signOut should have been called once.
          expect(signOutStub).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // getOriginalUrlForSignOutStub should not be called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm stored tenant ID is not cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([tid1]);
        });
    });

    it('should reject when getOriginalUrlForSignOutStub rejects', () => {
      const expectedError = new HttpCIAPError(504);
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
      // Mock getOriginalUrlForSignOut API.
      const getOriginalUrlForSignOutStub =
          sinon.stub(IAPRequestHandler.prototype, 'getOriginalUrlForSignOut').rejects(expectedError);
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
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
          // Confirm completeSignOut is not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.called.and.calledAfter(isAuthorizedDomainStub);
          // Confirm getOriginalUrlForSignOutStub called.
          expect(getOriginalUrlForSignOutStub)
            .to.have.been.calledOnce.and.calledAfter(signOutSpy)
            .and.calledWith(singleSignOutConfig.redirectUrl, singleSignOutConfig.tid, singleSignOutConfig.state);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // User should be signed out.
          expect(auth1.currentUser).to.be.null;
          // Progress bar should be hidden when the error is detected.
          expect(hideProgressBarSpy) .to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub);
          // Confirm stored tenant ID is cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // Other tenant ID should remain in storage.
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID']);
        });
    });

    it('should sign out from all tenants when no tenant ID is specified', () => {
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(signOutSpy);
          // Confirm signOut is called after showing progress bar.
          expect(signOutSpy).to.have.been.calledThrice.and.calledAfter(showProgressBarSpy);
          // Progress bar should be hidden before compleSignOut is called.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(signOutSpy);
          // Confirm completeSignOut is called after progress bar is hidden.
          expect(completeSignOutSpy).to.have.been.calledOnce.and.calledAfter(hideProgressBarSpy);
          // Confirm redirect URL is not checked since it's not available.
          expect(isAuthorizedDomainStub).to.not.have.been.called;
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // Confirm no redirect to originalUri occurs.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Users should be signed out.
          expect(auth1.currentUser).to.be.null;
          expect(auth2.currentUser).to.be.null;
          expect(auth3.currentUser).to.be.null;
          // Confirm all tenants are cleared from storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          // All tenants should be cleared.
          expect(tenantList).to.deep.equal([]);
        });
    });

    it('should not redirect to redirectUrl on multi-tenant signout', () => {
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
      const config = new Config(createMockUrl('signout', apiKey, null, redirectUri, state, hl));
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          // Confirm signOut is called after confirming redirect URL authorization.
          expect(signOutSpy).to.have.been.calledThrice.and.calledAfter(isAuthorizedDomainStub);
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
      // Mock domain is not authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(false);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(singleSignOutConfig.redirectUrl);
          // Expected error should be thrown.
          expect(error).to.have.property('message', 'unauthorized');
          // No signout should occur.
          expect(signOutSpy).to.not.have.been.called;
          // Confirm completeSignOut not called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // Confirm getOriginalUrlForSignOutStub not called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // Users should still be signed in.
          expect(auth1.currentUser).to.not.be.null;
          expect(auth2.currentUser).to.not.be.null;
          expect(auth3.currentUser).to.not.be.null;
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
      const isAuthorizedDomainStub =
          sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          // Confirm redirect URL is not checked as no redirect URL is available.
          expect(isAuthorizedDomainStub).to.not.have.been.called;
          // Confirm signOut is called after showing progress bar.
          expect(signOutStub).to.have.been.calledThrice.and.calledAfter(showProgressBarSpy);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // completeSignOut should not be called.
          expect(completeSignOutSpy).to.not.have.been.called;
          // getOriginalUrlForSignOutStub should not be called.
          expect(getOriginalUrlForSignOutStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm only tenants corresponding to succeeding signOut calls are cleared.
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
