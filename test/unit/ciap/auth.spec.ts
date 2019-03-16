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
import { FirebaseAuth } from '../../../src/ciap/firebase-auth';
import { Authentication } from '../../../src/ciap/auth';
import {
  createMockAuth, createMockAuthenticationHandler, createMockUrl,
} from '../../resources/utils';
import * as utils from '../../../src/utils/index';
import * as signIn from '../../../src/ciap/sign-in-handler';
import * as signOut from '../../../src/ciap/sign-out-handler';

describe('Authentication', () => {
  const stubs: sinon.SinonStub[] = [];
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/cicp/tenantIds/${tid}:handleRedirect`;
  const auth = createMockAuth(apiKey, tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  tenant2Auth[tid] = auth;
  const handler = createMockAuthenticationHandler(tenant2Auth);
  let signInOperationHandlerSpy: sinon.SinonSpy;
  let signOutOperationHandlerSpy: sinon.SinonSpy;
  let startSignInOperationHandlerStub: sinon.SinonStub;
  let startSignOutOperationHandlerStub: sinon.SinonStub;
  let onDomReadySpy: sinon.SinonSpy;

  beforeEach(() => {
    signInOperationHandlerSpy = sinon.spy(signIn, 'SignInOperationHandler');
    signOutOperationHandlerSpy = sinon.spy(signOut, 'SignOutOperationHandler');
    onDomReadySpy = sinon.spy(utils, 'onDomReady');
    startSignInOperationHandlerStub = sinon.stub(signIn.SignInOperationHandler.prototype, 'start').resolves();
    startSignOutOperationHandlerStub = sinon.stub(signOut.SignOutOperationHandler.prototype, 'start').resolves();
    stubs.push(startSignInOperationHandlerStub);
    stubs.push(startSignOutOperationHandlerStub);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    signInOperationHandlerSpy.restore();
    signOutOperationHandlerSpy.restore();
    onDomReadySpy.restore();
  });

  describe('Constructor', () => {
    it('throws an error when initialized with undefined', () => {
      expect(() => {
        return new Authentication(undefined as any);
      }).to.throw().with.property('code', 'invalid-argument');
    });

    it('throws an error when initialized with an invalid AuthenticationHandler', () => {
      expect(() => {
        const invalidHandler = {} as any;
        return new Authentication(invalidHandler);
      }).to.throw().with.property('code', 'invalid-argument');
    });

    it('should not throw when initialized with a login mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce;
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should not throw when initialized with a reauth mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('reauth', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce;
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should not throw when initialized with a signout mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.not.have.been.called;
      expect(signOutOperationHandlerSpy).to.have.been.calledOnce;
      expect(handler.languageCode).to.equal(hl);
    });
  });

  describe('start()', () => {
    it('should reject when initialized with an invalid URL mode', () => {
      const currentUrl = createMockUrl('unknown', apiKey, tid, redirectUri, state, 'fr');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authHandler =  new Authentication(handler);
      return authHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(onDomReadySpy).to.have.been.calledOnce;
          expect(error).to.have.property('message', 'Invalid mode');
          expect(error).to.have.property('code', 'invalid-argument');
          // Language code set despite error.
          expect(handler.languageCode).to.equal('fr');
          expect(handler.getLastHandledError()).to.equal(error);
          expect(startSignInOperationHandlerStub).to.not.have.been.called;
          expect(startSignOutOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should reject when initialized with invalid sign in parameters', () => {
      const currentUrl = createMockUrl('login', apiKey, 'invalidTenantId', redirectUri, state, 'fr');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authHandler =  new Authentication(handler);
      return authHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(onDomReadySpy).to.have.been.calledOnce;
          expect(error).to.have.property('code', 'invalid-argument');
          // Language code set despite error.
          expect(handler.languageCode).to.equal('fr');
          expect(handler.getLastHandledError()).to.equal(error);
          expect(startSignInOperationHandlerStub).to.not.have.been.called;
          expect(startSignOutOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should reject when initialized with invalid sign out parameters', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, null, 'fr');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authHandler =  new Authentication(handler);
      return authHandler.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(onDomReadySpy).to.have.been.calledOnce;
          expect(error).to.have.property('code', 'invalid-argument');
          // Language code set despite error.
          expect(handler.languageCode).to.equal('fr');
          expect(handler.getLastHandledError()).to.equal(error);
          expect(startSignInOperationHandlerStub).to.not.have.been.called;
          expect(startSignOutOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should eventually be fullfilled for login mode', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, 'ru');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      expect(authenticationInstance.start()
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignInOperationHandlerStub);
          // Confirm signInOperationHandler.start called under the hood.
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.equal('ru');
        })).to.be.fulfilled;
    });

    it('should eventually be fullfilled for re-auth mode', () => {
      const currentUrl = createMockUrl('reauth', apiKey, tid, redirectUri, state, 'it');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      expect(authenticationInstance.start()
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignInOperationHandlerStub);
          // Confirm signInOperationHandler.start called under the hood.
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.equal('it');
        })).to.be.fulfilled;
    });

    it('should eventually be fullfilled for signout mode', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      expect(authenticationInstance.start()
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignOutOperationHandlerStub);
          // Confirm signOutOperationHandler.start called under the hood.
          expect(startSignOutOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.be.undefined;
        })).to.be.fulfilled;
    });
  });
});
