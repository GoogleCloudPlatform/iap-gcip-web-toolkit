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

const request = require('request');
const IapJwtVerifier = require('./verify-iap-jwt');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const templates = require('./templates');

// Useful links:
// https://cloud.google.com/iap/docs/signed-headers-howto
// https://cloud.google.com/iap/docs/identity-howto
// https://cloud.google.com/appengine/docs/standard/nodejs/quickstart
// https://cloud.google.com/iap/docs/app-engine-quickstart

/** Metadata service url for getting project number. */
const PROJECT_NUMBER_URL = 'http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id';
/** Injected IAP JWT header name. */
const IAP_JWT_HEADER = 'x-goog-iap-jwt-assertion';
/** IAP JWT verifier. */
const jwtVerifierPromise = getProjectNumber().then((projectNumber) => {
  return new IapJwtVerifier(process.env.GOOGLE_CLOUD_PROJECT, projectNumber);
});

/** @return {Promise<string>} A promise that resolves with the project number. */
function getProjectNumber() {
  return new Promise((resolve, reject) => {
    request({
      url: PROJECT_NUMBER_URL,
      json: false
    }, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        resolve(body);
      } else {
        reject(error || new Error('Unable to retrieve project number'));
      }
    });
  });
}

/**
 * Renders the resource profile page and serves it in the response.
 * @param {function(!Object): string} template The template generating function.
 * @param {!Object} req The expressjs request.
 * @param {!Object} res The expressjs response.
 * @param {*} decodedClaims The decoded claims from verified IAP JWT.
 * @return {!Promise} A promise that resolves on success.
 */
function serveContentForUser(template, req, res, decodedClaims) {
  // Still subject to change.
  const cicpClaims = JSON.parse(decodedClaims.firebase);
  res.set('Content-Type', 'text/html');
  res.end(template({
    sub: decodedClaims.sub,
    email: decodedClaims.email,
    tenandId: cicpClaims.tenant,
    cicpClaims: JSON.stringify(cicpClaims, null, 2),
    iapClaims: JSON.stringify(decodedClaims, null, 2),
    signoutURL: './_gcp_iap/cicp_signout',
  }));
}

/**
 * Checks if a user is signed in. If not, shows an error message.
 * @return {function()} The middleware function to run.
 */
function checkIfSignedIn() {
  return (req, res, next) => {
    // Allow access only if user is signed in.
    const iapToken = req.headers[IAP_JWT_HEADER] || '';
    // Get JWT verifier.
    jwtVerifierPromise.then((jwtVerifier) => {
      jwtVerifier.verify(iapToken).then((decodedClaims) => {
        req.claims = decodedClaims;
        next();
      }).catch((error) => {
        res.status(503).send('403: Permission defined!');
      });
    });
  };
}

// Support JSON-encoded bodies.
app.use(bodyParser.json());
// Support URL-encoded bodies.
app.use(bodyParser.urlencoded({
  extended: true
}));
// Show error message if user is not signed in.
app.use(checkIfSignedIn());
// Static CSS assets.
app.use('/styles', express.static('styles'));

app.get('/', (req, res) => {
  res.redirect('/resource1');
});

/** Get the resource1 endpoint. This will map with one tenant. */
app.get('/resource1', (req, res) => {
  // Serve content for signed in user.
  return serveContentForUser(templates.main, req, res, req.claims);
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});