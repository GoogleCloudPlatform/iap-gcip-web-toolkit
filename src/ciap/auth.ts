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

import { OperationHandler } from './base-operation-handler';
import { SignInOperationHandler } from './sign-in-handler';
import { SignOutOperationHandler } from './sign-out-handler';
import { Config, ConfigMode } from './config';
import { AuthenticationHandler, isAuthenticationHandler } from './authentication-handler';
import { getCurrentUrl } from '../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';

/**
 * Defines the main utility used to handle all incoming sign-in, re-auth and sign-out operation
 * when accessing IAP gated resources.
 * An externally provided AuthenticationHandler is required to access CICP tenant-specific Auth
 * instances and display sign-in or sign-out related UIs.
 */
export class Authentication {
  private readonly operationHandler: OperationHandler;

  /**
   * Initializes the Authentication instance used to handle a sign-in, sign-out or re-auth operation.
   *
   * @param {AuthenticationHandler} handler The externally provided AuthenticationHandler used to
   *     interact with the CICP/Firebase Auth instance and display sign-in or sign-out related UI.
   * @constructor
   */
  constructor(handler: AuthenticationHandler) {
    if (!isAuthenticationHandler(handler)) {
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid AuthenticationHandler');
    }
    // Determine the current operation mode.
    const config = new Config(getCurrentUrl(window));
    switch (config.mode) {
      case ConfigMode.Login:
        this.operationHandler = new SignInOperationHandler(config, handler);
        break;
      case ConfigMode.Reauth:
        this.operationHandler = new SignInOperationHandler(config, handler, true);
        break;
      case ConfigMode.Signout:
        this.operationHandler = new SignOutOperationHandler(config, handler);
        break;
      default:
      throw new CIAPError(CLIENT_ERROR_CODES['invalid-argument'], 'Invalid mode');
    }
  }

  /**
   * @return {Promise<void>} A promise that resolves when underlying operation handler is rendered.
   */
  public start(): Promise<void> {
    return this.operationHandler.start();
  }
}
