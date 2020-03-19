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
import { PromiseCache } from '../../../src/utils/promise-cache';
import { GCIPRequestHandler } from '../../../src/ciap/gcip-request';
import { IAPRequestHandler } from '../../../src/ciap/iap-request';
import { HttpClient } from '../../../src/utils/http-client';
import { SharedSettings } from '../../../src/ciap/shared-settings';

describe('SharedSettings', () => {
  const apiKey = 'API_KEY';
  const FRAMEWORK_VERSION = 'ui-0.0.1';

  describe('Constructor', () => {
    it('should create an instance with the expected public properties' , () => {
      const sharedSettings = new SharedSettings(apiKey);

      expect(sharedSettings.apiKey).to.equal(apiKey);
      expect(sharedSettings.gcipRequest)
        .to.deep.equal(new GCIPRequestHandler(apiKey, new HttpClient()));
      expect(sharedSettings.iapRequest)
        .to.deep.equal(new IAPRequestHandler(new HttpClient()));
      expect(sharedSettings.cache).to.deep.equal(new PromiseCache());
    });

    it('should create an instance with the expected public properties when framework is provided' , () => {
      const sharedSettings = new SharedSettings(apiKey, FRAMEWORK_VERSION);

      expect(sharedSettings.apiKey).to.equal(apiKey);
      expect(sharedSettings.gcipRequest)
        .to.deep.equal(new GCIPRequestHandler(apiKey, new HttpClient(), FRAMEWORK_VERSION));
      expect(sharedSettings.iapRequest)
        .to.deep.equal(new IAPRequestHandler(new HttpClient()));
      expect(sharedSettings.cache).to.deep.equal(new PromiseCache());
    });
  });
});
