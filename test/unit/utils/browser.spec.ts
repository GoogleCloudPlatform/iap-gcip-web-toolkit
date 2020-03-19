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
  getBrowserName, isMobileBrowser, getClientVersion, BrowserName,
} from '../../../src/utils/browser';
import { USER_AGENTS } from '../../resources/utils';

describe('getBrowserName', () => {
  it('should return Edge for edge userAgent', () => {
    expect(getBrowserName(USER_AGENTS.edge)).to.equal(BrowserName.Edge);
  });

  it('should return Firefox for firefox userAgent', () => {
    expect(getBrowserName(USER_AGENTS.firefox)).to.equal(BrowserName.Firefox);
  });

  it('should return Silk for silk userAgent', () => {
    expect(getBrowserName(USER_AGENTS.silk)).to.equal(BrowserName.Silk);
  });

  it('should return Safari for Safari userAgent', () => {
    expect(getBrowserName(USER_AGENTS.safari)).to.equal(BrowserName.Safari);
  });

  it('should return Chrome for Chrome userAgent', () => {
    expect(getBrowserName(USER_AGENTS.chrome)).to.equal(BrowserName.Chrome);
  });

  it('should return Android for Android stock userAgent', () => {
    expect(getBrowserName(USER_AGENTS.android)).to.equal(BrowserName.Android);
  });

  it('should return Blackberry for Blackberry userAgent', () => {
    expect(getBrowserName(USER_AGENTS.blackberry)).to.equal(BrowserName.Blackberry);
  });

  it('should return IEMobile for windows phone userAgent', () => {
    expect(getBrowserName(USER_AGENTS.windowsPhone)).to.equal(BrowserName.IEMobile);
  });

  it('should return Webos for WebOS userAgent', () => {
    expect(getBrowserName(USER_AGENTS.webOS)).to.equal(BrowserName.Webos);
  });

  it('should return custom browser name for recognizable userAgent', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like ' +
        'Gecko) Awesome/2.0.012';
    expect(getBrowserName(ua)).to.equal('Awesome');
  });

  it('should return Other for unrecognizable userAgent', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_2 like Mac OS X) AppleWebKi' +
        't/600.1.4 (KHTML, like Gecko) Mobile/12D508 [FBAN/FBIOS;FBAV/27.0.0.1' +
        '0.12;FBBV/8291884;FBDV/iPhone7,1;FBMD/iPhone;FBSN/iPhone OS;FBSV/8.2;' +
        'FBSS/3; FBCR/vodafoneIE;FBID/phone;FBLC/en_US;FBOP/5]';
    expect(getBrowserName(ua)).to.equal(BrowserName.Other);
  });
});

describe('isMobileBrowser', () => {
  const mobileUserAgents = [
    USER_AGENTS.iOS7iPod,
    USER_AGENTS.iOS7iPhone,
    USER_AGENTS.iOS7iPad,
    USER_AGENTS.iOS9iPhone,
    USER_AGENTS.iOS8iPhone,
    USER_AGENTS.android,
    USER_AGENTS.blackberry,
    USER_AGENTS.webOS,
    USER_AGENTS.windowsPhone,
    USER_AGENTS.chrios,
  ];
  const desktopUserAgents = [
    USER_AGENTS.firefox,
    USER_AGENTS.opera,
    USER_AGENTS.ie,
    USER_AGENTS.edge,
    USER_AGENTS.silk,
    USER_AGENTS.safari,
    USER_AGENTS.chrome,
  ];

  it('should return true for mobile browser', () => {
    mobileUserAgents.forEach((ua: string) => {
      expect(isMobileBrowser(ua)).to.be.true;
    });
  });

  it('should return false for desktop browser', () => {
    desktopUserAgents.forEach((ua: string) => {
      expect(isMobileBrowser(ua)).to.be.false;
    });
  });
});

describe('getClientVersion', () => {
  it('should return expected client version for the specified userAgent', () => {
    expect(getClientVersion(USER_AGENTS.chrome)).to.equal('Chrome/CIAP/<XXX_SDK_VERSION_XXX>');
    expect(getClientVersion(USER_AGENTS.safari)).to.equal('Safari/CIAP/<XXX_SDK_VERSION_XXX>');
  });

  it('should append framework version when available', () => {
    expect(getClientVersion(USER_AGENTS.chrome, 'ui-0.0.1')).to.equal('Chrome/CIAP/<XXX_SDK_VERSION_XXX>/ui-0.0.1');
    expect(getClientVersion(USER_AGENTS.safari, 'ui-2.3.0')).to.equal('Safari/CIAP/<XXX_SDK_VERSION_XXX>/ui-2.3.0');
  });
});
