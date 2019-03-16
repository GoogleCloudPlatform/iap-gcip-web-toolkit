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

import {isNonNullObject} from './validator';
import { callbackify } from 'util';

/**
 * Defines a new read-only property directly on an object and returns the object.
 *
 * @param {object} obj The object on which to define the property.
 * @param {string} prop The name of the property to be defined or modified.
 * @param {any} value The value associated with the property.
 */
export function addReadonlyGetter(obj: object, prop: string, value: any): void {
  Object.defineProperty(obj, prop, {
    value,
    // Make this property read-only.
    writable: false,
    // Include this property during enumeration of obj's properties.
    enumerable: true,
  });
}

/**
 * Removes entries in an object whose values are undefined and returns the same
 * object. This only removes the top-level undefined fields.
 *
 * @param {T} obj The object whose undefined fields are to be removed.
 * @return {T} The same object with undefined fields removed.
 */
export function removeUndefinedFields<T>(obj: T): T {
  // If obj is not a non-null object, return it back.
  if (!isNonNullObject(obj)) {
    return obj;
  }
  for (const key in obj) {
    if (typeof obj[key] === 'undefined') {
      delete obj[key];
    }
  }
  return obj;
}

/**
 * Formats a string of form 'project/{projectId}/{api}' and replaces
 * with corresponding arguments {projectId: '1234', api: 'resource'}
 * and returns output: 'project/1234/resource'.
 *
 * @param {string} str The original string where the param need to be
 *     replaced.
 * @param {object=} params The optional parameters to replace in the
 *     string.
 * @return {string} The resulting formatted string.
 */
export function formatString(str: string, params?: object): string {
  let formatted = str;
  Object.keys(params || {}).forEach((key) => {
    formatted = formatted.replace(
        new RegExp('{' + key + '}', 'g'),
        (params as {[key: string]: string})[key]);
  });
  return formatted;
}

/**
 * Submits the provided data to a URL using the provided HTTP method via a hidden form.
 * This will also redirect the current page to the provided URL.
 * All data values will be converted to string formats before they are sent to server and all
 * null and undefined values will be ignored.
 *
 * @param {HTMLDocument} doc The HTML document instance.
 * @param {string} url The form action URL.
 * @param {string} httpMethod The form HTTP method.
 * @param {object<string, *>} data The data to be form-urlencoded and sent along to URL.
 */
export function formSubmitWithRedirect(
    doc: HTMLDocument,
    url: string,
    httpMethod: 'GET' | 'POST',
    data: {[key: string]: any}) {
  const form: HTMLFormElement = doc.createElement('form');
  form.setAttribute('method', httpMethod);
  form.setAttribute('action', url);
  for (const key in data) {
    if (data.hasOwnProperty(key) &&
        typeof data[key] !== 'undefined' &&
        data[key] !== null) {
      const hiddenField: HTMLInputElement = doc.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name = key;
      hiddenField.value = data[key].toString();
      form.appendChild(hiddenField);
    }
  }
  doc.body.appendChild(form);
  form.submit();
}

/**
 * Returns the current URL if available.
 *
 * @param {Window} windowInstance The window reference.
 * @return {?string} The current URL if available.
 */
export function getCurrentUrl(windowInstance: Window) {
  return (windowInstance && windowInstance.location && windowInstance.location.href) || null;
}

/**
 * Redirects the window instance to the requested URL.
 *
 * @param {Window} windowInstance The window reference.
 * @param {string} url The URL to redirect to.
 */
export function setCurrentUrl(windowInstance: Window, url: string) {
  // TODO: use safe assign.
  windowInstance.location.assign(url);
}

/**
 * Runs the provided callback function if defined.
 *
 * @param {function()=} cb Callback function to run if defined.
 * @param {any=} thisArg The thisArg of the callback function if available.
 * @param {any[]=} args The list of optional arguments to pass to the callback function.
 */
export function runIfDefined(cb?: (...args: any[]) => any, thisArg?: any, args: any[] = []): any {
  if (typeof cb === 'function') {
    return cb.apply(thisArg, args);
  }
}

/**
 * Generates a random alpha numeric string.
 *
 * @param {number} numOfChars The number of random characters within the string.
 * @return {string} A string with a specific number of random characters.
 */
export function generateRandomAlphaNumericString(numOfChars: number) {
  const chars: string[] = [];
  const allowedChars =
      '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  while (numOfChars > 0) {
    chars.push(
        allowedChars.charAt(
            Math.floor(Math.random() * allowedChars.length)));
    numOfChars--;
  }
  return chars.join('');
}

/**
 * Maps an object's value based on the provided callback function.
 *
 * @param {object<string, T>} obj The object to map.
 * @param {function(string, T): V} cb The callback function used to compute the new mapped value.
 * @return {object<string, V} The mapped new object.
 */
export function mapObject<T, V>(
    obj: {[key: string]: T},
    cb: (key: string, value: T) => V): {[key: string]: V} {
  const mappedObject: {[key: string]: V} = {};
  Object.keys(obj).forEach((key: string) => {
    mappedObject[key] = cb(key, obj[key]);
  });
  return mappedObject;
}

/**
 * Returns a promise that resolves on DOM readiness.
 *
 * @param {Document} doc The document reference.
 * @return {Promise<void>} A promise that resolves when DOM is ready.
 */
export function onDomReady(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    if (doc.readyState === 'complete') {
      resolve();
    } else {
      doc.addEventListener('DOMContentLoaded', (event) => {
        resolve();
      });
    }
  });
}
