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
import { HttpResponse, LowLevelError, HttpClient } from '../utils/http-client';
import { ApiRequester } from '../utils/api-requester';
import { HttpCIAPError } from '../utils/error';


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
  projectId: string;
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
        !isArray(response.data.authorizedDomains) ||
        !isNonEmptyString(response.data.projectId)) {
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
   * Checks whether the provided URLs are authorized to receive ID tokens and credentials on behalf
   * of the corresponding project.
   *
   * @param {Array<string>} urls The URLs to check.
   * @return {Promise<string>} A promise that resolves with the status whether the domain is
   *     authorized or not.
   */
  public checkAuthorizedDomainsAndGetProjectId(urls: string[]): Promise<string> {
    return Promise.resolve().then(() => {
      urls.forEach((url: string) => {
        if (!isURL(url)) {
          throw new Error('Invalid URL');
        }
      });

      return CICPRequestHandler.GET_PROJECT_CONFIG.process(this.httpClient, {apiKey: this.apiKey})
          .then((response: HttpResponse) => {
            const responseJson = response.data as GetProjectConfigResponse;
            // Check each URL.
            urls.forEach((url: string) => {
              if (!isAuthorizedDomain(responseJson.authorizedDomains, url)) {
                throw new Error('Unauthorized domain');
              }
            });
            // If all URLs are authorized, return project ID.
            return responseJson.projectId;
          })
          .catch((error: Error) => {
            throw this.translateLowLevelError(error);
          });
    });
  }

  /**
   * Translates a LowLevelError error thrown by CICP server to an HttpCIAPError.
   * Sample error code (JSON formatted):
   * {
   *   "error": {
   *     "code": 400,
   *     "message": "CREDENTIAL_TOO_OLD_LOGIN_AGAIN",
   *     // Details can be returned from Auth server in format:
   *     // "message": "CREDENTIAL_TOO_OLD_LOGIN_AGAIN: detailed message",
   *     "errors": [
   *       {
   *         "message": "CREDENTIAL_TOO_OLD_LOGIN_AGAIN",
   *         "domain": "global",
   *         "reason": "invalid"
   *       }
   *     ]
   *   }
   * }
   *
   * There are cases where status field is returned.
   * {
   *   "error": {
   *     "code": 400,
   *     "message": "API key not valid. Please pass a valid API key.",
   *     "errors": [
   *       {
   *         "message": "API key not valid. Please pass a valid API key.",
   *         "domain": "global",
   *         "reason": "badRequest"
   *       }
   *     ],
   *     "status": "INVALID_ARGUMENT"
   *   }
   * }
   *
   * @param {Error} error The error caught when calling the CICP server.
   * @return {Error} The translated error.
   */
  private translateLowLevelError(error: Error): Error {
    // Check if low level error, otherwise pass it through.
    if ('status' in error) {
      let statusCode: string;
      let message: string;
      const lowLevelResponse = (error as LowLevelError).response;
      if (lowLevelResponse &&
          lowLevelResponse.data &&
          (lowLevelResponse.data as any).error &&
          (lowLevelResponse.data as any).error.message) {
        const errorResponse = lowLevelResponse.data as any;
        if (isNonEmptyString(errorResponse.error.status)) {
          // If status is vailable, use that as status code.
          statusCode = errorResponse.error.status;
          message = errorResponse.error.message;
        } else {
          // Otherwise, get code from response.error.message.
          const components = (errorResponse.error.message || '').split(':');
          statusCode = components.length > 1 ? components[0].trim() : errorResponse.error.message;
          // TODO: add default error messages for common Auth error codes when no server message is provided.
          message = components.length > 1 ? components[1].trim() : undefined;
        }
      }
      return new HttpCIAPError((error as LowLevelError).status, statusCode, message, error);
    }
    return error;
  }
}
