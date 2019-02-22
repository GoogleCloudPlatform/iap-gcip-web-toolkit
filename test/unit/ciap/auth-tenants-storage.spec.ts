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
import { Factory } from '../../../src/storage/storage';
import { StorageManager } from '../../../src/storage/manager';
import { MockStorage } from '../../resources/utils';
import { AuthTenantsStorageManager } from '../../../src/ciap/auth-tenants-storage';

describe('AuthTenantsStorageManager', () => {
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

  it('should support basic operations for adding, listing and removing a single or all tenants', () => {
    const authTenantsStorageManager = new AuthTenantsStorageManager(manager, 'appId1');
    return authTenantsStorageManager.listTenants()
      .then((tenantList: string[]) => {
        expect(tenantList).to.deep.equal([]);
        return authTenantsStorageManager.addTenant('TENANT_ID1');
      })
      .then(() => {
        // Confirm localStorage used.
        expect(mockWin.localStorage.length).to.equal(1);
        expect(mockWin.localStorage.key(0)).to.contain('auth-tenants').and.contains('appId1');
        expect(mockWin.sessionStorage.length).to.equal(0);
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        expect(tenantList).to.have.same.members(['TENANT_ID1']);
        return Promise.all([
          authTenantsStorageManager.addTenant('TENANT_ID1'),
          authTenantsStorageManager.addTenant('TENANT_ID2'),
          authTenantsStorageManager.addTenant('TENANT_ID1'),
          authTenantsStorageManager.addTenant('TENANT_ID3'),
          authTenantsStorageManager.addTenant('TENANT_ID4'),
          authTenantsStorageManager.addTenant('TENANT_ID5'),
        ]);
      })
      .then(() => {
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        expect(tenantList).to.have.same.members(
            ['TENANT_ID1', 'TENANT_ID2', 'TENANT_ID3', 'TENANT_ID4', 'TENANT_ID5']);
        return authTenantsStorageManager.removeTenant('TENANT_ID3');
      })
      .then(() => {
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        expect(tenantList).to.have.same.members(['TENANT_ID1', 'TENANT_ID2', 'TENANT_ID4', 'TENANT_ID5']);
        return Promise.all([
          authTenantsStorageManager.removeTenant('TENANT_ID4'),
          authTenantsStorageManager.removeTenant('TENANT_ID3'),
          authTenantsStorageManager.removeTenant('TENANT_ID1'),
        ]);
      })
      .then(() => {
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        expect(tenantList).to.have.same.members(['TENANT_ID2', 'TENANT_ID5']);
        return authTenantsStorageManager.clearTenants();
      })
      .then(() => {
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        expect(tenantList).to.deep.equal([]);
        return authTenantsStorageManager.clearTenants();
      })
      .then(() => {
        return authTenantsStorageManager.listTenants();
      })
      .then((tenantList: string[]) => {
        // Entry should be completely cleared from storage.
        expect(mockWin.localStorage.length).to.equal(0);
        expect(tenantList).to.deep.equal([]);
      });
  });

  it('should initialize with previously saved tenant list', () => {
    const authTenantsStorageManager1 = new AuthTenantsStorageManager(manager, 'appId1');
    let authTenantsStorageManager2: AuthTenantsStorageManager;
    return Promise.all([
      authTenantsStorageManager1.addTenant('TENANT_ID1'),
      authTenantsStorageManager1.addTenant('TENANT_ID2'),
    ]).then(() => {
      // Confirm tenants saved.
      return authTenantsStorageManager1.listTenants();
    }).then((tenantList: string[]) => {
      expect(tenantList).to.have.same.members(['TENANT_ID1', 'TENANT_ID2']);
      // Initialize new AuthTenantsStorageManager with same ID.
      authTenantsStorageManager2 = new AuthTenantsStorageManager(manager, 'appId1');
      // Confirm previously saved tenants loaded.
      return authTenantsStorageManager2.listTenants();
    }).then((tenantList: string[]) => {
      expect(tenantList).to.have.same.members(['TENANT_ID1', 'TENANT_ID2']);
    });
  });

  it('should serialize write operations', () => {
    const authTenantsStorageManager = new AuthTenantsStorageManager(manager, 'appId1');
    // Confirm despite parallel calls, the operations will still run sequentially.
    const promises: Array<Promise<any>> = [
      authTenantsStorageManager.addTenant('TENANT_ID1'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.addTenant('TENANT_ID2'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.removeTenant('TENANT_ID4'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.addTenant('TENANT_ID4'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.removeTenant('TENANT_ID2'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.removeTenant('TENANT_ID1'),
      authTenantsStorageManager.listTenants(),
      authTenantsStorageManager.removeTenant('TENANT_ID4'),
      authTenantsStorageManager.listTenants(),
    ];
    return Promise.all(promises).then((values: any[]) => {
      // Confirm expect tenants stored after each call.
      expect(values[1]).to.have.same.members(['TENANT_ID1']);
      expect(values[3]).to.have.same.members(['TENANT_ID1', 'TENANT_ID2']);
      expect(values[5]).to.have.same.members(['TENANT_ID1', 'TENANT_ID2']);
      expect(values[7]).to.have.same.members(['TENANT_ID1', 'TENANT_ID2', 'TENANT_ID4']);
      expect(values[9]).to.have.same.members(['TENANT_ID1', 'TENANT_ID4']);
      expect(values[11]).to.have.same.members(['TENANT_ID4']);
      expect(values[13]).to.have.same.members([]);
    });
  });

  it('should support multiple instances with different IDs', () => {
    const authTenantsStorageManager1 = new AuthTenantsStorageManager(manager, 'appId1');
    const authTenantsStorageManager2 = new AuthTenantsStorageManager(manager, 'appId2');

    // Nothing should be stored yet.
    expect(mockWin.localStorage.length).to.equal(0);
    expect(mockWin.sessionStorage.length).to.equal(0);
    const promises: Array<Promise<any>> = [
      authTenantsStorageManager1.addTenant('TENANT_ID1'),
      authTenantsStorageManager1.addTenant('TENANT_ID2'),
      authTenantsStorageManager2.addTenant('TENANT_ID1'),
      authTenantsStorageManager2.addTenant('TENANT_ID3'),
      authTenantsStorageManager1.listTenants(),
      authTenantsStorageManager2.listTenants(),
      // This will only remove TENANT1 in authTenantsStorageManager1.
      authTenantsStorageManager1.removeTenant('TENANT_ID1'),
      // This will do nothing and will not affect authTenantsStorageManager2.
      authTenantsStorageManager1.removeTenant('TENANT_ID3'),
      authTenantsStorageManager1.listTenants(),
      authTenantsStorageManager2.listTenants(),
    ];
    return Promise.all(promises).then((values: any[]) => {
      // 2 entries should be stored in localStorage. Confirm expected strings stored.
      expect(mockWin.localStorage.length).to.equal(2);
      expect(mockWin.localStorage.key(0)).to.contain('auth-tenants').and.contains('appId1');
      expect(mockWin.localStorage.key(1)).to.contain('auth-tenants').and.contains('appId2');
      expect(mockWin.sessionStorage.length).to.equal(0);

      expect(values[4]).to.have.same.members(['TENANT_ID1', 'TENANT_ID2']);
      expect(values[5]).to.have.same.members(['TENANT_ID1', 'TENANT_ID3']);
      expect(values[8]).to.have.same.members(['TENANT_ID2']);
      expect(values[9]).to.have.same.members(['TENANT_ID1', 'TENANT_ID3']);
    });
  });
});
