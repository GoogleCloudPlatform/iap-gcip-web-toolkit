/*
 * Copyright 2020 Google Inc.
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
import * as testUtils from './test-utils';
import * as utils from '../../../src/utils/index';
import {HttpClient} from '../../../src/utils/http-client';
import { UiConfig } from '../../../src/sign-in-ui';
import {
  AdminUi, TIMEOUT_DURATION, OAUTH_SCOPES, MSG_CONFIGURATION_SAVED,
  MSG_NO_USER_LOGGED_IN, MSG_INVALID_CONFIGURATION, MSG_CONFIGURATION_COPIED,
  MSG_GOOGLE_PROVIDER_NOT_CONFIGURED, CODE_MIRROR_CONFIG, MSG_INVALID_CREDENTIALS,
} from '../../../src/admin-ui';
// tslint:disable-next-line
import * as firebase from 'firebase/app';
import * as CodeMirror from '../../../node_modules/codemirror/lib/codemirror.js';

/**
 * Asserts toast message and status.
 * @param status The expected status.
 * @param message The expected message.
 */
function assertToastMessage(status: string, message: string) {
  const alertStatusElement = document.getElementById('alert-status');
  const alertMessageElement = document.getElementById('alert-message');
  expect(alertStatusElement.innerText).to.be.equal(status);
  expect(alertMessageElement.innerText).to.be.equal(message);
}

describe('AdminUi', () => {
  let codeMirrorEditorSpy: sinon.SinonSpy;
  let httpClientSendStub: sinon.SinonStub;
  let showToast: () => void;
  let loadingSpinner: HTMLElement;
  let toastContainer: HTMLElement;
  let mainContainer: HTMLElement;
  let stubs: sinon.SinonStub[];
  const EMAIL = 'user@example.com';
  const OAUTH_ACCESS_TOKEN = 'OAUTH_ACCESS_TOKEN';
  const UPDATED_OAUTH_ACCESS_TOKEN = 'UPDATED_OAUTH_ACCESS_TOKEN';
  const PROJECT_ID = 'project-id';
  const API_KEY = 'API_KEY';
  const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
  const CUSTOM_STYLESHEET_URL = 'https://www.example.com/css/custom-stylesheet.css';
  const expectedGcipConfig = {
    apiKey: API_KEY,
    authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
  };
  const expectedUiConfig: UiConfig = {
    [API_KEY]: {
      authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
      displayMode: 'optionFirst',
      selectTenantUiTitle: PROJECT_ID,
      selectTenantUiLogo: 'https://www.example.com/img/select-tenant-logo.png',
      styleUrl: CUSTOM_STYLESHEET_URL,
      tenants: {
        _: {
          displayName: 'ABCD',
          iconUrl: 'https://www.example.com/img/tenant-icon0.png',
          logoUrl: 'https://www.example.com/img/tenant-logo0.png',
          buttonColor: '#007bff',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {provider: 'facebook.com'},
            {provider: 'twitter.com'},
            {
              provider: 'saml.idp1',
              providerName: 'saml-display-name-1',
            },
            {
              provider: 'oidc.idp1',
              providerName: 'oidc-display-name-1',
            },
          ],
        },
        tenantId1: {
          displayName: 'Tenant-display-name-1',
          iconUrl: 'https://www.example.com/img/tenant-icon1.png',
          logoUrl: 'https://www.example.com/img/tenant-logo1.png',
          buttonColor: '#007bff',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {provider: 'password'},
            {
              provider: 'saml.idp2',
              providerName: 'saml-display-name-2',
            },
            {
              provider: 'oidc.idp2',
              providerName: 'oidc-display-name-2',
            },
          ],
        },
        tenantId2: {
          displayName: 'Tenant-display-name-2',
          iconUrl: 'https://www.example.com/img/tenant-icon2.png',
          logoUrl: 'https://www.example.com/img/tenant-logo2.png',
          buttonColor: '#007bff',
          tosUrl: '',
          privacyPolicyUrl: '',
          signInOptions: [
            {provider: 'microsoft.com'},
            {
              provider: 'saml.idp3',
              providerName: 'saml-display-name-3',
            },
            {
              provider: 'oidc.idp3',
              providerName: 'oidc-display-name-3',
            },
          ],
        },
      },
      tosUrl: '',
      privacyPolicyUrl: '',
    },
  };

  beforeEach(() => {
    codeMirrorEditorSpy = sinon.spy(CodeMirror, 'fromTextArea');
    stubs = [];
    showToast = sinon.stub();
    loadingSpinner = document.createElement('div');
    loadingSpinner.id = 'loading-spinner';
    loadingSpinner.classList.add('d-flex', 'justify-content-center');
    loadingSpinner.innerHTML = `
      <div class="spinner-border text-secondary" role="status">
        <span class="sr-only">Loading...</span>
      </div>`;
    document.body.appendChild(loadingSpinner);

    toastContainer = document.createElement('div');
    toastContainer.classList.add('toast-container');
    toastContainer.innerHTML = `
      <div class="toast" data-autohide="true" data-delay="5000">
        <div class="toast-header">
          <strong class="mr-auto" id="alert-status">Success</strong>
          <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="toast-body" id="alert-message"></div>
      </div>`;
    document.body.appendChild(toastContainer);

    mainContainer = document.createElement('div');
    mainContainer.id = 'admin-container';
    mainContainer.style.display = 'none';
    mainContainer.innerHTML = `
      <h5 class="heading-center">Customize Authentication UI Configuration</h5>
      <form class="admin-form">
        <textarea rows="20" cols="70" class="config"></textarea><br>
        <button type="submit" class="btn btn-primary mb-2">Save</button>
        <button class="reauth btn btn-primary mb-2" style="display:none;">Reauthenticate</button>
      </form>
      <div title="Copy to clipboard" class="copy-btn copy-to-clipboard" style="display:none;" aria-label="Copy">
      </div>`;
    document.body.appendChild(mainContainer);
    httpClientSendStub = sinon.stub(HttpClient.prototype, 'send');
    stubs.push(httpClientSendStub);
  });

  afterEach(() => {
    codeMirrorEditorSpy.restore();
    if (loadingSpinner && loadingSpinner.parentNode) {
      document.body.removeChild(loadingSpinner);
    }
    if (toastContainer) {
      document.body.removeChild(toastContainer);
    }
    if (mainContainer) {
      document.body.removeChild(mainContainer);
    }
    stubs.forEach((s) => s.restore());
  });

  describe('constructor', () => {
    it('should not throw when valid container provided', () => {
      expect(() => {
        return new AdminUi(mainContainer, showToast);
      }).not.to.throw();
    });

    it('should throw when invalid container provided', () => {
      expect(() => {
        return new AdminUi('#not-found', showToast);
      }).to.throw(`Container element #not-found not found`);
    });

    it('should throw when .reauth not found', () => {
      expect(() => {
        mainContainer.getElementsByClassName('reauth')[0].remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`.reauth element not found`);
    });

    it('should throw when .copy-to-clipboard not found', () => {
      expect(() => {
        mainContainer.getElementsByClassName('copy-to-clipboard')[0].remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`.copy-to-clipboard element not found`);
    });

    it('should throw when .config not found', () => {
      expect(() => {
        mainContainer.getElementsByClassName('config')[0].remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`.config element not found`);
    });

    it('should throw when .admin-form not found', () => {
      expect(() => {
        mainContainer.getElementsByClassName('admin-form')[0].remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`.admin-form element not found`);
    });

    it('should throw when #alert-status not found', () => {
      expect(() => {
        document.getElementById('alert-status').remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`#alert-status element not found`);
    });

    it('should throw when #alert-message not found', () => {
      expect(() => {
        document.getElementById('alert-message').remove();
        return new AdminUi(mainContainer, showToast);
      }).to.throw(`#alert-message element not found`);
    });
  });

  describe('render()', () => {
    it('should populate the admin config after successful sign-in redirect', () => {
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      // Copy button should be initially hidden.
      const copyToClipboardButton = document.getElementsByClassName('copy-to-clipboard')[0] as HTMLButtonElement;
      expect(copyToClipboardButton.style.display).to.be.equal('none');
      return adminUi.render()
        .then(() => {
          expect(stubbedAuthMethods.getRedirectResult).to.have.been.calledOnce;
          expect(httpClientSendStub).to.have.been.calledTwice;
          // Confirm loaded admin config displayed in textarea.
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Confirm on change set.
          editorInstance.setValue('test');
          expect(area.value).to.be.equal('test');
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          // Copy button should be appended to editor.
          const editorContainer = document.getElementsByClassName('CodeMirror')[0] as HTMLTextAreaElement;
          expect(copyToClipboardButton.style.display).to.not.be.equal('none');
          expect(copyToClipboardButton.parentNode).to.be.equal(editorContainer);
        });
    });

    it('should catch Google provider not enabled error', () => {
      const expectedError = {
        code: 'auth/operation-not-allowed',
        message: 'The identity provider configuration is not found.',
      };
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          // Simulate Google provider is not enabled.
          return Promise.reject(expectedError);
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      const copyToClipboardButton = document.getElementsByClassName('copy-to-clipboard')[0] as HTMLButtonElement;
      return adminUi.render()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.deep.equal(expectedError);
          expect(stubbedAuthMethods.getRedirectResult).to.have.been.calledOnce;
          expect(httpClientSendStub).to.have.been.calledOnce;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(mainContainer.innerText).to.be.equal(MSG_GOOGLE_PROVIDER_NOT_CONFIGURED);
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.not.have.been.called;
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          // Copy button should remain hidden.
          expect(copyToClipboardButton.style.display).to.be.equal('none');
        });
    });

    it('should show unrecoverable error message on /get_admin_config error', () => {
      const expectedMessage = 'Unable to get config';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 400',
          400,
          {
            data: {
              error: {
                code: 400,
                message: expectedMessage,
              },
            },
          });
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.reject(serverLowLevelError);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal(expectedMessage);
          expect(httpClientSendStub).to.have.been.calledTwice;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(mainContainer.innerText).to.be.equal(expectedMessage);
        });
    });

    it('should show unrecoverable error message on /gcipConfig error', () => {
      const expectedMessage = 'Unable to get config';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 400',
          400,
          {
            data: {
              error: {
                code: 400,
                message: expectedMessage,
              },
            },
          });
      // Stub /gcipConfig.
      httpClientSendStub.rejects(serverLowLevelError);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal(expectedMessage);
          expect(httpClientSendStub).to.have.been.calledOnce;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(mainContainer.innerText).to.be.equal(expectedMessage);
        });
    });

    it('should handle copy-to-clipboard button correctly', () => {
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Test copy to clipboard functionality.
          const copyToClipboardButton = mainContainer.getElementsByClassName('copy-to-clipboard')[0];
          (copyToClipboardButton as HTMLButtonElement).click();
          expect(copyTextAreaContentStub).to.have.been.calledOnce.and.calledWith(area);
          // Confirm toast message
          assertToastMessage('Success', MSG_CONFIGURATION_COPIED);
          expect(showToast).to.have.been.calledOnce;
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          (copyToClipboardButton as HTMLButtonElement).click();
          expect(copyTextAreaContentStub).to.have.been.calledTwice.and.calledWith(area);
          // In the process, the textarea should be updated.
          expect(area.value).to.be.equal(editorInstance.getValue());
          // Confirm toast message
          assertToastMessage('Success', MSG_CONFIGURATION_COPIED);
          expect(showToast).to.have.been.calledTwice;
        });
    });

    it('should disable copy when an invalid configuration is provided', () => {
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      // Use invalid field.
      updatedUiConfig[API_KEY].selectTenantUiTitle = '<h1>Cool App</h1>';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test copy to clipboard functionality.
          const copyToClipboardButton = mainContainer.getElementsByClassName('copy-to-clipboard')[0];
          (copyToClipboardButton as HTMLButtonElement).click();
          expect(copyTextAreaContentStub).to.not.have.been.called;
          // Confirm toast message with error.
          assertToastMessage('Error', `"${API_KEY}.selectTenantUiTitle" should be a valid string.`);
          expect(showToast).to.have.been.calledOnce;
        });
    });

    it('should successfully save admin config on unexpired access token', () => {
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          expect(params.data).to.deep.equal(updatedUiConfig);
          return Promise.resolve(testUtils.createMockHttpResponse(
              {'Content-Type': 'application/json'}, {}));
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          const adminFormButton = mainContainer.querySelector('button[type="submit"]');
          (adminFormButton as HTMLButtonElement).click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button still hidden.
          const reauthButton = document.getElementsByClassName('reauth')[0];
          expect((reauthButton as HTMLButtonElement).style.display).to.be.equal('none');
          assertToastMessage('Success', MSG_CONFIGURATION_SAVED);
          expect(showToast).to.have.been.calledOnce;
        });
    });

    it('should catch invalid provided JSON configuration', () => {
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content with an invalid JSON input.
          editorInstance.setValue('{invalid}');
          // Test save functionality.
          const adminFormButton = mainContainer.querySelector('button[type="submit"]');
          (adminFormButton as HTMLButtonElement).click();
          // No addition network request.
          expect(httpClientSendStub).to.have.been.calledTwice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button still hidden.
          const reauthButton = document.getElementsByClassName('reauth')[0];
          expect((reauthButton as HTMLButtonElement).style.display).to.be.equal('none');
          // Confirm invalid JSON error displayed.
          assertToastMessage('Error', MSG_INVALID_CONFIGURATION);
          expect(showToast).to.have.been.calledOnce;
        });
    });

    it('should not save and catch invalid fields in the configuration client side', () => {
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      // Use invalid field.
      updatedUiConfig[API_KEY].selectTenantUiTitle = '<h1>Cool App</h1>';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content with an invalid config.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          const adminFormButton = mainContainer.querySelector('button[type="submit"]');
          (adminFormButton as HTMLButtonElement).click();
          // No additional network request.
          expect(httpClientSendStub).to.have.been.calledTwice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button still hidden.
          const reauthButton = document.getElementsByClassName('reauth')[0];
          expect((reauthButton as HTMLButtonElement).style.display).to.be.equal('none');
          // Confirm invalid config error displayed.
          assertToastMessage('Error', `"${API_KEY}.selectTenantUiTitle" should be a valid string.`);
          expect(showToast).to.have.been.calledOnce;
        });
    });

    it('should handle save admin config error', () => {
      const expectedMessage = 'Unable to get config';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 400',
          400,
          {
            data: {
              error: {
                code: 400,
                message: expectedMessage,
              },
            },
          });
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1');
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          expect(params.data).to.deep.equal(updatedUiConfig);
          return Promise.reject(serverLowLevelError);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      const copyTextAreaContentStub = sinon.stub(utils, 'copyTextAreaContent');
      stubs.push(copyTextAreaContentStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          const adminFormButton = mainContainer.querySelector('button[type="submit"]');
          (adminFormButton as HTMLButtonElement).click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button still hidden.
          const reauthButton = document.getElementsByClassName('reauth')[0];
          expect((reauthButton as HTMLButtonElement).style.display).to.be.equal('none');
          // Confirm expected error message toast.
          assertToastMessage('Error', expectedMessage);
          expect(showToast).to.have.been.calledOnce;
        });
    });

    it('should trigger re-auth on expired access token', () => {
      let callCounter = 0;
      const reauthButton = document.getElementsByClassName('reauth')[0] as HTMLButtonElement;
      const adminFormButton = mainContainer.querySelector('button[type="submit"]') as HTMLButtonElement;
      const stubbedUserMethods = {
        email: EMAIL,
        reauthenticateWithPopup: sinon.stub().callsFake((provider) => {
          expect(provider.providerId).to.be.equal('google.com');
          expect(addScopeStub).to.have.been.calledTwice;
          expect(addScopeStub.getCall(0)).to.have.been.calledWith(OAUTH_SCOPES[0]);
          expect(addScopeStub.getCall(1)).to.have.been.calledWith(OAUTH_SCOPES[1]);
          expect(setCustomParametersStub).to.have.been.calledOnce
            .and.calledWith({login_hint: EMAIL, prompt: 'select_account'});
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              // Return updated OAuth access token.
              accessToken: UPDATED_OAUTH_ACCESS_TOKEN,
            },
          })
        }),
      };
      const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1', stubbedUserMethods);
      const UNAUTHORIZED_USER_ERROR = 'Unauthorized user';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 401',
          401,
          {
            data: {
              error: {
                code: 401,
                message: UNAUTHORIZED_USER_ERROR,
              },
            },
          });
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        callCounter++;
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          if (callCounter === 3) {
            expect(params.headers).to.deep.equal({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
            });
            expect(params.data).to.deep.equal(updatedUiConfig);
            // Simulate token expired.
            return Promise.reject(serverLowLevelError);
          } else if (callCounter === 4) {
            // This call should be made with an updated OAuth access token.
            expect(params.headers).to.deep.equal({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${UPDATED_OAUTH_ACCESS_TOKEN}`,
            });
            expect(params.data).to.deep.equal(updatedUiConfig);
            return Promise.resolve(testUtils.createMockHttpResponse(
                {'Content-Type': 'application/json'}, {}));
          }
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      // GoogleAuthProvider stubs.
      const addScopeStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'addScope');
      stubs.push(addScopeStub);
      const setCustomParametersStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'setCustomParameters');
      stubs.push(setCustomParametersStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          adminFormButton.click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button shown.
          expect(reauthButton.style.display).to.be.equal('inline-block');
          assertToastMessage('Error', MSG_INVALID_CREDENTIALS);
          expect(showToast).to.have.been.calledOnce;
          // Click re-auth button.
          reauthButton.click();
          // Add some delay to allow reauthenticateWithPopup to process.
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 20);
          });
        })
        .then(() => {
          // Re-auth button should be hidden now.
          expect(reauthButton.style.display).to.be.equal('none');
          // Try to save again.
          adminFormButton.click();
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          expect(httpClientSendStub.callCount).to.be.equal(4);
          assertToastMessage('Success', MSG_CONFIGURATION_SAVED);
          expect(showToast).to.have.been.calledTwice;
        });
    });

    it('should trigger re-auth on Invalid Credentials error', () => {
      let callCounter = 0;
      const invalidCredentialsMessage = 'Invalid Credentials';
      const reauthButton = document.getElementsByClassName('reauth')[0] as HTMLButtonElement;
      const adminFormButton = mainContainer.querySelector('button[type="submit"]') as HTMLButtonElement;
      const stubbedUserMethods = {
        email: EMAIL,
        reauthenticateWithPopup: sinon.stub().callsFake((provider) => {
          expect(provider.providerId).to.be.equal('google.com');
          expect(addScopeStub).to.have.been.calledTwice;
          expect(addScopeStub.getCall(0)).to.have.been.calledWith(OAUTH_SCOPES[0]);
          expect(addScopeStub.getCall(1)).to.have.been.calledWith(OAUTH_SCOPES[1]);
          expect(setCustomParametersStub).to.have.been.calledOnce
            .and.calledWith({login_hint: EMAIL, prompt: 'select_account'});
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              // Return updated OAuth access token.
              accessToken: UPDATED_OAUTH_ACCESS_TOKEN,
            },
          })
        }),
      };
      const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1', stubbedUserMethods);
      const UNAUTHORIZED_USER_ERROR = 'Unauthorized user';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 500',
          500,
          {
            data: {
              error: {
                code: 500,
                message: invalidCredentialsMessage,
              },
            },
          });
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        callCounter++;
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          if (callCounter === 3) {
            expect(params.headers).to.deep.equal({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
            });
            expect(params.data).to.deep.equal(updatedUiConfig);
            // Simulate invalid credentials.
            return Promise.reject(serverLowLevelError);
          } else if (callCounter === 4) {
            // This call should be made with an updated OAuth access token.
            expect(params.headers).to.deep.equal({
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${UPDATED_OAUTH_ACCESS_TOKEN}`,
            });
            expect(params.data).to.deep.equal(updatedUiConfig);
            return Promise.resolve(testUtils.createMockHttpResponse(
                {'Content-Type': 'application/json'}, {}));
          }
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      // GoogleAuthProvider stubs.
      const addScopeStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'addScope');
      stubs.push(addScopeStub);
      const setCustomParametersStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'setCustomParameters');
      stubs.push(setCustomParametersStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          adminFormButton.click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button shown.
          expect(reauthButton.style.display).to.be.equal('inline-block');
          assertToastMessage('Error', MSG_INVALID_CREDENTIALS);
          expect(showToast).to.have.been.calledOnce;
          // Click re-auth button.
          reauthButton.click();
          // Add some delay to allow reauthenticateWithPopup to process.
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 20);
          });
        })
        .then(() => {
          // Re-auth button should be hidden now.
          expect(reauthButton.style.display).to.be.equal('none');
          // Try to save again.
          adminFormButton.click();
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          expect(httpClientSendStub.callCount).to.be.equal(4);
          assertToastMessage('Success', MSG_CONFIGURATION_SAVED);
          expect(showToast).to.have.been.calledTwice;
        });
    });

    it('should handle reauthenticateWithPopup error', () => {
      const expectedError = new Error('Reauth error');
      const reauthButton = document.getElementsByClassName('reauth')[0] as HTMLButtonElement;
      const adminFormButton = mainContainer.querySelector('button[type="submit"]') as HTMLButtonElement;
      const stubbedUserMethods = {
        email: EMAIL,
        reauthenticateWithPopup: sinon.stub().callsFake((provider) => {
          expect(provider.providerId).to.be.equal('google.com');
          expect(addScopeStub).to.have.been.calledTwice;
          expect(addScopeStub.getCall(0)).to.have.been.calledWith(OAUTH_SCOPES[0]);
          expect(addScopeStub.getCall(1)).to.have.been.calledWith(OAUTH_SCOPES[1]);
          expect(setCustomParametersStub).to.have.been.calledOnce
            .and.calledWith({login_hint: EMAIL, prompt: 'select_account'});
          return Promise.reject(expectedError);
        }),
      };
      const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1', stubbedUserMethods);
      const UNAUTHORIZED_USER_ERROR = 'Unauthorized user';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 401',
          401,
          {
            data: {
              error: {
                code: 401,
                message: UNAUTHORIZED_USER_ERROR,
              },
            },
          });
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          expect(params.data).to.deep.equal(updatedUiConfig);
          // Simulate token expired.
          return Promise.reject(serverLowLevelError);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      // GoogleAuthProvider stubs.
      const addScopeStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'addScope');
      stubs.push(addScopeStub);
      const setCustomParametersStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'setCustomParameters');
      stubs.push(setCustomParametersStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          adminFormButton.click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button shown.
          expect(reauthButton.style.display).to.be.equal('inline-block');
          assertToastMessage('Error', MSG_INVALID_CREDENTIALS);
          expect(showToast).to.have.been.calledOnce;
          // Click re-auth button.
          reauthButton.click();
          // Add some delay to allow reauthenticateWithPopup to process.
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 20);
          });
        })
        .then(() => {
          expect(reauthButton.style.display).to.be.equal('inline-block');
          // Confirm re-auth error shown in toast alert.s
          assertToastMessage('Error', expectedError.message);
          expect(showToast).to.have.been.calledTwice;
        });
    });

    it('should handle null currentUser before reauthenticateWithPopup', () => {
      const reauthButton = document.getElementsByClassName('reauth')[0] as HTMLButtonElement;
      const adminFormButton = mainContainer.querySelector('button[type="submit"]') as HTMLButtonElement;
      const stubbedUserMethods = {
        email: EMAIL,
        reauthenticateWithPopup: sinon.stub(),
      };
      const mockUser = new testUtils.MockUser('UID123', 'ID_TOKEN1', stubbedUserMethods);
      const UNAUTHORIZED_USER_ERROR = 'Unauthorized user';
      const serverLowLevelError = testUtils.createMockLowLevelError(
          'Server responded with status 401',
          401,
          {
            data: {
              error: {
                code: 401,
                message: UNAUTHORIZED_USER_ERROR,
              },
            },
          });
      const updatedUiConfig = utils.deepCopy(expectedUiConfig);
      updatedUiConfig[API_KEY].selectTenantUiTitle = 'Custom title';
      const stubbedAuthMethods = {
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().callsFake(() => {
          app.auth().setCurrentMockUser(mockUser);
          return Promise.resolve({
            user: mockUser,
            credential: {
              providerId: 'google.com',
              accessToken: OAUTH_ACCESS_TOKEN,
            },
          });
        }),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      const expectedGetAdminConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedUiConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.mode).to.be.equal('same-origin');
        expect(params.cache).to.be.equal('no-cache');
        if (params.url === '/gcipConfig') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        } else if (params.url === '/get_admin_config') {
          expect(params.method).to.be.equal('GET');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          return Promise.resolve(expectedGetAdminConfigResp);
        } else if (params.url === '/set_admin_config') {
          expect(params.method).to.be.equal('POST');
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OAUTH_ACCESS_TOKEN}`,
          });
          expect(params.data).to.deep.equal(updatedUiConfig);
          // Simulate token expired.
          return Promise.reject(serverLowLevelError);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      // GoogleAuthProvider stubs.
      const addScopeStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'addScope');
      stubs.push(addScopeStub);
      const setCustomParametersStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'setCustomParameters');
      stubs.push(setCustomParametersStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledTwice;
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(mainContainer.style.display).to.be.equal('block');
          expect(area.value).to.be.equal(JSON.stringify(expectedUiConfig, undefined, 2));
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.have.been.calledOnce.and.calledWith(
              area, CODE_MIRROR_CONFIG);
          const editorInstance = codeMirrorEditorSpy.getCall(0).returnValue;
          expect(editorInstance.getValue()).to.be.equal(area.value);
          // Update editor content.
          editorInstance.setValue(JSON.stringify(updatedUiConfig));
          // Test save functionality.
          adminFormButton.click();
          expect(httpClientSendStub).to.have.been.calledThrice;
          // Add some delay before checking toast message.
          return Promise.resolve();
        })
        .then(() => {
          // Confirm re-auth button shown.
          expect(reauthButton.style.display).to.be.equal('inline-block');
          assertToastMessage('Error', MSG_INVALID_CREDENTIALS);
          expect(showToast).to.have.been.calledOnce;
          // Simulate user signed out for some reason.
          app.auth().signOut();
          // Click re-auth button. This will trigger an error.
          reauthButton.click();
          expect(reauthButton.style.display).to.be.equal('inline-block');
          assertToastMessage('Error', MSG_NO_USER_LOGGED_IN);
          expect(showToast).to.have.been.calledTwice;
        });
    });

    it('should trigger signInWithRedirect with expected provider when no credential is available', () => {
      const stubbedAuthMethods = {
        signInWithRedirect: sinon.stub().callsFake((provider) => {
          expect(stubbedAuthMethods.getRedirectResult).to.have.been.calledOnce;
          expect(stubbedAuthMethods.setPersistence).to.have.been.calledOnce
            .and.calledWith('none');
          expect(provider.providerId).to.be.equal('google.com');
          expect(addScopeStub).to.have.been.calledTwice;
          expect(addScopeStub.getCall(0)).to.have.been.calledWith(OAUTH_SCOPES[0]);
          expect(addScopeStub.getCall(1)).to.have.been.calledWith(OAUTH_SCOPES[1]);
          expect(setCustomParametersStub).to.have.been.calledOnce
            .and.calledWith({login_hint: undefined, prompt: 'select_account'});
        }),
        setPersistence: sinon.stub(),
        getRedirectResult: sinon.stub().resolves({user: null, credential: null}),
      };
      const app = testUtils.createMockApp(
          expectedGcipConfig,
          stubbedAuthMethods);
      const expectedGcipConfigResp = testUtils.createMockHttpResponse(
          {'Content-Type': 'application/json'},
          expectedGcipConfig);
      httpClientSendStub.callsFake((params) => {
        expect(params.timeout).to.be.equal(TIMEOUT_DURATION);
        expect(params.method).to.be.equal('GET');
        if (params.url === '/gcipConfig') {
          expect(params.headers).to.deep.equal({
            'Content-Type': 'application/json',
          });
          return Promise.resolve(expectedGcipConfigResp);
        }
        throw new Error('Unexpected call');
      });
      const firebaseStub = sinon.stub(firebase, 'initializeApp');
      firebaseStub.callsFake((config) => {
        expect(config).to.deep.equal(expectedGcipConfig);
        return app as any;
      });
      stubs.push(firebaseStub);
      // GoogleAuthProvider stubs.
      const addScopeStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'addScope');
      stubs.push(addScopeStub);
      const setCustomParametersStub = sinon.stub(firebase.auth.GoogleAuthProvider.prototype, 'setCustomParameters');
      stubs.push(setCustomParametersStub);

      const adminUi = new AdminUi(mainContainer, showToast);
      const copyToClipboardButton = document.getElementsByClassName('copy-to-clipboard')[0] as HTMLButtonElement;
      return adminUi.render()
        .then(() => {
          expect(httpClientSendStub).to.have.been.calledOnce;
          expect(stubbedAuthMethods.signInWithRedirect).to.have.been.calledOnce.and.calledAfter(httpClientSendStub);
          expect(mainContainer.style.display).to.be.equal('none');
          const area = document.getElementsByClassName('config')[0] as HTMLTextAreaElement;
          expect(area.value).to.be.equal('');
          // Confirm CodeMirror editor behavior.
          expect(codeMirrorEditorSpy).to.not.have.been.called;
          // Spinner should not be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.equal(document.body);
          // Copy button should remain hidden.
          expect(copyToClipboardButton.style.display).to.be.equal('none');
        });
    });
  });
});
