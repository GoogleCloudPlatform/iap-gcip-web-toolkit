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
    const providerMatch = {
      email: 'user@example.com',
      tenantId: tid,
      providerIds: ['saml.my-provider', 'oidc.provider'],
    };
    const historyState = {
      state: 'signIn',
      providerMatch,
    };
    const otherProviderMatch = {
      email: 'other@example.com',
      tenantId: 'TENANT_ID2',
      providerIds: ['microsoft.com', 'linkedin.com'],
    };
    it('should initialize successfully with login config mode', () => {
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should populate providerMatch from history.state', () => {
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl), historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.deep.equal(providerMatch);
    });

    it('should populate providerMatch from hash when history.state is not available', () => {
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          `#hint=${providerMatch.email};${(providerMatch.providerIds || []).join(',')}`;
      const config = new Config(url);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.deep.equal(providerMatch);
    });

    it('should nullify providerMatch when no tenant ID is available', () => {
      const url = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl) +
          `#hint=${providerMatch.email};${(providerMatch.providerIds || []).join(',')}`;
      const config = new Config(url);
      expect(config.providerMatch).to.be.null;
    });

    it('should populate providerMatch from history.state even when hash is available', () => {
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          `#hint=${otherProviderMatch.email};${(otherProviderMatch.providerIds || []).join(',')}`;
      const config = new Config(url, historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.deep.equal(providerMatch);
    });

    it('should nullify providerMatch on tenant ID mismatch', () => {
      const invalidHistoryState = {
        state: 'signIn',
        providerMatch: {
          tenantId: 'mismatching-tenant-id',
        },
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.providerMatch).to.be.null;
    });

    it('should not nullify providerMatch on project level flow', () => {
      const topLevelProjectProviderMatch = {
        email: 'user@example.com',
        // Project level project ID.
        tenantId: null,
        providerIds: ['saml.my-provider', 'oidc.provider'],
      };
      const topLevelProjectHistoryState = {
        state: 'signIn',
        providerMatch: topLevelProjectProviderMatch,
      };
      const config = new Config(
          createMockUrl('login', apiKey, '_PROJECT_ID', redirectUri, state, hl),
          topLevelProjectHistoryState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal('_PROJECT_ID');
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.deep.equal(topLevelProjectProviderMatch);
    });

    it('should nullify tenant level providerMatch on mismatch with project level flow', () => {
      const config = new Config(
          createMockUrl('login', apiKey, '_PROJECT_ID', redirectUri, state, hl),
          historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal('_PROJECT_ID');
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should nullify project level providerMatch on mismatch with tenant level flow', () => {
      const topLevelProjectProviderMatch = {
        email: 'user@example.com',
        // Project level project ID.
        tenantId: null,
        providerIds: ['saml.my-provider', 'oidc.provider'],
      };
      const topLevelProjectHistoryState = {
        state: 'signIn',
        providerMatch: topLevelProjectProviderMatch,
      };
      const config = new Config(
          createMockUrl('login', apiKey, tid, redirectUri, state, hl),
          topLevelProjectHistoryState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should nullify providerMatch on invalid history.state', () => {
      const invalidHistoryState = {
        state: 'other',
        providerMatch,
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.providerMatch).to.be.null;
    });

    it('should clear invalid email in providerMatch', () => {
      const invalidHistoryState = {
        state: 'signIn',
        providerMatch: {
          email: 'invalid',
          tenantId: tid,
          providerIds: ['saml.idp'],
        },
      };
      const expectedProviderMatch = {
        tenantId: tid,
        providerIds: ['saml.idp'],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.providerMatch).to.deep.equal(expectedProviderMatch);
    });

    it('should clear non-array providerIds in providerMatch', () => {
      const invalidHistoryState = {
        state: 'signIn',
        providerMatch: {
          email: 'invalid',
          tenantId: tid,
          // This should be an array.
          providerIds: 'saml.idp',
        },
      };
      const expectedProviderMatch = {
        tenantId: tid,
        providerIds: [],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.providerMatch).to.deep.equal(expectedProviderMatch);
    });

    it('should remove each invalid providerId in providerMatch from history.state', () => {
      const invalidHistoryState = {
        state: 'signIn',
        providerMatch: {
          email: 'user@example.com',
          tenantId: tid,
          providerIds: [
            '', {}, '   ', '!invalid', 'saml.idp', 123, 'oidc.provider', ' google.com  ',
          ],
        },
      };
      const expectedProviderMatch = {
        email: 'user@example.com',
        tenantId: tid,
        providerIds: ['saml.idp', 'oidc.provider', 'google.com'],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.providerMatch).to.deep.equal(expectedProviderMatch);
    });

    it('should clear each invalid providerId in providerMatch from URL hash', () => {
      // Since spaces are not allowed in hashes (they will be encoded as %20), provider Ids with
      // spaces will be ignored as invalid.
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          '#hint=user@example.com;,{},  ,!invalid,saml.idp,oidc.provider,  google.com  ';
      const config = new Config(url);
      const expectedProviderMatch = {
        email: 'user@example.com',
        tenantId: tid,
        providerIds: ['saml.idp', 'oidc.provider'],
      };

      expect(config.providerMatch).to.deep.equal(expectedProviderMatch);
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
      expect(config.providerMatch).to.be.null;
    });

    it('should initialize successfully with reauth config mode', () => {
      const config = new Config(createMockUrl('reauth', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Reauth);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should initialize successfully with signout config mode', () => {
      const config = new Config(createMockUrl('signout', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Signout);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should initialize successfully with selectAuthSession config mode', () => {
      const config = new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.SelectAuthSession);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.be.null;
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.providerMatch).to.be.null;
    });

    it('should initialize successfully with unknown config mode when invalid mode passed', () => {
      const config = new Config(createMockUrl('other'));
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
      expect(config.providerMatch).to.be.null;
    });

    it('should initialize successfully with unknown config mode when no mode is passed', () => {
      const config = new Config('https://www.example.com');
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
      expect(config.providerMatch).to.be.null;
    });
  });
});
