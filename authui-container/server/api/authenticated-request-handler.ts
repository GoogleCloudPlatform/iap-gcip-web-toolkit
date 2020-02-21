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

import {AccessTokenManager} from './token-manager';
import { deepCopy } from '../../utils/deep-copy';
import {
  HttpServerRequestHandler, BaseRequestOptions, RequestOptions,
  HttpResponse,
} from '../../utils/http-server-request-handler';

/** Utility for sending authenticated server side HTTP requests. */
export class AuthenticatedRequestHandler extends HttpServerRequestHandler {
  /**
   * Instantiates an authenticated request handler instance using the access token manager
   * provided.
   * @param baseOptions The base options for the request.
   * @param accessTokenManager The access token manager used to facilitate retrieval of OAuth access tokens.
   */
  constructor(baseOptions: BaseRequestOptions, private readonly accessTokenManager: AccessTokenManager) {
    super(baseOptions);
  }

  /**
   * Sends the specified request options to the underlying endpoint while injecting an
   * OAuth access token in the request header.
   * @param requestOptions The variable request options to append to base config options.
   * @param defaultMessage The default error message if none is available in the response.
   * @return A promise that resolves with the full response.
   */
  send(
      requestOptions?: RequestOptions | null,
      defaultMessage?: string): Promise<HttpResponse> {
    const modifiedRequestOptions = deepCopy(requestOptions || {});
    if (typeof modifiedRequestOptions.headers === 'undefined') {
      modifiedRequestOptions.headers = {};
    }
    // Get OAuth access token and add to header.
    return this.accessTokenManager.getAccessToken()
      .then((accessToken) => {
        // Inject access token to request.
        modifiedRequestOptions.headers.Authorization = `Bearer ${accessToken}`;
        return super.send(modifiedRequestOptions, defaultMessage);
      });
  }
}
