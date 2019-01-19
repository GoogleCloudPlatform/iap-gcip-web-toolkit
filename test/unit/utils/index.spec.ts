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
import {
  addReadonlyGetter, removeUndefinedFields,
} from '../../../src/utils/index';

interface Obj {
  [key: string]: any;
}

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
