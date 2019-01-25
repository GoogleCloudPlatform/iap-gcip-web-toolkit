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

import {
  isArray, isAuthorizedDomain, isNonEmptyString, isURL,
} from '../utils/validator';
import { HttpResponse, HttpRequestConfig, HttpClient } from '../utils/http-client';
import { ApiRequester } from '../utils/api-requester';


/** CICP backend host. */
const CICP_HOST = 'www.googleapis.com';
/** CICP backend path. */
const CICP_PATH = '/identitytoolkit/v3/relyingparty/';
/** CICP temporary placeholder for request header. */
const CICP_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client-Version': 'Browser/CIAP/<XXX_SDK_VERSION_XXX>',
};
/**
 * CICP request timeout duration in milliseconds. This should become variable depending on
 * whether this is a desktop or mobile browser.
 */
const CICP_TIMEOUT = 30000;

/** Defines GetProjectConfig response interface. */
interface GetProjectConfigResponse {
  authorizedDomains: string[];
}


/**
 * Defines the RPC handler for calling the CICP server APIs.
 */
export class CICPRequestHandler {
  /** Defines the GetProjectConfig endpoint. */
  private static GET_PROJECT_CONFIG = new ApiRequester({
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: CICP_HEADERS,
    url: `https://${CICP_HOST}${CICP_PATH}getProjectConfig?key={apiKey}`,
    timeout: CICP_TIMEOUT,
  }).setResponseValidator((response: HttpResponse) => {
    if (!response.isJson() ||
        !isArray(response.data.authorizedDomains)) {
      // TODO: create common internal error class to handle errors.
      throw new Error('Invalid response');
    }
  });

  /**
   * Initializes the CICP request handler with the provided API key and HttpClient instance.
   *
   * @param {string} apiKey The browser API key.
   * @param {HttpClient} httpClient The HTTP client used to process RPCs to CICP endpoints.
   * @constructor
   */
  constructor(private readonly apiKey: string, private readonly httpClient: HttpClient) {
    if (!isNonEmptyString(apiKey)) {
      // TODO: create common internal error class to handle errors.
      throw new Error('Invalid API key');
    }

    if (!httpClient || typeof httpClient.send !== 'function') {
      throw new Error('Invalid HTTP client instance');
    }
  }

  /**
   * Checks whether the provided URL is authorized to receive ID tokens and credentials on behalf
   * of the corresponding project.
   *
   * @param {string} url The URL to check.
   * @return {Promise<boolean>} A promise that resolves with the status whether the domain is
   *     authorized or not.
   */
  public isAuthorizedDomain(url: string): Promise<boolean> {
    if (!isURL(url)) {
      return Promise.reject(new Error('Invalid URL'));
    }
    return CICPRequestHandler.GET_PROJECT_CONFIG.process(this.httpClient, {apiKey: this.apiKey})
        .then((response: HttpResponse) => {
          const responseJson = response.data as GetProjectConfigResponse;
          return isAuthorizedDomain(responseJson.authorizedDomains, url);
        });
  }
}
