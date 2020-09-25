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
    const selectedTenantInfo = {
      email: 'user@example.com',
      tenantId: tid,
      providerIds: ['saml.my-provider', 'oidc.provider'],
    };
    const historyState = {
      state: 'signIn',
      selectedTenantInfo,
    };
    const otherSelectedTenantInfo = {
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
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should populate selectedTenantInfo from history.state', () => {
      const config = new Config(createMockUrl('login', apiKey, tid, redirectUri, state, hl), historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.deep.equal(selectedTenantInfo);
    });

    it('should populate selectedTenantInfo from hash when history.state is not available', () => {
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          `#hint=${selectedTenantInfo.email};${(selectedTenantInfo.providerIds || []).join(',')}`;
      const config = new Config(url);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.deep.equal(selectedTenantInfo);
    });

    it('should nullify selectedTenantInfo when no tenant ID is available', () => {
      const url = createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl) +
          `#hint=${selectedTenantInfo.email};${(selectedTenantInfo.providerIds || []).join(',')}`;
      const config = new Config(url);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should nullify selectedTenantInfo when invalid fragment is available', () => {
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          `#helloworld`;
      const config = new Config(url);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should populate selectedTenantInfo from history.state even when hash is available', () => {
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          `#hint=${otherSelectedTenantInfo.email};${(otherSelectedTenantInfo.providerIds || []).join(',')}`;
      const config = new Config(url, historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.deep.equal(selectedTenantInfo);
    });

    it('should nullify selectedTenantInfo on tenant ID mismatch', () => {
      const invalidHistoryState = {
        state: 'signIn',
        selectedTenantInfo: {
          tenantId: 'mismatching-tenant-id',
        },
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should not nullify selectedTenantInfo on project level flow', () => {
      const topLevelProjectSelectedTenantInfo = {
        email: 'user@example.com',
        // Project level project ID.
        tenantId: null,
        providerIds: ['saml.my-provider', 'oidc.provider'],
      };
      const topLevelProjectHistoryState = {
        state: 'signIn',
        selectedTenantInfo: topLevelProjectSelectedTenantInfo,
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
      expect(config.selectedTenantInfo).to.deep.equal(topLevelProjectSelectedTenantInfo);
    });

    it('should nullify tenant level selectedTenantInfo on mismatch with project level flow', () => {
      const config = new Config(
          createMockUrl('login', apiKey, '_PROJECT_ID', redirectUri, state, hl),
          historyState);

      expect(config.mode).to.equal(ConfigMode.Login);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal('_PROJECT_ID');
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should nullify project level selectedTenantInfo on mismatch with tenant level flow', () => {
      const topLevelProjectSelectedTenantInfo = {
        email: 'user@example.com',
        // Project level project ID.
        tenantId: null,
        providerIds: ['saml.my-provider', 'oidc.provider'],
      };
      const topLevelProjectHistoryState = {
        state: 'signIn',
        selectedTenantInfo: topLevelProjectSelectedTenantInfo,
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
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should nullify selectedTenantInfo on invalid history.state', () => {
      const invalidHistoryState = {
        state: 'other',
        selectedTenantInfo,
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should clear invalid email in selectedTenantInfo', () => {
      const invalidHistoryState = {
        state: 'signIn',
        selectedTenantInfo: {
          email: 'invalid',
          tenantId: tid,
          providerIds: ['saml.idp'],
        },
      };
      const expectedSelectedTenantInfo = {
        tenantId: tid,
        providerIds: ['saml.idp'],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.selectedTenantInfo).to.deep.equal(expectedSelectedTenantInfo);
    });

    it('should clear non-array providerIds in selectedTenantInfo', () => {
      const invalidHistoryState = {
        state: 'signIn',
        selectedTenantInfo: {
          email: 'invalid',
          tenantId: tid,
          // This should be an array.
          providerIds: 'saml.idp',
        },
      };
      const expectedSelectedTenantInfo = {
        tenantId: tid,
        providerIds: [],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.selectedTenantInfo).to.deep.equal(expectedSelectedTenantInfo);
    });

    it('should remove each invalid providerId in selectedTenantInfo from history.state', () => {
      const invalidHistoryState = {
        state: 'signIn',
        selectedTenantInfo: {
          email: 'user@example.com',
          tenantId: tid,
          providerIds: [
            '', {}, '   ', '!invalid', 'saml.idp', 123, 'oidc.provider', ' google.com  ',
          ],
        },
      };
      const expectedSelectedTenantInfo = {
        email: 'user@example.com',
        tenantId: tid,
        providerIds: ['saml.idp', 'oidc.provider', 'google.com'],
      };
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl);
      const config = new Config(url, invalidHistoryState);

      expect(config.selectedTenantInfo).to.deep.equal(expectedSelectedTenantInfo);
    });

    it('should clear each invalid providerId in selectedTenantInfo from URL hash', () => {
      // Since spaces are not allowed in hashes (they will be encoded as %20), provider Ids with
      // spaces will be ignored as invalid.
      const url = createMockUrl('login', apiKey, tid, redirectUri, state, hl) +
          '#hint=user@example.com;,{},  ,!invalid,saml.idp,oidc.provider,  google.com  ';
      const config = new Config(url);
      const expectedSelectedTenantInfo = {
        email: 'user@example.com',
        tenantId: tid,
        providerIds: ['saml.idp', 'oidc.provider'],
      };

      expect(config.selectedTenantInfo).to.deep.equal(expectedSelectedTenantInfo);
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
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should initialize successfully with reauth config mode', () => {
      const config = new Config(createMockUrl('reauth', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Reauth);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should initialize successfully with signout config mode', () => {
      const config = new Config(createMockUrl('signout', apiKey, tid, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.Signout);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.equal(tid);
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should initialize successfully with selectAuthSession config mode', () => {
      const config = new Config(createMockUrl('selectAuthSession', apiKey, null, redirectUri, state, hl));
      expect(config.mode).to.equal(ConfigMode.SelectAuthSession);
      expect(config.apiKey).to.equal(apiKey);
      expect(config.tid).to.be.null;
      expect(config.state).to.equal(state);
      expect(config.hl).to.equal(hl);
      expect(config.redirectUrl).to.equal(redirectUri);
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should initialize successfully with unknown config mode when invalid mode passed', () => {
      const config = new Config(createMockUrl('other'));
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
      expect(config.selectedTenantInfo).to.be.null;
    });

    it('should initialize successfully with unknown config mode when no mode is passed', () => {
      const config = new Config('https://www.example.com');
      expect(config.mode).to.equal(ConfigMode.Unknown);
      expect(config.apiKey).to.be.null;
      expect(config.tid).to.be.null;
      expect(config.state).to.be.null;
      expect(config.hl).to.be.null;
      expect(config.redirectUrl).to.be.null;
      expect(config.selectedTenantInfo).to.be.null;
    });
  });
});
