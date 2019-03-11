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

import { deepExtend } from './deep-copy';
import { mapObject } from './index';

/** Defines error info type. This includes a code and message string. */
export interface ErrorInfo {
  code: string;
  message: string;
}

/**
 * Defines the HTTP error info type. This include the http error code number,
 * the status code and the detailed error message.
 */
export interface HttpErrorInfo {
  code: number;
  status: string;
  message: string;
}

/**
 * CIAP error code structure used for all errors within the CIAP library. This extends Error.
 */
export class CIAPError extends Error {
  /**
   * Initializes the CIAP error object.
   *
   * @param {ErrorInfo} errorInfo The error information (code and message).
   * @param {Error=} underlyingReason The underlying error reason. For example, this could be a
   *     LowLevelError or a Firebase Error, etc.
   * @constructor
   * @extends {Error}
   */
  constructor(private errorInfo: ErrorInfo, message?: string, private readonly underlyingReason?: Error) {
    super(message || errorInfo.message);
    /* tslint:disable:max-line-length */
    // Set the prototype explicitly. See the following link for more details:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    /* tslint:enable:max-line-length */
    Object.setPrototypeOf(this, CIAPError.prototype);
  }

  /** @return {string} The error code. */
  public get code(): string {
    return this.errorInfo.code;
  }

  /** @return {string} The error message. */
  public get message(): string {
    return this.errorInfo.message;
  }

  /**
   * @return {Error|undefined} The underlying reason error if available. this could be a
   *     LowLevelError, a Firebase error, etc.
   */
  public get reason(): Error {
    return this.underlyingReason;
  }

  /** @return {object} The object representation of the error. */
  public toJSON(): object {
    const json = {
      code: this.code,
      message: this.message,
    };
    // Append the underlying reason error if available.
    if (typeof this.underlyingReason !== 'undefined') {
      deepExtend(json, {reason: JSON.stringify(this.underlyingReason)});
    }
    return json;
  }
}

/** Defines the HttpCIAPError which extends the CIAPError and is used to represent HTTP related errors. */
export class HttpCIAPError extends CIAPError {
  /**
   * Returns the ErrorInfo corresponding to the provided combination of HTTP error code,
   * status code and message.
   *
   * @param {number} httpErrorCode The required HTTP error code.
   * @param {string=} statusCode The status code of the error if available.
   * @param {string=} message The optional custom message which when provided, overrides
   *     any default message associated with the error.
   * @return {ErrorInfo} The corresponding ErrorInfo for the supplied combination of error properties.
   */
  private static getErrorInfo(httpErrorCode: number, statusCode?: string, message?: string): ErrorInfo {
    // Prioritize status code matches over http error codes.
    for (const key in HTTP_ERROR_CODE) {
      if (HTTP_ERROR_CODE.hasOwnProperty(key) && HTTP_ERROR_CODE[key].status === statusCode) {
        // Status codes are unique. Return immediately on match.
        return {
          code: reformatStatusCode(HTTP_ERROR_CODE[key].status),
          message: message || HTTP_ERROR_CODE[key].message,
        };
      }
    }
    // Lookup matching http error codes if no status code match is found.
    for (const key in HTTP_ERROR_CODE) {
      if (HTTP_ERROR_CODE.hasOwnProperty(key) && HTTP_ERROR_CODE[key].code === httpErrorCode) {
        // Return first match.
        return {
          code: reformatStatusCode(statusCode || HTTP_ERROR_CODE[key].status),
          message: message || HTTP_ERROR_CODE[key].message,
        };
      }
    }
    // Default to unknown error code if no status code provided.
    return {
      code: reformatStatusCode(statusCode || HTTP_ERROR_CODE.unknown.status),
      message: message || HTTP_ERROR_CODE.unknown.message,
    };
  }

  /**
   * Initializes the HTTP CIAP error using the server http error and status code, in addition to an optional
   * detailed message and the underlying Error if available.
   *
   * @param {number} httpErrorCode The HTTP error code number.
   * @param {string=} statusCode The status code.
   * @param {string=} message The detailed error message.
   * @param {Error=} reason The optional underlying error object.
   * @constructor
   * @extends {CIAPError}
   */
  constructor(public readonly httpErrorCode: number, statusCode?: string, message?: string, reason?: Error) {
    super(HttpCIAPError.getErrorInfo(httpErrorCode, statusCode, message), undefined, reason);
    /* tslint:disable:max-line-length */
    // Set the prototype explicitly. See the following link for more details:
    // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    /* tslint:enable:max-line-length */
    Object.setPrototypeOf(this, HttpCIAPError.prototype);
  }

  /**
   * @return {object} The object representation of the error.
   * @override
   */
  public toJSON(): object {
    // Inject the HTTP error code.
    return deepExtend(super.toJSON(), {httpErrorCode: this.httpErrorCode});
  }
}

/**
 * Reformats server status code string to client side code format.
 * This will lowercase the string and replace underscores with dashes.
 * This will also make all error codes compatible with each other.
 *
 * @param {string} statusCode The server side status code.
 * @return {string} The client side formatted status code.
 */
function reformatStatusCode(statusCode: string): string {
  return statusCode.toLowerCase().replace(/_/g, '-');
}

/** Defines the map of HTTP client to server error codes. */
export const HTTP_ERROR_CODE: {[key: string]: HttpErrorInfo} = {
  'invalid-argument': {
    code: 400,
    status: 'INVALID_ARGUMENT',
    message: 'Client specified an invalid argument.',
  },
  'failed-precondition': {
    code: 400,
    status: 'FAILED_PRECONDITION',
    message: 'Request can not be executed in the current system state.',
  },
  'out-of-range': {
    code: 400,
    status: 'OUT_OF_RANGE',
    message: 'Client specified an invalid range.',
  },
  'unauthenticated': {
    code: 401,
    status: 'UNAUTHENTICATED',
    message: 'Request not authenticated due to missing, invalid, or expired OAuth token',
  },
  'permission-denied': {
    code: 403,
    status: 'PERMISSION_DENIED',
    message: 'Client does not have sufficient permission.',
  },
  'not-found': {
    code: 404,
    status: 'NOT_FOUND',
    message: 'Specified resource is not found.',
  },
  'aborted': {
    code: 409,
    status: 'ABORTED',
    message: 'Concurrency conflict, such as read-modify-write conflict.',
  },
  'already-exists': {
    code: 409,
    status: 'ALREADY_EXISTS',
    message: 'The resource that a client tried to create already exists.',
  },
  'resource-exhausted': {
    code: 429,
    status: 'RESOURCE_EXHAUSTED',
    message: 'Either out of resource quota or reaching rate limiting.',
  },
  'cancelled': {
    code: 499,
    status: 'CANCELLED',
    message: 'Request cancelled by the client.',
  },
  'data-loss': {
    code: 500,
    status: 'DATA_LOSS',
    message: 'Unrecoverable data loss or data corruption.',
  },
  'unknown': {
    code: 500,
    status: 'UNKNOWN',
    message: 'Unknown server error.',
  },
  'internal': {
    code: 500,
    status: 'INTERNAL',
    message: 'Internal server error.',
  },
  'not-implemented': {
    code: 501,
    status: 'NOT_IMPLEMENTED',
    message: 'API method not implemented by the server.',
  },
  'unavailable': {
    code: 503,
    status: 'UNAVAILABLE',
    message: 'Service unavailable.',
  },
  'deadline-exceeded': {
    code: 504,
    status: 'DEADLINE_EXCEEDED',
    message: 'Request deadline exceeded.',
  },
};

/**
 * Maps HttpErrorInfo object to an ErrorInfo object. This eliminates the need to hardcode the strings which
 * increases binary size. It also limits the error code to a well defined limited list of codes.
 */
export const CLIENT_ERROR_CODES: {[key: string]: ErrorInfo} = mapObject<HttpErrorInfo, ErrorInfo>(
    HTTP_ERROR_CODE, (key: string, value: HttpErrorInfo) => {
  return {
    code: reformatStatusCode(HTTP_ERROR_CODE[key].status),
    message: HTTP_ERROR_CODE[key].message,
  };
});
