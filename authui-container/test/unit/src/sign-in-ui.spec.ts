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
import { SignInUi, UiConfig, HOSTED_UI_VERSION } from '../../../src/sign-in-ui';
import * as ciap from 'gcip-iap';
import * as firebaseui from 'firebaseui';
import * as utils from '../../../src/utils/index';
import * as browser from '../../../src/utils/browser';
import {HttpClient} from '../../../src/utils/http-client';
import {createMockLowLevelError, createMockHttpResponse} from './test-utils';

interface Callbacks {
  selectTenantUiShown: () => {};
  selectTenantUiHidden: () => {};
  signInUiShown: (tenantId: string | null) => {};
  [key: string]: any;
}

/**
 * Asserts the expected error message is handled.
 * @param containerElement The container element where FirebaseUI is rendered.
 * @param message The expected error message.
 */
function assertErrorMessageShown(containerElement: HTMLElement, message: string) {
  const separatorElement = document.getElementById('separator');
  const mainContainerElement = document.getElementsByClassName('main-container')[0];
  const titleElement = document.getElementById('title');
  const imgElement = document.getElementById('logo');

  expect(mainContainerElement.classList.contains('blend')).to.be.false;
  expect(separatorElement.style.display).to.be.equal('none');
  expect(containerElement.innerText).to.be.equal(message);
  expect(imgElement.style.display).to.be.equal('none');
  expect(titleElement.innerText).to.be.equal('');
}

/**
 * Asserts the expected callbacks are set on FirebaseUI.
 * @param callbacks The callbacks object to test for expected behavior.
 * @param expectedUiConfig The expected UI config returned by /config.
 * @param apiKey The API key.
 * @param tenantId A non-null tenant ID to test for expected sign-in behavior.
 */
function assertExpectedFirebaseUiCallbacks(
    callbacks: Callbacks, expectedUiConfig: UiConfig, apiKey: string, tenantId: string) {
  const mainContainerElement = document.getElementsByClassName('main-container')[0];
  const separatorElement = document.getElementById('separator');
  const titleElement = document.getElementById('title');
  const imgElement = document.getElementById('logo');

  // Reset elements to test.
  mainContainerElement.classList.add('blend');
  separatorElement.style.display = 'none';
  imgElement.style.display = 'none';

  // Check behavior of selectTenantUiShown.
  callbacks.selectTenantUiShown();
  expect(mainContainerElement.classList.contains('blend')).to.be.false;
  expect(titleElement.innerText).to.be.equal(expectedUiConfig[apiKey].selectTenantUiTitle);
  if (expectedUiConfig[apiKey].selectTenantUiLogo) {
    expect(separatorElement.style.display).to.be.equal('block');
    expect((imgElement as HTMLImageElement).src).to.be.equal(expectedUiConfig[apiKey].selectTenantUiLogo);
    expect(imgElement.style.display).to.be.equal('block');
  } else {
    expect(separatorElement.style.display).to.be.equal('none');
    expect(imgElement.style.display).to.be.equal('none');
  }

  // Check behavior of selectTenantUiHidden.
  callbacks.selectTenantUiHidden();
  expect(titleElement.innerText).to.be.equal('');

  // Check behavior of signInUiShown.
  mainContainerElement.classList.add('blend');
  separatorElement.style.display = 'none';
  imgElement.style.display = 'none';
  // Test with project level config.
  callbacks.signInUiShown(null);
  expect(mainContainerElement.classList.contains('blend')).to.be.false;
  expect(titleElement.innerText).to.be.equal(expectedUiConfig[apiKey].tenants._.displayName);
  if (expectedUiConfig[apiKey].tenants._.logoUrl) {
    expect((imgElement as HTMLImageElement).src).to.be.equal(expectedUiConfig[apiKey].tenants._.logoUrl);
    expect(imgElement.style.display).to.be.equal('block');
    expect(separatorElement.style.display).to.be.equal('block');
  } else {
    expect(imgElement.style.display).to.be.equal('none');
    expect(separatorElement.style.display).to.be.equal('none');
  }
  // Test with tenant level config.
  mainContainerElement.classList.add('blend');
  separatorElement.style.display = 'none';
  imgElement.style.display = 'none';
  // Test with project level config.
  callbacks.signInUiShown(tenantId);
  expect(mainContainerElement.classList.contains('blend')).to.be.false;
  expect(titleElement.innerText).to.be.equal(expectedUiConfig[apiKey].tenants[tenantId].displayName);
  if (expectedUiConfig[apiKey].tenants[tenantId].logoUrl) {
    expect((imgElement as HTMLImageElement).src).to.be.equal(expectedUiConfig[apiKey].tenants[tenantId].logoUrl);
    expect(imgElement.style.display).to.be.equal('block');
    expect(separatorElement.style.display).to.be.equal('block');
  } else {
    expect(imgElement.style.display).to.be.equal('none');
    expect(separatorElement.style.display).to.be.equal('none');
  }
}

describe('SignInUi', () => {
  let loadingSpinner: HTMLElement;
  let mainContainer: HTMLElement;
  let stubs: sinon.SinonStub[];
  let firebaseUiHandlerStub: sinon.SinonStub;
  let ciapAuthenticationStub: sinon.SinonStub;
  let setStyleSheetStub: sinon.SinonStub;
  let mockAuth;
  let mockHandler;
  let httpClientSendStub: sinon.SinonStub;

  const containerElement = '#firebaseui-container';
  const CUSTOM_STYLESHEET_URL = './css/custom-stylesheet.css';
  const PROJECT_ID = 'project-id';
  const API_KEY = 'API_KEY';
  const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
  const expectedUiConfig: UiConfig = {
    [API_KEY]: {
      authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
      displayMode: 'optionFirst',
      selectTenantUiTitle: PROJECT_ID,
      selectTenantUiLogo: 'http://www.example.com/img/select-tenant-logo.png',
      styleUrl: CUSTOM_STYLESHEET_URL,
      tenants: {
        _: {
          displayName: 'ABCD',
          iconUrl: 'http://www.example.com/img/tenant-icon0.png',
          logoUrl: 'http://www.example.com/img/tenant-logo0.png',
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
          iconUrl: 'http://www.example.com/img/tenant-icon1.png',
          logoUrl: 'http://www.example.com/img/tenant-logo1.png',
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
          iconUrl: 'http://www.example.com/img/tenant-icon2.png',
          logoUrl: 'http://www.example.com/img/tenant-logo2.png',
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
  const expectedFirebaseuiConfig = {
    [API_KEY]: utils.deepCopy(expectedUiConfig[API_KEY]),
  };
  delete expectedFirebaseuiConfig[API_KEY].selectTenantUiLogo;
  delete expectedFirebaseuiConfig[API_KEY].selectTenantUiTitle;
  delete expectedFirebaseuiConfig[API_KEY].styleUrl;
  const expectedConfigRequest = {
    method: 'GET',
    url: '/config',
    timeout: 30000,
  };

  beforeEach(() => {
    loadingSpinner = document.createElement('div');
    loadingSpinner.id = 'loading-spinner';
    loadingSpinner.classList.add('d-flex', 'justify-content-center');
    loadingSpinner.innerHTML = `
      <div class="spinner-border text-secondary" role="status">
        <span class="sr-only">Loading...</span>
      </div>`;
    document.body.appendChild(loadingSpinner);

    mainContainer = document.createElement('div');
    mainContainer.classList.add('main-container', 'blend');
    mainContainer.innerHTML = `
        <h4 id="tenant-header" class="heading-center">
          <span id="title"></span>
        </h4>
        <div id="separator" style="display:none;">
          <div class="separator"><img id="logo" src="" style="max-width:64px;"></div>
        </div>
        <div id="firebaseui-container"></div>`;
    document.body.appendChild(mainContainer);
    stubs = [];
    mockAuth = {
      start: sinon.stub().resolves(),
    };
    mockHandler = {
      getAuth: () => {/** Empty */},
      startSignIn: () => {/** Empty */},
      completeSignOut: () => {/** Empty */},
      processUser: () => {/** Empty */},
      showProgressBar: () => {/** Empty */},
      hideProgressBar: () => {/** Empty */},
      handleError: () => {/** Empty */},
      selectTenant: () => {/** Empty */},
     };
    ciapAuthenticationStub = sinon.stub(ciap, 'Authentication').returns(mockAuth);
    stubs.push(ciapAuthenticationStub);
    firebaseUiHandlerStub = sinon.stub(firebaseui.auth, 'FirebaseUiHandler').returns(mockHandler);
    stubs.push(firebaseUiHandlerStub);
    setStyleSheetStub = sinon.stub(utils, 'setStyleSheet');
    stubs.push(setStyleSheetStub);
    httpClientSendStub = sinon.stub(HttpClient.prototype, 'send');
    stubs.push(httpClientSendStub);
  });

  afterEach(() => {
    if (loadingSpinner && loadingSpinner.parentNode) {
      document.body.removeChild(loadingSpinner);
    }
    if (mainContainer) {
      document.body.removeChild(mainContainer);
    }
    stubs.forEach((s) => s.restore());
  });

  describe('constructor', () => {
    it('should not throw when valid container provided', () => {
      expect(() => {
        return new SignInUi(containerElement);
      }).not.to.throw();
    });

    it('should throw when invalid container provided', () => {
      expect(() => {
        return new SignInUi('#not-found');
      }).to.throw(`Container element #not-found not found`);
    });

    it('should throw when #title not found', () => {
      expect(() => {
        document.getElementById('title').remove();
        return new SignInUi(containerElement);
      }).to.throw(`#title element not found`);
    });

    it('should throw when #logo not found', () => {
      expect(() => {
        document.getElementById('logo').remove();
        return new SignInUi(containerElement);
      }).to.throw(`#logo element not found`);
    });

    it('should throw when #separator not found', () => {
      expect(() => {
        document.getElementById('separator').remove();
        return new SignInUi(containerElement);
      }).to.throw(`#separator element not found`);
    });

    it('should throw when .main-container not found', () => {
      expect(() => {
        document.body.removeChild(mainContainer);
        mainContainer = null;

        return new SignInUi(containerElement);
      }).to.throw(`.main-container element not found`);
    });
  });

  describe('render()', () => {
    it('should render sign-in UI with expected parameters', () => {
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, utils.deepCopy(expectedUiConfig));
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce
            .and.calledWith(mockHandler, undefined, HOSTED_UI_VERSION);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              expectedUiConfig,
              API_KEY,
              'tenantId2');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedFirebaseuiConfig);
        });
    });

    it('should keep immediateFederatedRedirect true in non-Safari browsers', () => {
      // Simulate Chrome browser.
      const getBrowserNameStub = sinon.stub(browser, 'getBrowserName');
      getBrowserNameStub.returns(browser.BrowserName.Chrome);
      stubs.push(getBrowserNameStub);
      // Simulate single provider with immediate redirect.
      const singleProviderConfig: UiConfig = utils.deepCopy(expectedUiConfig);
      singleProviderConfig[API_KEY].tenants.tenantId1.immediateFederatedRedirect = true;
      singleProviderConfig[API_KEY].tenants.tenantId1.signInOptions = ['facebook.com'];
      const expectedSingleProviderFirebaseuiConfig = {
        [API_KEY]: utils.deepCopy(singleProviderConfig[API_KEY]),
      };
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].selectTenantUiLogo;
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].selectTenantUiTitle;
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].styleUrl;
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, singleProviderConfig);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              singleProviderConfig,
              API_KEY,
              'tenantId1');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedSingleProviderFirebaseuiConfig);
        });
    });

    it('should handle missing tenant logoUrls as expected', () => {
       // Simulate tenant with no logoUrl.
      const modifiedProviderConfig: UiConfig = utils.deepCopy(expectedUiConfig);
      delete modifiedProviderConfig[API_KEY].tenants.tenantId1.logoUrl;
      const expectedModifiedProviderFirebaseuiConfig = {
        [API_KEY]: utils.deepCopy(modifiedProviderConfig[API_KEY]),
      };
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].selectTenantUiLogo;
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].selectTenantUiTitle;
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].styleUrl;
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].tenants.tenantId1.logoUrl;
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, modifiedProviderConfig);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              modifiedProviderConfig,
              API_KEY,
              'tenantId1');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedModifiedProviderFirebaseuiConfig);
        });
    });

    it('should handle missing selectTenantUiLogo as expected', () => {
       // Simulate tenant with no selectTenantUiLogo.
      const modifiedProviderConfig: UiConfig = utils.deepCopy(expectedUiConfig);
      delete modifiedProviderConfig[API_KEY].selectTenantUiLogo;
      const expectedModifiedProviderFirebaseuiConfig = {
        [API_KEY]: utils.deepCopy(modifiedProviderConfig[API_KEY]),
      };
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].selectTenantUiLogo;
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].selectTenantUiTitle;
      delete expectedModifiedProviderFirebaseuiConfig[API_KEY].styleUrl;
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, modifiedProviderConfig);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              modifiedProviderConfig,
              API_KEY,
              'tenantId1');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedModifiedProviderFirebaseuiConfig);
        });
    });

    it('should set immediateFederatedRedirect false in Safari browsers', () => {
      // Simulate Safari browser.
      const getBrowserNameStub = sinon.stub(browser, 'getBrowserName');
      getBrowserNameStub.returns(browser.BrowserName.Safari);
      stubs.push(getBrowserNameStub);
      // Simulate single provider with immediate redirect.
      const singleProviderConfig: UiConfig = utils.deepCopy(expectedUiConfig);
      singleProviderConfig[API_KEY].tenants.tenantId1.immediateFederatedRedirect = true;
      singleProviderConfig[API_KEY].tenants.tenantId1.signInOptions = ['facebook.com'];
      const expectedSingleProviderFirebaseuiConfig = {
        [API_KEY]: utils.deepCopy(singleProviderConfig[API_KEY]),
      };
      // This should be changed to false.
      expectedSingleProviderFirebaseuiConfig[API_KEY].tenants.tenantId1.immediateFederatedRedirect = false;
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].selectTenantUiLogo;
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].selectTenantUiTitle;
      delete expectedSingleProviderFirebaseuiConfig[API_KEY].styleUrl;
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, singleProviderConfig);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              singleProviderConfig,
              API_KEY,
              'tenantId1');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedSingleProviderFirebaseuiConfig);
        });
    });

    it('should render sign-in UI with expected parameters and hide logos when none provided', () => {
      const expectedUiConfigWithoutLogos = utils.deepCopy(expectedUiConfig);
      delete expectedUiConfigWithoutLogos[API_KEY].selectTenantUiLogo;
      delete expectedUiConfigWithoutLogos[API_KEY].tenants._.logoUrl;
      delete expectedUiConfigWithoutLogos[API_KEY].tenants.tenantId1.logoUrl;
      delete expectedUiConfigWithoutLogos[API_KEY].tenants.tenantId2.logoUrl;

      const expectedFirebaseuiConfigWithoutLogos = utils.deepCopy(expectedFirebaseuiConfig);
      delete expectedFirebaseuiConfigWithoutLogos[API_KEY].selectTenantUiLogo;
      delete expectedFirebaseuiConfigWithoutLogos[API_KEY].tenants._.logoUrl;
      delete expectedFirebaseuiConfigWithoutLogos[API_KEY].tenants.tenantId1.logoUrl;
      delete expectedFirebaseuiConfigWithoutLogos[API_KEY].tenants.tenantId2.logoUrl;

      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, expectedUiConfigWithoutLogos);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              expectedUiConfigWithoutLogos,
              API_KEY,
              'tenantId2');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedFirebaseuiConfigWithoutLogos);
        });
    });

    it('should render sign-in UI with expected parameters but not set styleUrl if not found', () => {
      const expectedUiConfigWithoutStyleSheet = utils.deepCopy(expectedUiConfig);
      delete expectedUiConfigWithoutStyleSheet[API_KEY].styleUrl;
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, expectedUiConfigWithoutStyleSheet);
      httpClientSendStub.resolves(expectedResp);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(setStyleSheetStub).to.not.have.been.called;
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          assertExpectedFirebaseUiCallbacks(
              actualFirebaseUiConfig[API_KEY].callbacks,
              expectedUiConfigWithoutStyleSheet,
              API_KEY,
              'tenantId2');
          // Confirm the remaining config parameters match.
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedFirebaseuiConfig);
        });
    });

    it('should handle /config download errors', () => {
      const expectedMessage = 'Unable to get config';
      const serverLowLevelError = createMockLowLevelError(
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
      // stub /config.
      httpClientSendStub.rejects(serverLowLevelError);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(error.message).to.be.equal(expectedMessage);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(setStyleSheetStub).to.not.have.been.called;
          expect(ciapAuthenticationStub).to.not.have.been.called;
          expect(mockAuth.start).to.not.have.been.called;
          expect(firebaseUiHandlerStub).to.not.have.been.called;
          // Confirm error message shown.
          assertErrorMessageShown(document.querySelector(containerElement), expectedMessage);
        });
    });

    it('should handle ciap.Authentication errors', () => {
      const expectedError = new Error('Some error occurred');
      // stub /config.
      const expectedResp = createMockHttpResponse(
          {'Content-Type': 'application/json'}, utils.deepCopy(expectedUiConfig));
      httpClientSendStub.resolves(expectedResp);
      // Simular Authentication.start() rejects.
      mockAuth.start = sinon.stub().rejects(expectedError);

      const signInUi = new SignInUi(containerElement);
      return signInUi.render()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          // Spinner should be removed from DOM.
          expect(loadingSpinner.parentNode).to.be.null;
          expect(error).to.be.equal(expectedError);
          expect(setStyleSheetStub).to.have.been.calledOnce.and.calledWith(document, CUSTOM_STYLESHEET_URL);
          expect(httpClientSendStub).to.have.been.calledOnce.and.calledWith(expectedConfigRequest);
          expect(ciapAuthenticationStub).to.have.been.calledOnce.and.calledWith(mockHandler);
          expect(mockAuth.start).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub).to.have.been.calledOnce;
          expect(firebaseUiHandlerStub.getCalls()[0].args[0]).to.be.equal(containerElement);
          const actualFirebaseUiConfig = firebaseUiHandlerStub.getCalls()[0].args[1];
          delete actualFirebaseUiConfig[API_KEY].callbacks;
          expect(actualFirebaseUiConfig).to.deep.equal(expectedFirebaseuiConfig);
          // Confirm error message shown.
          assertErrorMessageShown(document.querySelector(containerElement), expectedError.message);
        });
    });
  });
});
