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
import { SelectAuthSessionOperationHandler } from '../../../src/ciap/select-auth-session-handler';
import { OperationType, CacheDuration } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuth,
  MockAuthenticationHandler,
} from '../../resources/utils';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { GCIPRequestHandler } from '../../../src/ciap/gcip-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import { HttpCIAPError, CLIENT_ERROR_CODES, CIAPError } from '../../../src/utils/error';
import { PromiseCache } from '../../../src/utils/promise-cache';
import { AuthenticationHandler } from '../../../src/ciap/authentication-handler';
import { SharedSettings } from '../../../src/ciap/shared-settings';

describe('SelectAuthSessionOperationHandler', () => {
  let sharedSettings: SharedSettings;
  let pushstateCallbacks: sinon.SinonSpy[] = [];
  const stubs: sinon.SinonStub[] = [];
  const originalUri = 'https://project-id.appspot.com/path/file';
  const projectId = 'PROJECT_ID';
  const apiKey = 'API_KEY';
  const tid1 = 'TENANT_ID1';
  const tid2 = 'TENANT_ID2';
  const tid3 = 'TENANT_ID3';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/gcip/resources/RESOURCE_HASH:handleRedirect`;
  const parentProjectId = `_${projectId}`;
  const sessionInfoResponse = {
    originalUri,
    tenantIds: [tid1, tid2, tid3, parentProjectId],
  };
  const selectedTenantInfo = {
    email: 'user@example.com',
    tenantId: tid2,
    providerIds: ['saml.my-provider', 'oidc.provider'],
  };
  const selectedTenantInfoHash =
      `#hint=${selectedTenantInfo.email};${(selectedTenantInfo.providerIds || []).join(',')}`;
  const selectAuthSessionConfig = new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl));
  let auth1: MockAuth;
  let auth2: MockAuth;
  let auth3: MockAuth;
  let parentProjectAuth: MockAuth;
  let authenticationHandler: MockAuthenticationHandler;
  let operationHandler: SelectAuthSessionOperationHandler;
  let tenant2Auth: {[key: string]: FirebaseAuth};
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let selectProviderSpy: sinon.SinonSpy;
  let cacheAndReturnResultSpy: sinon.SinonSpy;
  const currentUrl = 'https://auth.example.com:8080/signin' +
      `?mode=selectAuthSession&apiKey=${encodeURIComponent(apiKey)}` +
      `&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const currentUrlOrigin = 'https://auth.example.com:8080';
  let startSpy: sinon.SinonSpy;
  let getCurrentUrlStub: sinon.SinonStub;
  const projectConfig = {
    projectId,
    apiKey,
  };
  let isHistoryAndCustomEventSupportedStub: sinon.SinonStub;

  beforeEach(() => {
    sharedSettings = new SharedSettings(apiKey);
    getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
    stubs.push(getCurrentUrlStub);
    // Simulate history API is not supported as the default case.
    isHistoryAndCustomEventSupportedStub = sinon.stub(utils, 'isHistoryAndCustomEventSupported').returns(false);
    stubs.push(isHistoryAndCustomEventSupportedStub);
    // Listen to selectProvider, showProgressBar and hideProgressBar.
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    selectProviderSpy = sinon.spy(MockAuthenticationHandler.prototype, 'selectProvider');
    cacheAndReturnResultSpy = sinon.spy(PromiseCache.prototype, 'cacheAndReturnResult');
    startSpy = sinon.spy(SelectAuthSessionOperationHandler.prototype, 'start');
    auth1 = createMockAuth(apiKey, tid1);
    auth2 = createMockAuth(apiKey, tid2);
    auth3 = createMockAuth(apiKey, tid3);
    parentProjectAuth = createMockAuth(apiKey, null);
    tenant2Auth = {};
    tenant2Auth[tid1] = auth1;
    tenant2Auth[tid2] = auth2;
    tenant2Auth[tid3] = auth3;
    tenant2Auth._ = parentProjectAuth;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth, null, selectedTenantInfo);
    operationHandler = new SelectAuthSessionOperationHandler(selectAuthSessionConfig, authenticationHandler);
  });

  afterEach(() => {
    pushstateCallbacks.forEach((callback) => {
      window.removeEventListener('pushstate', callback);
    });
    pushstateCallbacks = [];
    stubs.forEach((s) => s.restore());
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
    selectProviderSpy.restore();
    cacheAndReturnResultSpy.restore();
    startSpy.restore();
  });

  it('should not throw on initialization', () => {
    expect(() => {
      return new SelectAuthSessionOperationHandler(selectAuthSessionConfig, authenticationHandler);
    }).not.to.throw;
  });

  it('should throw on initialization with no state', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, null, null));
      return new SelectAuthSessionOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  it('should throw on initialization with no redirectUrl', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('selectAuthSession', apiKey, null, null, state, null));
      return new SelectAuthSessionOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw().to.have.property('code', 'invalid-argument');
  });

  describe('type', () => {
    it('should return OperationType.SelectAuthSession', () => {
      expect(operationHandler.type).to.equal(OperationType.SelectAuthSession);
    });
  });

  describe('start()', () => {
    const unauthorizedDomainError = new CIAPError(CLIENT_ERROR_CODES['permission-denied'], 'Unauthorized domain');
    it('should fail on unauthorized redirect URL', () => {
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
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Expected error should be thrown.
          expect(error).to.equal(unauthorizedDomainError);
          // Confirm selectProvider not called.
          expect(selectProviderSpy).to.not.have.been.called;
          // Confirm getSessionInfoStub not called.
          expect(getSessionInfoStub).to.not.have.been.called;
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should reject when getSessionInfo resolves with an empty tenant list', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API resolves with empty list of tenantIds.
      const getSessionInfoStub = sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo')
        .resolves({tenantIds: [], originalUri});
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'No tenants configured on resource.');
          expect(error).to.have.property('code', 'internal');
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Confirm selectProvider not called.
          expect(selectProviderSpy).to.not.have.been.called;
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should reject when mismatching tenant ID is selected', () => {
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API resolves with tenantIds that do not match selected one.
      const getSessionInfoStub = sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo')
        .resolves({tenantIds: [tid1, tid3], originalUri});
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.have.property('message', 'Mismatching tenant ID');
          expect(error).to.have.property('code', 'invalid-argument');
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          // Confirm selectProvider is called.
          expect(selectProviderSpy).to.have.been.calledOnce
            .and.calledWith(projectConfig, [tid1, tid3])
            .and.calledAfter(getSessionInfoStub);
          // No redirect should occur.
          expect(setCurrentUrlStub).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
        });
    });

    it('should use expected SharedSettings reference', () => {
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          `&tid=${encodeURIComponent(selectedTenantInfo.tenantId)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `${selectedTenantInfoHash}`;
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      operationHandler = new SelectAuthSessionOperationHandler(
          selectAuthSessionConfig, authenticationHandler, sharedSettings);
      return operationHandler.start()
        .then(() => {
          // Confirm SharedSettings cache used.
          expect(cacheAndReturnResultSpy.getCall(0).thisValue)
            .to.equal(sharedSettings.cache);
          // Confirm SharedSettings gcipRequest used.
          expect(checkAuthorizedDomainsAndGetProjectIdStub.getCall(0).thisValue)
            .to.equal(sharedSettings.gcipRequest);
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Confirm SharedSettings iapRequest used.
          expect(getSessionInfoStub.getCall(0).thisValue).to.equal(sharedSettings.iapRequest);
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          expect(selectProviderSpy).to.have.been.calledOnce
            .and.calledWith(projectConfig, sessionInfoResponse.tenantIds)
            .and.calledBefore(setCurrentUrlStub)
            .and.calledAfter(getSessionInfoStub);
          // Confirm redirect to expected sign-in URL.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedSignInUrl);
        });
    });

    it('should redirect to the expected sign-in URL with hash on successful selection for old browsers', () => {
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          `&tid=${encodeURIComponent(selectedTenantInfo.tenantId)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `${selectedTenantInfoHash}`;
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledTwice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, selectAuthSessionConfig.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getSessionInfo result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].getSessionInfo);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.GetSessionInfo);
          // Progress bar should be shown on initialization and after SelectedTenantInfo is returned.
          expect(showProgressBarSpy).to.have.been.calledTwice;
          expect(showProgressBarSpy).to.have.been.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          expect(showProgressBarSpy).to.have.been.calledAfter(selectProviderSpy);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Progress bar should be hidden after sessionInfoResponse is returned and before selectProvider.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(getSessionInfoStub)
            .and.calledBefore(selectProviderSpy);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          expect(selectProviderSpy).to.have.been.calledOnce
            .and.calledWith(projectConfig, sessionInfoResponse.tenantIds)
            .and.calledBefore(setCurrentUrlStub)
            .and.calledAfter(getSessionInfoStub);
          // Confirm redirect to expected sign-in URL.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedSignInUrl);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return operationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(getSessionInfoStub).to.be.calledOnce;
        });
    });

    it('should pushState to the expected sign-in URL on successful selection for modern browsers', () => {
      const pushstateCallback = sinon.spy();
      const expectedData = {
        state: 'signIn',
        selectedTenantInfo,
      };
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          `&tid=${encodeURIComponent(selectedTenantInfo.tenantId)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}`;
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate history API supported.
      isHistoryAndCustomEventSupportedStub.returns(true);
      const pushHistoryStateStub = sinon.stub(utils, 'pushHistoryState');
      stubs.push(pushHistoryStateStub);
      window.addEventListener('pushstate', pushstateCallback);
      // Keep track of callback so it can be removed after each test.
      pushstateCallbacks.push(pushstateCallback);

      return operationHandler.start()
        .then(() => {
          // Expect checkAuthorizedDomainsAndGetProjectId result to be cached for 30 mins.
          expect(cacheAndReturnResultSpy).to.be.calledTwice;
          expect(cacheAndReturnResultSpy.getCalls()[0].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[0].args[1].checkAuthorizedDomainsAndGetProjectId);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[1]).to.be.instanceof(GCIPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[2])
            .to.deep.equal([[currentUrlOrigin, selectAuthSessionConfig.redirectUrl]]);
          expect(cacheAndReturnResultSpy.getCalls()[0].args[3]).to.equal(CacheDuration.CheckAuthorizedDomains);
          // Expect getSessionInfo result to be cached for 5 mins.
          expect(cacheAndReturnResultSpy.getCalls()[1].args[0]).to.equal(
              cacheAndReturnResultSpy.getCalls()[1].args[1].getSessionInfo);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[1]).to.be.instanceof(IAPRequestHandler);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[2])
            .to.deep.equal([selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state]);
          expect(cacheAndReturnResultSpy.getCalls()[1].args[3]).to.equal(CacheDuration.GetSessionInfo);
          // Progress bar should be shown on initialization only.
          expect(showProgressBarSpy).to.have.been.calledOnce;
          expect(showProgressBarSpy).to.have.been.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Progress bar should be hidden after sessionInfoResponse is returned and before selectProvider.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(getSessionInfoStub)
            .and.calledBefore(selectProviderSpy);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          expect(selectProviderSpy).to.have.been.calledOnce
            .and.calledWith(projectConfig, sessionInfoResponse.tenantIds)
            .and.calledBefore(pushHistoryStateStub)
            .and.calledAfter(getSessionInfoStub);
          // No URL redirect. history.pushState should be used instead.
          expect(setCurrentUrlStub).to.not.be.called;
          expect(isHistoryAndCustomEventSupportedStub).to.have.been.calledWith(window);
          // Confirm pushState to expected sign-in URL.
          expect(pushHistoryStateStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedData, window.document.title, expectedSignInUrl);
          // Confirm pushstate custom event triggered.
          expect(pushstateCallback).to.be.calledOnce.and.calledAfter(pushHistoryStateStub);
          const customEvent = pushstateCallback.getCalls()[0].args[0];
          expect(customEvent.detail.data).to.deep.equal(expectedData);
          // Call again. Cached results should be used. This is not a realistic scenario and only used
          // to illustrate expected caching behavior.
          return operationHandler.start();
        })
        .then(() => {
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.be.calledOnce;
          expect(getSessionInfoStub).to.be.calledOnce;
        });
    });

    it('should select first selectedTenantInfo when no selectProvider is provided', () => {
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          `&tid=${encodeURIComponent(sessionInfoResponse.tenantIds[0])}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}`;
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      // Initialize a mock authentication handler with no selectProvider method.
      const mockAuthenticationHandler: AuthenticationHandler = {
        getAuth: (tenantId: string) => null,
        startSignIn: () => Promise.resolve({} as any),
        completeSignOut: () => Promise.resolve(),
      };
      const noSelectProviderOperationHandler = new SelectAuthSessionOperationHandler(
          selectAuthSessionConfig, mockAuthenticationHandler);

      return noSelectProviderOperationHandler.start()
        .then(() => {
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          // Confirm redirect to expected sign-in URL with first tenant automatically selected.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedSignInUrl);
        });
    });

    it('should select _<project-id> when selectProvider resolves with a null tenant ID', () => {
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          // _<project-id> tid selected.
          `&tid=${encodeURIComponent(parentProjectId)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}`;
      // Mock domains are authorized.
      const checkAuthorizedDomainsAndGetProjectIdStub = sinon.stub(
          GCIPRequestHandler.prototype,
          'checkAuthorizedDomainsAndGetProjectId').resolves(projectId);
      stubs.push(checkAuthorizedDomainsAndGetProjectIdStub);
      // Mock getSessionInfo API.
      const getSessionInfoStub =
          sinon.stub(IAPRequestHandler.prototype, 'getSessionInfo').resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);
      // Simulate user selects project level IdPs.
      const mockAuthenticationHandler = createMockAuthenticationHandler(tenant2Auth, null, {tenantId: null});
      operationHandler = new SelectAuthSessionOperationHandler(
          selectAuthSessionConfig, mockAuthenticationHandler);

      return operationHandler.start()
        .then(() => {
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          // Confirm redirect to expected sign-in URL with project level ID selected.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedSignInUrl);
        });
    });

    it('should reject when getSessionInfo rejects', () => {
      // Simulate recoverable error.
      const expectedError = new HttpCIAPError(504);
      const expectedSignInUrl = `https://auth.example.com:8080/signin` +
          `?mode=login&apiKey=${encodeURIComponent(apiKey)}` +
          `&tid=${encodeURIComponent(selectedTenantInfo.tenantId)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `${selectedTenantInfoHash}`;
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
      getSessionInfoStub.onSecondCall().resolves(sessionInfoResponse);
      stubs.push(getSessionInfoStub);
      // Mock redirect.
      const setCurrentUrlStub = sinon.stub(utils, 'setCurrentUrl');
      stubs.push(setCurrentUrlStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce
            .and.calledBefore(checkAuthorizedDomainsAndGetProjectIdStub);
          // Confirm URLs are checked for authorization.
          expect(checkAuthorizedDomainsAndGetProjectIdStub)
            .to.have.been.calledOnce.and.calledWith([currentUrlOrigin, selectAuthSessionConfig.redirectUrl]);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce
            .and.calledAfter(getSessionInfoStub);
          // Confirm getSessionInfoStub called.
          expect(getSessionInfoStub)
            .to.have.been.calledOnce.and.calledAfter(checkAuthorizedDomainsAndGetProjectIdStub)
            .and.calledWith(selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state);
          // selectProvider should not have been called.
          expect(selectProviderSpy).to.not.have.been.called;
          // Confirm error passed to handler.
          expect(authenticationHandler.getLastHandledError()).to.equal(error);
          expect(startSpy).to.be.calledOnce;
          // Try again to confirm caching behavior.
          return (error as any).retry();
        })
        .then(() => {
          expect(startSpy).to.be.calledTwice;
          expect(startSpy.getCall(0).thisValue).to.equal(operationHandler);
          // Progress bar show before getSessionInfo and after provider is selected.
          expect(showProgressBarSpy).to.have.been.calledThrice;
          expect(showProgressBarSpy).to.have.been.calledBefore(getSessionInfoStub);
          expect(showProgressBarSpy).to.have.been.calledAfter(selectProviderSpy);
          // Progress bar is hidden before provider is selected.
          expect(hideProgressBarSpy).to.have.been.calledTwice;
          expect(hideProgressBarSpy).to.have.been.calledBefore(selectProviderSpy);
          // Only getSessionInfo call should retry.
          expect(checkAuthorizedDomainsAndGetProjectIdStub).to.have.been.calledOnce;
          expect(getSessionInfoStub).to.have.been.calledTwice;
          expect(getSessionInfoStub.getCalls()[1].args)
            .to.deep.equal([selectAuthSessionConfig.redirectUrl, selectAuthSessionConfig.state]);
          expect(selectProviderSpy).to.have.been.calledOnce
            .and.calledWith(projectConfig, sessionInfoResponse.tenantIds)
            .and.calledBefore(setCurrentUrlStub)
            .and.calledAfter(getSessionInfoStub);
          // Confirm redirect to expected sign-in URL.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(getSessionInfoStub)
            .and.calledWith(window, expectedSignInUrl);
        });
    });
  });
});
