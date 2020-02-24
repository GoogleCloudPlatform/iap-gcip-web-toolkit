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
import {expect} from 'chai';
import * as nock from 'nock';
import * as sinon from 'sinon';
import {AccessTokenManager} from '../../../../server/api/token-manager';
import {ApplicationData} from '../../../../server/api/metadata-server';
import {CloudStorageHandler} from '../../../../server/api/cloud-storage-handler';

describe('CloudStorageHandler', () => {
  let stubs: sinon.SinonStub[] = [];
  const PROJECT_ID = 'awesome-app';
  const PROJECT_NUMBER = '1029384756';
  const ZONE = 'us-east1';
  const ACCESS_TOKEN = 'ACCESS_TOKEN';
  let accessTokenManager: AccessTokenManager;
  let app: ApplicationData;
  let cloudStorageHandler: CloudStorageHandler
  let mockedRequests: nock.Scope[] = [];
  const expectedResponse = {
    foo: 'bar',
    success: true,
  };

  beforeEach(() => {
    accessTokenManager = {
      getAccessToken: () => Promise.resolve(ACCESS_TOKEN),
    };
    app = {
      getProjectId: () => Promise.resolve(PROJECT_ID),
      getProjectNumber: () => Promise.resolve(PROJECT_NUMBER),
      getZone: () => Promise.resolve(ZONE),
    };
    cloudStorageHandler = new CloudStorageHandler(app, accessTokenManager);
  });

  afterEach(() => {
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('createBucket()', () => {
    it('should call expected endpoint with expected parameters on success', () => {
      const bucketName = 'myBucket';
      const data = {
        name: bucketName,
        location: 'US-EAST1',
        storageClass: 'STANDARD',
      };
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).post(`/storage/v1/b?project=${PROJECT_ID}`, data)
        .reply(200);
      mockedRequests.push(scope);

      return expect(cloudStorageHandler.createBucket(bucketName)).to.be.fulfilled;
    });

    it('should fail with expected error when underlying call fails', () => {
      const bucketName = 'myBucket';
      const data = {
        name: bucketName,
        location: 'US-EAST1',
        storageClass: 'STANDARD',
      };
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).post(`/storage/v1/b?project=${PROJECT_ID}`, data)
        .reply(400, 'INVALID_ARGUMENT');
      mockedRequests.push(scope);

      return cloudStorageHandler.createBucket(bucketName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('INVALID_ARGUMENT');
        });
    });

    it('should fail with expected error when zone is not determined', () => {
      const expectedError = new Error('Zone not determined');
      const bucketName = 'myBucket';
      const stub = sinon.stub(app, 'getZone').rejects(expectedError);
      stubs.push(stub);

      return cloudStorageHandler.createBucket(bucketName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });

    it('should fail with expected error when project ID is not determined', () => {
      const expectedError = new Error('Project ID not determined');
      const bucketName = 'myBucket';
      const stub = sinon.stub(app, 'getProjectId').rejects(expectedError);
      stubs.push(stub);

      return cloudStorageHandler.createBucket(bucketName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const bucketName = 'myBucket';
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return cloudStorageHandler.createBucket(bucketName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });

  describe('readFile()', () => {
    it('should call expected endpoint with expected parameters on success', () => {
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/storage/v1/b/${bucketName}/o/${fileName}?alt=media`)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return cloudStorageHandler.readFile(bucketName, fileName)
        .then((content) => {
          expect(content).to.deep.equal(expectedResponse);
        });
    });

    it('should fail with expected error when underlying call fails', () => {
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).get(`/storage/v1/b/${bucketName}/o/${fileName}?alt=media`)
        .reply(400, 'INVALID_ARGUMENT');
      mockedRequests.push(scope);

      return cloudStorageHandler.readFile(bucketName, fileName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('INVALID_ARGUMENT');
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return cloudStorageHandler.readFile(bucketName, fileName)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });

  describe('writeFile()', () => {
    it('should call expected endpoint with expected parameters on success', () => {
      const content = {
        a: '1',
        b: 'c',
        c: false,
      };
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).post(`/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${fileName}`, content)
        .reply(200, expectedResponse);
      mockedRequests.push(scope);

      return expect(cloudStorageHandler.writeFile(bucketName, fileName, content)).to.be.fulfilled;
    });

    it('should fail with expected error when underlying call fails', () => {
      const content = {
        a: '1',
        b: 'c',
        c: false,
      };
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const scope = nock('https://storage.googleapis.com', {
        reqheaders: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }).post(`/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${fileName}`, content)
        .reply(400, 'INVALID_ARGUMENT');
      mockedRequests.push(scope);

      return cloudStorageHandler.writeFile(bucketName, fileName, content)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error.message).to.be.equal('INVALID_ARGUMENT');
        });
    });

    it('should fail with expected error when access token is not determined', () => {
      const expectedError = new Error('Invalid credentials');
      const content = {
        a: '1',
        b: 'c',
        c: false,
      };
      const bucketName = 'myBucket';
      const fileName = 'file.json';
      const stub = sinon.stub(accessTokenManager, 'getAccessToken').rejects(expectedError);
      stubs.push(stub);

      return cloudStorageHandler.writeFile(bucketName, fileName, content)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
        });
    });
  });
});
