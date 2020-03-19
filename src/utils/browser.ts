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

/**
 * Enums for Browser name.
 */
export enum BrowserName {
  Android = 'Android',
  Blackberry = 'Blackberry',
  Edge = 'Edge',
  Firefox = 'Firefox',
  IE = 'IE',
  IEMobile = 'IEMobile',
  Opera = 'Opera',
  Other = 'Other',
  Chrome = 'Chrome',
  Safari = 'Safari',
  Silk = 'Silk',
  Webos = 'Webos',
}

/**
 * @param userAgent The navigator user agent string.
 * @return The browser name, eg Safari, Firefox, etc.
 */
export function getBrowserName(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.indexOf('opera/') !== -1 ||
      ua.indexOf('opr/') !== -1 ||
      ua.indexOf('opios/') !== -1) {
    return BrowserName.Opera;
  } else if (ua.indexOf('iemobile') !== -1) {
    // Windows phone IEMobile browser.
    return BrowserName.IEMobile;
  } else if (ua.indexOf('msie') !== -1 ||
             ua.indexOf('trident/') !== -1) {
    return BrowserName.IE;
  } else if (ua.indexOf('edge/') !== -1) {
    return BrowserName.Edge;
  } else if (ua.indexOf('firefox/') !== -1) {
    return BrowserName.Firefox;
  } else if (ua.indexOf('silk/') !== -1) {
    return BrowserName.Silk;
  } else if (ua.indexOf('blackberry') !== -1) {
    // Blackberry browser.
    return BrowserName.Blackberry;
  } else if (ua.indexOf('webos') !== -1) {
    // WebOS default browser.
    return BrowserName.Webos;
  } else if (ua.indexOf('safari/') !== -1 &&
             ua.indexOf('chrome/') === -1 &&
             ua.indexOf('crios/') === -1 &&
             ua.indexOf('android') === -1) {
    return BrowserName.Safari;
  } else if ((ua.indexOf('chrome/') !== -1 ||
              ua.indexOf('crios/') !== -1) &&
             ua.indexOf('edge/') === -1) {
    return BrowserName.Chrome;
  } else if (ua.indexOf('android') !== -1) {
    // Android stock browser.
    return BrowserName.Android;
  } else {
    // Most modern browsers have name/version at end of user agent string.
    const re = new RegExp('([a-zA-Z\\d\\.]+)\/[a-zA-Z\\d\\.]*$');
    const matches = userAgent.match(re);
    if (matches && matches.length === 2) {
      return matches[1];
    }
  }
  return BrowserName.Other;
}

/**
 * @return The user agent string reported by the environment, or the
 *     empty string if not available.
 */
function getUserAgentString(): string {
  return (window && window.navigator && window.navigator.userAgent) || '';
}

/**
 * Detects whether browser is running on a mobile device.
 *
 * @param userAgent The navigator user agent.
 * @return True if the browser is running on a mobile device.
 */
export function isMobileBrowser(userAgent?: string): boolean {
  const ua = userAgent || getUserAgentString();
  const uaLower = ua.toLowerCase();
  if (uaLower.match(/android/) ||
      uaLower.match(/webos/) ||
      uaLower.match(/iphone|ipad|ipod/) ||
      uaLower.match(/blackberry/) ||
      uaLower.match(/windows phone/) ||
      uaLower.match(/iemobile/)) {
    return true;
  }
  return false;
}

/**
 * Returns the client version to be passed in x-client-version header.
 * This library is only usable from a window browser environment.
 *
 * @param The optional user agent.
 * @param framework Optional additional framework version to log.
 * @return The full client SDK version.
 */
export function getClientVersion(userAgent?: string, framework?: string): string {
  // The format to be followed:
  // ${browserName}/${clientImplementation}/${clientVersion}/${frameworkVersion}
  return `${getBrowserName(userAgent || getUserAgentString())}/CIAP/<XXX_SDK_VERSION_XXX>` +
    (typeof framework === 'undefined' ? '' : `/${framework}`);
}
