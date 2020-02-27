/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import requestPromise = require('request-promise');
import { deepCopy, deepExtend } from '../utils/deep-copy';
import { isNonNullObject } from '../utils/validator';
import { addReadonlyGetter, formatString } from '../utils/index';

/** HTTP method type definition. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

/** Default error message to shown when an expected non-200 response is returned. */
const DEFAULT_ERROR_MESSAGE = 'Unexpected error occurred.'

// Google Cloud standard error response:
// https://cloud.google.com/apis/design/errors
interface ErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: {[key: string]: string}[];
  };
}

/** Interface defining the base request options for an HttpServerRequest. */
export interface BaseRequestOptions {
  method: HttpMethod;
  url: string;
  headers?: {[key: string]: any};
  // Request timeout is defined in milliseconds.
  timeout?: number;
}

/** Interface defining the variable HTTP request options to append to request. */
export interface RequestOptions {
  urlParams?: {[key: string]: string};
  headers?: {[key: string]: any};
  body?: {[key: string]: any};
}

/** Interface defining the options passed to a request-promise call. */
interface RequestPromiseOptions extends BaseRequestOptions, RequestOptions {
  json: boolean;
  resolveWithFullResponse: boolean;
  simple: boolean,
}

/** Interface defining the response returned by an HttpServerRequest. */
export interface HttpResponse {
  statusCode: number;
  body: any;
}

/** Defines a utility for sending server side HTTP requests. */
export class HttpServerRequestHandler {
  private baseRequestPromiseOptions: RequestPromiseOptions;

  /**
   * Instantiates an HttpServerRequest instance used for sending server side HTTP requests
   * using the provided base configuration.
   * @param baseOptions The base options for the request.
   */
  constructor(baseOptions: BaseRequestOptions) {
    this.baseRequestPromiseOptions = deepExtend({
      // Send request in JSON format.
      json: true,
      // Resolve promise with full response.
      resolveWithFullResponse: true,
      // This will resolve promise with full response even for non 2xx http status codes.
      simple: false,
    }, baseOptions);
  }

  /**
   * Sends the specified request options to the underlying endpoint.
   * @param requestOptions The variable request options to append to base config options.
   * @param defaultMessage The default error message if none is available in the response.
   * @return A promise that resolves with the full response.
   */
  send(
      requestOptions?: RequestOptions | null,
      defaultMessage: string = DEFAULT_ERROR_MESSAGE): Promise<HttpResponse> {
    const requestPromiseOptions: RequestPromiseOptions = deepCopy(this.baseRequestPromiseOptions);
    // Replace placeholders in the URL with their values if available.
    if (requestOptions && requestOptions.urlParams) {
      requestPromiseOptions.url = formatString(requestPromiseOptions.url, requestOptions.urlParams);
    }
    if (requestOptions && requestOptions.body) {
      if (requestPromiseOptions.method === 'GET' || requestPromiseOptions.method === 'HEAD') {
        if (!isNonNullObject(requestOptions.body)) {
          return Promise.reject(new Error('Invalid GET request data'));
        }
        // Parse URL and append data to query string.
        const parsedUrl = new URL(requestPromiseOptions.url);
        const dataObj = requestOptions.body;
        for (const key in dataObj) {
          if (dataObj.hasOwnProperty(key)) {
            parsedUrl.searchParams.append(key, dataObj[key]);
          }
        }
        requestPromiseOptions.url = parsedUrl.toString();
      } else {
        requestPromiseOptions.body = requestOptions.body;
      }
    }
    if (requestOptions && requestOptions.headers) {
      requestPromiseOptions.headers = requestPromiseOptions.headers || {};
      for (const key in requestOptions.headers) {
        if (requestOptions.headers.hasOwnProperty(key)) {
          requestPromiseOptions.headers[key] = requestOptions.headers[key];
        }
      }
    }

    return requestPromise(requestPromiseOptions)
      .catch((reason) => {
        throw reason.error;
      })
      .then((httpResponse) => {
        if (httpResponse.statusCode !== 200) {
          throw this.getError(httpResponse, defaultMessage);
        }
        return httpResponse;
      });
  }

  /**
   * Returns the Error objects from the non-200 HTTP response.
   * @param httpResponse The non-200 HTTP response.
   * @param defaultMessage The default error message if none is available in the response.
   * @return The corresponding Error object.
   */
  private getError(httpResponse: HttpResponse, defaultMessage: string): Error {
    let jsonResponse: ErrorResponse;
    let error: Error;
    try {
      jsonResponse = typeof httpResponse.body === 'object' ?
          httpResponse.body : JSON.parse(httpResponse.body);
      error = new Error(
          (jsonResponse &&
           jsonResponse.error &&
           jsonResponse.error.message &&
           jsonResponse.error.message.toString()) || defaultMessage);
    } catch (e) {
      // If the error response body is a string. Use the string as the error message.
      // This is the case for GCS:
      // response.body === 'No such object: gcip-iap-bucket-625969875839/config.json'
      // response.body === 'Not found'
      error = new Error(typeof httpResponse.body === 'string' ? httpResponse.body : defaultMessage);
    }
    if (jsonResponse &&
        jsonResponse.error &&
        jsonResponse.error.message &&
        jsonResponse.error.code) {
      addReadonlyGetter(error, 'cloudCompliant', true);
    } else {
      addReadonlyGetter(error, 'cloudCompliant', false);
    }
    addReadonlyGetter(error, 'rawResponse', httpResponse.body);
    return error;
  }
}
