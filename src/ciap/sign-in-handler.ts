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

import { AuthenticationHandler } from './authentication-handler';
import { BaseOperationHandler, OperationType } from './base-operation-handler';
import { Config } from './config';


/**
 * Defines the sign-in operation handler.
 */
export class SignInOperationHandler extends BaseOperationHandler {

  /**
   * Initializes an sign-in operation handler. This will either present the sign-in
   * UI for the specified tenant ID or get an ID token for a user already signed in with
   * that specific tenant.
   *
   * @param {Config} config The current operation configuration.
   * @param {AuthenticationHandler} handler The Authentication handler instance.
   * @param {boolean=} forceReauth Whether to force re-authentication or not. When this is true,
   *     even if a user is already signed in, they will still be required to re-authenticate via
   *     the sign-in UI.
   * @constructor
   * @extends {BaseOperationHandler}
   * @implements {OperationHandler}
   */
  constructor(
      config: Config,
      handler: AuthenticationHandler,
      private readonly forceReauth: boolean = false) {
    super(config, handler);
  }

  /**
   * @return {OperationType} The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignIn;
  }

  /**
   * Starts the sign-in operation handler. This either results in the sign-in UI being presented, or
   * the ID token being retrieved for an already signed in user that does not require
   * re-authentication.
   *
   * @return {Promise<void>} A promise that resolves when the operation handler is initialized.
   * @override
   */
  public start(): Promise<void> {
    // TODO.
    return Promise.resolve();
  }
}
