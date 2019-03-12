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

import { generateRandomAlphaNumericString } from '../utils/index';
import { CLIENT_ERROR_CODES, CIAPError } from '../utils/error';

/** Generic web storage interface. */
export interface WebStorage {
  type: StorageType;
  set(key: string, value: any): Promise<void>;
  get(key: string): Promise<any>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Enum for the storage type.
 * @enum {string}
 */
export enum StorageType {
  Local = 'LOCAL',
  Session = 'SESSION',
  None = 'NONE',
}

/** Prefix for storage availability key. */
const STORAGE_AVAILABLE_KEY = '__sak';

/**
 * Checks whether the Storage instance is available.
 * @param {Storage} storage The Storage instance to check.
 * @return {boolean} Whether the Storage instance is available.
 */
function isStorageAvailable(storage: Storage): boolean {
  try {
    const key = STORAGE_AVAILABLE_KEY + generateRandomAlphaNumericString(10);
    const value = '1';
    storage.setItem(key, value);
    if (storage.getItem(key) !== value) {
      return false;
    }
    storage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
}

/** Defines the abstract storage class used for initializing Storage based WebStorage instances. */
abstract class AbstractStorage implements WebStorage {
  /**
   * Initializes an instance of WebStorage using the provided Storage instance.
   * @param {Storage} storage The HTML5 storage instance.
   * @constructor
   */
  constructor(protected readonly storage: Storage) {
    if (!isStorageAvailable(storage)) {
      throw new CIAPError(CLIENT_ERROR_CODES['failed-precondition'], 'Requested storage is not available');
    }
  }

  /** @return {StorageType} The corresponding storage type. */
  public abstract get type(): StorageType;

  /**
   * Stores the value at the specified key.
   * @param {string} key The entry key.
   * @param {any} value The entry value.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public set(key: string, value: any): Promise<void> {
    return Promise.resolve()
      .then(() => {
        this.storage.setItem(key, JSON.stringify(value));
      });
  }

  /**
   * Retrieves the value stored at the key.
   * @param {string} key The key to lookup.
   * @return {Promise<any>} A promise that resolves with the entry value.
   */
  public get(key: string): Promise<any> {
    return Promise.resolve()
      .then(() => {
        const json = this.storage.getItem(key);
        // Not found.
        if (json === null) {
          return undefined;
        }
        try {
          return JSON.parse(json);
        } catch (e) {
          return undefined;
        }
      });
  }

  /**
   * Removes the value at the specified key.
   * @param {string} key The key of the entry to remove.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public remove(key: string): Promise<void> {
    return Promise.resolve()
      .then(() => {
        this.storage.removeItem(key);
      });
  }

  /**
   * Clears all stored entries in storage.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public clear(): Promise<void> {
    this.storage.clear();
    return Promise.resolve();
  }
}

/** Defines the session WebStorage which persists in window.localStorage. */
export class LocalStorage extends AbstractStorage {
  /**
   * Initializes an instance of WebStorage using the provided localStorage instance.
   * @param {Window} win The window instance.
   * @constructor
   * @extends {AbstractStorage}
   * @implements {WebStorage}
   */
  constructor(win: Window) {
    super(win.localStorage);
  }

  /**
   * @return {StorageType} The corresponding storage type.
   * @override
   */
  public get type(): StorageType {
    return StorageType.Local;
  }
}

/** Defines the session WebStorage which persists in window.sessionStorage. */
export class SessionStorage extends AbstractStorage {
  /**
   * Initializes an instance of WebStorage using the provided sessionStorage instance.
   * @param {Window} win The window instance.
   * @constructor
   * @extends {AbstractStorage}
   * @implements {WebStorage}
   */
  constructor(win: Window) {
    super(win.sessionStorage);
  }

  /**
   * @return {StorageType} The corresponding storage type.
   * @override
   */
  public get type(): StorageType {
    return StorageType.Session;
  }
}

/** Defines the in-memory WebStorage which persists data in-memory only. */
export class InMemoryStorage implements WebStorage {
  private storageMap: {[key: string]: any};

  /**
   * Initializes an instance of WebStorage with in-memory persistence.
   * @constructor
   * @implements {WebStorage}
   */
  constructor() {
    this.storageMap = {};
  }

  /**
   * @return {StorageType} The corresponding storage type.
   */
  public get type(): StorageType {
    return StorageType.None;
  }

  /**
   * Stores the value at the specified key.
   * @param {string} key The entry key.
   * @param {any} value The entry value.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public set(key: string, value: any): Promise<void> {
    this.storageMap[key] = value;
    return Promise.resolve();
  }

  /**
   * Retrieves the value stored at the key.
   * @param {string} key The key to lookup.
   * @return {Promise<any>} A promise that resolves with the entry value.
   */
  public get(key: string): Promise<any> {
    return Promise.resolve(this.storageMap[key]);
  }

  /**
   * Removes the value at the specified key.
   * @param {string} key The key of the entry to remove.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public remove(key: string): Promise<void> {
    delete this.storageMap[key];
    return Promise.resolve();
  }

  /**
   * Clears all stored entries in storage.
   * @return {Promise<void>} A promise that resolves when the operation completes.
   */
  public clear(): Promise<void> {
    return Promise.resolve()
      .then(() => {
        this.storageMap = {};
      });
  }
}

/** Defines a factory utility to generate WebStorage instances. */
export class Factory {
  /**
   * Initializes a WebStorage factory instance using the window instance provided.
   * @param {Window} win The window instance.
   * @constructor
   */
  constructor(private readonly win: Window) {}

  /**
   * Generates a WebStorage instance using the storage type provided.
   * @param {StorageType} type The type of storage to use.
   * @return {WebStorage} The WebStorage corresponding to the StorageType provided.
   */
  public makeStorage(type: StorageType): WebStorage {
    switch (type) {
      case StorageType.Local:
        return new LocalStorage(this.win);
      case StorageType.Session:
        return new SessionStorage(this.win);
      default:
        return new InMemoryStorage();
    }
  }
}
