/*!
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

import * as _ from 'lodash';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as proxy from 'http-proxy-middleware';
import request = require('supertest');
import * as templates from  '../../../server/templates';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as http from 'http';
import {
  AuthServer, AUTH_SERVER_SCOPES, HOSTED_UI_VERSION, MAX_BUCKET_STRING_LENGTH,
  ALLOWED_LAST_CHAR,
} from '../../../server/auth-server';
import express = require('express');
import * as storage from '../../../server/api/cloud-storage-handler';
import * as metadata from '../../../server/api/metadata-server';
import { ERROR_MAP, ErrorResponse } from '../../../server/utils/error';
import { addReadonlyGetter } from '../../../common/index';
import { deepCopy } from '../../../common/deep-copy';
import * as gcip from '../../../server/api/gcip-handler';
import * as iap from '../../../server/api/iap-settings-handler';
import {
  DefaultUiConfigBuilder,
} from '../../../common/config-builder';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

/**
 * Generates the HttpServerRequestHandler error using the provided
 * expectedResponse.
 * @param expectedResponse The expected error response object.
 * @return The associated HttpServerRequestHandler generated error.
 */
function createError(expectedResponse: ErrorResponse) {
  const expectedError = new Error(expectedResponse.error.message);
  addReadonlyGetter(expectedError, 'cloudCompliant', true);
  addReadonlyGetter(expectedError, 'rawResponse', expectedResponse);
  return expectedError;
}

/**
 * Asserts metadata server instance was passed to API handler as app data.
 * @param apiHandlerConstructor The API handler constructor spy.
 * @param metadataServerConstructor The metadata server constructor spy.
 */
function assertApiHandlerInitializedWithMetadataServer(
    apiHandlerConstructor: sinon.SinonSpy, metadataServerConstructor: sinon.SinonSpy) {
  expect(metadataServerConstructor).to.have.been.calledOnce;
  expect(apiHandlerConstructor.firstCall.args[0])
    .to.be.equal(metadataServerConstructor.firstCall.returnValue);
}

describe('AuthServer', () => {
  let metadataServerSpy: sinon.SinonSpy;
  let cloudStorageHandlerSpy: sinon.SinonSpy;
  let gcipHandlerSpy: sinon.SinonSpy;
  let iapSettingsHandlerSpy: sinon.SinonSpy;
  let fetchAuthSpy: sinon.SinonSpy;
  let stubs: sinon.SinonStub[] = [];
  let consoleStub: sinon.SinonStub;
  let getGcipConfigStub: sinon.SinonStub;
  let createProxyMiddlewareStub: sinon.SinonStub;

  const PROJECT_NUMBER = '1234567890';
  const PROJECT_ID = 'project-id';
  const API_KEY = 'API_KEY';
  const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
  const HOST_NAME = 'gcip-iap-hosted-ui-xyz.uc.run.app';
  const K_CONFIGURATION = 'service123';
  let app: express.Application;
  let authServer: AuthServer;
  const previousKConfiguration = process.env.K_CONFIGURATION;
  const previousGCSBucketName = process.env.GCS_BUCKET_NAME;
  const previousUiConfig = process.env.UI_CONFIG;
  const previousAllowAdmin = process.env.ALLOW_ADMIN;
  const previousDebugConsole = process.env.DEBUG_CONSOLE;
  const METADATA_ACCESS_TOKEN = 'METADATA_ACCESS_TOKEN';
  const CONFIG = {
    apiKey: API_KEY,
    authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
  };
  let proxyRequest: http.ClientRequest | undefined;

  beforeEach(async () =>  {
    process.env.K_CONFIGURATION = K_CONFIGURATION;
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.UI_CONFIG;
    delete process.env.ALLOW_ADMIN;
    delete process.env.DEBUG_CONSOLE;
    app = express();
    metadataServerSpy = sinon.spy(metadata, 'MetadataServer');
    gcipHandlerSpy = sinon.spy(gcip, 'GcipHandler');
    cloudStorageHandlerSpy = sinon.spy(storage, 'CloudStorageHandler');
    iapSettingsHandlerSpy = sinon.spy(iap, 'IapSettingsHandler');
    fetchAuthSpy = sinon.spy(AuthServer.prototype, 'fetchAuthDomainProxyTarget' as any);
    consoleStub = sinon.stub(console, 'log');
    const getAccessToken = sinon.stub(metadata.MetadataServer.prototype, 'getAccessToken')
      .resolves(METADATA_ACCESS_TOKEN);
    stubs.push(getAccessToken);
    getGcipConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getGcipConfig')
      .resolves(CONFIG);
    stubs.push(getGcipConfigStub);
    const middleware = proxy.createProxyMiddleware({
      target: `https://${CONFIG.authDomain}`,
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        proxyRequest = proxyReq;
      }
    });
    createProxyMiddlewareStub = sinon.stub(proxy, 'createProxyMiddleware').returns(middleware);
    stubs.push(createProxyMiddlewareStub);
    authServer = new AuthServer(app);
    await fetchAuthSpy;
    return authServer.start();
  });

  afterEach(() => {
    // Restore environment variables modified in tests.
    process.env.K_CONFIGURATION = previousKConfiguration;
    process.env.GCS_BUCKET_NAME = previousGCSBucketName;
    process.env.UI_CONFIG = previousUiConfig;
    process.env.ALLOW_ADMIN = previousAllowAdmin;
    process.env.DEBUG_CONSOLE = previousDebugConsole;
    consoleStub.restore();
    metadataServerSpy.restore();
    gcipHandlerSpy.restore();
    iapSettingsHandlerSpy.restore();
    cloudStorageHandlerSpy.restore();
    fetchAuthSpy.restore();
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    authServer.stop();
    proxyRequest = undefined;
  });

  describe('logging', () => {
    it('should only log version to console by default', () => {
      // Metadata server initialized with expected OAuth scopes.
      expect(metadataServerSpy).to.have.been.calledOnce
        .and.calledWith(AUTH_SERVER_SCOPES);
      expect(consoleStub).to.have.been.calledOnce
        .and.calledWith('Server started with version', HOSTED_UI_VERSION);
      // Get logger passed to metadataServer initializer.
      const logger = metadataServerSpy.getCall(0).args[1];
      logger('hello', 'world');
      // No data should be logged.
      expect(consoleStub).to.have.been.calledOnce;
    });

    it('should log data when DEBUG_CONSOLE is set', () => {
      // Restart server with DEBUG_CONSOLE variable enabled.
      metadataServerSpy.restore();
      authServer.stop();
      app = express();
      process.env.DEBUG_CONSOLE = '1';
      consoleStub.reset();
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        // Metadata server initialized with expected OAuth scopes.
        expect(metadataServerSpy).to.have.been.calledOnce
          .and.calledWith(AUTH_SERVER_SCOPES);
        // Get logger passed to metadataServer initializer.
        const logger = metadataServerSpy.getCall(0).args[1];
        logger('hello', 'world');
        logger('foo bar');
        // Data should be logged.
        expect(consoleStub).to.have.callCount(3);
        expect(consoleStub.firstCall).have.been.calledWith(
          'Server started with version', HOSTED_UI_VERSION);
        expect(consoleStub.secondCall).have.been.calledWith('hello', 'world');
        expect(consoleStub.thirdCall).have.been.calledWith('foo bar');
      });
    });
  });

  it('responds to /', () => {
    const logo = 'https://img.icons8.com/cotton/2x/cloud.png';
    const expectedResponse = templates.main({
      logo,
    });

    return request(authServer.server)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200)
      .then((response) => {
        expect(response.text).to.equal(expectedResponse);
      });
  });

  it('responds to /versionz', () => {
    return request(authServer.server)
      .get('/versionz')
      .expect('Content-Type', /html/)
      .expect(200)
      .then((response) => {
        expect(response.text).to.equal(HOSTED_UI_VERSION);
      });
  });

  it('responds to /authdomain-proxytarget', () => {
    return request(authServer.server)
      .get('/authdomain-proxytarget')
      .expect('Content-Type', /html/)
      .expect(200)
      .then(async (response) => {
        // One for initiate the end-point, one for GET /authdomain-proxytarget
        expect(fetchAuthSpy).to.have.been.calledTwice;
        expect(await fetchAuthSpy.firstCall.returnValue).to.equal(`https://${CONFIG.authDomain}`);
        expect(await fetchAuthSpy.secondCall.returnValue).to.equal(`https://${CONFIG.authDomain}`);
        expect(gcipHandlerSpy).to.have.been.calledOnce;
        expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
          .to.eventually.equal(METADATA_ACCESS_TOKEN);
        // getGcipConfig called.
        expect(getGcipConfigStub).to.have.been.calledTwice;
        expect(response.text).to.equal(`https://${CONFIG.authDomain}`);
      });
  });

  describe('responds to /__/auth', () => {
    it('responds to /__/auth/handler', () => {
      return request(authServer.server)
        .get('/__/auth/handler')
        .then(() => {
          expect(proxyRequest?.getHeader('host')).to.equal(`${CONFIG.authDomain}`.toLowerCase());
        });
    });

    it('responds to /__/auth/iframe', () => {
      return request(authServer.server)
        .get('/__/auth/iframe')
        .then(() => {
          expect(proxyRequest?.getHeader('host')).to.equal(`${CONFIG.authDomain}`.toLowerCase());
        });
    });
  });

  describe('responds to /admin', () => {
    it('returns the expected 200 response', () => {
      return request(authServer.server)
        .get('/admin')
        .expect('Content-Type', /html/)
        .expect(200)
        .then((response) => {
          expect(response.text).to.contain(templates.admin({}));
        });
    });

    it('returns 404 when ALLOW_ADMIN environment variable is false', () => {
      // Restart server with ALLOW_ADMIN variable set to false.
      authServer.stop();
      app = express();
      process.env.ALLOW_ADMIN = 'false';
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        return request(authServer.server)
          .get('/admin')
          .expect('Content-Type', /html/)
          .expect(404);
      });
    });
  });

  describe('responds to /static', () => {
    const expectedContentTypeMap = {
      js: /javascript/,
      css: /css/,
      html: /html/,
    }
    // npm run bundle needs to be run to generate the static files.
    fs.readdirSync('public/').forEach((file) => {
      it(`should serve expected file /static/${file}`, () => {
        const components = file.split('.');
        const expectedContentType = expectedContentTypeMap[components[components.length - 1]];
        return request(authServer.server)
          .get(`/static/${file}`)
          .expect('Content-Type', expectedContentType)
          .expect(200);
      });
    });
  });

  describe('responds to /set_admin_config', () => {
    // Configuration to save.
    const config = {
      [API_KEY]: {
        authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
        displayMode: 'optionFirst',
        selectTenantUiTitle: PROJECT_ID,
        selectTenantUiLogo: 'https://example.com/img/mylogo.png',
        tenants: {
          _ : {
            displayName: PROJECT_ID,
            iconUrl: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/anonymous.png',
            logoUrl: 'https://img.icons8.com/cotton/2x/cloud.png',
            buttonColor: '#007bff',
            signInOptions: [
              'password',
              'phone',
              'facebook.com',
              {
                provider: 'saml.provider1',
                providerName: 'SAMLProvider1',
              },
              {
                provider: 'oidc.provider1',
                providerName: 'OIDCProvider1',
              },
            ],
          },
        },
      },
    };

    it('returns 404 when ALLOW_ADMIN environment variable is false', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      // Restart server with ALLOW_ADMIN variable set to false.
      authServer.stop();
      app = express();
      process.env.ALLOW_ADMIN = 'false';
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        return request(authServer.server)
          .post('/set_admin_config')
          .send(config)
          .set({'Authorization': `Bearer ${personalAccessToken}`})
          .expect('Content-Type', /html/)
          .expect(404);
      });
    });

    it('creates bucket if readFile 404s', () => {
      // HTTP status code alone should be sufficient to inform that the file is not found.
      const notFoundError = {
        statusCode: 404,
        message: 'Unexpected message',
      };
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`, 'Host': HOST_NAME})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // Bucket should be created next.
          expect(createBucketStub).to.have.been.calledOnce.and.calledWith(bucketName).and.calledAfter(readFileStub);
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName, config)
            .and.calledAfter(createBucketStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('creates bucket if not already created', () => {
      const notFoundError = new Error('Not found');
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // Bucket should be created next.
          expect(createBucketStub).to.have.been.calledOnce.and.calledWith(bucketName).and.calledAfter(readFileStub);
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName, config)
            .and.calledAfter(createBucketStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('trims bucket name to allowed limit on creation', () => {
      // Simulate long service name used (62 chars). The generated bucket name will get trimmed as
      // a maximum of 63 characters are allowed.
      process.env.K_CONFIGURATION =
        'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz';
      // The expected bucket name will be trimmed to not exceed the maximum allowed number
      // of characters.
      const expectedBucketName = `gcip-iap-bucket-${process.env.K_CONFIGURATION}-${PROJECT_NUMBER}`
        .substr(0, MAX_BUCKET_STRING_LENGTH);
      const notFoundError = new Error('Not found');
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(expectedBucketName, fileName);
          // Bucket should be created next.
          expect(createBucketStub).to.have.been.calledOnce.and.calledWith(expectedBucketName)
            .and.calledAfter(readFileStub);
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and
            .calledWith(expectedBucketName, fileName, config).and.calledAfter(createBucketStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('substitutes invalid character in trimmed bucket name', () => {
      // Simulate long service name. The last char at 63 mark will be replaced with 0.
      const numberOfRepeatedChars = MAX_BUCKET_STRING_LENGTH - 'gcip-iap-bucket-'.length - 1;
      process.env.K_CONFIGURATION = 'a'.repeat(numberOfRepeatedChars) + '-bc';
      // The expected bucket name will be trimmed to not exceed the maximum allowed number
      // of characters. The last invalid char will be replaced with an allowed char.
      const expectedBucketName =
        `gcip-iap-bucket-${'a'.repeat(numberOfRepeatedChars)}${ALLOWED_LAST_CHAR}`;
      const notFoundError = new Error('Not found');
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(expectedBucketName, fileName);
          // Bucket should be created next.
          expect(createBucketStub).to.have.been.calledOnce.and.calledWith(expectedBucketName)
            .and.calledAfter(readFileStub);
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and
            .calledWith(expectedBucketName, fileName, config).and.calledAfter(createBucketStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('skips bucket creation if already created', () => {
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket. Simulate bucket already created.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(config);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // createBucket should not be called.
          expect(createBucketStub).to.not.have.been.called;
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName, config)
            .and.calledAfter(readFileStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('saves to GCS_BUCKET_NAME environment variable if available', () => {
      process.env.GCS_BUCKET_NAME = 'custom-bucket-name';
      const notFoundError = new Error('Not found');
      const expectedResponse = {
        status: 200,
        message: 'Changes successfully saved.',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      // Environment variable should be used for the bucket name.
      const bucketName = process.env.GCS_BUCKET_NAME;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .resolves();
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .resolves();
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // Bucket should be created next.
          expect(createBucketStub).to.have.been.calledOnce.and.calledWith(bucketName).and.calledAfter(readFileStub);
          // writeFile should be called last.
          expect(writeFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName, config)
            .and.calledAfter(createBucketStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if access token is missing', () => {
      // Simulate request with no authorization header.
      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .expect('Content-Type', /json/)
        .expect(401)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(ERROR_MAP.UNAUTHENTICATED));
        });
    });

    it('returns expected error if config is missing', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';

      // Simulate request with no body.
      return request(authServer.server)
        .post('/set_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(ERROR_MAP.INVALID_ARGUMENT));
        });
    });

    it('returns expected error if project number is not determined', () => {
      const expectedError = new Error('Project number not determined');
      const expectedResponse = {
        error: {
          code: 500,
          status: 'UNKNOWN',
          message: 'Project number not determined',
        },
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .rejects(expectedError);
      stubs.push(getProjectNumberStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(500)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error when invalid configuration is provided', () => {
      // Simulate invalid configuration provided.
      const invalidConfig = deepCopy(config);
      (invalidConfig[API_KEY].tenants._.signInOptions[3] as any).iconUrl = 'javascript:doEvil()';
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: `"${API_KEY}.tenants._.signInOptions[].iconUrl" should be a valid HTTPS URL.`,
        },
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';

      return request(authServer.server)
        .post('/set_admin_config')
        .send(invalidConfig)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if underlying operation fails with non-cloud compliant error', () => {
      const expectedError = new Error('unexpected error');
      const expectedResponse = {
        error: {
          code: 500,
          status: 'UNKNOWN',
          message: 'unexpected error',
        },
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(expectedError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket');
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile');
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(500)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // Bucket should not be created.
          expect(createBucketStub).to.not.have.been.called;
          // writeFile should be not be called.
          expect(writeFileStub).to.not.have.been.called;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if underlying operation fails with cloud compliant error', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(expectedError);
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket');
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile');
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // Bucket should not be created.
          expect(createBucketStub).to.not.have.been.called;
          // writeFile should be not be called.
          expect(writeFileStub).to.not.have.been.called;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if write operation fails', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(config);
      stubs.push(readFileStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile')
        .rejects(expectedError);
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // writeFile should be called.
          expect(writeFileStub).to.have.been.called.and.calledAfter(readFileStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if bucket creation fails', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      // Get Storage bucket.
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      // Create Storage bucket.
      const createBucketStub = sinon.stub(storage.CloudStorageHandler.prototype, 'createBucket')
        .rejects(expectedError);
      stubs.push(createBucketStub);
      // Save Storage bucket.
      const writeFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'writeFile');
      stubs.push(writeFileStub);

      return request(authServer.server)
        .post('/set_admin_config')
        .send(config)
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile first called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // create bucket called next.
          expect(createBucketStub).to.have.been.called.and.calledAfter(readFileStub);
          // writeFile should not be called.
          expect(writeFileStub).to.not.have.been.called;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });
  });

  describe('responds to /config', () => {
    const gcipConfig = {
      apiKey: API_KEY,
      authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
    };
    const iapSettings = [
      {
        name: 'RESOURCE_NAME1',
        accessSettings: {
          gcipSettings: {
            tenantIds: [`_${PROJECT_NUMBER}`],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      },
      {
        name: 'RESOURCE_NAME2',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenantId1', 'tenantId2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      },
      {
        name: 'RESOURCE_NAME3',
        accessSettings: {},
      },
    ];
    const tenantUiConfigMap = {
      _: {
        fullLabel: 'ABCD Portal',
        displayName: 'ABCD',
        signInOptions: [
          {provider: 'facebook.com'},
          {provider: 'twitter.com'},
        ],
      },
      tenantId1: {
        fullLabel: 'Tenant 1',
        displayName: 'Tenant-display-name-1',
        signInOptions: [
          {provider: 'password'},
          {
            provider: 'saml.idp2',
            providerName: 'saml-display-name-2',
          },
        ],
      },
      tenantId2: {
        fullLabel: 'Tenant 2',
        displayName: 'Tenant-display-name-2',
        signInOptions: [
          {provider: 'microsoft.com'},
          {
            provider: 'oidc.idp3',
            providerName: 'oidc-display-name-3',
          },
        ],
      },
    };
    const expectedUiConfig =
      new DefaultUiConfigBuilder(PROJECT_ID, '', gcipConfig, tenantUiConfigMap).build();
    const expectedUiConfigWithHostNameAuthDomain =
      new DefaultUiConfigBuilder(PROJECT_ID, HOST_NAME, gcipConfig, tenantUiConfigMap).build();

    it('returns config from UI_CONFIG environment variable', () => {
      process.env.UI_CONFIG = JSON.stringify(expectedUiConfig);

      // Setting hostname will not change the authDomain since it is returned from UI_CONFIG environment variable.
      return request(authServer.server)
        .get('/config')
        .expect('Content-Type', /json/)
        .set('Host', HOST_NAME)
        .expect(200)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedUiConfig));
        });
    });

    it('returns config from GCS using default location if available', () => {
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(expectedUiConfig);
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/config')
        .expect('Content-Type', /json/)
        .set('Host', HOST_NAME)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected metadata OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          expect(response.text).to.equal(JSON.stringify(expectedUiConfig));
        });
    });

    it('returns config from GCS using GCS_BUCKET_NAME environment variable if available', () => {
      process.env.GCS_BUCKET_NAME = 'custom-bucket-name';
      const fileName = 'config.json';
      const bucketName = process.env.GCS_BUCKET_NAME;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(expectedUiConfig);
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/config')
        .expect('Content-Type', /json/)
        .set('Host', HOST_NAME)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected metadata OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          expect(response.text).to.equal(JSON.stringify(expectedUiConfig));
        });
    });

    it('returns config from default config when not found in GCS and caches it', () => {
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/config')
        .expect('Content-Type', /json/)
        .set('Host', HOST_NAME)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected metadata OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // gcipHandler and iapSettingsHandler initialized with expected Matadata OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledTwice.and.calledAfter(readFileStub);
          // listIapSettings called next.
          expect(listIapSettingsStub).to.have.been.calledOnce.and.calledAfter(getGcipConfigStub);
          // getTenantUiConfig called thrice.
          expect(getTenantUiConfigStub).to.have.been.calledThrice.and.calledAfter(listIapSettingsStub);
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);

          // Try again. Cached result should be returned.
          return request(authServer.server)
            .get('/config')
            .expect('Content-Type', /json/)
            .expect(200);
        })
        .then((response) => {
          expect(readFileStub).to.have.been.calledTwice;
          // No additional calls to build default config.
          expect(getGcipConfigStub).to.have.been.calledTwice;
          expect(listIapSettingsStub).to.have.been.calledOnce;
          expect(getTenantUiConfigStub).to.have.been.calledThrice;
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
        });
    });

    it('uses fallback when UI_CONFIG content is an invalid JSON', () => {
      // Invalid UI_CONFIG content.
      process.env.UI_CONFIG = '{"key": "invalid"';
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      // Restart server with DEBUG_CONSOLE variable enabled.
      metadataServerSpy.restore();
      authServer.stop();
      app = express();
      process.env.DEBUG_CONSOLE = '1';
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        return request(authServer.server)
          .get('/config')
          .set('Host', HOST_NAME)
          .expect('Content-Type', /json/)
          .expect(200)
          .then((response) => {
            expect(consoleStub).to.have.been.calledWith(
              'Invalid configuration in environment variable UI_CONFIG: Unexpected end of JSON input');
            expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
          });
      });
    });

    it('uses fallback when UI_CONFIG content is an invalid UiConfig', () => {
      // Invalid UI_CONFIG content.
      const invalidUiConfig = deepCopy(expectedUiConfig);
      invalidUiConfig[API_KEY].selectTenantUiLogo = 'invalid';
      process.env.UI_CONFIG = JSON.stringify(invalidUiConfig);
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      // Restart server with DEBUG_CONSOLE variable enabled.
      metadataServerSpy.restore();
      authServer.stop();
      app = express();
      process.env.DEBUG_CONSOLE = '1';
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        return request(authServer.server)
          .get('/config')
          .set('Host', HOST_NAME)
          .expect('Content-Type', /json/)
          .expect(200)
          .then((response) => {
            expect(consoleStub).to.have.been.calledWith(
              'Invalid configuration in environment variable UI_CONFIG: ' +
              `"${API_KEY}.selectTenantUiLogo" should be a valid HTTPS URL.`);
            expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
          });
      });
    });

    it('returns 404 when fallback fails', () => {
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
      listIapSettingsStub.onFirstCall().resolves([]);
      listIapSettingsStub.onSecondCall().resolves(iapSettings);
      stubs.push(listIapSettingsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);

      return request(authServer.server)
        .get('/config')
        .expect('Content-Type', /json/)
        .expect(404)
        .then((response) => {
          expect(JSON.parse(response.text)).to.deep.equal(ERROR_MAP.NOT_FOUND);
          expect(listIapSettingsStub).to.have.been.calledOnce;
          // Confirm, null default config is not stored.
          return request(authServer.server)
            .get('/config')
            .set('Host', HOST_NAME)
            .expect('Content-Type', /json/)
            .expect(200);
        })
        .then((response) => {
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
          expect(listIapSettingsStub).to.have.been.calledTwice;
          // Result should be cached now.
          return request(authServer.server)
            .get('/config')
            .expect('Content-Type', /json/)
            .expect(200);
        })
        .then((response) => {
          // No additional calls.
          expect(listIapSettingsStub).to.have.been.calledTwice;
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
        });
    });

    it('returns underlying error on default config construction without caching it', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      // Simulate first call fails.
      getGcipConfigStub.onSecondCall().rejects(expectedError);
      getGcipConfigStub.onThirdCall().resolves(gcipConfig);
      stubs.push(getGcipConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);

      return request(authServer.server)
        .get('/config')
        .set('Host', HOST_NAME)
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          expect(JSON.parse(response.text)).to.deep.equal(expectedResponse);
          expect(listIapSettingsStub).to.not.have.been.called;
          // Confirm, default config error should not be cached.
          return request(authServer.server)
            .get('/config')
            .set('Host', HOST_NAME)
            .expect('Content-Type', /json/)
            .expect(200);
        })
        .then((response) => {
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
          expect(listIapSettingsStub).to.have.been.calledOnce;
          // Result should be cached now.
          return request(authServer.server)
            .get('/config')
            .expect('Content-Type', /json/)
            .expect(200);
        })
        .then((response) => {
          // No additional calls.
          expect(listIapSettingsStub).to.have.been.calledOnce;
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
        });
    });
  });

  describe('responds to /get_admin_config', () => {
    const gcipConfig = {
      apiKey: API_KEY,
      authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
    };
    const iapSettings = [
      {
        name: 'RESOURCE_NAME1',
        accessSettings: {
          gcipSettings: {
            tenantIds: [`_${PROJECT_NUMBER}`],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      },
      {
        name: 'RESOURCE_NAME2',
        accessSettings: {
          gcipSettings: {
            tenantIds: ['tenantId1', 'tenantId2'],
            loginPageUri: 'https://auth.example.com/login',
          },
        },
      },
      {
        name: 'RESOURCE_NAME3',
        accessSettings: {},
      },
    ];
    const tenantUiConfigMap = {
      _: {
        fullLabel: 'ABCD Portal',
        displayName: 'ABCD',
        signInOptions: [
          {provider: 'facebook.com'},
          {provider: 'twitter.com'},
        ],
      },
      tenantId1: {
        fullLabel: 'Tenant 1',
        displayName: 'Tenant-display-name-1',
        signInOptions: [
          {provider: 'password'},
          {
            provider: 'saml.idp2',
            providerName: 'saml-display-name-2',
          },
        ],
      },
      tenantId2: {
        fullLabel: 'Tenant 2',
        displayName: 'Tenant-display-name-2',
        signInOptions: [
          {provider: 'microsoft.com'},
          {
            provider: 'oidc.idp3',
            providerName: 'oidc-display-name-3',
          },
        ],
      },
    };
    const emptyListBucketsResponse = {
      kind: 'storage#buckets',
      items: [],
    };
    const listBucketsResponse = {
      kind: 'storage#buckets',
      items: [
        {
          kind: 'storage#bucket',
          selfLink: 'https://www.googleapis.com/storage/v1/b/foo-bar-static-files',
          id: 'foo-bar-static-files',
          name: 'foo-bar-static-files',
          projectNumber: PROJECT_NUMBER,
          metageneration: '1',
          location: 'US',
          storageClass: 'STANDARD',
          etag: 'CAE=',
          defaultEventBasedHold: false,
          timeCreated: '2020-04-30T21:28:34.181Z',
          updated: '2020-04-30T21:28:34.181Z',
          iamConfiguration: {
            bucketPolicyOnly: {
              enabled: false
            },
            uniformBucketLevelAccess: {
              enabled: false
            }
          },
          locationType: 'multi-region',
        },
        {
          kind: 'storage#bucket',
          selfLink: 'https://www.googleapis.com/storage/v1/b/hello-world.appspot.com',
          id: 'hello-world.appspot.com',
          name: 'hello-world.appspot.com',
          projectNumber: PROJECT_NUMBER,
          metageneration: '1',
          location: 'US',
          storageClass: 'STANDARD',
          etag: 'CAE=',
          timeCreated: '2019-03-29T01:12:31.813Z',
          updated: '2019-03-29T01:12:31.813Z',
          iamConfiguration: {
            bucketPolicyOnly: {
              enabled: false,
            },
            uniformBucketLevelAccess: {
              enabled: false,
            },
          },
          locationType: 'multi-region',
        },
      ],
    };
    const expectedUiConfig =
        new DefaultUiConfigBuilder(PROJECT_ID, '', gcipConfig, tenantUiConfigMap).build();
    const expectedUiConfigWithHostNameAuthDomain =
        new DefaultUiConfigBuilder(PROJECT_ID, HOST_NAME, gcipConfig, tenantUiConfigMap).build();

    it('returns 404 when ALLOW_ADMIN environment variable is false', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      // Restart server with ALLOW_ADMIN variable set to false.
      authServer.stop();
      app = express();
      process.env.ALLOW_ADMIN = 'false';
      authServer = new AuthServer(app);

      return authServer.start().then(() => {
        return request(authServer.server)
          .get('/get_admin_config')
          .set({'Authorization': `Bearer ${personalAccessToken}`})
          .expect('Content-Type', /html/)
          .expect(404);
      });
    });

    it('responds with config file from GCS if found', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(expectedUiConfig);
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected personal OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          expect(response.text).to.equal(JSON.stringify(expectedUiConfig));
        });
    });

    it('responds with config file from GCS using environment variable name if found', () => {
      process.env.GCS_BUCKET_NAME = 'custom-bucket-name';
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = process.env.GCS_BUCKET_NAME;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .resolves(expectedUiConfig);
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected personal OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          expect(response.text).to.equal(JSON.stringify(expectedUiConfig));
        });
    });

    it('returns expected error if GCS read file fails', () => {
      const expectedResponse = {
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(expectedError);
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(403)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if project number is not determined', () => {
      const expectedError = new Error('Project number not determined');
      const expectedResponse = {
        error: {
          code: 500,
          status: 'UNKNOWN',
          message: 'Project number not determined',
        },
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .rejects(expectedError);
      stubs.push(getProjectNumberStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(500)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if project ID is not determined', () => {
      const expectedError = new Error('Project ID not determined');
      const expectedResponse = {
        error: {
          code: 500,
          status: 'UNKNOWN',
          message: 'Project ID not determined',
        },
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .rejects(expectedError);
      stubs.push(getProjectIdStub);
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(500)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if access token is missing', () => {
      // Simulate request with no authorization header.
      return request(authServer.server)
        .get('/get_admin_config')
        .expect('Content-Type', /json/)
        .expect(401)
        .then((response) => {
          expect(response.text).to.equal(JSON.stringify(ERROR_MAP.UNAUTHENTICATED));
        });
    });

    it('responds with default config file if readFile 404s', () => {
      // HTTP status code alone should be sufficient to inform that the file is not found.
      const notFoundError = {
        statusCode: 404,
        message: 'Unexpected message',
      };
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(notFoundError);
      stubs.push(readFileStub);
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .resolves(listBucketsResponse);
      stubs.push(listBucketsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`, 'Host': HOST_NAME})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected Matadata OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledTwice.and.calledAfter(readFileStub);
          // listIapSettings called next.
          expect(listIapSettingsStub).to.have.been.calledOnce.and.calledAfter(getGcipConfigStub);
          // getTenantUiConfig called thrice.
          expect(getTenantUiConfigStub).to.have.been.calledThrice.and.calledAfter(listIapSettingsStub);
          // Expected default config returned.
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
        });
    });

    it('responds with default config file if file not found in GCS', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .resolves(listBucketsResponse);
      stubs.push(listBucketsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`, 'Host': HOST_NAME})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected Matadata OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledTwice.and.calledAfter(readFileStub);
          // listIapSettings called next.
          expect(listIapSettingsStub).to.have.been.calledOnce.and.calledAfter(getGcipConfigStub);
          // getTenantUiConfig called thrice.
          expect(getTenantUiConfigStub).to.have.been.calledThrice.and.calledAfter(listIapSettingsStub);
          // Expected default config returned.
          expect(JSON.parse(response.text)).to.deep.equal(expectedUiConfigWithHostNameAuthDomain);
        });
    });

    it('responds with error if file not found in GCS and user does not have list permission', () => {
      const expectedResponse = {
        error: {
          code: 403,
          message: 'EMAIL does not have storage.buckets.list access to project PROJECT_NUMBER.',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .rejects(expectedError);
      stubs.push(listBucketsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').resolves(tenantUiConfigMap.tenantId2);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(403)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledOnce;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('responds with empty object if file not found in GCS and IAP not enabled', () => {
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .resolves(emptyListBucketsResponse);
      stubs.push(listBucketsStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .rejects(new Error('some error'));
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledTwice.and.calledAfter(readFileStub);
          // listIapSettings called next.
          expect(listIapSettingsStub).to.have.been.calledOnce.and.calledAfter(getGcipConfigStub);
          // Expected empty object returned.
          expect(JSON.parse(response.text)).to.deep.equal({});
        });
    });

    it('responds with error if file not found in GCS and getGcipConfig fails', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .resolves(emptyListBucketsResponse);
      stubs.push(listBucketsStub);
      stubs.push(readFileStub);
      getGcipConfigStub.restore();
      getGcipConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getGcipConfig')
        .rejects(expectedError);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledOnce.and.calledAfter(readFileStub);
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('responds with error if file not found in GCS and getTenantUiConfig fails', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      const personalAccessToken = 'PERSONAL_ACCESS_TOKEN';
      const fileName = 'config.json';
      const bucketName = `gcip-iap-bucket-${K_CONFIGURATION}-${PROJECT_NUMBER}`;
      const getProjectNumberStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectNumber')
        .resolves(PROJECT_NUMBER);
      stubs.push(getProjectNumberStub);
      const getProjectIdStub = sinon.stub(metadata.MetadataServer.prototype, 'getProjectId')
        .resolves(PROJECT_ID);
      stubs.push(getProjectIdStub);
      const readFileStub = sinon.stub(storage.CloudStorageHandler.prototype, 'readFile')
        .rejects(new Error('Not found'));
      stubs.push(readFileStub);
      const listBucketsStub = sinon.stub(storage.CloudStorageHandler.prototype, 'listBuckets')
        .resolves(emptyListBucketsResponse);
      stubs.push(listBucketsStub);
      const getTenantUiConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getTenantUiConfig');
      getTenantUiConfigStub.withArgs(`_${PROJECT_NUMBER}`).resolves(tenantUiConfigMap._);
      getTenantUiConfigStub.withArgs('tenantId1').resolves(tenantUiConfigMap.tenantId1);
      getTenantUiConfigStub.withArgs('tenantId2').rejects(expectedError);
      stubs.push(getTenantUiConfigStub);
      const listIapSettingsStub = sinon.stub(iap.IapSettingsHandler.prototype, 'listIapSettings')
        .resolves(iapSettings);
      stubs.push(listIapSettingsStub);

      return request(authServer.server)
        .get('/get_admin_config')
        .set({'Authorization': `Bearer ${personalAccessToken}`})
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(cloudStorageHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          assertApiHandlerInitializedWithMetadataServer(iapSettingsHandlerSpy, metadataServerSpy);
          // CloudStorageHandler initialized with expected OAuth access token.
          expect(cloudStorageHandlerSpy).to.have.been.calledOnce;
          expect(cloudStorageHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(personalAccessToken);
          // gcipHandler and iapSettingsHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          expect(iapSettingsHandlerSpy).to.have.been.calledOnce;
          expect(iapSettingsHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // readFile called.
          expect(readFileStub).to.have.been.calledOnce.and.calledWith(bucketName, fileName);
          // listBuckets called.
          expect(listBucketsStub).to.have.been.calledOnce;
          // getGcipConfig called next.
          expect(getGcipConfigStub).to.have.been.calledTwice.and.calledAfter(readFileStub);
          // listIapSettings called next.
          expect(listIapSettingsStub).to.have.been.calledOnce.and.calledAfter(getGcipConfigStub);
          // getTenantUiConfig called.
          expect(getTenantUiConfigStub).to.have.been.called;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });
  });

  describe('responds to /gcipConfig', () => {

    it('returns expected config on success', () => {
      return request(authServer.server)
        .get('/gcipConfig')
        .expect('Content-Type', /json/)
        .expect(200)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          // GcipHandler initialized with expected Metadata server OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // getGcipConfig called.
          expect(getGcipConfigStub).to.have.been.calledTwice;
          expect(response.text).to.equal(JSON.stringify(CONFIG));
        });
    });

    it('returns expected error if underlying operation fails with non-cloud compliant error', () => {
      const expectedError = new Error('unexpected error');
      const expectedResponse = {
        error: {
          code: 500,
          status: 'UNKNOWN',
          message: 'unexpected error',
        },
      };
      getGcipConfigStub.restore();
      getGcipConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getGcipConfig')
        .rejects(expectedError);

      return request(authServer.server)
        .get('/gcipConfig')
        .expect('Content-Type', /json/)
        .expect(500)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          // GcipHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // getGcipConfig called.
          expect(getGcipConfigStub).to.have.been.calledOnce;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });

    it('returns expected error if underlying operation fails with cloud compliant error', () => {
      const expectedResponse = {
        error: {
          code: 400,
          status: 'INVALID_ARGUMENT',
          message: 'Some error occurred',
        },
      };
      const expectedError = createError(expectedResponse);
      getGcipConfigStub.restore();
      getGcipConfigStub = sinon.stub(gcip.GcipHandler.prototype, 'getGcipConfig')
        .rejects(expectedError);

      return request(authServer.server)
        .get('/gcipConfig')
        .expect('Content-Type', /json/)
        .expect(400)
        .then((response) => {
          // Confirm API handlers initialized with MetadataServer.
          // This confirms that API handlers will log operations using MetadataServer#log.
          assertApiHandlerInitializedWithMetadataServer(gcipHandlerSpy, metadataServerSpy);
          // GcipHandler initialized with expected OAuth access token.
          expect(gcipHandlerSpy).to.have.been.calledOnce;
          expect(gcipHandlerSpy.getCall(0).args[1].getAccessToken())
            .to.eventually.equal(METADATA_ACCESS_TOKEN);
          // Metadata server initialized with expected OAuth scopes.
          expect(metadataServerSpy).to.have.been.calledOnce
            .and.calledWith(AUTH_SERVER_SCOPES);
          // getGcipConfig called.
          expect(getGcipConfigStub).to.have.been.calledOnce;
          expect(response.text).to.equal(JSON.stringify(expectedResponse));
        });
    });
  });

  it('404 everything else', () => {
    return request(authServer.server)
      .get('/not/found')
      .expect(404);
  });
});
