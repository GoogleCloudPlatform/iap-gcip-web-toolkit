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
import { SignInOperationHandler } from '../../../src/ciap/sign-in-handler';
import { OperationType, CacheDuration } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuth,
  createMockUser, MockUser, MockAuthenticationHandler, createMockStorageManager,
} from '../../resources/utils';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { HttpCIAPError, CLIENT_ERROR_CODES, CIAPError } from '../../../src/utils/error';
import * as storageManager from '../../../src/storage/manager';
import * as authTenantsStorage from '../../../src/ciap/auth-tenants-storage';
import { PromiseCache } from '../../../src/utils/promise-cache';

describe('SignInOperationHandler', () => {
  const stubs: sinon.SinonStub[] = [];
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));
  let auth: MockAuth;
  let user: MockUser;
  let authenticationHandler: MockAuthenticationHandler;
  let operationHandler: SignInOperationHandler;
  const redirectServerResp = {
    originalUri: 'https://www.example.com/path/main',
    targetUri: 'https://www.example.com/path/main/_gcp_iap/cicp_auth',
    redirectToken: 'REDIRECT_TOKEN',
  };
  let tenant2Auth: {[key: string]: FirebaseAuth};
  let startSignInSpy: sinon.SinonSpy;
  let processUserSpy: sinon.SinonSpy;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let mockStorageManager: storageManager.StorageManager;
  let authTenantsStorageManager: authTenantsStorage.AuthTenantsStorageManager;
  const currentUrl = utils.getCurrentUrl(window);
  const projectId = 'PROJECT_ID';
  let cacheAndReturnResultSpy: sinon.SinonSpy;
  let startSpy: sinon.SinonSpy;

  beforeEach(() => {
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

    // Listen to startSignIn calls.
    startSignInSpy = sinon.spy(MockAuthenticationHandler.prototype, 'startSignIn');
    processUserSpy = sinon.spy(MockAuthenticationHandler.prototype, 'processUser');
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    cacheAndReturnResultSpy = sinon.spy(PromiseCache.prototype, 'cacheAndReturnResult');
    startSpy = sinon.spy(SignInOperationHandler.prototype, 'start');
    auth = createMockAuth(apiKey, tid);
    tenant2Auth = {};
    tenant2Auth[tid] = auth;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    operationHandler = new SignInOperationHandler(config, authenticationHandler);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    startSignInSpy.restore();
    processUserSpy.restore();
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    cacheAndReturnResultSpy.restore();
    startSpy.restore();
  });

  it('should not throw on initialization with valid configuration', () => {
    expect(() => {
      return new SignInOperationHandler(config, authenticationHandler);
    }).not.to.throw();
  });

  it('should throw on initialization with invalid tenant ID', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('login', apiKey, 'invalidTenantId', redirectUri, state, hl));
      return new SignInOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  it('should throw on initialization with no redirectUrl', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('login', apiKey, tid, null, state, hl));
      return new SignInOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  it('should throw on initialization with no state', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('login', apiKey, tid, redirectUri, null, hl));
      return new SignInOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  describe('type', () => {
    it('should return OperationType.SignIn', () => {
      expect(operationHandler.type).to.equal(OperationType.SignIn);
    });
  });

  describe('start()', () => {
    const unauthorizedDomainError = new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'Unauthorized domain');
    it('should fail on unauthorized redirect URL if no user is signed in', () => {
      // Mock domains are not authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(unauthorizedDomainError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          expect(startSignInSpy).to.not.have.been.called;
          expect(processUserSpy).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should fail on unauthorized redirect URL if user is signed in', () => {
      // Mock domains are not authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(unauthorizedDomainError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Simulate user is signed in.
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          expect(startSignInSpy).to.not.have.been.called;
          expect(processUserSpy).to.not.have.been.called;
          // Progress bar hidden on error thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should call authenticationHandler startSignIn when user is signed in and re-auth is required', () => {
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      const reauthConfig = new Config(createMockUrl('reauth', apiKey, tid, redirectUri, state, hl));
      operationHandler = new SignInOperationHandler(reauthConfig, authenticationHandler, true);

      return operationHandler.start()
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
            // Progress bar should be hidden before startSignIn.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // startSignIn should be called even though a user is already signed in, since
          // re-auth is required.
          expect(startSignInSpy).to.have.been.calledOnce.and.calledWith(auth);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
            .and.calledWith(auth.currentUser)
            .and.calledAfter(startSignInSpy)
            .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // ID token for processed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members([tid]);
        });
    });

    it('should succeed when AuthenticationHandler processUser is not provided', () => {
      // Simulate processUser method not implemented.
      authenticationHandler.processUser = null;
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      const reauthConfig = new Config(createMockUrl('reauth', apiKey, tid, redirectUri, state, hl));
      operationHandler = new SignInOperationHandler(reauthConfig, authenticationHandler, true);

      return operationHandler.start()
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
            // Progress bar should be hidden before startSignIn.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // startSignIn should be called even though a user is already signed in, since
          // re-auth is required.
          expect(startSignInSpy).to.have.been.calledOnce.and.calledWith(auth);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // processUserSpy should not be called.
          expect(processUserSpy).to.not.have.been.called;
          // ID token for unprocessed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members([tid]);
        });
    });

    it('should call authenticationHandler startSignIn when existing user has mismatching tenant ID', () => {
      const matchingUser = createMockUser('UID1', 'ID_TOKEN1', tid);
      // Set current user with mismatching tenant ID.
      auth.setCurrentMockUser(createMockUser('UID2', 'ID_TOKEN2', 'MISMATCHING_TENANT_ID'));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      authenticationHandler = createMockAuthenticationHandler(
          tenant2Auth,
          // onStartSignIn simulates user signing in with matching user.
          () => auth.setCurrentMockUser(matchingUser));

      operationHandler = new SignInOperationHandler(config, authenticationHandler);

      return operationHandler.start()
        .then(() => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Progress bar should be hidden before startSignIn.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // startSignIn should be called even though a user is already signed in, since
          // that user has mismatching tenant ID.
          expect(startSignInSpy).to.have.been.calledOnce.and.calledWith(auth);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
            .and.calledWith(auth.currentUser)
            .and.calledAfter(startSignInSpy)
            .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // ID token for processed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members([tid]);
        });
    });

    it('should finish sign in when authenticationHandler startSignIn triggers', () => {
      user = createMockUser('UID1', 'ID_TOKEN1', tid);
      tenant2Auth[tid] = auth;
      authenticationHandler = createMockAuthenticationHandler(
          tenant2Auth,
          // onStartSignIn simulates user signing in.
          () => auth.setCurrentMockUser(user));
      operationHandler = new SignInOperationHandler(config, authenticationHandler);
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate some other tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return operationHandler.start();
        })
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledThrice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(CICPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrl, config.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getOriginalUrlForSignOut result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].exchangeIdTokenAndGetOriginalAndTargetUrl);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          // ID token for processed user should be used.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.ExchangeIdToken);
          // Expect setCookieAtTargetUrl to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[2].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[2].args[1].setCookieAtTargetUrl);
          expect(cacheAndReturnResultSpy.getCalls()[2].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[2].args[2])
            .to.deep.equal([redirectServerResp.targetUri, redirectServerResp.redirectToken]);
          expect(cacheAndReturnResultSpy.getCalls()[2].args[3]).to.equal(CacheDuration.SetCookie);

          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Progress bar should be hidden before user is asked to sign-in.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // Confirm startSignIn is called.
          expect(startSignInSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
            .and.calledWith(auth.currentUser)
            .and.calledAfter(startSignInSpy)
            .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // Confirm ID token for processed user exchanged.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          // Confirm set cookie endpoint called.
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success along with the other existing tenant ID.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members(['OTHER_TENANT_ID', tid]);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return operationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub).to.be.calledOnce;
          expect(setCookieAtTargetUrlStub).to.be.calledOnce;
        });
    });

    it('should reject when authenticationHandler startSignIn resolves with a mismatching user tenant ID', () => {
      user = createMockUser('UID1', 'ID_TOKEN1', 'MISMATCHING_TENANT_ID');
      tenant2Auth[tid] = auth;
      authenticationHandler = createMockAuthenticationHandler(
          tenant2Auth,
          // onStartSignIn simulates user signing in.
          () => auth.setCurrentMockUser(user));
      operationHandler = new SignInOperationHandler(config, authenticationHandler);
      // Mock domain is authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate some other tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return operationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Expected tenant mismatch error should be thrown.
          expect(error).to.have.property('message', 'Mismatching tenant ID');
          expect(error).to.have.property('code', 'invalid-argument');
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Progress bar should be hidden before user is asked to sign-in.
          expect(hideProgressBarSpy).to.have.been.calledTwice.and.calledBefore(startSignInSpy);
          // Confirm startSignIn is called.
          expect(startSignInSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(processUserSpy).to.not.have.been.called;
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // Confirm progress bar hidden after sign in returns mismatching user.
          expect(hideProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub).to.not.have.been.called;
          // Confirm set cookie endpoint called.
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm no new tenant ID is stored.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members(['OTHER_TENANT_ID']);
        });
    });

    it('should reject when authenticationHandler processUser resolves with a mismatching user tenant ID', () => {
      const mismatchUser = createMockUser('UID1', 'ID_TOKEN1', 'MISMATCHING_TENANT_ID');
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domain is authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate processUser resolves with mismatching user.
      processUserSpy.restore();
      const processUserStub = sinon.stub(MockAuthenticationHandler.prototype, 'processUser')
        .resolves(mismatchUser);
      stubs.push(processUserStub);

      // Simulate some other tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return operationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Expected tenant mismatch error should be thrown.
          expect(error).to.have.property('message', 'Mismatching tenant ID');
          expect(error).to.have.property('code', 'invalid-argument');
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Confirm startSignIn is not called.
          expect(startSignInSpy).to.not.have.been.called;
          // processUser should be called once afterwards.
          expect(processUserStub).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm progress bar hidden after processUser returns mismatching user.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(processUserStub);
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub).to.not.have.been.called;
          // Confirm set cookie endpoint called.
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm no new tenant ID is stored.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members(['OTHER_TENANT_ID']);
        });
    });

    it('should finish sign in when ID token is already available', () => {
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // When ID token is already available, the tenant ID is likely already stored.
      return authTenantsStorageManager.addTenant(tid)
        .then(() => {
          return operationHandler.start();
        })
        .then(() => {
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          // Since ID token is available, startSignIn should not be called.
          expect(startSignInSpy).to.not.have.been.called;
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
            .and.calledWith(auth.currentUser)
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // ID token for processed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID remains after success.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.have.same.members([tid]);
        });
    });

    it('should reject when isAuthorizedDomain rejects', () => {
      const expectedError = new HttpCIAPError(504);
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').rejects(expectedError);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
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
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          expect(startSignInSpy).to.not.have.been.called;
          expect(processUserSpy).to.not.have.been.called;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.not.have.been.called;
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm the tenant ID is not stored.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([]);
        });
    });

    it('should reject when exchangeIdTokenAndGetOriginalAndTargetUrl rejects', () => {
      let caughtError: CIAPError;
      // Simulate recoverable error.
      const expectedError = new HttpCIAPError(504);
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl');
      // Fail on first try and succeed on second.
      exchangeIdTokenAndGetOriginalAndTargetUrlStub.onFirstCall().rejects(expectedError);
      exchangeIdTokenAndGetOriginalAndTargetUrlStub.onSecondCall().resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Simulate another tenant previously signed in and saved in storage.
      return authTenantsStorageManager.addTenant('OTHER_TENANT_ID')
        .then(() => {
          return operationHandler.start();
        })
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          caughtError = error;
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          expect(error).to.equal(expectedError);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          expect(startSignInSpy).to.not.have.been.called;
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
            .and.calledWith(auth.currentUser)
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // ID token for processed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm existing tenant remains in storage.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID']);
          expect(startSpy).to.be.calledOnce;
          expect(caughtError).to.haveOwnProperty('retry');
          // Try again to confirm caching behavior.
          return (caughtError as any).retry();
        })
        .then(() => {
          expect(startSpy).to.be.calledTwice;
          expect(startSpy.getCall(0).thisValue).to.equal(operationHandler);
          // Cached result returned for checkAuthorizedDomainsAndGetProjectId.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
          // User should be processed again.
          expect(processUserSpy).to.have.been.calledTwice;
          expect(processUserSpy.secondCall).calledWith(auth.currentUser);
          // Second call made for failing exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub).to.have.been.calledTwice;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub.getCalls()[1].args)
            .to.deep.equal([config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state]);
          // Confirm set cookie endpoint called.
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success along with the other existing tenant ID.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal(['OTHER_TENANT_ID', config.tid]);
        });
    });

    it('should reject when setCookieAtTargetUrl rejects', () => {
      const expectedError = new HttpCIAPError(
          400, 'RESOURCE_MISSING_CICP_TENANT_ID', 'message');
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1', tid));
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          CICPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub = sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl');
      // Fail on first try and succeed on second.
      setCookieAtTargetUrlStub.onFirstCall().rejects(expectedError);
      setCookieAtTargetUrlStub.onSecondCall().resolves();
      stubs.push(setCookieAtTargetUrlStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrl, config.redirectUrl]);
          expect(startSignInSpy).to.not.have.been.called;
          // User should be processed before calling exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(processUserSpy).to.have.been.calledOnce
           .and.calledWith(auth.currentUser)
           .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
           .and.calledBefore(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // ID token for processed user should be used.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(processUserSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1-processed', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          // Confirm the tenant ID is not stored.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([]);
          // Try again to confirm retry for setCookieAtTargetUrl.
          return operationHandler.start();
        })
        .then(() => {
          // Cached result returned for checkAuthorizedDomainsAndGetProjectId.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
          // Cached result returned for exchangeIdTokenAndGetOriginalAndTargetUrl.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub).to.have.been.calledOnce;
          // User should be processed again.
          expect(processUserSpy).to.have.been.calledTwice;
          expect(processUserSpy.getCalls()[1]).calledWith(auth.currentUser);
          // Confirm set cookie endpoint called again.
          expect(setCookieAtTargetUrlStub).to.have.been.calledTwice;
          expect(setCookieAtTargetUrlStub.getCalls()[1].args)
            .to.deep.equal([redirectServerResp.targetUri, redirectServerResp.redirectToken]);
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
          // Confirm expected tenant ID stored after success.
          return authTenantsStorageManager.listTenants();
        })
        .then((tenantList: string[]) => {
          expect(tenantList).to.deep.equal([config.tid]);
        });
    });
  });
});
