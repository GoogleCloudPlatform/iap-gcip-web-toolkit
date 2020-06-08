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
  addReadonlyGetter, removeUndefinedFields, formatString,
  mapObject, sanitizeUrl, isSafeUrl, isLastCharLetterOrNumber,
} from '../../../common/index';


interface Obj {
  [key: string]: any;
}

const safeUrls = [
  'https://example.com/path/page?a=1&b=2#c=3',
  'http://example.com/path/page?a=1&b=2#c=3',
  'mailto:example@foo.com?subject=HelloWorld',
  'ftp://user:password@host:port/path',
];

const unsafeUrls = [
  'javascript:doEvil()',
  'chrome-extension://1234567890abcdef/foo/bar',
  'file://path/filename.txt',
  'moz-extension://1234-5678-90ab-cdef/foo/bar',
  'ms-browser-extension://1234-5678-90ab-cdef/foo/bar',
  'data:image/png;base64,iVBORw0KGgoA%0AAAANSUhEUgA%0DAAT4AAA%0A',
  'disallowed:foo',
  'about:blank',
];

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

describe('formatString()', () => {
  it('should keep string as is if not parameters are provided', () =>  {
    const str = 'projects/{projectId}/{api}/path/api/projectId';
    expect(formatString(str)).to.equal(str);
  });

  it('should substitute parameters in string', () => {
    const str = 'projects/{projectId}/{api}/path/api/projectId';
    const expectedOutput = 'projects/PROJECT_ID/API/path/api/projectId';
    const params = {
      projectId: 'PROJECT_ID',
      api: 'API',
      notFound: 'NOT_FOUND',
    };
    expect(formatString(str, params)).to.equal(expectedOutput);
  });

  it('should keep string as is if braces are not matching', () =>  {
    const str = 'projects/projectId}/{api/path/api/projectId';
    const params = {
      projectId: 'PROJECT_ID',
      api: 'API',
    };
    expect(formatString(str, params)).to.equal(str);
  });

  it('should handle multiple successive braces', () =>  {
    const str = 'projects/{{projectId}}/path/{{api}}/projectId';
    const expectedOutput = 'projects/{PROJECT_ID}/path/{API}/projectId';
    const params = {
      projectId: 'PROJECT_ID',
      api: 'API',
    };
    expect(formatString(str, params)).to.equal(expectedOutput);
  });

  it('should substitute multiple occurrences of the same parameter', () => {
    const str = 'projects/{projectId}/{api}/path/api/{projectId}';
    const expectedOutput = 'projects/PROJECT_ID/API/path/api/PROJECT_ID';
    const params = {
      projectId: 'PROJECT_ID',
      api: 'API',
    };
    expect(formatString(str, params)).to.equal(expectedOutput);
  });

  it('should keep string as is if parameters are not found', () => {
    const str = 'projects/{projectId}/{api}/path/api/projectId';
    const params = {
      notFound: 'value',
    };
    expect(formatString(str, params)).to.equal(str);
  });
});

describe('mapObject()', () => {
  const input1 = {
    a: 1,
    b: 2,
    c: 3,
  };
  const output1 = {
    a: 2,
    b: 4,
    c: 6,
  };
  const cb1 = (key: string, value: any) => {
    return value * 2;
  };
  const input2 = {
    a: {key: 'a', value: 1, other: 'other1'},
    b: {key: 'b', value: 2, other: 'other2'},
    c: {key: 'c', value: 3, other: 'other3'},
  };
  const output2 = {
    a: {newKey: 'keyA', newValue: 1, key: 'a'},
    b: {newKey: 'keyB', newValue: 4, key: 'b'},
    c: {newKey: 'keyC', newValue: 9, key: 'c'},
  };
  const cb2 = (key: string, value: any) => {
    return {
      newKey: `key${value.key.toUpperCase()}`,
      newValue: Math.pow(value.value, 2),
      key,
    };
  };

  it('should return expected empty object when given empty object', () => {
    expect(mapObject({}, cb1)).to.deep.equal({});
  });

  it('should return expected object for input object with simple values', () => {
    expect(mapObject(input1, cb1)).to.deep.equal(output1);
  });

  it('should return expected object for input object with object values', () => {
    expect(mapObject(input2, cb2)).to.deep.equal(output2);
  });
});

describe('santizeUrl()', () => {
  it('should echo safe URLs', () => {
    safeUrls.forEach((url) => {
      expect(sanitizeUrl(url)).to.equal(url);
    });
  });

  it('should sanitize unsafe URLs', () => {
    unsafeUrls.forEach((url) => {
      expect(sanitizeUrl(url)).to.equal('about:invalid');
    });
  });
});

describe('isSafeUrl()', () => {
  it('should return true for safe URLs', () => {
    safeUrls.forEach((url) => {
      expect(isSafeUrl(url)).to.be.true;
    });
  });

  it('should return false for unsafe URLs', () => {
    unsafeUrls.forEach((url) => {
      expect(isSafeUrl(url)).to.be.false;
    });
  });
});

describe('isLastCharLetterOrNumber()', () => {
  const alphabet = 'abcdefghijklmnopqrstuvwqyz';
  const singleLetterOrNumberChar =
    (alphabet + alphabet.toUpperCase() + '1234567890').split('');
  const allStringsWithTrailingLetter = [
    '-1a', '+1b', '?1c', '!1d', '#1e', '$1f', '%1g', '^1h', '&1i', '*1j', '(1k', ')1l',
    '-1m', '+1n', '?1o', '!1p', '#1q', '$1r', '%1s', '^1t', '&1u', '*1v', '(1w', ')1x',
    '-1y', '+1z',
  ];
  const allStringsWithTrailingNumber = [
    '-1a', '+1b', '?1', '!2', '#3', '$4', '%5', '^6', '&7', '*8', '(9', ')0',
  ];
  const allStringsWithTrailingNonNumberOrLetter = [
    'a.', 'ggr-', 'h5nt+', '{', ':', '&', '.',
  ];

  it('should return true when single char string is a letter or number', () => {
    singleLetterOrNumberChar.forEach((char) => {
      expect(isLastCharLetterOrNumber(char)).to.be.true;
    });
  });

  it('should return true when last char is upper case letter', () => {
    allStringsWithTrailingLetter.forEach((str) => {
      expect(isLastCharLetterOrNumber(str.toUpperCase())).to.be.true;
    });
  });

  it('should return true when last char is lower case letter', () => {
    allStringsWithTrailingLetter.forEach((str) => {
      expect(isLastCharLetterOrNumber(str.toLowerCase())).to.be.true;
    });
  });

  it('should return true when last char is a number', () => {
    allStringsWithTrailingNumber.forEach((str) => {
      expect(isLastCharLetterOrNumber(str)).to.be.true;
    });
  });

  it('should return false when given empty string', () => {
    expect(isLastCharLetterOrNumber('')).to.be.false;
  });

  it('should return false when last char is not a number of letter', () => {
    allStringsWithTrailingNonNumberOrLetter.forEach((str) => {
      expect(isLastCharLetterOrNumber(str)).to.be.false;
    });
  });
});
