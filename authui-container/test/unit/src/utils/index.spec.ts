/*!
 * Copyright 2020 Google Inc.
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

import * as _ from 'lodash';
import {expect} from 'chai';
import {
  deepCopy, deepExtend, deepEqual, addReadonlyGetter, removeUndefinedFields,
  onDomReady, setStyleSheet,
} from '../../../../src/utils/index';

interface Obj {
  [key: string]: any;
}

describe('setStyleSheet()', () => {
  it('should set expected stylesheet', () => {
    let appendedChild;
    const stylesheetUrl = 'https://www.example.com/css/stylesheet.css';
    const mockDocument = {
      createElement: (tagName) => {
        return document.createElement(tagName);
      },
      getElementsByTagName: (tagName) => {
        expect(tagName).to.be.equal('head');
        return [{
          appendChild: (element: Element) => {
            appendedChild = element;
          },
        }];
      },
    };

    setStyleSheet(mockDocument as any, stylesheetUrl);

    expect(appendedChild.nodeName.toLowerCase()).to.be.equal('link');
    expect((appendedChild as any).rel).to.be.equal('stylesheet');
    expect((appendedChild as any).type).to.be.equal('text/css');
    expect((appendedChild as any).href).to.be.equal(stylesheetUrl);
    expect((appendedChild as any).media).to.be.equal('all');
  });
});

describe('addReadonlyGetter()', () => {
  it('should add a new property to the provided object', () => {
    const obj: Obj = {};
    addReadonlyGetter(obj, 'foo', true);
    expect(obj.foo).to.be.true;
  });

  it('should make the new property read-only', () => {
    const obj: Obj = {};
    addReadonlyGetter(obj, 'foo', true);
    expect(() => {
      obj.foo = false;
    }).to.throw(/Cannot assign to read only property \'foo\' of/);
  });

  it('should make the new property enumerable', () => {
    const obj: Obj = {};
    addReadonlyGetter(obj, 'foo', true);
    expect(obj).to.have.keys(['foo']);
  });
});

describe('removeUndefinedFields()', () => {
  it('should remove undefined fields from provided object', () => {
    const obj = {a: undefined, b: 'b', c: undefined, d: null};
    const expectedOutput = {b: 'b', d: null};

    const actualOutput = removeUndefinedFields(obj);
    expect(actualOutput).to.deep.equal(expectedOutput);
    expect(actualOutput).to.equal(obj);
  });

  const nonNullObjects = [NaN, 0, 1, true, false, '', 'a', _.noop];
  nonNullObjects.forEach((nonNullObject) => {
    it('should pass through any non-object: ' + JSON.stringify(nonNullObject), () => {
      expect(removeUndefinedFields(nonNullObject)).to.deep.equal(nonNullObject);
    });
  });

  it('should not modify an object with non undefined fields', () => {
    const obj = {b: 'b', d: null};
    const expectedOutput = {b: 'b', d: null};

    const actualOutput = removeUndefinedFields(obj);
    expect(actualOutput).to.deep.equal(expectedOutput);
    expect(actualOutput).to.equal(obj);
  });
});

describe('onDomReady()', () => {
  it('should resolve when document.readyState is complete', () => {
    // Create fake ready document.
    const dummyDocument: any = document.createElement('div');
    dummyDocument.readyState = 'complete';

    // Test will timeout if promise does not eventually resolve;
    return expect(onDomReady(dummyDocument)).to.eventually.be.fulfilled;
  });

  it('should resolve when document.readyState is interactive', () => {
    // Create fake ready document.
    const dummyDocument: any = document.createElement('div');
    dummyDocument.readyState = 'interactive';

    // Test will timeout if promise does not eventually resolve;
    return expect(onDomReady(dummyDocument)).to.eventually.be.fulfilled;
  });

  it('should resolve on DOMContentLoaded event', () => {
    // Create fake loading document.
    const dummyDocument: any = document.createElement('div');
    dummyDocument.readyState = 'loading';
    const customEvent = new CustomEvent('DOMContentLoaded', {bubbles: false, cancelable: false});

    // Test will timeout if promise does not eventually resolve;
    const testResult = expect(onDomReady(dummyDocument)).to.eventually.be.fulfilled;

    // Dispatch custom DOMContentLoaded event.
    (dummyDocument as Element).dispatchEvent(customEvent);
    return testResult;
  });
});

describe('deepCopy()', () => {
  it('should successfully make a copy of a Date object', () => {
    const source = new Date();
    expect(deepCopy(source)).to.deep.equal(source);
  });

  it('should successfully make a copy of a plain object', () => {
    const source = {a: -0.1, b: 'str', c: false};
    expect(deepCopy(source)).to.deep.equal(source);
  });

  it('should successfully make a copy of an Array', () => {
    const source = ['a', -0.5, true];
    expect(deepCopy(source)).to.deep.equal(source);
  });

  const nonObjects = [null, NaN, 0, 1, true, false, '', 'a', _.noop];
  nonObjects.forEach((nonObject) => {
    it('should successfully make a copy of a scalar: ' + JSON.stringify(nonObject), () => {
      expect(deepCopy(nonObject)).to.deep.equal(nonObject);
    });
  });

  it('should successfully make a copy of nested objects', () => {
    const nullFunction = () => {
      // null function.
    };
    const source = {
      a: -0.1, b: 'str', c: false, d: ['a', -0.5, true], e: {},
      f: {a: -0.1, b: 'str', c: false, d: [{}, 'a', null, undefined]},
      g: nullFunction,
    };
    const sourceCopy = deepCopy(source);
    expect(sourceCopy).to.deep.equal(source);
    expect(sourceCopy.g).to.equal(source.g);
  });
});

describe('deepExtend()', () => {
  const nowTimestamp = new Date().getTime();
  it('should successfully copy a Date object', () => {
    const source = new Date(nowTimestamp);
    const target = {};

    expect(deepExtend(target, source)).to.deep.equal(new Date(nowTimestamp));
  });

  it('should successfully extend a nested object', () => {
    const nullFunction = () => {
      // null function.
    };
    const target = {y: 'overwriteme', z: '1'};
    const source = {
      a: -0.1, b: 'str', c: false, d: ['a', -0.5, true], e: {},
      f: {a: -0.1, b: 'str', c: false, d: [{}, 'a', null, undefined]},
      g: nullFunction, y: 'overwritten',
    };
    const expectedResult = {
      z: '1', a: -0.1, b: 'str', c: false, d: ['a', -0.5, true], e: {},
      f: {a: -0.1, b: 'str', c: false, d: [{}, 'a', null, undefined]},
      g: nullFunction, y: 'overwritten',
    };

    expect(deepExtend(target, source)).to.equal(target);
    expect(target).to.deep.equal(expectedResult);
  });

  it('should successfully extend a function', () => {
    const nullFunction = () => {
      // null function.
    };
    const target = () => {
      const prop = 'target';
      return prop;
    };
    const source = {
      a: -0.1, b: 'str', c: false, d: ['a', -0.5, true], e: {},
      f: {a: -0.1, b: 'str', c: false, d: [{}, 'a', null, undefined]},
      g: nullFunction,
    };

    expect(deepExtend(target, source)).to.equal(target);
    for (const prop in target) {
      if (target.hasOwnProperty(prop)) {
        expect(target[prop]).to.deep.equal(source[prop]);
      }
    }
  });
});

describe('deepEqual()', () => {
  it('should handle primitive type comparison', () => {
    expect(deepEqual('a', 'a')).to.be.true;
    expect(deepEqual(0, 0)).to.be.true;
    expect(deepEqual(-1.03, -1.03)).to.be.true;
    expect(deepEqual(true, true)).to.be.true;
    expect(deepEqual(null, null)).to.be.true;
    expect(deepEqual(undefined, undefined)).to.be.true;

    expect(deepEqual('a', 'b')).to.be.false;
    expect(deepEqual(-1.03, -1.029)).to.be.false;
    expect(deepEqual(true, false)).to.be.false;
    expect(deepEqual(null, undefined)).to.be.false;
    expect(deepEqual(undefined, 0)).to.be.false;
  });

  it('should handle function type comparison', () => {
    const func1 = () => { /* Empty block */ };
    const func2 = () => { /* Empty block */ };

    expect(deepEqual(func1, func1)).to.be.true;
    expect(deepEqual(func2, func2)).to.be.true;
    expect(deepEqual(func1, func2)).to.be.false;
  });

  it('should handle array type comparison', () => {
    const arr1 = ['a', undefined, 0, -1.03, true, false, null];
    const arr2 = ['a', undefined, 0, -1.03, true, false, null];
    const arr3 = ['a', null, 0, -1.03, true, false, undefined];
    const arr4 = ['a', undefined, 0, -1.03, true, false, null, 'extra'];

    expect(deepEqual(arr1, arr2)).to.be.true;
    expect(deepEqual(arr1, arr3)).to.be.false;
    expect(deepEqual(arr1, arr4)).to.be.false;
  });

  it('should handle object type comparison', () => {
    const obj1 = {a: 1, b: 0.04, c: 'str', d: undefined, e: null, f: [], g: ['a', 2], h: false};
    const obj2 = {a: 1, b: 0.04, c: 'str', d: undefined, e: null, f: [], g: ['a', 2], h: false};
    const obj3 = {a: 1, b: 0.04, c: 'str', d: undefined, e: null, f: [], g: ['a', 2, 3], h: false};

    expect(deepEqual({}, {})).to.be.true;
    expect(deepEqual({}, null)).to.be.false;
    expect(deepEqual({}, undefined)).to.be.false;
    expect(deepEqual(obj1, obj2)).to.be.true;
    expect(deepEqual(obj1, obj3)).to.be.false;
  });

  it('should handle nested object comparison', () => {
    const obj1 = {
      a: {
        b: [
          {
            c: {
              d: false,
              e: -0.02,
              f: true,
              g: ['str'],
              h: {
                i: 0,
              },
            },
          },
        ],
      },
    };
    const obj2 = {
      a: {
        b: [
          {
            c: {
              d: false,
              e: -0.02,
              f: true,
              g: ['str'],
              h: {
                i: 0,
              },
            },
          },
        ],
      },
    };
    const obj3 = {
      a: {
        b: [
          {
            c: {
              d: false,
              e: -0.02,
              f: true,
              g: ['str'],
              h: {
                // Deep mismatch.
                i: 1,
              },
            },
          },
        ],
      },
    };

    expect(deepEqual(obj1, obj2)).to.be.true;
    expect(deepEqual(obj1, obj3)).to.be.false;
  });
});
