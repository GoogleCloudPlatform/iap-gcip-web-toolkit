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

import * as _ from 'lodash';
import {expect} from 'chai';
import {deepCopy, deepExtend} from '../../../src/utils/deep-copy';

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
      this.prop = 'target';
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
