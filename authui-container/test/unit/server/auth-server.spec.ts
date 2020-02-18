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

import {expect} from 'chai';
import request = require('supertest');
import * as templates from  '../../../server/templates';
import * as fs from 'fs';
import {AuthServer} from '../../../server/auth-server';
import express = require('express');

describe('AuthServer', () => {
  let app: express.Application;
  let authServer: AuthServer;

  beforeEach(() =>  {
    app = express();
    authServer = new AuthServer(app);
    return authServer.start();
  });

  afterEach(() => {
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

  it('404 everything else', () => {
    return request(authServer.server)
      .get('/not/found')
      .expect(404);
  });
});
