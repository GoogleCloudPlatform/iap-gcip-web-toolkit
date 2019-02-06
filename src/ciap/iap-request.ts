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

import { isNonEmptyString, isHttpsURL } from '../utils/validator';
import { HttpResponse, HttpRequestConfig, HttpClient, LowLevelError } from '../utils/http-client';
import { ApiRequester } from '../utils/api-requester';
import { formSubmitWithRedirect } from '../utils/index';
import { HttpCIAPError } from '../utils/error';

/**
 * IAP request timeout duration in milliseconds. This should become variable depending on
 * whether this is a desktop or mobile browser.
 */
const IAP_TIMEOUT = 30000;
/** IAP request headers. */
const IAP_HEADERS = {
  'Content-Type': 'application/json',
};

/** IAP error code number to string mappings. */
const IAP_ERROR_CODE: {[key: string]: string} = {
  8: 'AUTHENTICATION_URI_FAIL',
  37: 'CICP_TOKEN_INVALID',
  38: 'RESOURCE_MISSING_CICP_TENANT_ID',
  39: 'CICP_REDIRECT_INVALID',
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
        })
        .catch((error: Error) => {
          throw this.translateLowLevelCanonicalError(error);
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
        })
        .catch((error: Error) => {
          throw this.translateLowLevelTextError(error);
        });
  }

  /**
   * Submits form-urlencoded state and tenantId to IAP redirect server. This will also result with a
   * redirect to that URL.
   *
   * @param {string} iapRedirectServerUrl The IAP redirect server URL passed via query string.
   * @param {string} tenantId The tenant ID.
   * @param {string} state The state JWT.
   * @return {Promise<void>} A promise that resolves on successful submission.
   */
  public signOutWithRedirect(
      iapRedirectServerUrl: string,
      tenantId: string,
      state: string): Promise<void> {
    return Promise.resolve().then(() => {
      if (!isHttpsURL(iapRedirectServerUrl)) {
        throw new Error('Invalid URL');
      }
      if (!isNonEmptyString(tenantId) || !isNonEmptyString(state)) {
        throw new Error('Invalid request');
      }
      formSubmitWithRedirect(
          window.document,
          iapRedirectServerUrl,
          'POST',
          {
            id_token_tenant_id: tenantId,
            state,
          });
    });
  }

  /**
   * Translates a LowLevelError canonical error thrown by IAP redirect server to an HttpCIAPError.
   * Sample error code (JSON formatted):
   * {
   *   "error": {
   *     "code": 400,
   *     "message": "Request contains an invalid argument.",
   *     "status": "INVALID_ARGUMENT",
   *     "details": [
   *       {
   *         "@type": "type.googleapis.com/google.rpc.DebugInfo",
   *         "detail": "[ORIGINAL ERROR] generic::invalid_argument: state_jwt cannot be empty"
   *       }
   *     ]
   *   }
   * }
   *
   * @param {Error} error The error caught when calling the IAP redirect server.
   * @return {Error} The translated error.
   */
  private translateLowLevelCanonicalError(error: Error): Error {
    // Check if low level error, otherwise pass it through.
    if ('status' in error) {
      let statusCode: string;
      let message: string;
      const lowLevelResponse = (error as LowLevelError).response;
      if (lowLevelResponse &&
          lowLevelResponse.data &&
          (lowLevelResponse.data as any).error &&
          (lowLevelResponse.data as any).error.status) {
        const errorResponse = lowLevelResponse.data as any;
        statusCode = errorResponse.error.status;
        message = errorResponse.error.details && errorResponse.error.details.length &&
            errorResponse.error.details[0] && errorResponse.error.details[0].detail;
      }
      return new HttpCIAPError((error as LowLevelError).status, statusCode, message, error);
    }
    return error;
  }

  /**
   * Translates a LowLevelError text error thrown by IAP targetUri to an HttpCIAPError.
   * Sample error code (Text formatted and error code needs to be parsed separately):
   * "An internal server error occurred while authorizing your request. Error XYZ code."
   *
   * @param {Error} error The error caught when calling the target URI.
   * @return {Error} The translated error.
   */
  private translateLowLevelTextError(error: Error): Error {
    // Low level error.
    if ('status' in error) {
      let message: string;
      let statusCode: string;
      const lowLevelResponse = (error as LowLevelError).response;
      if (lowLevelResponse && lowLevelResponse.data) {
        message = lowLevelResponse.data as string;
        if (isNonEmptyString(message)) {
          const matchServerErrorCode = message.match(/Error\s(\d+)\scode/);
          if (matchServerErrorCode.length > 1 &&
              typeof IAP_ERROR_CODE[matchServerErrorCode[1]] !== 'undefined') {
            statusCode = IAP_ERROR_CODE[matchServerErrorCode[1]];
          }
        }
      }
      return new HttpCIAPError((error as LowLevelError).status, statusCode, message, error);
    }
    return error;
  }
}
