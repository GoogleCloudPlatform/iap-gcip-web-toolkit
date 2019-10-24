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
  addReadonlyGetter, removeUndefinedFields,
} from './index';
import { isNonNullObject, isObject } from './validator';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';

/** HTTP method type definition. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

/** HTTP fetch mode. */
export type FetchMode = 'cors' | 'no-cors' | 'same-origin';

/** HTTP fetch caching settings. */
export type Cache = 'default' | 'no-cache' | 'reload' | 'force-cache';

/** HTTP fetch credentials settings. */
export type Credentials = 'omit' | 'same-origin' | 'include';

/**
 * Configuration for constructing a new HTTP request.
 */
export interface HttpRequestConfig {
  method: HttpMethod;
  mode?: FetchMode;
  cache?: Cache;
  credentials?: Credentials;
  /** Target URL of the request. Should be a well-formed URL including protocol, hostname, port and path. */
  url: string;
  headers?: {[key: string]: string};
  data?: any;
  /** Connect and read timeout (in milliseconds) for the outgoing request. */
  timeout?: number;
}

/**
 * Represents an HTTP response received from a remote server.
 */
export interface HttpResponse {
  readonly status: number;
  readonly headers: any;
  /** Response data as a raw string. */
  readonly text: string;
  /** Response data as a parsed JSON object. */
  readonly data: any;
  readonly request: RequestInit;
  /**
   * Indicates if the response content is JSON-formatted or not. If true, data field can be used
   * to retrieve the content as a parsed JSON object.
   */
  isJson(): boolean;
}

/**
 * Defines the low level HTTP response interface which contains all information returned
 * from remote server on success and failure.
 */
interface LowLevelResponse {
  status: number;
  headers: any;
  request: RequestInit;
  data: string | object;
  config: HttpRequestConfig;
}

/**
 * Defines the low level HTTP error response (non-200 HTTP replies) interface.
 * This is useful as different remote servers may have different error details and formats.
 * The expectation is that the service using this utility will catch this error and translate
 * it into a common format that can be consumed downstream.
 */
export interface LowLevelError extends Error {
  config: HttpRequestConfig;
  request?: RequestInit;
  response?: LowLevelResponse;
  status: number;
}

/**
 * Sends an HTTP request to a remote server and returns a promise that resolves with the
 * low level http response. HTTP error responses are not handled and returned as part of the
 * low level response.
 *
 * @param config The HTTP request configuration.
 * @return A promise that resolves with the low level response.
 */
function sendRequest(config: HttpRequestConfig): Promise<LowLevelResponse> {
  let actualResponse: Response;
  let url = config.url;
  const headers = new Headers(config.headers);
  let contentType = headers.get('content-type');
  let body: string;

  if (config.data) {
    if (config.method === 'GET' || config.method === 'HEAD') {
      if (!isNonNullObject(config.data)) {
        return Promise.reject(new CIAPError(
            CLIENT_ERROR_CODES['invalid-argument'], `${config.method} requests cannot have a body.`));
      }
      // Parse URL and append data to query string.
      const parsedUrl = new URL(config.url);
      const dataObj = config.data as {[key: string]: string};
      for (const key in dataObj) {
        if (dataObj.hasOwnProperty(key)) {
          parsedUrl.searchParams.append(key, dataObj[key]);
        }
      }
      url = parsedUrl.toString();
    } else if (contentType &&
               contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
      // Prefer not to use FormData as it automatically sets the Content-Type to multipart/form-data.
      // https://github.com/github/fetch/issues/263.
      body = Object.keys(config.data).map((key) => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(config.data[key]);
      }).join('&');
    } else {
      body = JSON.stringify(config.data);
    }
  }

  const request: RequestInit = removeUndefinedFields({
    method: config.method,
    mode: config.mode,
    cache: config.cache,
    headers: config.headers,
    credentials: config.credentials,
    body,
  });

  return new Promise<LowLevelResponse>((resolve, reject) => {
    let timeoutId: number;
    if (config.timeout) {
      timeoutId = window.setTimeout(() => {
        reject(new CIAPError(
            CLIENT_ERROR_CODES['deadline-exceeded'],
            `Error while making request: timeout of ${config.timeout}ms exceeded`));
      }, config.timeout);
    }
    return fetch(url, request)
      .then((response: Response) => {
        window.clearTimeout(timeoutId);
        actualResponse = response;
        contentType = response.headers.get('content-type');
        if (contentType && contentType.toLowerCase().includes('application/json')) {
          return response.json();
        }
        return response.text();
      })
      .then((jsonResponse: object | string) => {
        resolve({
          status: actualResponse.status,
          headers: actualResponse.headers,
          config,
          request,
          data: jsonResponse,
        });
      })
      .catch((error: Error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Creates a LowLevelError using the parameters provided.
 *
 * @param message The error message.
 * @param status The HTTP error code.
 * @param config The original HTTP request configuration.
 * @param request The original Request object.
 * @param response The low level response if vailable.
 * @return The corresponding LowLevelError.
 */
function createLowLevelError(
    message: string, status: number, config: HttpRequestConfig, request: RequestInit,
    response?: LowLevelResponse): LowLevelError {
  const error = new Error(message);
  addReadonlyGetter(error, 'status', status);
  addReadonlyGetter(error, 'config', config);
  addReadonlyGetter(error, 'request', request);
  addReadonlyGetter(error, 'response', response);
  return error as LowLevelError;
}

/**
 * The implementation for HttpResponse with error handling.
 * Initializing LowLevelResponses with non-200 responses throws a LowLevelError.
 */
class DefaultHttpResponse implements HttpResponse {
  public readonly status: number;
  public readonly headers: any;
  public readonly text: string;
  public readonly request: RequestInit;

  private readonly parsedData: any;

  /**
   * Constructs a new HttpResponse from the given LowLevelResponse.
   *
   * @param resp The low level response used to initialize the DefaultHttpResponse.
   */
  constructor(resp: LowLevelResponse) {
    this.status = resp.status;
    this.headers = resp.headers;
    this.request = resp.request;
    if (Math.floor(this.status / 100) * 100 !== 200) {
      throw createLowLevelError(
        `Server responded with status ${resp.status}`,
        resp.status, resp.config, resp.request, resp);
    }
    if (isObject(resp.data)) {
      this.parsedData = resp.data;
      this.text = JSON.stringify(resp.data);
    } else {
      this.text = resp.data as string;
    }
  }

  /**
   * @return The underlying data (JSON or text) returned from the remote server.
   */
  get data(): any {
    if (this.isJson()) {
      return this.parsedData;
    } else {
      return this.text;
    }
  }

  /**
   * @return Whether the server server is JSON formatted or not.
   */
  public isJson(): boolean {
    return typeof this.parsedData !== 'undefined';
  }
}

/**
 * Defines the utility used to send HTTP requests to a remove server.
 * Having a dedicated class provides the ability to add a retrial policy if needed in the future.
 */
export class HttpClient {
  /**
   * Sends an HTTP response based on the provided HTTP request configuration and returns
   * a promise that resolves with the return HTTP response. Any returned HTTP error responses
   * will be translated to LowLevelErrors.
   *
   * @param config The HTTP request configuration.
   * @return A promise that resolves with the server HTTP response on success.
   */
  public send(config: HttpRequestConfig): Promise<HttpResponse> {
    return sendRequest(config)
      .then((resp: LowLevelResponse) => {
        // Parse the low level response returned. This will throw a LowLevelError when the
        // HTTP status code is non-200.
        return new DefaultHttpResponse(resp);
      });
  }
}
