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

import { isArray, isNonEmptyString, isHttpsURL } from '../utils/validator';
import { HttpResponse, HttpRequestConfig, HttpClient } from '../utils/http-client';
import { ApiRequester } from '../utils/api-requester';

/**
 * IAP request timeout duration in milliseconds. This should become variable depending on
 * whether this is a desktop or mobile browser.
 */
const IAP_TIMEOUT = 30000;
/** IAP request headers. */
const IAP_HEADERS = {
  'Content-Type': 'application/json',
};

/** Defines EXCHANGE_ID_TOKEN response interface. */
export interface RedirectServerResponse {
  redirectToken: string;
  originalUri: string;
  targetUri: string;
}

/**
 * Defines the RPC handler for calling the IAP related APIs.
 */
export class IAPRequestHandler {
  /** Defines the API to exchange the ID token for a redirect token and targetUri. */
  private static EXCHANGE_ID_TOKEN = new ApiRequester({
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: IAP_HEADERS,
    url: '{iapRedirectServerUrl}',
    timeout: IAP_TIMEOUT,
  }).setRequestValidator((config: HttpRequestConfig) => {
    // TODO: create common internal error class to handle errors.
    // Validate redirect server URL.
    if (!isHttpsURL(config.url)) {
      throw new Error('Invalid URL');
    }
    // Validate all data parameters.
    if (!isNonEmptyString(config.data.id_token) ||
        !isNonEmptyString(config.data.state) ||
        !isNonEmptyString(config.data.id_token_tenant_id)) {
      throw new Error('Invalid request');
    }
  }).setResponseValidator((response: HttpResponse) => {
    // Confirm response contains required parameters.
    if (!response.isJson() ||
        !isNonEmptyString(response.data.redirectToken) ||
        !isNonEmptyString(response.data.originalUri) ||
        !isNonEmptyString(response.data.targetUri)) {
      // TODO: create common internal error class to handle errors.
      throw new Error('Invalid response');
    }
  });

  /** Defines the API to set the cookie on IAP resource via targetUri. */
  private static SET_COOKIE = new ApiRequester({
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: IAP_HEADERS,
    url: '{targetUrl}',
    timeout: IAP_TIMEOUT,
  }).setRequestValidator((config: HttpRequestConfig) => {
    // TODO: create common internal error class to handle errors.
    // Validate target URL.
    if (!isHttpsURL(config.url)) {
      throw new Error('Invalid URL');
    }
    // Validate redirect token.
    if (!isNonEmptyString(config.headers['x-iap-3p-token'])) {
      throw new Error('Invalid request');
    }
  });

  /**
   * Initializes the IAP request handler with the provided HttpClient instance.
   *
   * @param {HttpClient} httpClient The HTTP client used to process RPCs to IAP endpoints.
   * @constructor
   */
  constructor(private readonly httpClient: HttpClient) {
    if (!httpClient || typeof httpClient.send !== 'function') {
      throw new Error('Invalid HTTP client instance');
    }
  }

  /**
   * Exchanges the provided Firebase ID token for a redirect token, original and targert URI.
   *
   * @param {string} iapRedirectServerUrl The IAP redirect server URL passed via query string.
   * @param {string} idToken The Firebase ID token.
   * @param {string} tenantId The tenant ID.
   * @param {string} state The state JWT.
   * @return {Promise<RedirectServerResponse>} A promise that resolves with the redirect token,
   *     target and original URI.
   */
  public exchangeIdTokenAndGetOriginalAndTargetUrl(
      iapRedirectServerUrl: string,
      idToken: string,
      tenantId: string,
      state: string): Promise<RedirectServerResponse> {
    const urlParams = {iapRedirectServerUrl};
    const requestData = {
      id_token: idToken,
      state,
      id_token_tenant_id: tenantId,
    };
    return IAPRequestHandler.EXCHANGE_ID_TOKEN.process(this.httpClient, urlParams, requestData)
        .then((response: HttpResponse) => {
          return response.data as RedirectServerResponse;
        });
  }

  /**
   * Calls the corresponding IAP resource target URI to validate the redirect token
   * and set the cookie for the authenticated user.
   *
   * @param {string} targetUrl The target URL returned from exchange ID token endpoint,
   *     used to set the IAP cookie.
   * @param {string} redirectToken The redirect token to pass to target URI.
   * @return {Promise<void>} A promise that resolves on successful cookie setting.
   */
  public setCookieAtTargetUrl(targetUrl: string, redirectToken: string): Promise<void> {
    const urlParams = {targetUrl};
    const headers = {
      'x-iap-3p-token': redirectToken,
    };
    return IAPRequestHandler.SET_COOKIE.process(this.httpClient, urlParams, null, headers)
        .then((response: HttpResponse) => {
          // Do nothing.
        });
  }
}
