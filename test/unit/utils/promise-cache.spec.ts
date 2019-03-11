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
import * as sinon from 'sinon';
import { PromiseCache } from '../../../src/utils/promise-cache';

describe('PromiseCache', () => {
  const now = new Date().getTime();
  let clock: sinon.SinonFakeTimers;
  let cb1: sinon.SinonStub;
  let cb2: sinon.SinonStub;
  let promiseCache: PromiseCache;

  beforeEach(() => {
    clock = sinon.useFakeTimers(now);
    promiseCache = new PromiseCache();
    cb1 = sinon.stub();
    cb2 = sinon.stub();
  });

  describe('cacheAndReturnResult()', () => {
    it('returns the cached result of the previous call if arguments do not change' , () => {
      const thisArg = {};
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called again.
          expect(cb1).to.be.calledOnce;
        });
    });

    it('clears cached result if arguments change and caches the new result' , () => {
      const thisArg = {};
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['3', '1'], 500);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('3-1');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['3', '1']);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['3', '1'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('3-1');
          // Callback should not be called again.
          expect(cb1).to.be.calledTwice;
        });
    });

    it('clears cached result if arguments length change and caches the new result' , () => {
      const thisArg = {};
      cb1.callsFake((par1: string, par2: string, par3?: string) => {
        return Promise.resolve(par1 + '-' + par2 + (par3 ? '-' + par3 : ''));
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2', '3'], 500);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('1-2-3');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['1', '2', '3']);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2', '3'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2-3');
          // Callback should not be called again.
          expect(cb1).to.be.calledTwice;
        });
    });

    it('clears cached result if thisArg changes and caches new result' , () => {
      const thisArg = {};
      const otherThisArg = {};
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, otherThisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(otherThisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['1', '2']);
          return promiseCache.cacheAndReturnResult(cb1, otherThisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called again.
          expect(cb1).to.be.calledTwice;
        });
    });

    it('does not cache errors' , () => {
      const expectedError = new Error('some error');
      const thisArg = {};
      cb1.onFirstCall().rejects(expectedError);
      cb1.onSecondCall().callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500)
        .then(() => {
          throw new Error('Unexpected success');
        })
        .catch((error) => {
          expect(error).to.equal(expectedError);
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['1', '2']);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called again.
          expect(cb1).to.be.calledTwice;
        });
    });

    it('clears expired results' , () => {
      const thisArg = {};
      const timeout = 500;
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          // Simulate cache not yet expired.
          clock.tick(timeout - 1);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called.
          expect(cb1).to.be.calledOnce;
          // Trigger timeout.
          clock.tick(1);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['1', '2']);
        });
    });

    it('clears cached results if underlying argument objects change' , () => {
      const thisArg = {};
      const timeout = 500;
      const par1 = {key: {val: '1'}};
      const par2 = {key: {val: '2'}};
      cb1.callsFake((p1: any, p2: any) => {
        return Promise.resolve(p1.key.val + '-' + p2.key.val);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, [par1, par2], timeout)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith(par1, par2);
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, [par1, par2], timeout);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called.
          expect(cb1).to.be.calledOnce;
          // Modify same parameter underlying value. This should clear the cache.
          par2.key.val = '3';
          return promiseCache.cacheAndReturnResult(cb1, thisArg, [par1, par2], timeout);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('1-3');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal([par1, par2]);
        });
    });

    it('caches multiple callbacks', () => {
      const timeout1 = 500;
      const timeout2 = 400;
      const thisArg = {};
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2 + ':' + new Date().getTime().toString());
      });
      cb2.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par2 + '-' + par1 + ':' + new Date().getTime().toString());
      });

      return Promise.all([
          promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
          promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
        ])
        .then((results: any[]) => {
          expect(results[0]).to.equal('1-2:' + now.toString());
          expect(results[1]).to.equal('2-1:' + now.toString());
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          expect(cb2).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb2.getCall(0).thisValue).to.equal(thisArg);
          return Promise.all([
            promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
            promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
          ]);
        })
        .then((results: any[]) => {
          // Cached results should be returned.
          expect(results[0]).to.equal('1-2:' + now.toString());
          expect(results[1]).to.equal('2-1:' + now.toString());
          // Callback should not be called again.
          expect(cb1).to.be.calledOnce;
          expect(cb2).to.be.calledOnce;
          clock.tick(timeout2);
          return Promise.all([
            promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
            promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
          ]);
        })
        .then((results: any[]) => {
          // Cached result for first call returned only.
          expect(results[0]).to.equal('1-2:' + now.toString());
          expect(results[1]).to.equal('2-1:' + (now + timeout2).toString());
          expect(cb1).to.be.calledOnce;
          expect(cb2).to.be.calledTwice;
          clock.tick(timeout1 - timeout2);
          return Promise.all([
            promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
            promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
          ]);
        })
        .then((results: any[]) => {
          // Cached result for second call returned only.
          expect(results[0]).to.equal('1-2:' + (now + timeout1).toString());
          expect(results[1]).to.equal('2-1:' + (now + timeout2).toString());
          expect(cb1).to.be.calledTwice;
          expect(cb2).to.be.calledTwice;
        });
    });
  });

  describe('clear()', () => {
    it('clears specified callback when passed', () => {
      const thisArg = {};
      const timeout = 500;
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2);
      });

      return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout)
        .then((result: string) => {
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should be returned.
          expect(result).to.equal('1-2');
          // Callback should not be called.
          expect(cb1).to.be.calledOnce;
          // Clear cache.
          promiseCache.clear(cb1);
          return promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], 500);
        })
        .then((result: string) => {
          // Cached result should not be returned.
          expect(result).to.equal('1-2');
          expect(cb1).to.be.calledTwice;
          expect(cb1.getCall(1).thisValue).to.equal(thisArg);
          expect(cb1.getCall(1).args).to.deep.equal(['1', '2']);
        });
    });

    it('does not throw when passed callback is not found', () => {
      expect(() => {
        promiseCache.clear(cb1);
        promiseCache.clear(cb2);
      }).not.to.throw();
    });

    it('clears entire cache when no callback passed', () => {
      const timeout1 = 500;
      const timeout2 = 400;
      const thisArg = {};
      cb1.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par1 + '-' + par2 + ':' + new Date().getTime().toString());
      });
      cb2.callsFake((par1: string, par2: string) => {
        return Promise.resolve(par2 + '-' + par1 + ':' + new Date().getTime().toString());
      });

      return Promise.all([
          promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
          promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
        ])
        .then((results: any[]) => {
          expect(results[0]).to.equal('1-2:' + now.toString());
          expect(results[1]).to.equal('2-1:' + now.toString());
          expect(cb1).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb1.getCall(0).thisValue).to.equal(thisArg);
          expect(cb2).to.be.calledOnce.and.calledWith('1', '2');
          expect(cb2.getCall(0).thisValue).to.equal(thisArg);
          return Promise.all([
            promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
            promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
          ]);
        })
        .then((results: any[]) => {
          // Cached results should be returned.
          expect(results[0]).to.equal('1-2:' + now.toString());
          expect(results[1]).to.equal('2-1:' + now.toString());
          // Callback should not be called again.
          expect(cb1).to.be.calledOnce;
          expect(cb2).to.be.calledOnce;
          promiseCache.clear();
          clock.tick(100);
          return Promise.all([
            promiseCache.cacheAndReturnResult(cb1, thisArg, ['1', '2'], timeout1),
            promiseCache.cacheAndReturnResult(cb2, thisArg, ['1', '2'], timeout2),
          ]);
        })
        .then((results: any[]) => {
          // New results returned for both calls.
          expect(results[0]).to.equal('1-2:' + (now + 100).toString());
          expect(results[1]).to.equal('2-1:' + (now + 100).toString());
          expect(cb1).to.be.calledTwice;
          expect(cb2).to.be.calledTwice;
        });
    });
  });
});
