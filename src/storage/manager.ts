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

import { isNonEmptyString } from '../utils/validator';
import {
  WebStorage, Factory, StorageType,
} from './storage';

/** Defines the data storage information. This is used to figure out how and where data is persisted. */
export interface DataStorageInfo {
  name: string;
  type: StorageType;
}

/** Storage namespace, used as prefix for storage keys. */
const NAMESPACE = 'ciap';

/** Storage key component separator. */
const SEPARATOR = ':';

/** Defines the storage manager. */
export class StorageManager {
  private readonly persistenceStorage: WebStorage;
  private readonly temporaryStorage: WebStorage;
  private readonly inMemoryStorage: WebStorage;

  /**
   * Initializes a StorageManager instance.
   * @param {Factory} factory The WebStorage factory instance.
   * @constructor
   */
  constructor(factory: Factory) {
    try {
      this.persistenceStorage = factory.makeStorage(StorageType.Local);
      this.temporaryStorage = factory.makeStorage(StorageType.Session);
    } catch (e) {
      // Fallback to in-memory storage.
      this.persistenceStorage = factory.makeStorage(StorageType.None);
      this.temporaryStorage = factory.makeStorage(StorageType.None);
    }
    this.inMemoryStorage = factory.makeStorage(StorageType.None);
  }

  /**
   * Gets the stored value from the corresponding storage.
   * @param {DataStorageInfo} dataStorageInfo The key information under which the value is stored.
   * @param {string=} id Additional optional identifier typically associated with multiple resource storage.
   * @return {Promise<any>} A Promise that resolves with the stored value.
   */
  public get(dataStorageInfo: DataStorageInfo, id?: string): Promise<any> {
    return this.getStorage(dataStorageInfo.type).get(this.getKeyName(dataStorageInfo, id));
  }

  /**
   * Stores the value in the corresponding storage.
   * @param {DateStorageInfo} dataStorageInfo The key information under which the value is stored.
   * @param {any} value The value to store.
   * @param {string=} id Additional optional identifier typically associated with multiple resource storage.
   * @return {Promise<void>} A Promise that resolves when the operation is completed.
   */
  public set(dataStorageInfo: DataStorageInfo, value: any, id?: string): Promise<void> {
    return this.getStorage(dataStorageInfo.type).set(this.getKeyName(dataStorageInfo, id), value);
  }

  /**
   * Removes the stored value from the corresponding storage.
   * @param {DateStorageInfo} dataStorageInfo The key information under which the value is stored.
   * @param {string=} id Additional optional identifier typically associated with multiple resource storage.
   * @return {Promise<void>} A Promise that resolves when the operation is completed.
   */
  public remove(dataStorageInfo: DataStorageInfo, id?: string): Promise<void> {
    return this.getStorage(dataStorageInfo.type).remove(this.getKeyName(dataStorageInfo, id));
  }

  /**
   * Returns the WebStorage instance for the type provided.
   * @param {StorageType} type The type of WebStorage.
   * @return {WebStorage} The WebStorage instance corresponding to the StorageType provided.
   */
  private getStorage(type: StorageType): WebStorage {
    switch (type) {
      case StorageType.Local:
        return this.persistenceStorage;
      case StorageType.Session:
        return this.temporaryStorage;
      default:
        return this.inMemoryStorage;
    }
  }

  /**
   * Constructs the corresponding storage key name.
   * @param {DateStorageInfo} dataStorageInfo The key information under which the value is stored.
   * @param {string=} id Additional optional identifier typically associated with multiple resource storage.
   * @return {string} The corresponding key name.
   */
  private getKeyName(dataStorageInfo: DataStorageInfo, id?: string): string {
    const suffix = isNonEmptyString(id) ? `${SEPARATOR}${id}` : '';
    return `${NAMESPACE}${SEPARATOR}${dataStorageInfo.name}${suffix}`;
  }
}

/** Singleton global StorageManager instance. */
export const globalStorageManager: StorageManager = new StorageManager(new Factory(window));
