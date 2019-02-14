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
  createMockUser, MockAuthenticationHandler,
} from '../../resources/utils';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import { HttpCIAPError } from '../../../src/utils/error';

describe('SignOutOperationHandler', () => {
  const stubs: sinon.SinonStub[] = [];
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const originalUri = 'https://www.example.com/path/main';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  const singleSignOutConfig = new Config(createMockUrl('signout', apiKey, tid, redirectUri, state, hl));
  let auth: MockAuth;
  let authenticationHandler: MockAuthenticationHandler;
  let singleSignOutOperationHandler: SignOutOperationHandler;
  let tenant2Auth: {[key: string]: FirebaseAuth};
  let completeSignOutSpy: sinon.SinonSpy;
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;
  let signOutSpy: sinon.SinonSpy;

  beforeEach(() => {
    // Listen to auth.signOut calls.
    signOutSpy = sinon.spy(MockAuth.prototype, 'signOut');
    // Listen to completeSignOut, showProgressBar and hideProgressBar.
    completeSignOutSpy = sinon.spy(MockAuthenticationHandler.prototype, 'completeSignOut');
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    auth = createMockAuth(tid);
    // Simulate user already signed in.
    auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
    tenant2Auth = {};
    tenant2Auth[tid] = auth;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    singleSignOutOperationHandler = new SignOutOperationHandler(singleSignOutConfig, authenticationHandler);
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
      const invalidConfig = new Config(createMockUrl('signout', apiKey, tid, redirectUri, null, hl));
      return new SignOutOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw();
  });

  describe('type', () => {
    it('should return OperationType.SignOut', () => {
      expect(singleSignOutOperationHandler.type).to.equal(OperationType.SignOut);
    });
  });

  describe('start()', () => {
    it('should fail on unauthorized redirect URL', () => {
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
          expect(auth.currentUser).to.not.be.null;
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

      return singleSignOutOperationHandler.start()
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
          expect(auth.currentUser).to.be.null;
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
      const config = new Config(createMockUrl('signout', apiKey, tid, null, state, hl));
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
          expect(auth.currentUser).to.be.null;
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
          expect(auth.currentUser).to.not.be.null;
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
          expect(auth.currentUser).to.be.null;
          // Progress bar should be hidden when the error is detected.
          expect(hideProgressBarSpy) .to.have.been.calledOnce.and.calledAfter(getOriginalUrlForSignOutStub);
        });
    });

    xit('should not redirect to redirectUrl on multi-tenant signout', () => {
      // TODO when multi-signout is supported.
    });

    xit('should sign out from all tenants when no tenant ID is specified', () => {
      // TODO when multi-signout is supported.
    });
  });
});
