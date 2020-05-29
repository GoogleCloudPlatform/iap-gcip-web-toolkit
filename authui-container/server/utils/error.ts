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

export interface ErrorResponse {
  error: {
    code: number;
    message: string;
    status?: string;
  };
}

export const ERROR_MAP: {[key: string]: ErrorResponse} = {
  INVALID_ARGUMENT: {
    error: {
      code: 400,
      message: 'Client specified an invalid argument.',
      status: 'INVALID_ARGUMENT',
    },
  },
  FAILED_PRECONDITION: {
    error: {
      code: 400,
      message: 'Request can not be executed in the current system state.',
      status: 'FAILED_PRECONDITION',
    },
  },
  OUT_OF_RANGE: {
    error: {
      code: 400,
      message: 'Client specified an invalid range.',
      status: 'OUT_OF_RANGE',
    },
  },
  UNAUTHENTICATED: {
    error: {
      code: 401,
      message: 'Request not authenticated due to missing, invalid, or expired OAuth token.',
      status: 'UNAUTHENTICATED',
    },
  },
  PERMISSION_DENIED: {
    error: {
      code: 403,
      message: 'Client does not have sufficient permission.',
      status: 'PERMISSION_DENIED',
    },
  },
  NOT_FOUND: {
    error: {
      code: 404,
      message: 'A specified resource is not found, or the request is rejected by undisclosed reasons.',
      status: 'NOT_FOUND',
    },
  },
  ABORTED: {
    error: {
      code: 409,
      message: 'Concurrency conflict, such as read-modify-write conflict.',
      status: 'ABORTED',
    },
  },
  ALREADY_EXISTS: {
    error: {
      code: 409,
      message: 'The resource that a client tried to create already exists.',
      status: 'ALREADY_EXISTS',
    },
  },
  RESOURCE_EXHAUSTED: {
    error: {
      code: 429,
      message: 'Either out of resource quota or reaching rate limiting.',
      status: 'RESOURCE_EXHAUSTED',
    },
  },
  CANCELLED: {
    error: {
      code: 499,
      message: 'Request cancelled by the client.',
      status: 'CANCELLED',
    },
  },
  DATA_LOSS: {
    error: {
      code: 500,
      message: 'Unrecoverable data loss or data corruption. ',
      status: 'DATA_LOSS',
    },
  },
  UNKNOWN: {
    error: {
      code: 500,
      message: 'Unknown server error.',
      status: 'UNKNOWN',
    },
  },
  INTERNAL: {
    error: {
      code: 500,
      message: 'Internal server error.',
      status: 'INTERNAL',
    },
  },
  NOT_IMPLEMENTED: {
    error: {
      code: 501,
      message: 'API method not implemented by the server.',
      status: 'NOT_IMPLEMENTED',
    },
  },
  UNAVAILABLE: {
    error: {
      code: 503,
      message: 'Service unavailable.',
      status: 'UNAVAILABLE',
    },
  },
  DEADLINE_EXCEEDED: {
    error: {
      code: 504,
      message: 'Request deadline exceeded.',
      status: 'DEADLINE_EXCEEDED',
    },
  },
};
