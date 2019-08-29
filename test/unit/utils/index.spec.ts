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
import * as sinon from 'sinon';
import {expect} from 'chai';
import {
  addReadonlyGetter, removeUndefinedFields, formatString,
  formSubmitWithRedirect, getCurrentUrl, setCurrentUrl, runIfDefined,
  generateRandomAlphaNumericString, mapObject, onDomReady, sanitizeUrl,
  isSafeUrl, isHistorySupported, isHistoryAndCustomEventSupported,
  pushHistoryState, isCustomEventSupported, getHistoryState,
} from '../../../src/utils/index';

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

describe('formSubmitWithRedirect()', () => {
  const stubs: sinon.SinonStub[] = [];

  afterEach(() => {
    stubs.forEach((s) => s.restore());
  });

  it('should POST submit the provided data to the requested URL', () => {
    // Catch FORM element submits.
    const stub = sinon.stub(HTMLFormElement.prototype, 'submit');
    stubs.push(stub);
    const data = {a: 'value', b: 2, c: false, d: -3.56};
    const url = 'https://example.com/handler';

    formSubmitWithRedirect(document, url, 'POST', data);

    expect(stub).to.have.been.calledOnce;
    const form = document.body.lastElementChild;
    // Confirm expected form submitted.
    expect(stub.getCall(0).thisValue).to.equal(form);
    expect(form.tagName).to.equal('FORM');
    expect(form.getAttribute('method')).to.equal('POST');
    expect(form.getAttribute('action')).to.equal(url);
    expect(form.children.length).to.equal(Object.keys(data).length);
    Object.keys(data).forEach((key: string, index: number) => {
      expect(form.children[index].tagName).to.equal('INPUT');
      expect(form.children[index].getAttribute('type')).to.equal('hidden');
      expect(form.children[index].getAttribute('name')).to.equal(key);
      expect(form.children[index].getAttribute('value')).to.equal(data[key].toString());
    });
  });

  it('should GET submit the provided data to the requested URL', () => {
    // Catch FORM element submits.
    const stub = sinon.stub(HTMLFormElement.prototype, 'submit');
    stubs.push(stub);
    const data = {a: 'value', b: 2, c: false, d: -3.56};
    const url = 'https://example.com/handler';

    formSubmitWithRedirect(document, url, 'GET', data);

    expect(stub).to.have.been.calledOnce;
    const form = document.body.lastElementChild;
    // Confirm expected form submitted.
    expect(stub.getCall(0).thisValue).to.equal(form);
    expect(form.tagName).to.equal('FORM');
    expect(form.getAttribute('method')).to.equal('GET');
    expect(form.getAttribute('action')).to.equal(url);
    expect(form.children.length).to.equal(Object.keys(data).length);
    Object.keys(data).forEach((key: string, index: number) => {
      expect(form.children[index].tagName).to.equal('INPUT');
      expect(form.children[index].getAttribute('type')).to.equal('hidden');
      expect(form.children[index].getAttribute('name')).to.equal(key);
      expect(form.children[index].getAttribute('value')).to.equal(data[key].toString());
    });
  });

  it('should ignore undefined and null values', () => {
    // Catch FORM element submits.
    const stub = sinon.stub(HTMLFormElement.prototype, 'submit');
    stubs.push(stub);
    const data = {a: 'value', b: null, c: undefined};
    const expectedData = {a: 'value'};
    const url = 'https://example.com/handler';

    formSubmitWithRedirect(document, url, 'POST', data);

    expect(stub).to.have.been.calledOnce;
    const form = document.body.lastElementChild;
    // Confirm expected form submitted.
    expect(stub.getCall(0).thisValue).to.equal(form);
    expect(form.tagName).to.equal('FORM');
    expect(form.getAttribute('method')).to.equal('POST');
    expect(form.getAttribute('action')).to.equal(url);
    // Expected data used and null/undefined values ignored.
    expect(form.children.length).to.equal(Object.keys(expectedData).length);
    Object.keys(expectedData).forEach((key: string, index: number) => {
      expect(form.children[index].tagName).to.equal('INPUT');
      expect(form.children[index].getAttribute('type')).to.equal('hidden');
      expect(form.children[index].getAttribute('name')).to.equal(key);
      expect(form.children[index].getAttribute('value')).to.equal(data[key].toString());
    });
  });
});

describe('getCurrentUrl()', () => {
  it('should return current URL when a valid window instance is provided', () => {
    const href = 'https://www.example.com/path/index.html?a=1&b=2#c';
    expect(getCurrentUrl({location: {href}} as any)).to.equal(href);
  });

  it('should return null when an invalid window instance is provided', () => {
    expect(getCurrentUrl({} as any)).to.be.null;
  });
});

describe('setCurrentUrl()', () => {
  it('should assign location on window', () => {
    const expectedUrl = 'https://www.example.com/path/page?a=1#b=2';
    const assignStub: sinon.SinonStub = sinon.stub();

    setCurrentUrl({location: {assign: assignStub}} as any, expectedUrl);

    expect(assignStub).to.have.been.calledOnce.and.calledWith(expectedUrl);
  });

  it('should safe assign URLs', () => {
    unsafeUrls.forEach((unsafeUrl) => {
      const expectedUrl = 'about:invalid';
      const assignStub: sinon.SinonStub = sinon.stub();

      setCurrentUrl({location: {assign: assignStub}} as any, unsafeUrl);

      expect(assignStub).to.have.been.calledOnce.and.calledWith(expectedUrl);
    });
  });
});

describe('runIfDefined()', () => {
  it('should not throw when called with undefined', () => {
    expect(() => {
      runIfDefined(undefined);
    }).not.to.throw();
  });

  it('should not throw when called with invalid function', () => {
    expect(() => {
      runIfDefined('invalid' as any);
    }).not.to.throw();
  });

  it('should trigger callback when called with a valid function and pass through returned value', () => {
    const expectedReturnedValue = {a: 1, b: 2};
    const cb = sinon.stub().returns(expectedReturnedValue);

    expect(runIfDefined(cb)).to.equal(expectedReturnedValue);
    expect(cb).to.be.calledOnce;
  });

  it('should trigger callback when called with a valid function and return undefined when nothing is returned', () => {
    const cb = sinon.stub();

    expect(runIfDefined(cb)).to.be.undefined;
    expect(cb).to.be.calledOnce;
  });
});

describe('generateRandomAlphaNumericString()', () => {
  it('should generate a random alphanumeric string with the specified number of characters ', () => {
    for (let i = 0; i < 10; i++) {
      const pattern = new RegExp('^[A-Za-z0-9]{' + i.toString() + '}$');
      expect(pattern.test(generateRandomAlphaNumericString(i))).to.be.true;
    }
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

describe('isHistorySupported', () => {
  it('should return true when history is supported', () => {
    expect(isHistorySupported({history: {pushState: () => {/** Empty. */}}} as any)).to.be.true;
  });

  it('should return false when history is not supported', () => {
    expect(isHistorySupported({history: {/** Empty. */}} as any)).to.be.false;
    expect(isHistorySupported({} as any)).to.be.false;
  });
});

describe('isCustomEventSupported', () => {
  it('should return true when CustomEvent is supported', () => {
    expect(isCustomEventSupported({CustomEvent: () => {/** Empty. */}} as any)).to.be.true;
  });

  it('should return false when CustomEvent is not supported', () => {
    expect(isCustomEventSupported({} as any)).to.be.false;
  });
});

describe('isHistoryAndCustomEventSupported', () => {
  it('should return true when history and CustomEvent are supported', () => {
    const win: any = {
      CustomEvent: () => {/** Empty. */},
      history: {
        pushState: () => {/** Empty. */},
      },
    };
    expect(isHistoryAndCustomEventSupported(win)).to.be.true;
  });

  it('should return false when history is not supported', () => {
    const win: any = {
      CustomEvent: () => {/** Empty. */},
      history: {},
    };
    expect(isHistoryAndCustomEventSupported(win)).to.be.false;
  });

  it('should return false when CustomEvent is not supported', () => {
    const win: any = {
      history: {
        pushState: () => {/** Empty. */},
      },
    };
    expect(isHistoryAndCustomEventSupported(win)).to.be.false;
  });
});

describe('pushHistoryState', () => {
  const data = {a: 1, b: 2};
  const title = 'title';
  const url = 'https://www.example.com/path?a=1#b=2';

  it('should not throw when history is not supported', () => {
    expect(() => pushHistoryState({} as any, data, title, url)).not.to.throw();
  });

  it('should call underlying pushState with expected parameters', () => {
    const win: any = {
      history: {
        pushState: sinon.spy(),
      },
    };

    pushHistoryState(win, data, title, url);
    expect(win.history.pushState).to.have.been.calledOnce.and.calledWith(data, title, url);
  });
});

describe('getHistoryState', () => {
  const data = {a: 1, b: 2};

  it('should return null when history is not supported', () => {
    expect(getHistoryState({} as any)).be.null;
  });

  it('should return history.state when history is supported', () => {
    const win: any = {
      history: {
        pushState: () => {/** Empty. */},
        state: data,
      },
    };

    expect(getHistoryState(win)).to.equal(data);
  });
});
