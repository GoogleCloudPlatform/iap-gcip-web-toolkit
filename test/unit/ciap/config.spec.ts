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
import { Config, ConfigMode } from '../../../src/ciap/config';
import { createMockUrl } from '../../resources/utils';

describe('Config', () => {
  describe('Constructor', () => {
    const apiKey = 'API_KEY';
    const tid = 'TENANT_ID';
    const state = 'STATE';
    const hl = 'en-US';
    const redirectUri = `https://iap.googleapis.com/v1alpha1/gcip/resources/RESOURCE_HASH:handleRedirect`;

    it('should initialize successfully with login config mode', () => {
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
    });

    it('should sanitize the redirect URL in the query string', () => {
      const unsafeUrl = 'javascript:doEvil()';
      const config = new Config(createMockUrl('login', apiKey, tid, unsafeUrl, state, hl));
      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal('about:invalid');
    });

    it('should initialize successfully with reauth config mode', () => {
      const config = new Config(createMockUrl('reauth', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Reauth);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
    });

    it('should initialize successfully with signout config mode', () => {
      const config = new Config(createMockUrl('signout', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Signout);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
    });

    it('should initialize successfully with selectAuthSession config mode', () => {
      const config = new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.SelectAuthSession);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.be.null;
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
    });

    it('should initialize successfully with unknown config mode when invalid mode passed', () => {
      const config = new Config(createMockUrl('other'));
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
    });

    it('should initialize successfully with unknown config mode when no mode is passed', () => {
      const config = new Config('https://www.example.com');
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
    });
  });
});
