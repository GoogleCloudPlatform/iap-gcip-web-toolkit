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

import * as chai from 'chai';
import * as _ from 'lodash';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';

import {
  isArray, isNonEmptyArray, isBoolean, isNumber, isString, isNonEmptyString,
  isNonNullObject, isObject,
} from '../../../src/utils/validator';


chai.should();
chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('isArray()', () => {
  it('should return false given no argument', () => {
    expect(isArray(undefined as any)).to.be.false;
  });

  const nonArrays = [null, NaN, 0, 1, '', 'a', true, false, {}, { a: 1 }, _.noop];
  nonArrays.forEach((nonArray) => {
    it('should return false given a non-array argument: ' + JSON.stringify(nonArray), () => {
      expect(isArray(nonArray as any)).to.be.false;
    });
  });

  it('should return true given an empty array', () => {
    expect(isArray([])).to.be.true;
  });

  it('should return true given a non-empty array', () => {
    expect(isArray([1, 2, 3])).to.be.true;
  });

  it('should return true given an empty array created from Array constructor', () => {
    expect(isArray(new Array())).to.be.true;
  });

  it('should return true given a non-empty array created from Array constructor', () => {
    expect(isArray(new Array(1, 2, 3))).to.be.true;
  });
});

describe('isNonEmptyArray()', () => {
  it('should return false given no argument', () => {
    expect(isNonEmptyArray(undefined as any)).to.be.false;
  });

  const nonNonEmptyArrays = [null, NaN, 0, 1, '', 'a', true, false, {}, { a: 1 }, _.noop];
  nonNonEmptyArrays.forEach((nonNonEmptyArray) => {
    it('should return false given a non-array argument: ' + JSON.stringify(nonNonEmptyArray), () => {
      expect(isNonEmptyArray(nonNonEmptyArray as any)).to.be.false;
    });
  });

  it('should return false given an empty array', () => {
    expect(isNonEmptyArray([])).to.be.false;
  });

  it('should return true given a non-empty array', () => {
    expect(isNonEmptyArray([1, 2, 3])).to.be.true;
  });

  it('should return false given an empty array created from Array constructor', () => {
    expect(isNonEmptyArray(new Array())).to.be.false;
  });

  it('should return true given a non-empty array created from Array constructor', () => {
    expect(isNonEmptyArray(new Array(1, 2, 3))).to.be.true;
  });
});

describe('isBoolean()', () => {
  it('should return false given no argument', () => {
    expect(isBoolean(undefined as any)).to.be.false;
  });

  const nonBooleans = [null, NaN, 0, 1, '', 'a', [], ['a'], {}, { a: 1 }, _.noop];
  nonBooleans.forEach((nonBoolean) => {
    it('should return false given a non-boolean argument: ' + JSON.stringify(nonBoolean), () => {
      expect(isBoolean(nonBoolean as any)).to.be.false;
    });
  });

  it('should return true given true', () => {
    expect(isBoolean(true)).to.be.true;
  });

  it('should return true given false', () => {
    expect(isBoolean(false)).to.be.true;
  });
});

describe('isNumber()', () => {
  it('should return false given no argument', () => {
    expect(isNumber(undefined as any)).to.be.false;
  });

  const nonNumbers = [null, true, false, '', 'a', [], ['a'], {}, { a: 1 }, _.noop];
  nonNumbers.forEach((nonNumber) => {
    it('should return false given a non-number argument: ' + JSON.stringify(nonNumber), () => {
      expect(isNumber(nonNumber as any)).to.be.false;
    });
  });

  it('should return false given NaN', () => {
    expect(isNumber(NaN)).to.be.false;
  });

  it('should return true given 0', () => {
    expect(isNumber(0)).to.be.true;
  });

  it('should return true given a negative number', () => {
    expect(isNumber(-1)).to.be.true;
  });

  it('should return true given a positive number', () => {
    expect(isNumber(1)).to.be.true;
  });

  it('should return true given Number.MAX_SAFE_INTEGER', () => {
    expect(isNumber((Number as any).MAX_SAFE_INTEGER)).to.be.true;
  });

  it('should return true given Number.MIN_SAFE_INTEGER', () => {
    expect(isNumber((Number as any).MIN_SAFE_INTEGER)).to.be.true;
  });

  it('should return true given Infinity', () => {
    expect(isNumber(Infinity)).to.be.true;
  });

  it('should return true given -Infinity', () => {
    expect(isNumber(-Infinity)).to.be.true;
  });
});

describe('isString()', () => {
  it('should return false given no argument', () => {
    expect(isString(undefined as any)).to.be.false;
  });

  const nonStrings = [null, NaN, 0, 1, true, false, [], ['a'], {}, { a: 1 }, _.noop];
  nonStrings.forEach((nonString) => {
    it('should return false given a non-string argument: ' + JSON.stringify(nonString), () => {
      expect(isString(nonString as any)).to.be.false;
    });
  });

  it('should return true given an empty string', () => {
    expect(isString('')).to.be.true;
  });

  it('should return true given a string with only whitespace', () => {
    expect(isString(' ')).to.be.true;
  });

  it('should return true given a non-empty string', () => {
    expect(isString('foo')).to.be.true;
  });
});

describe('isNonEmptyString()', () => {
  it('should return false given no argument', () => {
    expect(isNonEmptyString(undefined as any)).to.be.false;
  });

  const nonStrings = [null, NaN, 0, 1, true, false, [], ['a'], {}, { a: 1 }, _.noop];
  nonStrings.forEach((nonString) => {
    it('should return false given a non-string argument: ' + JSON.stringify(nonString), () => {
      expect(isNonEmptyString(nonString as any)).to.be.false;
    });
  });

  it('should return false given an empty string', () => {
    expect(isNonEmptyString('')).to.be.false;
  });

  it('should return true given a string with only whitespace', () => {
    expect(isNonEmptyString(' ')).to.be.true;
  });

  it('should return true given a non-empty string', () => {
    expect(isNonEmptyString('foo')).to.be.true;
  });
});

describe('isObject()', () => {
  it('should return false given no argument', () => {
    expect(isObject(undefined as any)).to.be.false;
  });

  const nonObjects = [NaN, 0, 1, true, false, '', 'a', _.noop];
  nonObjects.forEach((nonObject) => {
    it('should return false given a non-object argument: ' + JSON.stringify(nonObject), () => {
      expect(isObject(nonObject as any)).to.be.false;
    });
  });

  it('should return false given an empty array', () => {
    expect(isObject([])).to.be.false;
  });

  it('should return false given a non-empty array', () => {
    expect(isObject(['a'])).to.be.false;
  });

  it('should return true given null', () => {
    expect(isObject(null)).to.be.true;
  });

  it('should return true given an empty object', () => {
    expect(isObject({})).to.be.true;
  });

  it('should return true given a non-empty object', () => {
    expect(isObject({ a: 1 })).to.be.true;
  });
});

describe('isNonNullObject()', () => {
  it('should return false given no argument', () => {
    expect(isNonNullObject(undefined as any)).to.be.false;
  });

  const nonNonNullObjects = [NaN, 0, 1, true, false, '', 'a', _.noop];
  nonNonNullObjects.forEach((nonNonNullObject) => {
    it('should return false given a non-object argument: ' + JSON.stringify(nonNonNullObject), () => {
      expect(isNonNullObject(nonNonNullObject as any)).to.be.false;
    });
  });

  it('should return false given null', () => {
    expect(isNonNullObject(null)).to.be.false;
  });

  it('should return false given an empty array', () => {
    expect(isNonNullObject([])).to.be.false;
  });

  it('should return false given a non-empty array', () => {
    expect(isNonNullObject(['a'])).to.be.false;
  });

  it('should return true given an empty object', () => {
    expect(isNonNullObject({})).to.be.true;
  });

  it('should return true given a non-empty object', () => {
    expect(isNonNullObject({ a: 1 })).to.be.true;
  });
});
