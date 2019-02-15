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
import {
  LocalStorage, SessionStorage, InMemoryStorage, Factory, StorageType,
} from '../../../src/storage/storage';
import { MockStorage } from '../../resources/utils';

describe('LocalStorage', () => {
  const mockWin = {
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage(),
  };
  const storage = new LocalStorage(mockWin as any);

  describe('constructor', () => {
    it('should not throw on initialization with available and accessible localStorage', () => {
      expect(() => {
        return new LocalStorage({
          localStorage: new MockStorage(),
          sessionStorage: new MockStorage(),
        } as any);
      }).not.to.throw();
    });

    it('should throw on initialization with unavailable localStorage', () => {
      expect(() => {
        return new LocalStorage({
          localStorage: new MockStorage(false),
          sessionStorage: new MockStorage(),
        } as any);
      }).to.throw();
    });

    it('should throw on initialization with no-op localStorage', () => {
      expect(() => {
        return new LocalStorage({
          localStorage: new MockStorage(true, true),
          sessionStorage: new MockStorage(),
        } as any);
      }).to.throw();
    });
  });

  it('should support all basic storage operations', () => {
    return Promise.resolve()
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return storage.set('foo', 'bar');
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal(['foo']);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.equal('bar');
        return storage.remove('foo');
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return Promise.all([
          storage.set('foo1', 'bar1'),
          storage.set('foo2', 'bar2'),
        ]);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal(['foo1', 'foo2']);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.equal('bar1');
        expect(values[1]).to.equal('bar2');
        return storage.clear();
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.be.undefined;
        expect(values[1]).to.be.undefined;
        // Store invalid field.
        mockWin.localStorage.setItem('foo', 'invalid');
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(mockWin.localStorage.keys).to.deep.equal(['foo']);
        // Since field is invalid, it will return undefined.
        expect(value).to.be.undefined;
      });
  });

  it('should preserve types during storage operations', () => {
    const obj = {a: 1.2, b: 'foo'};
    const num = 54;
    const bool = true;
    return Promise.resolve()
      .then(() => {
        return Promise.all([
          storage.set('obj', obj),
          storage.set('num', num),
          storage.set('bool', bool),
          storage.set('null', null),
        ]);
      })
      .then(() => {
        return Promise.all([
          storage.get('obj'),
          storage.get('num'),
          storage.get('bool'),
          storage.get('null'),
          storage.get('undefined'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal(obj);
        expect(values[1]).to.equal(num);
        expect(values[2]).to.equal(bool);
        expect(values[3]).to.be.null;
        expect(values[4]).to.be.undefined;
      });
  });
});

describe('SessionStorage', () => {
  const mockWin = {
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage(),
  };
  const storage = new SessionStorage(mockWin as any);

  describe('constructor', () => {
    it('should not throw on initialization with available and accessible sessionStorage', () => {
      expect(() => {
        return new SessionStorage({
          localStorage: new MockStorage(),
          sessionStorage: new MockStorage(),
        } as any);
      }).not.to.throw();
    });

    it('should throw on initialization with unavailable sessionStorage', () => {
      expect(() => {
        return new SessionStorage({
          localStorage: new MockStorage(),
          sessionStorage: new MockStorage(false),
        } as any);
      }).to.throw();
    });

    it('should throw on initialization with no-op sessionStorage', () => {
      expect(() => {
        return new SessionStorage({
          localStorage: new MockStorage(),
          sessionStorage: new MockStorage(true, true),
        } as any);
      }).to.throw();
    });
  });

  it('should support all basic storage operations', () => {
    return Promise.resolve()
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return storage.set('foo', 'bar');
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal(['foo']);
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.equal('bar');
        return storage.remove('foo');
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return Promise.all([
          storage.set('foo1', 'bar1'),
          storage.set('foo2', 'bar2'),
        ]);
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal(['foo1', 'foo2']);
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.equal('bar1');
        expect(values[1]).to.equal('bar2');
        return storage.clear();
      })
      .then(() => {
        expect(mockWin.localStorage.keys).to.deep.equal([]);
        expect(mockWin.sessionStorage.keys).to.deep.equal([]);
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.be.undefined;
        expect(values[1]).to.be.undefined;
        // Store invalid field.
        mockWin.sessionStorage.setItem('foo', 'invalid');
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(mockWin.sessionStorage.keys).to.deep.equal(['foo']);
        // Since field is invalid, it will return undefined.
        expect(value).to.be.undefined;
      });
  });

  it('should preserve types during storage operations', () => {
    const obj = {a: 1.2, b: 'foo'};
    const num = 54;
    const bool = true;
    return Promise.resolve()
      .then(() => {
        return Promise.all([
          storage.set('obj', obj),
          storage.set('num', num),
          storage.set('bool', bool),
          storage.set('null', null),
        ]);
      })
      .then(() => {
        return Promise.all([
          storage.get('obj'),
          storage.get('num'),
          storage.get('bool'),
          storage.get('null'),
          storage.get('undefined'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal(obj);
        expect(values[1]).to.equal(num);
        expect(values[2]).to.equal(bool);
        expect(values[3]).to.be.null;
        expect(values[4]).to.be.undefined;
      });
  });
});

describe('InMemoryStorage', () => {
  const storage = new InMemoryStorage();

  describe('constructor', () => {
    it('should not throw on initialization', () => {
      expect(() => {
        return new InMemoryStorage();
      }).not.to.throw();
    });
  });

  it('should support all basic storage operations', () => {
    return Promise.resolve()
      .then(() => {
        storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return storage.set('foo', 'bar');
      })
      .then(() => {
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.equal('bar');
        return storage.remove('foo');
      })
      .then(() => {
        return storage.get('foo');
      })
      .then((value: any) => {
        expect(value).to.be.undefined;
        return Promise.all([
          storage.set('foo1', 'bar1'),
          storage.set('foo2', 'bar2'),
        ]);
      })
      .then(() => {
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.equal('bar1');
        expect(values[1]).to.equal('bar2');
        return storage.clear();
      })
      .then(() => {
        return Promise.all([
          storage.get('foo1'),
          storage.get('foo2'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.be.undefined;
        expect(values[1]).to.be.undefined;
      });
  });

  it('should preserve types during storage operations', () => {
    const obj = {a: 1.2, b: 'foo'};
    const num = 54;
    const bool = true;
    return Promise.resolve()
      .then(() => {
        return Promise.all([
          storage.set('obj', obj),
          storage.set('num', num),
          storage.set('bool', bool),
          storage.set('null', null),
        ]);
      })
      .then(() => {
        return Promise.all([
          storage.get('obj'),
          storage.get('num'),
          storage.get('bool'),
          storage.get('null'),
          storage.get('undefined'),
        ]);
      })
      .then((values: any[]) => {
        expect(values[0]).to.deep.equal(obj);
        expect(values[1]).to.equal(num);
        expect(values[2]).to.equal(bool);
        expect(values[3]).to.be.null;
        expect(values[4]).to.be.undefined;
      });
  });
});

describe('Factory', () => {
  const mockWin = {
    localStorage: new MockStorage(),
    sessionStorage: new MockStorage(),
  };

  const factory = new Factory(mockWin as any);

  describe('makeStorage()', () => {
    it('should return a LocalStorage instance for a Local StorageType', () => {
      expect(factory.makeStorage(StorageType.Local))
        .to.deep.equal(new LocalStorage(mockWin as any));
    });

    it('should return a SessionStorage instance for a Session StorageType', () => {
      expect(factory.makeStorage(StorageType.Session))
        .to.deep.equal(new SessionStorage(mockWin as any));
    });

    it('should return a InMemoryStorage instance when for all other StorageTypes', () => {
      expect(factory.makeStorage(StorageType.None))
        .to.deep.equal(new InMemoryStorage());
    });
  });
});
