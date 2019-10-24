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

import { generateRandomAlphaNumericString } from './index';
import { deepCopy, deepEqual } from './deep-copy';

/**
 * Sign in
 * 1. validateAppAndGetProjectId (cacheable)
 * 2. startSignIn / getIdToken
 * 3. exchangeIdTokenAndGetOriginalAndTargetUrl (cacheable)
 * 4. setCookieAtTargetUrl (cacheable)
 * 5. redirect
 *
 * Sign out (single)
 * 1. validateAppAndGetProjectId (cacheable)
 * 2. signout (single)
 * 3. getOriginalUrlForSignOut (cacheable)
 * 4. redirect
 *
 * Sign out (multi)
 * 1. validateAppAndGetProjectId (cacheable)
 * 2. signout (multi)
 * 3. completeSignOut
 */

interface SingleCachedPromise<T> {
  promise: Promise<T>;
  cb: (...args) => Promise<T>;
  thisArg: any;
  args: any[];
  expirationTime: number;
}


/**
 * Defines a utility used for caching successful promise returning function calls for a
 * specified period of time. This is ideal for retrial flows.
 * For example in the sign-in flow, if setCookieAtTargetUrl fails due to a network timeout,
 * the developer can show a button to retry, this will likely go as follows:
 * 1. cached result for validateAppAndGetProjectId.
 * 2. ID token already available
 * 3. cached result for exchangeIdTokenAndGetOriginalAndTargetUrl
 * 4. retrial for setCookieAtTargetUrl (eliminating the need for the previous 2 calls)
 */
export class PromiseCache {
  private cachedPromises: {[key: string]: SingleCachedPromise<any>};

  /**
   * Initializes the promise caching utility.
   */
  constructor() {
    this.cachedPromises = {};
  }

  /**
   * Returns the cached result of the function call with the specified arguments.
   * If no cached results are found. Runs the function and caches its result before
   * returning it.
   *
   * @param cb The function to call.
   * @param thisArg The `this` argument for the function call.
   * @param args The arguments to call the function with.
   * @param duration The cache duration in milliseconds for the result.
   * @return The cached or current Promise result of the call.
   */
  public cacheAndReturnResult<T>(
      cb: (...args) => Promise<T>,
      thisArg: any,
      args: any[],
      duration: number): Promise<T> {
    // Lookup cache ID.
    if (typeof (cb as any)._cid_ === 'undefined') {
      // If not available, inject the id on the function.
      (cb as any)._cid_ = generateRandomAlphaNumericString(10);
    }
    const id = (cb as any)._cid_;
    // Check if result previously cached and not stale.
    if (typeof this.cachedPromises[id] !== 'undefined' &&
        this.cachedPromises[id].cb === cb &&
        this.cachedPromises[id].thisArg === thisArg &&
        this.cachedPromises[id].expirationTime > new Date().getTime() &&
        this.cachedPromises[id].args.length === args.length) {
      let matchingArgs = true;
      for (let i = 0; i < args.length; i++) {
        if (!deepEqual(args[i], this.cachedPromises[id].args[i])) {
          matchingArgs = false;
          break;
        }
      }
      if (matchingArgs) {
        return this.cachedPromises[id].promise as Promise<T>;
      }
    }
    // For simplicity delete any outdated cached promise.
    // In retrial scenarios (network errors), parameters are unlikely to change anyway.
    delete this.cachedPromises[id];
    // Run callback with expected arguments.
    const p = cb.apply(thisArg, args)
      .catch((error: Error) => {
        // On error, remove entry from cache.
        delete this.cachedPromises[id];
        throw error;
      });
    // Cache promise and its arguments.
    this.cachedPromises[id] = {
      promise: p,
      cb,
      thisArg,
      args: deepCopy(args),
      expirationTime: new Date().getTime() + duration,
    };
    // Return the promise.
    return p;
  }

  /**
   * Clears the cached result for the callback function. If no callback function is
   * specified, clears the whole cache.
   *
   * @param cb The optional callback function.
   */
  public clear(cb?: (...args) => Promise<any>) {
    if (typeof cb === 'undefined') {
      this.cachedPromises = {};
    } else {
      const id = (cb as any)._cid_;
      if (typeof id !== 'undefined') {
        delete this.cachedPromises[id];
      }
    }
  }
}
