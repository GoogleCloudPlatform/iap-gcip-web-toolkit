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

/** Basic IPv4 address regex matcher. */
const IP_ADDRESS_REGEXP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * Validates that a value is an array.
 *
 * @param value The value to validate.
 * @return Whether the value is an array or not.
 */
export function isArray(value: any): boolean {
  return Array.isArray(value);
}

/**
 * Validates that a value is a non-empty array.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-empty array or not.
 */
export function isNonEmptyArray(value: any): boolean {
  return isArray(value) && value.length !== 0;
}

/**
 * Validates that a value is a boolean.
 *
 * @param value The value to validate.
 * @return Whether the value is a boolean or not.
 */
export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

/**
 * Validates that a value is a number.
 *
 * @param value The value to validate.
 * @return Whether the value is a number or not.
 */
export function isNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Validates that a value is a string.
 *
 * @param value The value to validate.
 * @return Whether the value is a string or not.
 */
export function isString(value: any): value is string {
  return typeof value === 'string';
}

/**
 * Validates that a value is a non-empty string.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-empty string or not.
 */
export function isNonEmptyString(value: any): value is string {
  return isString(value) && value !== '';
}

/**
 * Validates that a value is a nullable object.
 *
 * @param value The value to validate.
 * @return Whether the value is an object or not.
 */
export function isObject(value: any): boolean {
  return typeof value === 'object' && !isArray(value);
}

/**
 * Validates that a value is a non-null object.
 *
 * @param value The value to validate.
 * @return Whether the value is a non-null object or not.
 */
export function isNonNullObject(value: any): boolean {
  return isObject(value) && value !== null;
}

/**
 * Validates whether the url provided is whitelisted in the list of authorized domains.
 * Authorized domains currently correspond to: domain.com = *://*.domain.com:* or
 * exact domain match.
 * In the case of Chrome extensions, the authorizedDomain will be formatted
 * as 'chrome-extension://abcdefghijklmnopqrstuvwxyz123456'.
 * The URL to check must have a chrome extension scheme and the domain
 * must be an exact match domain == 'abcdefghijklmnopqrstuvwxyz123456'.
 * For GCIP/IAP purposes, only http and https domains (traditional browser application) will be accepted.
 *
 * @param authorizedDomains List of authorized domains.
 * @param url The URL to check.
 * @return Whether the passed domain is an authorized one.
 */
export function isAuthorizedDomain(authorizedDomains: string[], url: string): boolean {
  const uri = new URL(url);
  const scheme = uri.protocol;
  const domain = uri.hostname;
  let matchFound = false;
  authorizedDomains.forEach((authorizedDomain: string) => {
    if (matchDomain(authorizedDomain, domain, scheme)) {
      matchFound = true;
    }
  });
  return matchFound;
}

/**
 * @param domainPattern The domain pattern to match.
 * @param domain The domain to check. It is assumed that it is a valid
 *     domain, not a user provided one.
 * @param scheme The scheme of the domain to check.
 * @return Whether the provided domain matches the domain pattern.
 */
function matchDomain(domainPattern: string, domain: string, scheme: string): boolean {
  if (scheme !== 'http:' && scheme !== 'https:') {
    // Any other scheme that is not http or https cannot be whitelisted.
    return false;
  } else {
    // domainPattern must not contain a scheme and the current scheme must be
    // either http or https.
    // Check if authorized domain pattern is an IP address.
    if (IP_ADDRESS_REGEXP.test(domainPattern)) {
      // The domain has to be exactly equal to the pattern, as an IP domain will
      // only contain the IP, no extra character.
      return domain === domainPattern;
    }
    // Dots in pattern should be escaped.
    const escapedDomainPattern = domainPattern.split('.').join('\\.');
    // Non ip address domains.
    // domain.com = *.domain.com OR domain.com
    const re = new RegExp('^(.+\\.' + escapedDomainPattern + '|' + escapedDomainPattern + ')$', 'i');
    return re.test(domain);
  }
}

/**
 * Validates that a string is a valid web URL.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is valid web URL or not.
 */
export function isURL(urlStr: any): boolean {
  if (typeof urlStr !== 'string') {
    return false;
  }
  // Lookup illegal characters.
  const re = /[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i;
  if (re.test(urlStr)) {
    return false;
  }
  try {
    const uri = new URL(urlStr);
    const scheme = uri.protocol;
    const hostname = uri.hostname;
    const pathname = uri.pathname;
    if (scheme !== 'http:' && scheme !== 'https:') {
      return false;
    }
    // Validate hostname: Can contain letters, numbers, underscore and dashes separated by a dot.
    // Each zone must not start with a hyphen or underscore.
    if (!/^[a-zA-Z0-9]+[\w\-]*([\.]?[a-zA-Z0-9]+[\w\-]*)*$/.test(hostname)) {
      return false;
    }
    // Allow for pathnames: (/+chars+)*/*
    // Where chars can be a combination of: a-z A-Z 0-9 - _ . ~ ! $ & ' ( ) * + , ; = : @ %
    const pathnameRe = /^(\/+[\w\-\.\~\!\$\'\(\)\*\+\,\;\=\:\@\%]+)*\/*$/;
    // Validate pathname.
    if (pathname &&
        !/^\/+$/.test(pathname) &&
        !pathnameRe.test(pathname)) {
      return false;
    }
    // Allow any query string and hash as long as no invalid character is used.
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * Validates that a string is a valid HTTPS URL.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is valid HTTPS URL or not.
 */
export function isHttpsURL(urlStr: any): boolean {
  return isURL(urlStr) && new URL(urlStr).protocol === 'https:';
}

/**
 * Validates that a string is localhost or a valid HTTPS URL.
 * This is needed to facilitate testing. As localhost is always served locally, there is no
 * risk of man in the middle attack.
 *
 * @param urlStr The string to validate.
 * @return Whether the string is localhost/valid HTTPS URL or not.
 */
export function isLocalhostOrHttpsURL(urlStr: any): boolean {
  if (isURL(urlStr)) {
    const uri = new URL(urlStr);
    return (uri.protocol === 'http:' && uri.hostname === 'localhost') ||
        uri.protocol === 'https:';
  }
  return false;
}

/**
 * Validates that a string is a valid email.
 *
 * @param email The string to validate.
 * @return Whether the string is valid email or not.
 */
export function isEmail(email: any): boolean {
  if (typeof email !== 'string') {
    return false;
  }
  // There must at least one character before the @ symbol and another after.
  const re = /^[^@]+@[^@]+$/;
  return re.test(email);
}

/**
 * Validates that a string is a valid provider ID.
 *
 * @param providerId The string to validate.
 * @return Whether the string is valid provider ID or not.
 */
export function isProviderId(providerId: any): boolean {
  if (typeof providerId !== 'string') {
    return false;
  }
  // This check is quite lax. It may be tightened in the future.
  const re = /^[a-zA-Z0-9\-\_\.]+$/;
  return isNonEmptyString(providerId) && re.test(providerId);
}