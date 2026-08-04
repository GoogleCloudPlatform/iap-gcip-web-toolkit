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

import * as http from 'http';
import * as https from 'https';
import { deepCopy, deepExtend } from '../../common/deep-copy';
import { isNonNullObject } from '../../common/validator';
import { addReadonlyGetter, formatString } from '../../common/index';
import { URL } from 'url';

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

/** Helper function to send requests using native http/https modules. */
function makeRequest(options: RequestPromiseOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const headers: {[key: string]: any} = { ...options.headers };

    let bodyData: any = null;
    if (options.body) {
      if (options.json) {
        bodyData = JSON.stringify(options.body);
        const hasContentType = Object.keys(headers).some(
          (key) => key.toLowerCase() === 'content-type'
        );
        if (!hasContentType) {
          headers['content-type'] = 'application/json';
        }
      } else {
        bodyData = options.body;
      }
      Object.keys(headers).forEach((key) => {
        if (key.toLowerCase() === 'content-length') {
          delete headers[key];
        }
      });
      headers['content-length'] = Buffer.byteLength(bodyData);
    }

    const requestOptions: http.RequestOptions = {
      method: options.method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
      timeout: options.timeout,
    };

    const req = lib.request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('error', (err) => {
        reject({ error: err });
      });
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        let parsedBody: any;
        if (data) {
          parsedBody = data;
          if (options.json) {
            try {
              parsedBody = JSON.parse(data);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }
        }
        resolve({
          statusCode: res.statusCode || 0,
          body: parsedBody,
        });
      });
    });

    req.on('error', (err) => {
      reject({ error: err });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ error: new Error('ESOCKETTIMEDOUT') });
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

/** Defines a utility for sending server side HTTP requests. */
export class HttpServerRequestHandler {
  private baseRequestPromiseOptions: RequestPromiseOptions;

  /**
   * Instantiates an HttpServerRequest instance used for sending server side HTTP requests
   * using the provided base configuration.
   * @param baseOptions The base options for the request.
   * @param logger The optional logging function used to log request information for debugging purposes.
   *   This can be accessed via Cloud Run LOGS tab.
   */
  constructor(baseOptions: BaseRequestOptions, private readonly logger?: (...args: any[]) => void) {
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

    // Log requests. Do not log headers as they can contain sensitive OAuth access tokens.
    this.log(`${requestPromiseOptions.method} to ${requestPromiseOptions.url}`);
    if (requestPromiseOptions.body) {
      this.log('Request body:', requestPromiseOptions.body)
    }
    return makeRequest(requestPromiseOptions)
      .catch((reason) => {
        const error = (reason && reason.error) || reason;
        this.log('Error encountered:', error);
        throw error;
      })
      .then((httpResponse) => {
        // To be safe, we will not log successful responses as they may contain
        // sensitive information like OAuth client secrets, hashing secret keys, etc.
        // Logging is mainly needed for debugging issues.
        if (httpResponse.statusCode !== 200) {
          this.log(`${httpResponse.statusCode} Response:`, httpResponse.body);
          const parsedError = this.getError(httpResponse, defaultMessage);
          throw parsedError;
        } else {
          this.log(`${httpResponse.statusCode} response`);
        }
        return httpResponse;
      });
  }

  /**
   * Logs the network request operation if a logger is available.
   * @param args The list of arguments to log.
   */
  private log(...args: any[]) {
    if (this.logger) {
      this.logger(...args);
    }
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
    // Append status code as it is more reliable than error messages.
    addReadonlyGetter(error, 'statusCode', httpResponse.statusCode);
    return error;
  }
}
