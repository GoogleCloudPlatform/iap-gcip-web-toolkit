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

import { PromiseCache } from '../utils/promise-cache';
import { GCIPRequestHandler } from './gcip-request';
import { IAPRequestHandler } from './iap-request';
import { HttpClient } from '../utils/http-client';

/**
 * Defines the data structure for storing settings that are shared by
 * OperationHandlers. This is mainly used to facilitate caching of
 * RPC requests to IAP and GCIP servers.
 */
export class SharedSettings {
  public readonly gcipRequest: GCIPRequestHandler;
  public readonly iapRequest: IAPRequestHandler;
  public readonly cache: PromiseCache;

  /**
   * Initializes a shared settings instance.
   * @param apiKey The shared settings API key.
   * @param framework Optional additional framework version to log.
   */
  constructor(public readonly apiKey: string, framework?: string) {
    const httpClient = new HttpClient();
    this.cache = new PromiseCache();
    this.gcipRequest = new GCIPRequestHandler(apiKey, httpClient, framework);
    this.iapRequest = new IAPRequestHandler(httpClient);
  }
}
