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

import {expect} from 'chai';
import { Factory, StorageType} from '../../../src/storage/storage';
import { StorageManager, DataStorageInfo} from '../../../src/storage/manager';
import { MockStorage } from '../../resources/utils';

describe('StorageManager', () => {
  const localDataStorageInfo: DataStorageInfo = {
    name: 'local_key1',
    type: StorageType.Local,
  };

  const sessionDataStorageInfo: DataStorageInfo = {
    name: 'session_key1',
    type: StorageType.Session,
  };

  const inMemoryDataStorageInfo: DataStorageInfo = {
    name: 'none_key1',
    type: StorageType.None,
  };

  let mockWin: any;
  let factory: Factory;
  let manager: StorageManager;

  beforeEach(() => {
    mockWin = {
      localStorage: new MockStorage(),
      sessionStorage: new MockStorage(),
    };
    factory = new Factory(mockWin as any);
    manager = new StorageManager(factory);
  });

  it('should support basic operations for Local WebStorage with id specified', () => {
    const key = localDataStorageInfo;
    const expectedValue = 'something';
    const appId = 'appId1';
    const storageKey = 'ciap:local_key1:appId1';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue, appId);
      })
      .then(() => {
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([storageKey]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.remove(key, appId);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should support basic operations for Local WebStorage with no id specified', () => {
    const key = localDataStorageInfo;
    const expectedValue = 'something';
    const storageKey = 'ciap:local_key1';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue);
      })
      .then(() => {
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([storageKey]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.remove(key);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should support basic operations for Session WebStorage with id specified', () => {
    const key = sessionDataStorageInfo;
    const expectedValue = 'something';
    const appId = 'appId1';
    const storageKey = 'ciap:session_key1:appId1';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue, appId);
      })
      .then(() => {
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([storageKey]);
        return manager.remove(key, appId);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should support basic operations for Session WebStorage with no id specified', () => {
    const key = sessionDataStorageInfo;
    const expectedValue = 'something';
    const storageKey = 'ciap:session_key1';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue);
      })
      .then(() => {
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([storageKey]);
        return manager.remove(key);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should support basic operations for InMemory WebStorage with id specified', () => {
    const key = inMemoryDataStorageInfo;
    const expectedValue = 'something';
    const appId = 'appId1';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue, appId);
      })
      .then(() => {
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.remove(key, appId);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should support basic operations for InMemory WebStorage with no id specified', () => {
    const key = inMemoryDataStorageInfo;
    const expectedValue = 'something';
    return Promise.resolve()
      .then(() => {
        return manager.set(key, expectedValue);
      })
      .then(() => {
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.remove(key);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return manager.get(key);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });

  it('should fallback to InMemory WebStorage when localStorage/sessionStorage are not supported', () => {
    // Simulate unavailable web storage.
    const mockWinWithUnavailableWebStorage = {
      localStorage: new MockStorage(false),
      sessionStorage: new MockStorage(false),
    };

    const factoryWithUnavailableWebStorage = new Factory(mockWinWithUnavailableWebStorage as any);
    const managerWithUnavailableWebStorage = new StorageManager(factoryWithUnavailableWebStorage);
    // Even though local storage used, storage manager will fallback to in memory
    // since the former is not available.
    const key = localDataStorageInfo;
    const expectedValue = 'something';
    const appId = 'appId1';
    return Promise.resolve()
      .then(() => {
        return managerWithUnavailableWebStorage.set(key, expectedValue, appId);
      })
      .then(() => {
        return managerWithUnavailableWebStorage.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.deep.equal(expectedValue);
        expect(mockWinWithUnavailableWebStorage.localStorage.keys).to.deep.equal([]);
        expect(mockWinWithUnavailableWebStorage.sessionStorage.keys).to.deep.equal([]);
        return managerWithUnavailableWebStorage.remove(key, appId);
      })
      .then(() => {
        expect(mockWinWithUnavailableWebStorage.localStorage.keys).to.deep.equal([]);
        expect(mockWinWithUnavailableWebStorage.sessionStorage.keys).to.deep.equal([]);
        return managerWithUnavailableWebStorage.get(key, appId);
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
      });
  });
});
