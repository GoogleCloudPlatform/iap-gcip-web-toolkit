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
  HttpRequestConfig, HttpResponse, HttpClient,
} from './http-client';
import { isObject } from './validator';
import { formatString } from './index';
import { deepCopy, deepExtend } from './deep-copy';

/** API request validator callback function type definition. */
export type RequestValidatorCallback = (config: HttpRequestConfig) => void;

/** API response validator callback function type definition. */
export type ResponseValidatorCallback = (response: HttpResponse) => void;

/**
 * Class that defines all the settings for the backend API endpoint.
 *
 * Example usage:
 * ```
 * // Defining API.
 * const REFRESH_ID_TOKEN = new ApiRequester(
 *     {
 *       method: 'POST',
 *       mode: 'cors',
 *       cache: 'no-cache',
 *       headers: {
 *         'Content-Type': 'application/x-www-form-urlencoded',
 *       },
 *       url: 'https://securetoken.googleapis.com/{version}/token?key={apiKey}',
 *       timeout: 30000,
 *       data: {
 *         grant_type: 'refresh_token',
 *       },
 *     })
 *     .setRequestValidator((config: HttpRequestConfig) => {
 *       if (!isNonEmptyString(config.data.refresh_token)) {
 *         throw new Error('Invalid refresh token');
 *       }
 *     })
 *     .setRequestValidator((response: HttpResponse) => {
 *       if (!isNonEmptyString(response.data.id_token)) {
 *         throw new Error('Invalid response');
 *       }
 *     });
 * // Using API.
 * REFRESH_ID_TOKEN.process(httpClient, {apiKey: 'API_KEY', version: 'v1'}, {refresh_token: 'REFRESH_TOKEN'})
 *   .then((response: HttpResponse) => {
 *     return response.data.id_token;
 *   });
 * ```
 */
export class ApiRequester {
  private requestValidator: RequestValidatorCallback;
  private responseValidator: ResponseValidatorCallback;

  /**
   * Initializes the API requester instance with the base configuration.
   *
   * @param baseConfig The base HTTP request configuration to use for this endpoint.
   */
  constructor(private readonly baseConfig: HttpRequestConfig) {
    // URL can contain variables, eg:
    // https://www.googleapis.com/identitytoolkit/{version}/relyingparty/getProjectConfig?key={apiKey}
    // Config can have headers and data but can be extended with variable data on processing.
    this.setRequestValidator(null);
    this.setResponseValidator(null);
  }

  /**
   * Sends an HTTP request based on the defined base HTTP request configuration and variable parameters
   * provided (URL params, additional data and headers) and returns a promise that resolves with the
   * returned HTTP response.
   * Before sending the request, any defined request validator will be applied.
   * After receiving the response, any defined response validator will be applied before
   * resolving with the response.
   *
   * @param client The HTTP client instance used to send HTTP requests.
   * @param urlParams The URL parameters to substitute.
   * @param data The additional variable data to pass in request.
   * @param headers The additional variable headers to pass in request.
   * @return A promise that resolves with the server HTTP response on success.
   */
  public process(
      client: HttpClient,
      urlParams: object | null = null,
      data: object | string | null = null,
      headers: object | null = null,
      timeout: number | null = null): Promise<HttpResponse> {
    const configCopy: HttpRequestConfig = deepCopy(this.baseConfig);
    // Substitute any variables in URL if needed.
    if (urlParams) {
      configCopy.url = formatString(configCopy.url, urlParams);
    }
    if (data) {
      if (isObject(configCopy.data) && isObject(data)) {
        deepExtend(configCopy.data, data);
      } else {
        configCopy.data = data;
      }
    }
    if (headers) {
      if (!configCopy.headers) {
        configCopy.headers = {};
      }
      deepExtend(configCopy.headers, headers);
    }
    // Override default timeout.
    if (timeout !== null) {
      configCopy.timeout = timeout;
    }
    return Promise.resolve().then(() => {
      // Validate request if validator available.
      this.requestValidator(configCopy);
      return client.send(configCopy);
    }).then((response: HttpResponse) => {
      // Validate response if validator available.
      this.responseValidator(response);
      return response;
    });
  }

  /**
   * Sets the request validator. Passing null will clear existing validator.
   *
   * @param requestValidator The request validator.
   * @return The current API settings instance.
   */
  public setRequestValidator(requestValidator: RequestValidatorCallback | null): ApiRequester {
    this.requestValidator = requestValidator || ((config: HttpRequestConfig) => undefined);
    return this;
  }

  /**
   * Sets the response validator. Passing null will clear existing validator.
   *
   * @param responseValidator The response validator.
   * @return The current API settings instance.
   */
  public setResponseValidator(responseValidator: ResponseValidatorCallback | null): ApiRequester {
    this.responseValidator = responseValidator || ((response: HttpResponse) => undefined);
    return this;
  }
}
