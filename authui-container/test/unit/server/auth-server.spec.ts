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
import request = require('supertest');
import * as templates from  '../../../server/templates';
import * as fs from 'fs';
import * as sinon from 'sinon';
import {AuthServer, AUTH_SERVER_SCOPES} from '../../../server/auth-server';
import express = require('express');
import * as storage from '../../../server/api/cloud-storage-handler';
import * as metadata from '../../../server/api/metadata-server';
import { ERROR_MAP, ErrorResponse } from '../../../utils/error';
import { addReadonlyGetter } from '../../../utils/index';

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

describe('AuthServer', () => {
  let metadataServerSpy: sinon.SinonSpy;
  let cloudStorageHandlerSpy: sinon.SinonSpy;
  let stubs: sinon.SinonStub[] = [];
  const PROJECT_NUMBER = '1234567890';
  const PROJECT_ID = 'project-id';
  const ZONE_RESOURCE = `projects/${PROJECT_NUMBER}/zones/us-central1-1`;
  const API_KEY = 'API_KEY';
  const AUTH_SUBDOMAIN = 'AUTH_SUBDOMAIN';
  const K_CONFIGURATION = 'service123';
  let app: express.Application;
  let authServer: AuthServer;
  const previousKConfiguration = process.env.K_CONFIGURATION;
  const previousGCSBucketName = process.env.GCS_BUCKET_NAME;

  beforeEach(() =>  {
    process.env.K_CONFIGURATION = K_CONFIGURATION;
    delete process.env.GCS_BUCKET_NAME;
    app = express();
    metadataServerSpy = sinon.spy(metadata, 'MetadataServer');
    cloudStorageHandlerSpy = sinon.spy(storage, 'CloudStorageHandler');
    authServer = new AuthServer(app);
    return authServer.start();
  });

  afterEach(() => {
    // Restore environment variables modified in tests.
    process.env.K_CONFIGURATION = previousKConfiguration;
    process.env.GCS_BUCKET_NAME = previousGCSBucketName;
    metadataServerSpy.restore();
    cloudStorageHandlerSpy.restore();
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    authServer.stop();
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

  it('responds to /admin', () => {
    return request(authServer.server)
      .get('/admin')
      .expect('Content-Type', /html/)
      .expect(200)
      .then((response) => {
        expect(response.text).to.contain(templates.admin({}));
      });
  });

  describe('responds to /static', () => {
    const expectedContentTypeMap = {
      js: /javascript/,
      css: /css/,
      html: /html/,
    }
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
        title: '',
        authDomain: `${AUTH_SUBDOMAIN}.firebaseapp.com`,
        displayMode: 'optionFirst',
        seletTenantUiTitle: PROJECT_ID,
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

  it('404 everything else', () => {
    return request(authServer.server)
      .get('/not/found')
      .expect(404);
  });
});
