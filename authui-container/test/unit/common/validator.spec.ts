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

import * as chai from 'chai';
import * as _ from 'lodash';
import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from 'chai-as-promised';

import {
  isArray, isNonEmptyArray, isBoolean, isNumber, isString, isNonEmptyString,
  isNonNullObject, isObject, isURL, isHttpsURL,
  isLocalhostOrHttpsURL, isEmail, isProviderId, JsonObjectValidator,
  isEmptyObject, isValidColorString, isSafeString,
} from '../../../common/validator';
import {deepCopy} from '../../../common/deep-copy';


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

describe('isURL()', () => {
  it('should return false with a null input', () => {
    expect(isURL(null)).to.be.false;
  });

  it('should return false with an undefined input', () => {
    expect(isURL(undefined)).to.be.false;
  });

  it('should return false with a non string', () => {
    expect(isURL(['http://www.google.com'])).to.be.false;
  });

  it('show return true with a valid web URL string', () => {
    expect(isURL('https://www.example.com:8080')).to.be.true;
    expect(isURL('https://www.example.com')).to.be.true;
    expect(isURL('http://localhost/path/name/')).to.be.true;
    expect(isURL('https://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isURL('http://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isURL('http://localhost/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isURL('http://127.0.0.1/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isURL('http://a--b.c-c.co-uk/')).to.be.true;
    expect(isURL('http://a--b.c-c.co-uk//')).to.be.true;
    expect(isURL('http://a--b.c-c.co-uk//path//')).to.be.true;
    expect(isURL('https://storage.googleapis.com/example-bucket/cat%20pic.jpeg?GoogleAccessId=e@' +
      'example-project.iam.gserviceaccount.com&Expires=1458238630&Signature=VVUgfqviDCov%2B%2BKn' +
      'mVOkwBR2olSbId51kSibuQeiH8ucGFyOfAVbH5J%2B5V0gDYIioO2dDGH9Fsj6YdwxWv65HE71VEOEsVPuS8CVb%2' +
      'BVeeIzmEe8z7X7o1d%2BcWbPEo4exILQbj3ROM3T2OrkNBU9sbHq0mLbDMhiiQZ3xCaiCQdsrMEdYVvAFggPuPq%2' +
      'FEQyQZmyJK3ty%2Bmr7kAFW16I9pD11jfBSD1XXjKTJzgd%2FMGSde4Va4J1RtHoX7r5i7YR7Mvf%2Fb17zlAuGlz' +
      'VUf%2FzmhLPqtfKinVrcqdlmamMcmLoW8eLG%2B1yYW%2F7tlS2hvqSfCW8eMUUjiHiSWgZLEVIG4Lw%3D%3D'))
      .to.be.true;
    expect(isURL('https://project.appspot.com//_gcp_iap/gcip_authenticate')).to.be.true;
  });

  it('should return false with an invalid web URL string', () => {
    expect(isURL('ftp://www.example.com:8080/path/name/file.png')).to.be.false;
    expect(isURL('example.com')).to.be.false;
    expect(isURL('')).to.be.false;
    expect(isURL('5356364326')).to.be.false;
    expect(isURL('http://www.exam[].com')).to.be.false;
    expect(isURL('http://`a--b.com')).to.be.false;
    expect(isURL('http://.com')).to.be.false;
    expect(isURL('http://abc.com.')).to.be.false;
    expect(isURL('http://-abc.com')).to.be.false;
    expect(isURL('http://www._abc.com')).to.be.false;
  });
});

describe('isHttpsURL()', () => {
  it('should return false with a null input', () => {
    expect(isHttpsURL(null)).to.be.false;
  });

  it('should return false with an undefined input', () => {
    expect(isHttpsURL(undefined)).to.be.false;
  });

  it('should return false with a non string', () => {
    expect(isHttpsURL(['https://www.google.com'])).to.be.false;
  });

  it('show return true with a valid HTTPS URL string', () => {
    expect(isHttpsURL('https://www.example.com:8080')).to.be.true;
    expect(isHttpsURL('https://www.example.com')).to.be.true;
    expect(isHttpsURL('https://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isHttpsURL('https://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isHttpsURL('https://localhost/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isHttpsURL('https://127.0.0.1/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isHttpsURL('https://a--b.c-c.co-uk/')).to.be.true;
    expect(isHttpsURL('https://storage.googleapis.com/example-bucket/cat%20pic.jpeg?GoogleAccessId=e@' +
      'example-project.iam.gserviceaccount.com&Expires=1458238630&Signature=VVUgfqviDCov%2B%2BKn' +
      'mVOkwBR2olSbId51kSibuQeiH8ucGFyOfAVbH5J%2B5V0gDYIioO2dDGH9Fsj6YdwxWv65HE71VEOEsVPuS8CVb%2' +
      'BVeeIzmEe8z7X7o1d%2BcWbPEo4exILQbj3ROM3T2OrkNBU9sbHq0mLbDMhiiQZ3xCaiCQdsrMEdYVvAFggPuPq%2' +
      'FEQyQZmyJK3ty%2Bmr7kAFW16I9pD11jfBSD1XXjKTJzgd%2FMGSde4Va4J1RtHoX7r5i7YR7Mvf%2Fb17zlAuGlz' +
      'VUf%2FzmhLPqtfKinVrcqdlmamMcmLoW8eLG%2B1yYW%2F7tlS2hvqSfCW8eMUUjiHiSWgZLEVIG4Lw%3D%3D'))
      .to.be.true;
  });

  it('should return false with a valid HTTP URL', () => {
    expect(isHttpsURL('http://www.google.com')).to.be.false;
  });

  it('should return false with an invalid HTTPS URL string', () => {
    expect(isHttpsURL('ftp://www.example.com:8080/path/name/file.png')).to.be.false;
    expect(isHttpsURL('example.com')).to.be.false;
    expect(isHttpsURL('')).to.be.false;
    expect(isHttpsURL('5356364326')).to.be.false;
    expect(isHttpsURL('https://www.exam[].com')).to.be.false;
    expect(isHttpsURL('https://`a--b.com')).to.be.false;
    expect(isHttpsURL('https://.com')).to.be.false;
    expect(isHttpsURL('https://abc.com.')).to.be.false;
    expect(isHttpsURL('https://-abc.com')).to.be.false;
    expect(isHttpsURL('https://www._abc.com')).to.be.false;
  });
});

describe('isLocalhostOrHttpsURL()', () => {
  it('should return false with a null input', () => {
    expect(isLocalhostOrHttpsURL(null)).to.be.false;
  });

  it('should return false with an undefined input', () => {
    expect(isLocalhostOrHttpsURL(undefined)).to.be.false;
  });

  it('should return false with a non string', () => {
    expect(isLocalhostOrHttpsURL(['https://www.google.com'])).to.be.false;
  });

  it('should return true with a localhost URL string', () => {
    expect(isLocalhostOrHttpsURL('http://localhost')).to.be.true;
    expect(isLocalhostOrHttpsURL('http://localhost:8080')).to.be.true;
    expect(isLocalhostOrHttpsURL('http://localhost/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isLocalhostOrHttpsURL('http://localhost:5000/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
  });

  it('show return true with a valid HTTPS URL string', () => {
    expect(isLocalhostOrHttpsURL('https://www.example.com:8080')).to.be.true;
    expect(isLocalhostOrHttpsURL('https://www.example.com')).to.be.true;
    expect(isLocalhostOrHttpsURL('https://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isLocalhostOrHttpsURL('https://www.example.com:8080/path/name/index.php?a=1&b=2&c=3#abcd'))
      .to.be.true;
    expect(isLocalhostOrHttpsURL('https://localhost/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isLocalhostOrHttpsURL('https://127.0.0.1/path/name/index.php?a=1&b=2&c=3#abcd')).to.be.true;
    expect(isLocalhostOrHttpsURL('https://a--b.c-c.co-uk/')).to.be.true;
    expect(isLocalhostOrHttpsURL('https://storage.googleapis.com/example-bucket/cat%20pic.jpeg?GoogleAccessId=e@' +
      'example-project.iam.gserviceaccount.com&Expires=1458238630&Signature=VVUgfqviDCov%2B%2BKn' +
      'mVOkwBR2olSbId51kSibuQeiH8ucGFyOfAVbH5J%2B5V0gDYIioO2dDGH9Fsj6YdwxWv65HE71VEOEsVPuS8CVb%2' +
      'BVeeIzmEe8z7X7o1d%2BcWbPEo4exILQbj3ROM3T2OrkNBU9sbHq0mLbDMhiiQZ3xCaiCQdsrMEdYVvAFggPuPq%2' +
      'FEQyQZmyJK3ty%2Bmr7kAFW16I9pD11jfBSD1XXjKTJzgd%2FMGSde4Va4J1RtHoX7r5i7YR7Mvf%2Fb17zlAuGlz' +
      'VUf%2FzmhLPqtfKinVrcqdlmamMcmLoW8eLG%2B1yYW%2F7tlS2hvqSfCW8eMUUjiHiSWgZLEVIG4Lw%3D%3D'))
      .to.be.true;
  });

  it('should return false with a valid HTTP non-localhost URL', () => {
    expect(isLocalhostOrHttpsURL('http://www.google.com')).to.be.false;
    expect(isLocalhostOrHttpsURL('http://127.0.0.1')).to.be.false;
  });

  it('should return false with an invalid URL string', () => {
    expect(isLocalhostOrHttpsURL('localhost')).to.be.false;
    expect(isLocalhostOrHttpsURL('ftp://www.example.com:8080/path/name/file.png')).to.be.false;
    expect(isLocalhostOrHttpsURL('example.com')).to.be.false;
    expect(isLocalhostOrHttpsURL('')).to.be.false;
    expect(isLocalhostOrHttpsURL('5356364326')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://www.exam[].com')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://`a--b.com')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://.com')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://abc.com.')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://-abc.com')).to.be.false;
    expect(isLocalhostOrHttpsURL('https://www._abc.com')).to.be.false;
  });
});

describe('isEmail()', () => {

  it('should return false with a null input', () => {
    expect(isEmail(null)).to.be.false;
  });

  it('should return false with an undefined input', () => {
    expect(isEmail(undefined)).to.be.false;
  });

  it('should return false with a non string', () => {
    expect(isEmail({email: 'user@example.com'})).to.be.false;
  });

  it('show return true with a valid email string', () => {
    expect(isEmail('abc12345@abc.b-a.bla2235535.co.uk')).to.be.true;
    expect(isEmail('abc@com')).to.be.true;
    expect(isEmail('abc@bla.')).to.be.true;
  });

  it('should return false with an invalid email string', () => {
    expect(isEmail('abc.com')).to.be.false;
    expect(isEmail('@bla.com')).to.be.false;
    expect(isEmail('a@')).to.be.false;
  });
});

describe('isProviderId()', () => {
  const nonStrings = [undefined, null, NaN, 0, 1, true, false, [], ['a'], {}, { a: 1 }, _.noop];
  nonStrings.forEach((nonString) => {
    it('should return false given a non-string argument: ' + JSON.stringify(nonString), () => {
      expect(isProviderId(nonString as any)).to.be.false;
    });
  });

  it('should return false given an empty string', () => {
    expect(isProviderId('')).to.be.false;
  });

  const invalidProviderIdStrings = [
    '@provider.com', 'p .com', '!provider.com', 'p?rovider', 'p:rovider',
    'pro,vider.com', '{provider', ';provider',
  ];
  invalidProviderIdStrings.forEach((invalidProviderIdString) => {
    it('should return false given strings with invalid chars: ' + JSON.stringify(invalidProviderIdString), () => {
      expect(isProviderId(invalidProviderIdString)).to.be.false;
    });
  });

  it('should return true with valid provider ID strings', () => {
    expect(isProviderId('abc.com')).to.be.true;
    expect(isProviderId('google.com')).to.be.true;
    expect(isProviderId('password')).to.be.true;
    expect(isProviderId('saml.idp')).to.be.true;
    expect(isProviderId('oidc.idp')).to.be.true;
    expect(isProviderId('oidc.my-provider')).to.be.true;
    expect(isProviderId('oidc.123')).to.be.true;
    expect(isProviderId('oidc.ABC12_3d')).to.be.true;
  });
});

describe('isSafeString()', () => {
  it('should return false given no argument', () => {
    expect(isSafeString(undefined as any)).to.be.false;
  });

  const nonStrings = [null, NaN, 0, 1, true, false, [], ['a'], {}, { a: 1 }, _.noop];
  nonStrings.forEach((nonString) => {
    it('should return false given a non-string argument: ' + JSON.stringify(nonString), () => {
      expect(isSafeString(nonString as any)).to.be.false;
    });
  });

  it('should return false given an empty string', () => {
    expect(isSafeString('')).to.be.false;
  });

  it('should return true given a string with only whitespace', () => {
    expect(isSafeString(' ')).to.be.true;
  });

  it('should return true given a non-empty string', () => {
    expect(isSafeString('foo')).to.be.true;
  });

  const unsafeStrings = ['<', '<a>', '"', '\'', '(', ')', '\\', '/'];
  unsafeStrings.forEach((unsafeString) => {
    it(`should return false given a safe string: "${unsafeString}"`, () => {
      expect(isSafeString(unsafeString)).to.be.false;
    });
  });

  it('should return true given a safe string', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    expect(isSafeString(
      `${alphabet.toLowerCase()} ${alphabet.toUpperCase()} ${numbers} - _ . , + ! ? & ;`)
    ).to.be.true;
  });
});

describe('isValidColorString()', () => {
  it('should return false given no argument', () => {
    expect(isValidColorString(undefined as any)).to.be.false;
  });

  const nonStrings = [null, NaN, 0, 1, true, false, [], ['a'], {}, { a: 1 }, _.noop];
  nonStrings.forEach((nonString) => {
    it('should return false given a non-string argument: ' + JSON.stringify(nonString), () => {
      expect(isValidColorString(nonString as any)).to.be.false;
    });
  });

  it('should return false given an empty string', () => {
    expect(isValidColorString('')).to.be.false;
  });

  const nonColorStrings = ['#aaa', '#', '00ff00', '#p03030'];
  nonColorStrings.forEach((nonColorString) => {
    it(`should return false given a non-color string: "${nonColorString}"`, () => {
      expect(isValidColorString(nonColorString)).to.be.false;
    });
  });

  const colorStrings = ['#aaaaaa', '#000000', '#00ff00', '#ffffff', '#123456'];
  colorStrings.forEach((colorString) => {
    it(`should return true given a color string: "${colorString}"`, () => {
      expect(isValidColorString(colorString)).to.be.true;
    });
  });
});

describe('isEmptyObject()', () => {
  it('should return false given no argument', () => {
    expect(isEmptyObject(undefined as any)).to.be.false;
  });

  const nonObjects = [NaN, 0, 1, true, false, '', 'a', _.noop];
  nonObjects.forEach((nonObject) => {
    it('should return false given a non-object argument: ' + JSON.stringify(nonObject), () => {
      expect(isEmptyObject(nonObject as any)).to.be.false;
    });
  });

  it('should return false given an empty array', () => {
    expect(isEmptyObject([])).to.be.false;
  });

  it('should return false given a non-empty array', () => {
    expect(isEmptyObject(['a'])).to.be.false;
  });

  it('should return false given null', () => {
    expect(isEmptyObject(null)).to.be.false;
  });

  it('should return false given a non-empty object', () => {
    expect(isEmptyObject({ a: 1 })).to.be.false;
  });

  it('should return true given an empty object', () => {
    expect(isEmptyObject({})).to.be.true;
  });
});

describe('JsonObjectValidator', () => {
  const validationTree = {
    '*': {
      nodes: {
        key1: {
          validator: (input: any) => {
            // If input not string, throw.
            if (!isString(input)) {
              throw new Error('invalid key1 type');
            }
          },
        },
        'key2[]': {
          validator: (input: any) => {
            // If input not string, throw.
            if (!isString(input)) {
              throw new Error('invalid key2[] type');
            }
          },
          nodes: {
            key6: {
              validator: (input: any) => {
                // If input not string, throw.
                if (!isString(input)) {
                  throw new Error('invalid key6 type');
                }
              },
            },
          },
        },
        'key7[]': {
          nodes: {
            key8: {
              validator: (input: any) => {
                // If input not number, throw.
                if (!isNumber(input)) {
                  throw new Error('invalid key8 type');
                }
              },
            },
          },
        },
        key3: {
          nodes: {
            key4: {
              validator: (input: any) => {
                // If input not boolean, throw.
                if (!isBoolean(input)) {
                  throw new Error('invalid key4 type');
                }
              },
              nodes: {
                key5: {
                  validator: (input: any) => {
                    // If input not number, throw.
                    if (!isNumber(input)) {
                      throw new Error('invalid key5 type');
                    }
                  },
                  nodes: {
                    '*': {
                      validator: (input: any) => {
                        // If input not string, throw.
                        if (!isString(input)) {
                          throw new Error('invalid key5.* type');
                        }
                      },
                    }
                  }
                },
              },
            },
          },
        },
      },
    },
  };
  const jsonObjectValidator = new JsonObjectValidator(validationTree);
  const testObject = {
    a1: {
      key1: 'some-string',
      key2: ['str1', 'str2'],
      key3: {
        key4: false,
      },
    },
    b2: {
      key3: {
        key4: {
          key5: -1.3,
        },
      },
    },
    c3: {
      key2: ['single value'],
    },
  };
  const requiredFields = [
    '*.key1',
    '*.key2[]',
    '*.key3.key4',
    '*.key7[].key8',
  ];
  const testObjectWithRequiredFields = {
    a1: {
      key1: 'some-string',
      key2: ['str1', 'str2'],
      key3: {
        key4: false,
      },
      key7: [{
        key8: 1,
      }],
    },
    b2: {
      key1: 'other',
      key2: [],
      key3: {
        key4: {
          key5: -1.3,
        },
      },
      key7: [{
        key8: 2,
      }],
    },
    c3: {
      key1: 'another',
      key2: ['single value'],
      key3: {
        key4: {
          key5: {
            foo: 'bar',
          },
        },
      },
      key7: [{
        key8: 3,
      }],
    },
  };

  describe('validate()', () => {
    it('should not throw on valid JSON object', () => {
      expect(() => {
        jsonObjectValidator.validate(testObject);
      }).not.to.throw();
    });

    it('should not throw on valid empty array type', () => {
      expect(() => {
        const validObject: any = deepCopy(testObject);
        validObject.c3.key2 = [];
        jsonObjectValidator.validate(validObject);
      }).not.to.throw();
    });

    it('should not throw on valid empty object type', () => {
      expect(() => {
        const validObject: any = deepCopy(testObject);
        validObject.b2.key3 = {};
        jsonObjectValidator.validate(validObject);
      }).not.to.throw();
    });

    it('should not throw on valid multiple type values', () => {
      expect(() => {
        const validObject: any = deepCopy(testObject);
        validObject.a1.key2 = ['other', {key6: 'str'}];
        jsonObjectValidator.validate(validObject);
      }).not.to.throw();
    });

    it('should not throw on valid nested wildcard object with valid type', () => {
      expect(() => {
        const validObject: any = deepCopy(testObject);
        validObject.b2.key3.key4.key5 = {
          other: 'valid',
        };
        jsonObjectValidator.validate(validObject);
      }).not.to.throw();
    });

    it('should throw on invalid JSON object', () => {
      expect(() => {
        jsonObjectValidator.validate('invalid object');
      }).to.throw(`Invalid key or type ""`);
    });

    it('should throw on null object', () => {
      expect(() => {
        jsonObjectValidator.validate(null);
      }).to.throw('Invalid key or type ""');
    });

    it('should throw on invalid key', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.a1.foo = 'bar';
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`Invalid key or type "a1.foo"`);
    });

    it('should throw on invalid array value for valid key', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.a1.key2[0] = true;
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`invalid key2[] type`);
    });

    it('should throw on invalid value for valid key', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.b2.key3.key4 = 'bar';
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`invalid key4 type`);
    });

    it('should throw on a key that requires a nested object', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.a1.key3 = 'invalid';
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`Invalid value for "a1.key3"`);
    });

    it('should throw on a invalid array type for valid key', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.a1.key3 = ['invalid'];
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`Invalid key or type "a1.key3[]"`);
    });

    it('should throw on a key with an invalid empty object', () => {
      expect(() => {
        const invalidObject: any = deepCopy(testObject);
        invalidObject.a1.key2 = {};
        jsonObjectValidator.validate(invalidObject);
      }).to.throw(`Invalid key or type "a1.key2"`);
    });

    it('should throw on valid nested wildcard object with invalid type', () => {
      expect(() => {
        const validObject: any = deepCopy(testObject);
        validObject.b2.key3.key4.key5 = {
          other: false,
        };
        jsonObjectValidator.validate(validObject);
      }).to.throw('invalid key5.* type');
    });

    it('should not throw when all required fields are available', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        requiredJsonObjectValidator.validate(testObjectWithRequiredFields);
      }).not.to.throw();
    });

    it('should not throw when required array is empty', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        const modifiedFieldObject = deepCopy(testObjectWithRequiredFields);
        modifiedFieldObject.b2.key2 = [];
        requiredJsonObjectValidator.validate(modifiedFieldObject);
      }).not.to.throw();
    });

    it('should throw when required top level field is missing', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        const missingFieldObject = deepCopy(testObjectWithRequiredFields);
        delete missingFieldObject.c3.key1;
        requiredJsonObjectValidator.validate(missingFieldObject);
      }).to.throw('Missing required field "*.key1"');
    });

    it('should throw when required nested field is missing', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        const missingFieldObject = deepCopy(testObjectWithRequiredFields);
        delete missingFieldObject.b2.key3.key4;
        requiredJsonObjectValidator.validate(missingFieldObject);
      }).to.throw('Missing required field "*.key3.key4"');
    });

    it('should throw when required array is missing', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        const missingFieldObject = deepCopy(testObjectWithRequiredFields);
        delete missingFieldObject.b2.key2;
        requiredJsonObjectValidator.validate(missingFieldObject);
      }).to.throw('Missing required field "*.key2[]"');
    });

    it('should throw when required object in array is missing', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator(validationTree, requiredFields);
      expect(() => {
        const missingFieldObject = deepCopy(testObjectWithRequiredFields);
        delete missingFieldObject.b2.key7[0].key8;
        requiredJsonObjectValidator.validate(missingFieldObject);
      }).to.throw('Missing required field "*.key7[].key8"');
    });

    it('should not throw when top level explicit required field is provided', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator({
        '*': {
          validator: (input: any) => {
            // If input not string, throw.
            if (!isString(input)) {
              throw new Error('invalid "top" type');
            }
          },
        },
      }, ['top']);
      expect(() => {
        requiredJsonObjectValidator.validate({top: 'hello'});
      }).not.to.throw();
    });

    it('should throw when top level explicit required field is not provided', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator({
        '*': {
          validator: (input: any) => {
            // If input not string, throw.
            if (!isString(input)) {
              throw new Error('invalid "top" type');
            }
          },
        },
      }, ['top']);
      expect(() => {
        requiredJsonObjectValidator.validate({other: 'hello'});
      }).to.throw('Missing required field "top"');
    });

    it('should not throw when required nested wilcard claim is provided', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator({
        top: {
          nodes: {
            '*': {
              validator: (input: any) => {
                // If input not string, throw.
                if (!isString(input)) {
                  throw new Error('invalid "top" type');
                }
              },
            },
          },
        },
      }, ['top.*']);
      expect(() => {
        requiredJsonObjectValidator.validate({top: {nested: 'hello'}});
      }).not.to.throw();
    });

    it('should throw when required nested wilcard claim is not provided', () => {
      const requiredJsonObjectValidator = new JsonObjectValidator({
        top: {
          nodes: {
            '*': {
              validator: (input: any) => {
                // If input not string, throw.
                if (!isString(input)) {
                  throw new Error('invalid "top" type');
                }
              },
            },
          },
        },
      }, ['top.*']);
      expect(() => {
        requiredJsonObjectValidator.validate({top: {}});
      }).to.throw('Missing required field "top.*"');
    });
  });
});
