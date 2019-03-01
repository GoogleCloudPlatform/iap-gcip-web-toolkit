/*
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

const jwt = require('jsonwebtoken');
const request = require('request');

/** IAP signed JWT algorithm. */
const ALGORITHM = 'ES256';
/** IAP signed JWT issuer URL. */
const ISSUER = 'https://cloud.google.com/iap';
/** IAP public keys URL. */
const PUBLIC_KEY_URL = 'https://www.gstatic.com/iap/verify/public_key';

/** Defines the IAP JWT verifier. */
class IapJwtVerifier {
  /**
   * Initializes an IAP JWT verifier.
   * @param {string} projectId
   * @param {string} projectNumber
   * @constructor
   */
  constructor(projectId, projectNumber) {
    /** @private {string} The project ID. */
    this.projectId = projectId;
    /** @private {string} The project number. */
    this.projectNumber = projectNumber;
  };

  /**
   * Verifies the IAP JWT.
   * @param {string} jwtToken The signed IAP JWT token to verify.
   * @return {Promise<!Object>} The decoded payload of the verified JWT.
   */
  verify(jwtToken) {
    let header;
    let payload;
    return Promise.resolve().then(() => {
      // For GAE: /projects/PROJECT_NUMBER/apps/PROJECT_ID
      const aud = `/projects/${this.projectNumber}/apps/${this.projectId}`;
      const fullDecodedToken = jwt.decode(jwtToken, {
        complete: true,
      });
      header = fullDecodedToken && fullDecodedToken.header;
      payload = fullDecodedToken && fullDecodedToken.payload;

      if (!fullDecodedToken) {
        throw new Error('Decoding the JWT failed.');
      } else if (typeof header.kid === 'undefined') {
        throw new Error('IAP JWT has no "kid" claim.');
      } else if (header.alg !== ALGORITHM) {
        throw new Error(`IAP JWT has incorrect algorithm. Expected ${ALGORITHM} algorithm but got ${header.alg}`);
      } else if (payload.aud !== aud) {
        throw new Error(`IAP JWT has incorrect audience. Expected ${aud} but got ${payload.aud}`);
      } else if (payload.iss !== ISSUER) {
        throw new Error(`IAP JWT has incorrect issuer. Expected ${ISSUER} algorithm but got ${payload.iss}`);
      } else if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new Error('IAP JWT has no valid "sub".')
      }
      return this.fetchPublicKey(header.kid);
    }).then((publicKey) => {
      return this.verifyJwtSignatureWithKey(jwtToken, publicKey);
    });
  }

  /**
   * @param {string} The kid whose public cert is to be returned.
   * @return {Promise<string>} A promise that resolves with the public key that the provided kid maps to.
   * @private
   */
  fetchPublicKey(kid) {
    if (typeof this.publicKeys !== 'undefined' &&
        this.publicKeys.hasOwnProperty(kid)) {
      return Promise.resolve(this.publicKeys);
    }
    return new Promise((resolve, reject) => {
      request({
        url: PUBLIC_KEY_URL,
        json: true
      }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          // Cache public keys.
          this.publicKeys = body;
          if (this.publicKeys.hasOwnProperty(kid)) {
            // Return the corresponding key.
            resolve(body[kid]);
          } else {
            reject('IAP JWT has "kid" claim which does not correspond to a known public key.');
          }
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Verifies the IAP token signature using the provided key.
   * @param {string} jwtToken The IAP token.
   * @param {string} publicKey The corresponding public key.
   * @return {Promise<!Object>} A promise that resolves with the decoded JWT claims.
   * @private
   */
  verifyJwtSignatureWithKey(jwtToken, publicKey) {
    return new Promise((resolve, reject) => {
      jwt.verify(jwtToken, publicKey, {
        algorithms: [ALGORITHM],
      }, (error, decodedToken) => {
        if (error) {
          if (error.name === 'TokenExpiredError') {
            return reject(new Error('IAP JWT is expired'));
          } else if (error.name === 'JsonWebTokenError') {
            return reject(new Error('IAP JWT has invalid signature'));
          }
          return reject(new Error(error.message));
        } else {
          resolve(decodedToken);
        }
      });
    });
  }
}

module.exports = IapJwtVerifier;
