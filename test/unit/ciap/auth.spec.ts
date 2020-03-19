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
import * as selectAuthSession from '../../../src/ciap/select-auth-session-handler';
import * as signIn from '../../../src/ciap/sign-in-handler';
import * as signOut from '../../../src/ciap/sign-out-handler';
import { HttpCIAPError } from '../../../src/utils/error';
import { Config } from '../../../src/ciap/config';
import { SharedSettings } from '../../../src/ciap/shared-settings';

describe('Authentication', () => {
  const stubs: sinon.SinonStub[] = [];
  const originalUri = 'https://www.example.com/path/main';
  const apiKey = 'API_KEY';
  const tid = 'TENANT_ID';
  const tid2 = 'TENANT_ID2';
  const state = 'STATE';
  const hl = 'en-US';
  const redirectUri = `https://iap.googleapis.com/v1alpha1/gcip/resources/RESOURCE_HASH:handleRedirect`;
  const auth = createMockAuth(apiKey, tid);
  const tenant2Auth: {[key: string]: FirebaseAuth} = {};
  const selectedTenantInfo = {
    email: 'user@example.com',
    tenantId: tid,
    providerIds: ['saml.my-provider', 'oidc.provider'],
  };
  const historyState = {
    state: 'signIn',
    selectedTenantInfo,
  };
  tenant2Auth[tid] = auth;
  tenant2Auth[tid2] = createMockAuth(apiKey, tid2);
  const handler = createMockAuthenticationHandler(tenant2Auth);
  let signInOperationHandlerSpy: sinon.SinonSpy;
  let signOutOperationHandlerSpy: sinon.SinonSpy;
  let selectAuthSessionOperationHandlerSpy: sinon.SinonSpy;
  let startSignInOperationHandlerStub: sinon.SinonStub;
  let startSignOutOperationHandlerStub: sinon.SinonStub;
  let startSelectAuthSessionOperationHandlerStub: sinon.SinonStub;
  let getOriginalURLSignInOperationHandlerStub: sinon.SinonStub;
  let getOriginalURLSignOutOperationHandlerStub: sinon.SinonStub;
  let getOriginalURLSelectAuthSessionOperationHandlerStub: sinon.SinonStub;
  let onDomReadySpy: sinon.SinonSpy;
  let sharedSettings: SharedSettings;

  beforeEach(() => {
    sharedSettings = new SharedSettings(apiKey);
    signInOperationHandlerSpy = sinon.spy(signIn, 'SignInOperationHandler');
    signOutOperationHandlerSpy = sinon.spy(signOut, 'SignOutOperationHandler');
    selectAuthSessionOperationHandlerSpy = sinon.spy(selectAuthSession, 'SelectAuthSessionOperationHandler');
    onDomReadySpy = sinon.spy(utils, 'onDomReady');
    startSignInOperationHandlerStub = sinon.stub(signIn.SignInOperationHandler.prototype, 'start').resolves();
    startSignOutOperationHandlerStub = sinon.stub(signOut.SignOutOperationHandler.prototype, 'start').resolves();
    startSelectAuthSessionOperationHandlerStub = sinon.stub(
        selectAuthSession.SelectAuthSessionOperationHandler.prototype, 'start').resolves();
    stubs.push(startSignInOperationHandlerStub);
    stubs.push(startSignOutOperationHandlerStub);
    stubs.push(startSelectAuthSessionOperationHandlerStub);
    getOriginalURLSignInOperationHandlerStub =
      sinon.stub(signIn.SignInOperationHandler.prototype, 'getOriginalURL').resolves(originalUri);
    getOriginalURLSignOutOperationHandlerStub =
      sinon.stub(signOut.SignOutOperationHandler.prototype, 'getOriginalURL').resolves(originalUri);
    getOriginalURLSelectAuthSessionOperationHandlerStub =
      sinon.stub(selectAuthSession.SelectAuthSessionOperationHandler.prototype, 'getOriginalURL')
        .resolves(originalUri);
    stubs.push(getOriginalURLSignInOperationHandlerStub);
    stubs.push(getOriginalURLSignOutOperationHandlerStub);
    stubs.push(getOriginalURLSelectAuthSessionOperationHandlerStub);
  });

  afterEach(() => {
    stubs.forEach((s) => s.restore());
    signInOperationHandlerSpy.restore();
    signOutOperationHandlerSpy.restore();
    selectAuthSessionOperationHandlerSpy.restore();
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
      const expectedConfig = new Config(currentUrl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, sharedSettings);
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(selectAuthSessionOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should initialize default SharedSettings with passed framework version', () => {
      const frameworkVersion = 'ui-0.0.1';
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const expectedConfig = new Config(currentUrl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const frameworkSharedSettings = new SharedSettings(apiKey, frameworkVersion);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, undefined, frameworkVersion);
      }).not.to.throw();
      // Default shared settings with framework version used.
      expect(signInOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, frameworkSharedSettings);
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(selectAuthSessionOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should use same SharedSettings reference for a login mode AuthenticationHandler', () => {
      const frameworkVersion = 'ui-0.0.1';
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const sharedSettingsRef = new SharedSettings(apiKey, frameworkVersion);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, sharedSettingsRef);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce;
      // Should pass the exact same reference for SharedSettings.
      expect(signInOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
    });

    it('should not use same SharedSettings reference on API key mismatch', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const sharedSettingsRef = new SharedSettings('MISMATCHING_API_KEY');
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, sharedSettingsRef);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce;
      // Should initialize a new SharedSettings instance.
      expect(signInOperationHandlerSpy.getCall(0).args[2]).to.not.equal(sharedSettingsRef);
      expect(signInOperationHandlerSpy.getCall(0).args[2]).to.deep.equal(sharedSettings);
    });

    it('should initialize config with historyState if available', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(getCurrentUrlStub);
      const getHistoryStateStub = sinon.stub(utils, 'getHistoryState').returns(historyState);
      stubs.push(getHistoryStateStub);
      const expectedConfig = new Config(currentUrl, historyState);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(getHistoryStateStub).to.have.been.calledOnce.and.calledWith(window);
      expect(signInOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, sharedSettings);
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(selectAuthSessionOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should not throw when initialized with a reauth mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('reauth', apiKey, tid, redirectUri, state, hl);
      const expectedConfig = new Config(currentUrl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, sharedSettings, true);
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(selectAuthSessionOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should use same SharedSettings reference for a reauth mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('reauth', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const sharedSettingsRef = new SharedSettings(apiKey);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, sharedSettingsRef);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.have.been.calledOnce;
      // Should pass the exact same reference for SharedSettings.
      expect(signInOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
    });

    it('should not throw when initialized with a signout mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, hl);
      const expectedConfig = new Config(currentUrl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.not.have.been.called;
      expect(signOutOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, sharedSettings);
      expect(selectAuthSessionOperationHandlerSpy).to.not.have.been.called;
      expect(handler.languageCode).to.equal(hl);
    });

    it('should use same SharedSettings reference for a signout mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const sharedSettingsRef = new SharedSettings(apiKey);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, sharedSettingsRef);
      }).not.to.throw();
      expect(signOutOperationHandlerSpy).to.have.been.calledOnce;
      // Should pass the exact same reference for SharedSettings.
      expect(signOutOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
    });

    it('should not throw when initialized with a selectAuthSession mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl);
      const expectedConfig = new Config(currentUrl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler);
      }).not.to.throw();
      expect(signInOperationHandlerSpy).to.not.have.been.called;
      expect(signOutOperationHandlerSpy).to.not.have.been.called;
      expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce
        .and.calledWith(expectedConfig, handler, sharedSettings);
      expect(handler.languageCode).to.equal(hl);
    });

    it('should use same SharedSettings reference for a selectAuthSession mode AuthenticationHandler', () => {
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      const sharedSettingsRef = new SharedSettings(apiKey);
      stubs.push(stub);

      expect(() => {
        return new Authentication(handler, sharedSettingsRef);
      }).not.to.throw();
      expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce;
      // Should pass the exact same reference for SharedSettings.
      expect(selectAuthSessionOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
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
          expect(startSelectAuthSessionOperationHandlerStub).to.not.have.been.called;
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
          expect(startSelectAuthSessionOperationHandlerStub).to.not.have.been.called;
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
          expect(startSelectAuthSessionOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should reject when initialized with invalid select auth session parameters', () => {
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, null, 'fr');
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
          expect(startSelectAuthSessionOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should eventually be fullfilled for login mode', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, 'ru');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      const startRef = authenticationInstance.start();
      expect(startRef
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignInOperationHandlerStub);
          // Confirm signInOperationHandler.start called under the hood.
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.equal('ru');
        })).to.be.fulfilled;
      return startRef;
    });

    it('should eventually be fullfilled for re-auth mode', () => {
      const currentUrl = createMockUrl('reauth', apiKey, tid, redirectUri, state, 'it');
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      const startRef = authenticationInstance.start();
      expect(startRef
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignInOperationHandlerStub);
          // Confirm signInOperationHandler.start called under the hood.
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.equal('it');
        })).to.be.fulfilled;
      return startRef;
    });

    it('should eventually be fullfilled for signout mode', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      const startRef = authenticationInstance.start();
      expect(startRef
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce.and.calledBefore(startSignOutOperationHandlerStub);
          // Confirm signOutOperationHandler.start called under the hood.
          expect(startSignOutOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.be.undefined;
        })).to.be.fulfilled;
      return startRef;
    });

    it('should eventually be fullfilled for selectAuthSession mode', () => {
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      const startRef = authenticationInstance.start();
      expect(startRef
        .then(() => {
          expect(onDomReadySpy).to.have.been.calledOnce
            .and.calledBefore(startSelectAuthSessionOperationHandlerStub);
          // Confirm selectAuthSessionOperationHandler.start called under the hood.
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
          expect(handler.languageCode).to.be.undefined;
        })).to.be.fulfilled;
      return startRef;
    });

    it('should detect pushstate custom events', () => {
      let currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const selectAuthSessionConfig = new Config(currentUrl);
      const signInConfig = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, null));
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        // Simulate user selects tenant which redirects to login page.
        currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSignInOperationHandlerStub.callsFake(() => {
        // Simulate user completes sign-in.
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce
            .and.calledWith(selectAuthSessionConfig, handler, sharedSettings)
            .and.calledBefore(signInOperationHandlerSpy);
          expect(signInOperationHandlerSpy).to.have.been.calledOnce
            .and.calledWith(signInConfig, handler, sharedSettings);
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce
            .and.calledBefore(startSignInOperationHandlerStub);
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should detect popstate events', () => {
      let currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
      const signInConfig = new Config(currentUrl);
      const selectAuthSessionConfig =
          new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null));
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSignInOperationHandlerStub.callsFake(() => {
        // Simulate user clicks back on login page which can result in a redirect to hypothetical
        // previous page to select the tenant.
        currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
        const event = new CustomEvent('popstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        // This normally redirects back to sign in page but for testing we will ignore that.
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          expect(signInOperationHandlerSpy).to.have.been.calledOnce
            .and.calledWith(signInConfig, handler, sharedSettings)
            .and.calledBefore(selectAuthSessionOperationHandlerSpy);
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce
            .and.calledWith(selectAuthSessionConfig, handler, sharedSettings);
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce
            .and.calledBefore(startSelectAuthSessionOperationHandlerStub);
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should detect popstate events and use same SharedSettings reference for all OperationHandlers', () => {
      const sharedSettingsRef = new SharedSettings(apiKey);
      let currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSignInOperationHandlerStub.callsFake(() => {
        // Simulate user clicks back on login page which can result in a redirect to hypothetical
        // previous page to select the tenant.
        currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
        const event = new CustomEvent('popstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        // This normally redirects back to sign in page but for testing we will ignore that.
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler, sharedSettingsRef);
      return authenticationInstance.start()
        .then(() => {
          expect(signInOperationHandlerSpy).to.have.been.calledOnce
            .and.calledBefore(selectAuthSessionOperationHandlerSpy);
          // Same reference passed.
          expect(signInOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce;
          // Same reference passed.
          expect(selectAuthSessionOperationHandlerSpy.getCall(0).args[2]).to.equal(sharedSettingsRef);
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce
            .and.calledBefore(startSelectAuthSessionOperationHandlerStub);
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should detect successive pushstate and popstate events', () => {
      let currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      const callOrder: string[] = [];
      startSelectAuthSessionOperationHandlerStub.onCall(0).callsFake(() => {
        callOrder.push('select0');
        // Simulate first pushState to login page after user selects the tenant.
        currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSignInOperationHandlerStub.onCall(0).callsFake(() => {
        callOrder.push('login0');
        // Simulate user clicks back from login page to change the selected tenant.
        currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
        const event = new CustomEvent('popstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSelectAuthSessionOperationHandlerStub.onCall(1).callsFake(() => {
        callOrder.push('select1');
        // Simulate user selects a different tenant to sign in with.
        currentUrl = createMockUrl('login', apiKey, tid2, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      startSignInOperationHandlerStub.onCall(1).callsFake(() => {
        callOrder.push('login1');
        // Simulate user completes sign in with second tenant.
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          expect(callOrder).to.deep.equal(['select0', 'login0', 'select1', 'login1']);
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledTwice;
          expect(signInOperationHandlerSpy).to.have.been.calledTwice;
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledTwice;
          expect(startSignInOperationHandlerStub).to.have.been.calledTwice;
        });
    });

    it('should funnel underlying next Auth error after history event', () => {
      const expectedError = new HttpCIAPError(504);
      let currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      // Simulate login page rejects.
      startSignInOperationHandlerStub.rejects(expectedError);
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce
            .and.calledBefore(signInOperationHandlerSpy);
          expect(signInOperationHandlerSpy).to.have.been.calledOnce;
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce
            .and.calledBefore(startSignInOperationHandlerStub);
          expect(startSignInOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should catch invalid config errors thrown in next Auth after history event', () => {
      let currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        // This should not happen. Simulate incorrect config.
        currentUrl = createMockUrl('login', apiKey, null, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.code).to.equal('invalid-argument');
          expect(error.message).to.equal('Invalid request');
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce
            .and.calledBefore(signInOperationHandlerSpy);
          expect(signInOperationHandlerSpy).to.have.been.calledOnce;
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
          expect(startSignInOperationHandlerStub).to.not.have.been.called;
        });
    });

    it('should catch fatal errors thrown in next Auth after history event', () => {
      let currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const expectedData = {
        a: 1, b: 2, c: 3,
      };
      startSelectAuthSessionOperationHandlerStub.callsFake(() => {
        // This should not happen. Simulate incorrect mode.
        currentUrl = createMockUrl('unknown', apiKey, null, redirectUri, state, null);
        const event = new CustomEvent('pushstate', {
          bubbles: true,
          detail: {
            data: expectedData,
          },
        });
        window.dispatchEvent(event);
        return Promise.resolve();
      });
      const getCurrentUrlStub = sinon.stub(utils, 'getCurrentUrl');
      getCurrentUrlStub.callsFake(() => {
        return currentUrl;
      });
      stubs.push(getCurrentUrlStub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.start()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.code).to.equal('invalid-argument');
          expect(error.message).to.equal('Invalid mode');
          expect(selectAuthSessionOperationHandlerSpy).to.have.been.calledOnce;
          expect(startSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
        });
    });
  });

  describe('getOriginalURL()', () => {
    it('should resolve with expected originalUri for login mode', () => {
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          // Confirm signInOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSignInOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should reject with expected underlying error for login mode', () => {
      const expectedError = new HttpCIAPError(504);
      const currentUrl = createMockUrl('login', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);
      getOriginalURLSignInOperationHandlerStub.rejects(expectedError);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          // Confirm signInOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSignInOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should resolve with expected originalUri for signout mode', () => {
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          // Confirm signOutOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSignOutOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should reject with expected underlying error for signout mode', () => {
      const expectedError = new HttpCIAPError(504);
      const currentUrl = createMockUrl('signout', apiKey, tid, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);
      getOriginalURLSignOutOperationHandlerStub.rejects(expectedError);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          // Confirm signOutOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSignOutOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should resolve with expected originalUri for selectAuthSession mode', () => {
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          expect(actualOriginalUri).to.equal(originalUri);
          // Confirm selectAuthSessionOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
        });
    });

    it('should reject with expected underlying error for selectAuthSession mode', () => {
      const expectedError = new HttpCIAPError(504);
      const currentUrl = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, null);
      const stub = sinon.stub(utils, 'getCurrentUrl').returns(currentUrl);
      stubs.push(stub);
      getOriginalURLSelectAuthSessionOperationHandlerStub.rejects(expectedError);

      const authenticationInstance = new Authentication(handler);
      return authenticationInstance.getOriginalURL()
        .then((actualOriginalUri) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          // Confirm selectAuthSessionOperationHandler.getOriginalURL called under the hood.
          expect(getOriginalURLSelectAuthSessionOperationHandlerStub).to.have.been.calledOnce;
        });
    });
  });
});
