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

import { isNonEmptyString, isHttpsURL, isArray } from '../utils/validator';
import { HttpResponse, HttpRequestConfig, HttpClient, LowLevelError } from '../utils/http-client';
import { ApiRequester } from '../utils/api-requester';
import { HttpCIAPError, CLIENT_ERROR_CODES, CIAPError } from '../utils/error';
import { isMobileBrowser } from '../utils/browser';
import { isSafeUrl } from '../utils/index';

/**
 * Enum for IAP request timeout durations in milliseconds.
 * Short timeout is used for desktop browsers.
 * Long timeout is used for mobile browsers.
 * @enum {number}
 */
enum IAP_TIMEOUT {
  Short = 30000,
  Long = 60000,
}
/** IAP request headers. */
const IAP_HEADERS = {
  'Content-Type': 'application/json',
};

/** IAP error code number to string mappings. */
const IAP_ERROR_CODE: {[key: string]: string} = {
  8: 'AUTHENTICATION_URI_FAIL',
  37: 'GCIP_TOKEN_INVALID',
  38: 'RESOURCE_MISSING_GCIP_SIGN_IN_URL',
  39: 'GCIP_REDIRECT_INVALID',
  40: 'GET_PROJECT_MAPPING_FAIL',
  41: 'GCIP_ID_TOKEN_ENCRYPTION_ERROR',
  42: 'GCIP_ID_TOKEN_DECRYPTION_ERROR',
  43: 'GCIP_ID_TOKEN_UNESCAPE_ERROR',
};

/**
 * Enum for GCIP customized error codes.
 * enum {string}
 */
enum GCIP_ERROR_CODES {
  RestartProcess = 'RESTART_PROCESS',
}

/**
 * The map for IAP errors that need to be overidden by GCIP.
 */
const GCIP_ERROR_OVERRIDE: {[key: string]: any} = {
  FAILED_PRECONDITION: {
    messagePattern: /restart\sthe\sauthentication\sprocess/,
    newCode: GCIP_ERROR_CODES.RestartProcess,
  },
};

/** Defines EXCHANGE_ID_TOKEN response interface. */
export interface RedirectServerResponse {
  redirectToken: string;
  originalUri: string;
  targetUri: string;
}

/** Defines GET_SESSION_INFO response interface. */
export interface SessionInfoResponse {
  originalUri: string;
  targetUri: string;
  tenantIds: string[];
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
  }).setRequestValidator((config: HttpRequestConfig) => {
    // Validate redirect server URL.
    if (!isSafeUrl(config.url) || !isHttpsURL(config.url)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid URL');
    }
    // Validate all data parameters.
    if (!isNonEmptyString(config.data.id_token) ||
        !isNonEmptyString(config.data.state) ||
        !isNonEmptyString(config.data.id_token_tenant_id)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  }).setResponseValidator((response: HttpResponse) => {
    // Confirm response contains required parameters.
    if (!response.isJson() ||
        !isNonEmptyString(response.data.redirectToken) ||
        !isNonEmptyString(response.data.originalUri) ||
        !isNonEmptyString(response.data.targetUri) ||
        !isSafeUrl(response.data.originalUri) ||
        !isSafeUrl(response.data.targetUri)) {
      throw new CIAPError(CLIENT_ERROR_CODES.unknown, 'Invalid response');
    }
  });

  /** Defines the API to set the cookie on IAP resource via targetUri. */
  private static SET_COOKIE = new ApiRequester({
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    headers: IAP_HEADERS,
    credentials: 'include',
    url: '{targetUrl}',
  }).setRequestValidator((config: HttpRequestConfig) => {
    // Validate target URL.
    if (!isSafeUrl(config.url) || !isHttpsURL(config.url)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid URL');
    }
    // Validate redirect token.
    if (!isNonEmptyString(config.headers['x-iap-3p-token'])) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  });

  /** Defines the API to get the session information associated with a state JWT. */
  private static GET_SESSION_INFO = new ApiRequester({
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: IAP_HEADERS,
    url: '{iapRedirectServerUrl}',
  }).setRequestValidator((config: HttpRequestConfig) => {
    // Validate redirect server URL.
    if (!isSafeUrl(config.url) || !isHttpsURL(config.url)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid URL');
    }
    // Validate state parameter.
    if (!isNonEmptyString(config.data.state)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid request');
    }
  }).setResponseValidator((response: HttpResponse) => {
    // Confirm response contains required parameters.
    if (!response.isJson() ||
        !isNonEmptyString(response.data.originalUri) ||
        !isSafeUrl(response.data.originalUri) ||
        !isArray(response.data.tenantIds)) {
      throw new CIAPError(CLIENT_ERROR_CODES.unknown, 'Invalid response');
    }
  });

  private readonly timeout: number;
  /**
   * Initializes the IAP request handler with the provided HttpClient instance.
   *
   * @param httpClient The HTTP client used to process RPCs to IAP endpoints.
   * @constructor
   */
  constructor(private readonly httpClient: HttpClient) {
    if (!httpClient || typeof httpClient.send !== 'function') {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid HTTP client instance');
    }
    this.timeout = isMobileBrowser() ? IAP_TIMEOUT.Long : IAP_TIMEOUT.Short;
  }

  /**
   * Exchanges the provided Firebase ID token for a redirect token, original and target URI.
   * TODO: remove depedency on id_token_tenant_id.
   *
   * @param iapRedirectServerUrl The IAP redirect server URL passed via query string.
   * @param idToken The Firebase ID token.
   * @param tenantId The tenant ID.
   * @param state The state JWT.
   * @return A promise that resolves with the redirect token, target and original URI.
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
    return IAPRequestHandler.EXCHANGE_ID_TOKEN.process(this.httpClient, urlParams, requestData, null, this.timeout)
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
   * @param targetUrl The target URL returned from exchange ID token endpoint,
   *     used to set the IAP cookie.
   * @param redirectToken The redirect token to pass to target URI.
   * @return A promise that resolves on successful cookie setting.
   */
  public setCookieAtTargetUrl(targetUrl: string, redirectToken: string): Promise<void> {
    const urlParams = {targetUrl};
    const headers = {
      'x-iap-3p-token': redirectToken,
    };
    return IAPRequestHandler.SET_COOKIE.process(this.httpClient, urlParams, null, headers, this.timeout)
        .then((response: HttpResponse) => {
          // Do nothing.
        })
        .catch((error: Error) => {
          throw this.translateLowLevelTextError(error);
        });
  }

  /**
   * Get the original URI associated with the state JWT used to complete signout.
   * TODO: remove depedency on id_token_tenant_id.
   *
   * @param iapRedirectServerUrl The IAP redirect server URL passed via query string.
   * @param tenantId The tenant ID.
   * @param state The state JWT.
   * @return A promise that resolves on successful response with the original URI.
   */
  public getOriginalUrlForSignOut(
      iapRedirectServerUrl: string,
      tenantId: string,
      state: string): Promise<string> {
    const urlParams = {iapRedirectServerUrl};
    const requestData = {
      id_token: 'dummy',
      state,
      id_token_tenant_id: tenantId,
    };
    // Re-use same API for sign-in with dummy variable passed as ID token.
    return IAPRequestHandler.EXCHANGE_ID_TOKEN.process(this.httpClient, urlParams, requestData, null, this.timeout)
        .then((response: HttpResponse) => {
          // Only original URI is needed.
          return (response.data as RedirectServerResponse).originalUri;
        })
        .catch((error: Error) => {
          throw this.translateLowLevelCanonicalError(error);
        });
  }

  /**
   * Returns the session information (associated resource tenants and original URI) for
   * the provided state JWT.
   *
   * @param iapRedirectServerUrl The IAP redirect server URL passed via query string.
   * @param state The state JWT.
   * @return A promise that resolves with the session info response.
   */
  public getSessionInfo(
      iapRedirectServerUrl: string,
      state: string): Promise<SessionInfoResponse> {
    const urlParams = {iapRedirectServerUrl};
    const requestData = {
      state,
    };
    return IAPRequestHandler.GET_SESSION_INFO.process(this.httpClient, urlParams, requestData, null, this.timeout)
        .then((response: HttpResponse) => {
          return response.data as SessionInfoResponse;
        })
        .catch((error: Error) => {
          throw this.translateLowLevelCanonicalError(error);
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
   * @param error The error caught when calling the IAP redirect server.
   * @return The translated error.
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
        // Check the status code and error message, if it's eligible to be overriden,
        // override the status code and message so that proper instructions can be
        // given to the end user.
        if (GCIP_ERROR_OVERRIDE.hasOwnProperty(statusCode)) {
          const msgRegex = new RegExp(GCIP_ERROR_OVERRIDE[statusCode].messagePattern);
          const errorMessage = errorResponse.error.message;
          if (msgRegex.test(errorMessage)) {
            statusCode = GCIP_ERROR_OVERRIDE[statusCode].newCode;
            message = errorMessage;
          }
        }
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
   * @param error The error caught when calling the target URI.
   * @return The translated error.
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
