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
import { OperationType } from '../../../src/ciap/base-operation-handler';
import {
  createMockUrl, createMockAuth, createMockAuthenticationHandler, MockAuth,
  createMockUser, MockUser, MockAuthenticationHandler,
} from '../../resources/utils';
import { CICPRequestHandler } from '../../../src/ciap/cicp-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import * as utils from '../../../src/utils/index';
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { HttpCIAPError } from '../../../src/utils/error';

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
  let showProgressBarSpy: sinon.SinonSpy;
  let hideProgressBarSpy: sinon.SinonSpy;

  beforeEach(() => {
    // Listen to startSignIn calls.
    startSignInSpy = sinon.spy(MockAuthenticationHandler.prototype, 'startSignIn');
    showProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'showProgressBar');
    hideProgressBarSpy = sinon.spy(MockAuthenticationHandler.prototype, 'hideProgressBar');
    auth = createMockAuth(tid);
    tenant2Auth = {};
    tenant2Auth[tid] = auth;
    authenticationHandler = createMockAuthenticationHandler(tenant2Auth);
    operationHandler = new SignInOperationHandler(config, authenticationHandler);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    startSignInSpy.restore();
    showProgressBarSpy.restore();
    hideProgressBarSpy.restore();
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
    }).to.throw();
  });

  it('should throw on initialization with no redirectUrl', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('login', apiKey, tid, null, state, hl));
      return new SignInOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw();
  });

  it('should throw on initialization with no state', () => {
    expect(() => {
      const invalidConfig = new Config(createMockUrl('login', apiKey, tid, redirectUri, null, hl));
      return new SignInOperationHandler(invalidConfig, authenticationHandler);
    }).to.throw();
  });

  describe('type', () => {
    it('should return OperationType.SignIn', () => {
      expect(operationHandler.type).to.equal(OperationType.SignIn);
    });
  });

  describe('start()', () => {
    it('should fail on unauthorized redirect URL if no user is signed in', () => {
      // Mock domain is not authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(false);
      stubs.push(isAuthorizedDomainStub);

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          // Expected error should be thrown.
          expect(error).to.have.property('message', 'unauthorized');
          expect(startSignInSpy).to.not.have.been.called;
          // On failure, progress bar should be hidden.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
        });
    });

    it('should fail on unauthorized redirect URL if user is signed in', () => {
      // Mock domain is not authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(false);
      stubs.push(isAuthorizedDomainStub);
      // Simulate user is signed in.
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));

      return operationHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          // Expected error should be thrown.
          expect(error).to.have.property('message', 'unauthorized');
          expect(startSignInSpy).to.not.have.been.called;
          // Progress bar hidden on error thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
        });
    });

    it('should call authenticationHandler startSignIn when user is signed in and re-auth is required', () => {
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
            // Progress bar should be hidden before startSignIn.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // startSignIn should be called even though a user is already signed in, since
          // re-auth is required.
          expect(startSignInSpy).to.have.been.calledOnce.and.calledWith(auth);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
        });
    });

    it('should finish sign in when authenticationHandler startSignIn triggers', () => {
      user = createMockUser('UID1', 'ID_TOKEN1');
      tenant2Auth[tid] = auth;
      authenticationHandler = createMockAuthenticationHandler(
          tenant2Auth,
          // onStartSignIn simulates user signing in.
          () => auth.setCurrentMockUser(user));
      operationHandler = new SignInOperationHandler(config, authenticationHandler);
       // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          // Progress bar should be hidden before user is asked to sign-in.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledBefore(startSignInSpy);
          // Confirm startSignIn is called.
          expect(startSignInSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // Progress bar should be shown after the user is signed in and ID token is being processed.
          expect(showProgressBarSpy).to.have.been.calledTwice.and.calledAfter(startSignInSpy);
          // Confirm ID token exchanged.
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(startSignInSpy)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          // Confirm set cookie endpoint called.
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          // Confirm redirect to original URI.
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
        });
    });

    it('should finish sign in when ID token is already available', () => {
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
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
          expect(hideProgressBarSpy).to.not.have.been.called;
          // Progress bar should be shown on initialization.
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          // Since ID token is available, startSignIn should not be called.
          expect(startSignInSpy).to.not.have.been.called;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub)
            .to.have.been.calledOnce.and.calledAfter(setCookieAtTargetUrlStub)
            .and.calledWith(window, redirectServerResp.originalUri);
        });
    });

    it('should reject when isAuthorizedDomain rejects', () => {
      const expectedError = new HttpCIAPError(504);
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
      // Mock domain is authorized.
      const isAuthorizedDomainStub =
          sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').rejects(expectedError);
      stubs.push(isAuthorizedDomainStub);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy).to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          expect(startSignInSpy).to.not.have.been.called;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.not.have.been.called;
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          expect(setCurrentUrlStub).to.not.have.been.called;
        });
    });

    it('should reject when exchangeIdTokenAndGetOriginalAndTargetUrl rejects', () => {
      const expectedError = new HttpCIAPError(400);
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .rejects(expectedError);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          expect(error).to.equal(expectedError);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          expect(startSignInSpy).to.not.have.been.called;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          expect(setCookieAtTargetUrlStub).to.not.have.been.called;
          expect(setCurrentUrlStub).to.not.have.been.called;
        });
    });

    it('should reject when setCookieAtTargetUrl rejects', () => {
      const expectedError = new HttpCIAPError(
          400, 'RESOURCE_MISSING_CICP_TENANT_ID', 'message');
      auth.setCurrentMockUser(createMockUser('UID1', 'ID_TOKEN1'));
      // Mock domain is authorized.
      const isAuthorizedDomainStub = sinon.stub(CICPRequestHandler.prototype, 'isAuthorizedDomain').resolves(true);
      stubs.push(isAuthorizedDomainStub);
      // Mock ID token exchange endpoint.
      const exchangeIdTokenAndGetOriginalAndTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'exchangeIdTokenAndGetOriginalAndTargetUrl')
            .resolves(redirectServerResp);
      stubs.push(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
      // Mock set cookie.
      const setCookieAtTargetUrlStub =
          sinon.stub(IAPRequestHandler.prototype, 'setCookieAtTargetUrl').rejects(expectedError);
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
          expect(showProgressBarSpy).to.have.been.calledOnce.and.calledBefore(isAuthorizedDomainStub);
          // Progress bar should be hidden after error is thrown.
          expect(hideProgressBarSpy)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub);
          // Expected error should be thrown.
          expect(error).to.equal(expectedError);
          // Confirm redirect URL is checked for authorization.
          expect(isAuthorizedDomainStub)
            .to.have.been.calledOnce.and.calledWith(config.redirectUrl);
          expect(startSignInSpy).to.not.have.been.called;
          expect(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(isAuthorizedDomainStub)
            .and.calledWith(config.redirectUrl, 'ID_TOKEN1', config.tid, config.state);
          expect(setCookieAtTargetUrlStub)
            .to.have.been.calledOnce.and.calledAfter(exchangeIdTokenAndGetOriginalAndTargetUrlStub)
            .and.calledWith(redirectServerResp.targetUri, redirectServerResp.redirectToken);
          expect(setCurrentUrlStub).to.not.have.been.called;
        });
    });
  });
});
