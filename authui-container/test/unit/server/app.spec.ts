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

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';
import {AuthServer} from '../../../server/auth-server';

chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('app server', () => {
  let server;
  let currentPort: string;
  let startAuthServerSpy: sinon.SinonSpy;
  let stopAuthServerSpy: sinon.SinonSpy;
  const TEST_PORT = '5000';

  beforeEach(() =>  {
    // Save environment variable port if available.
    currentPort = process.env.PORT;
    startAuthServerSpy = sinon.spy(AuthServer.prototype, 'start');
    stopAuthServerSpy = sinon.spy(AuthServer.prototype, 'stop');
  });

  afterEach(() => {
    // Restore port if available.
    process.env.PORT = currentPort;
    if (server) {
      server.close();
    }
    startAuthServerSpy.restore();
    stopAuthServerSpy.restore();
  });

  it('should initialize an AuthServer and use process.env.PORT for server port', () => {
    process.env.PORT = TEST_PORT;
    server = require('../../../server/app');
    expect(startAuthServerSpy).to.have.been.calledOnce.and.calledWith(TEST_PORT);
    expect(startAuthServerSpy.getCall(0).thisValue).to.be.instanceof(AuthServer);
    expect(startAuthServerSpy.getCall(0).thisValue.server).to.be.equal(server);
    expect(stopAuthServerSpy).to.not.have.been.called;
  })
});
