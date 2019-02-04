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
 * Defines the sign-out operation handler.
 */
export class SignOutOperationHandler extends BaseOperationHandler {

  /**
   * Initializes an sign-out operation handler. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @param {Config} config The current operation configuration.
   * @param {AuthenticationHandler} handler The Authentication handler instance.
   * @constructor
   * @extends {BaseOperationHandler}
   * @implements {OperationHandler}
   */
  constructor(config: Config, handler: AuthenticationHandler) {
    super(config, handler);
  }

  /**
   * @return {OperationType} The corresponding operation type.
   * @override
   */
  public get type(): OperationType {
    return OperationType.SignOut;
  }

  /**
   * Starts the sign-out operation handler. This will either sign out from a specified tenant
   * or all current tenants and then either redirect back or display a sign-out message.
   *
   * @return {Promise<void>} A promise that resolves when the operation handler is initialized.
   * @override
   */
  public start(): Promise<void> {
    // TODO
    return Promise.resolve();
  }
}
