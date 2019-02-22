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

import { StorageManager, DataStorageInfo } from '../storage/manager';
import { StorageType} from '../storage//storage';

/** List of authenticated tenants is stored in LOCAL storage and keyed by the "auth-tenants" name. */
const AUTH_TENANTS_DATA_STORAGE_INFO: DataStorageInfo = {
  name: 'auth-tenants',
  type: StorageType.Local,
};

/** Defines a class used to manage the list of authenticated tenants stored in localStorage. */
export class AuthTenantsStorageManager {
  private tenantList: string[];
  /** Queue used to serialize writes to storage to avoid successive write calls from overwriting each other. */
  private queue: Promise<void>;
  /**
   * Initializes a storage manager for storing and manipulating a list of authenticated tenants.
   *
   * @param {StorageManager} storageManager The storage manager to use to access localStorage.
   * @param {string} appId The storage key identifier.
   * @constructor
   */
  constructor(private readonly storageManager: StorageManager, private readonly appId: string) {
    this.queue = this.storageManager.get(AUTH_TENANTS_DATA_STORAGE_INFO, this.appId)
      .then((tenantList: string[]) => {
        this.tenantList = tenantList || [];
      });
  }

  /** @return {Promise<Array<string>} A promise that resolves with the list of stored tenant IDs. */
  public listTenants(): Promise<string[]> {
    // Wait for queue to be ready before returning results.
    return this.addToQueue(() => Promise.resolve(this.tenantList.concat()));
  }

  /**
   * Removes a tenant ID from the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to remove.
   * @return {Promise<void>} A promise that resolves on successful removal.
   */
  public removeTenant(tenantId: string): Promise<void> {
    return this.addToQueue(() => {
      this.tenantList = this.tenantList.filter((value: string) => {
        return value !== tenantId;
      });
      return this.save();
    });
  }

  /**
   * Adds a tenant ID to the list of stored authenticated tenants.
   *
   * @param {string} tenantId The tenant to add.
   * @return {Promise<void>} A promise that resolves on successful addition.
   */
  public addTenant(tenantId: string): Promise<void> {
    return this.addToQueue(() => {
      if (this.tenantList.indexOf(tenantId) === -1) {
        this.tenantList.push(tenantId);
        return this.save();
      }
      return Promise.resolve();
    });
  }

  /**
   * Clears list of stored authenticated tenants.
   *
   * @return {Promise<void>} A promise that resolves on successful clearing of all authenticated tenants.
   */
  public clearTenants(): Promise<void> {
    return this.addToQueue(() => {
      if (this.tenantList.length > 0) {
        this.tenantList = [];
        return this.save();
      }
      return Promise.resolve();
    });
  }

  /** @return {Promise<void>} A promise that resolves when current state is saved to storage. */
  private save(): Promise<void> {
    if (this.tenantList.length) {
      return this.storageManager.set(AUTH_TENANTS_DATA_STORAGE_INFO, this.tenantList, this.appId);
    } else {
      // If there is no entry left, remove the whole entry as it could contain sensitive info in the key.
      return this.storageManager.remove(AUTH_TENANTS_DATA_STORAGE_INFO, this.appId);
    }
  }

  /**
   * Adds a callback function to a queue which will trigger when the queue is ready and
   * returns a promise that resolves when the callback promise resolves.
   *
   * @param {function(): Promise<any>} promiseCallback A callback that returns a promise.
   * @return {Promise<any>} A promise that resolves after the queue is cleared and the callback function resolves.
   */
  private addToQueue(promiseCallback: () => Promise<any>): Promise<any> {
    const promise = this.queue.then(promiseCallback);
    // Ignore error for next call.
    this.queue = promise.catch((error) => {
      // Ignore error.
    });
    return promise;
  }
}
