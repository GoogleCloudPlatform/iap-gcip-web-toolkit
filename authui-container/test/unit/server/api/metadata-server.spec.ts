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
import * as token from '../../../../server/api/token-manager';
import {
  MetadataServer, DEFAULT_ZONE, DEFAULT_ERROR_MESSAGE_PROJECT_ID,
  DEFAULT_ERROR_MESSAGE_PROJECT_NUMBER, DEFAULT_ERROR_MESSAGE_ZONE,
} from '../../../../server/api/metadata-server';

describe('MetadataServer', () => {
  let logger: sinon.SinonStub;
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/identitytoolkit',
  ];
  const PROJECT_NUMBER = '1234567890';
  const PROJECT_ID = 'project-id';
  const ZONE_RESOURCE = `projects/${PROJECT_NUMBER}/zones/us-east1-1`;
  let tokenManagerSpy: sinon.SinonSpy;
  let stubs: sinon.SinonStub[] = [];
  let mockedRequests: nock.Scope[] = [];
  let metadataServer: MetadataServer;
  const expectedResponse = {
    access_token: 'ACCESS_TOKEN',
    expires_in: 3600,
  };
  const expectedResponse2 = {
    access_token: 'ACCESS_TOKEN2',
    expires_in: 3600,
  };
  const errorResponse = {
    error: {
      code: 400,
      message: 'Invalid request',
      status: 'INVALID_ARGUMENT',
      details: [{
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
      }],
    }
  };

  beforeEach(() => {
    logger = sinon.stub();
    tokenManagerSpy = sinon.spy(token, 'TokenManager');
    metadataServer = new MetadataServer(scopes);
  });

  afterEach(() => {
    tokenManagerSpy.restore();
    _.forEach(stubs, (stub) => stub.restore());
    stubs = [];
    mockedRequests.forEach((mockedRequest) => mockedRequest.done());
    mockedRequests = [];
    nock.cleanAll();
  });

  describe('log()', () => {
    it('will be a no-op when no logger is provided', () => {
      expect(() => {
        metadataServer.log('hello', 'world');
        expect(logger).to.not.have.been.called;
      }).not.to.throw();
    });

    it('will call logger if provided', () => {
      expect(() => {
        const metadataServerWithLogger = new MetadataServer(scopes, logger);

        metadataServerWithLogger.log('hello', 'world');
        metadataServerWithLogger.log('foo bar');

        expect(logger).to.have.been.calledTwice;
        expect(logger.firstCall).to.have.been.calledWith('hello', 'world');
        expect(logger.secondCall).to.have.been.calledWith('foo bar');
      }).not.to.throw();
    });
  });

  describe('getAccessToken()', () => {
    it('resolves with an access token', () => {
      const getAccessTokenStub = sinon.stub(token.TokenManager.prototype, 'getAccessToken');
      getAccessTokenStub.onFirstCall().resolves(expectedResponse);
      getAccessTokenStub.onSecondCall().resolves(expectedResponse2);
      stubs.push(getAccessTokenStub);

      // Confirm underlying token manager initialized with the expected scopes.
      expect(tokenManagerSpy).to.have.been.calledOnce.and.calledWith(scopes);
      return metadataServer.getAccessToken()
        .then((accessToken) => {
          expect(accessToken).to.be.equal(expectedResponse.access_token);
          expect(getAccessTokenStub).to.have.been.calledOnce.and.calledWith(false);
          return metadataServer.getAccessToken(true);
        })
        .then((accessToken) => {
          expect(accessToken).to.be.equal(expectedResponse2.access_token);
          expect(getAccessTokenStub).to.have.been.calledTwice.and.calledWith(true);
        });
    });

    it('should not log anything on success', () => {
      const getAccessTokenStub = sinon.stub(token.TokenManager.prototype, 'getAccessToken')
        .resolves(expectedResponse);
      stubs.push(getAccessTokenStub);

      const metadataServerWithLogger = new MetadataServer(scopes, logger);

      return metadataServerWithLogger.getAccessToken()
        .then((accessToken) => {
          expect(logger).to.not.have.been.called;
          expect(accessToken).to.be.equal(expectedResponse.access_token);
        });
    });

    it('rejects with the expected error when underlying error is detected', () => {
      const expectedError = new Error('Some error occurred');
      const getAccessTokenStub = sinon.stub(token.TokenManager.prototype, 'getAccessToken');
      getAccessTokenStub.onFirstCall().rejects(expectedError);
      getAccessTokenStub.onSecondCall().resolves(expectedResponse);
      stubs.push(getAccessTokenStub);

      return metadataServer.getAccessToken()
        .then((response) => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
          expect(getAccessTokenStub).to.have.been.calledOnce.and.calledWith(false);
          return metadataServer.getAccessToken();
        })
        .then((accessToken) => {
          expect(accessToken).to.be.equal(expectedResponse.access_token);
          expect(getAccessTokenStub).to.have.been.calledTwice.and.calledWith(false);
        });
    });

    it('should log reason when error occurs', () => {
      const expectedError = new Error('Some error occurred');
      const getAccessTokenStub = sinon.stub(token.TokenManager.prototype, 'getAccessToken')
        .rejects(expectedError);
      stubs.push(getAccessTokenStub);

      const metadataServerWithLogger = new MetadataServer(scopes, logger);

      return metadataServerWithLogger.getAccessToken()
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.be.equal(expectedError);
          expect(logger).to.have.been.calledOnce.and.calledWith(
            'Error encountered while getting Metadata server access token', expectedError);
        });
    });
  });

  describe('getProjectId()', () => {
    it('resolves with the project ID', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/project-id')
        .reply(200, PROJECT_ID);
      mockedRequests.push(scope);

      return metadataServer.getProjectId()
        .then((projectId) => {
          expect(projectId).to.be.equal(PROJECT_ID);
          // Cached project ID should be returned.
          return metadataServer.getProjectId();
        })
        .then((projectId) => {
          expect(projectId).to.be.equal(PROJECT_ID);
        });
    });

    it('logs expected information', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/project-id')
        .reply(200, PROJECT_ID);
      mockedRequests.push(scope);

      const metadataServerWithLogger = new MetadataServer(scopes, logger);

      return metadataServerWithLogger.getProjectId()
        .then((projectId) => {
          expect(logger).to.have.been.calledTwice;
          expect(logger.firstCall).to.be.calledWith(
            `GET to http://metadata.google.internal/computeMetadata/v1/project/project-id`);
          expect(logger.secondCall).to.be.calledWith('200 response');
          expect(projectId).to.be.equal(PROJECT_ID);
        });
    });

    it('rejects with the expected error when underlying error is detected', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/project-id')
        .reply(400, errorResponse)
        .get('/computeMetadata/v1/project/project-id')
        .reply(200, PROJECT_ID);
      mockedRequests.push(scope);

      return metadataServer.getProjectId()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(errorResponse.error.message);
          // Next call should succeed.
          return metadataServer.getProjectId();
        })
        .then((projectId) => {
          expect(projectId).to.be.equal(PROJECT_ID);
          // Cached project ID should be returned.
          return metadataServer.getProjectId();
        })
        .then((projectId) => {
          expect(projectId).to.be.equal(PROJECT_ID);
        });
    });

    it('rejects with the default error message when none is available', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/project-id')
        .reply(400, {error: 'other'});
      mockedRequests.push(scope);

      return metadataServer.getProjectId()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(DEFAULT_ERROR_MESSAGE_PROJECT_ID);
        });
    });
  });

  describe('getProjectNumber()', () => {
    it('resolves with the project number', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/numeric-project-id')
        .reply(200, PROJECT_NUMBER);
      mockedRequests.push(scope);

      return metadataServer.getProjectNumber()
        .then((projectNumber) => {
          expect(projectNumber).to.be.equal(PROJECT_NUMBER);
          // Cached project number should be returned.
          return metadataServer.getProjectNumber();
        })
        .then((projectNumber) => {
          expect(projectNumber).to.be.equal(PROJECT_NUMBER);
        });
    });

    it('logs expected information', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/numeric-project-id')
        .reply(200, PROJECT_NUMBER);
      mockedRequests.push(scope);

      const metadataServerWithLogger = new MetadataServer(scopes, logger);

      return metadataServerWithLogger.getProjectNumber()
        .then((projectNumber) => {
          expect(logger).to.have.been.calledTwice;
          expect(logger.firstCall).to.be.calledWith(
            `GET to http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id`);
          expect(logger.secondCall).to.be.calledWith('200 response');
          expect(projectNumber).to.be.equal(PROJECT_NUMBER);
        });
    });

    it('rejects with the expected error when underlying error is detected', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/numeric-project-id')
        .reply(400, errorResponse)
        .get('/computeMetadata/v1/project/numeric-project-id')
        .reply(200, PROJECT_NUMBER);
      mockedRequests.push(scope);

      return metadataServer.getProjectNumber()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(errorResponse.error.message);
          // Next call should succeed.
          return metadataServer.getProjectNumber();
        })
        .then((projectNumber) => {
          expect(projectNumber).to.be.equal(PROJECT_NUMBER);
          // Cached project number should be returned.
          return metadataServer.getProjectNumber();
        })
        .then((projectNumber) => {
          expect(projectNumber).to.be.equal(PROJECT_NUMBER);
        });
    });

    it('rejects with the default error message when none is available', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/project/numeric-project-id')
        .reply(400, {error: 'other'});
      mockedRequests.push(scope);

      return metadataServer.getProjectNumber()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(DEFAULT_ERROR_MESSAGE_PROJECT_NUMBER);
        });
    });
  });

  describe('getZone()', () => {
    it('resolves with the zone', () => {
      const expectedZone = 'us-east1';
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/instance/zone')
        .reply(200, ZONE_RESOURCE);
      mockedRequests.push(scope);

      return metadataServer.getZone()
        .then((zone) => {
          expect(zone).to.be.equal(expectedZone);
          // Cached zone should be returned.
          return metadataServer.getZone();
        })
        .then((zone) => {
          expect(zone).to.be.equal(expectedZone);
        });
    });

    it('logs expected information', () => {
      const expectedZone = 'us-east1';
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/instance/zone')
        .reply(200, ZONE_RESOURCE);
      mockedRequests.push(scope);

      const metadataServerWithLogger = new MetadataServer(scopes, logger);

      return metadataServerWithLogger.getZone()
        .then((zone) => {
          expect(logger).to.have.been.calledTwice;
          expect(logger.firstCall).to.be.calledWith(
            `GET to http://metadata.google.internal/computeMetadata/v1/instance/zone`);
          expect(logger.secondCall).to.be.calledWith('200 response');
          expect(zone).to.be.equal(expectedZone);
        });
    });

    it('resolves with a default zone if not available', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/instance/zone')
        .reply(200, 'unexpected/format');
      mockedRequests.push(scope);

      return metadataServer.getZone()
        .then((zone) => {
          expect(zone).to.be.equal(DEFAULT_ZONE);
          // Cached zone should be returned.
          return metadataServer.getZone();
        })
        .then((zone) => {
          expect(zone).to.be.equal(DEFAULT_ZONE);
        });
    });

    it('rejects with the expected error when underlying error is detected', () => {
      const expectedZone = 'us-east1';
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/instance/zone')
        .reply(400, errorResponse)
        .get('/computeMetadata/v1/instance/zone')
        .reply(200, ZONE_RESOURCE);
      mockedRequests.push(scope);

      return metadataServer.getZone()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(errorResponse.error.message);
          // Next call should succeed.
          return metadataServer.getZone();
        })
        .then((zone) => {
          expect(zone).to.be.equal(expectedZone);
          // Cached zone should be returned.
          return metadataServer.getZone();
        })
        .then((zone) => {
          expect(zone).to.be.equal(expectedZone);
        });
    });

    it('rejects with the default error message when none is available', () => {
      const scope = nock('http://metadata.google.internal', {
        reqheaders: {
          'Metadata-Flavor': 'Google',
        },
      }).get('/computeMetadata/v1/instance/zone')
        .reply(400, {error: 'other'});
      mockedRequests.push(scope);

      return metadataServer.getZone()
         .then((response) => {
          throw new Error('Unexpected success');
        }).catch((error) => {
          expect(error.message).to.be.equal(DEFAULT_ERROR_MESSAGE_ZONE);
        });
    });
  });
});
