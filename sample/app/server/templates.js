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

const HandleBars = require('handlebars');

/** Main template used for resource specific user profile. */
const main = HandleBars.compile(`
<html>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tenant {{tenandId}}</title>
  <link href="/styles/style.css" rel="stylesheet" type="text/css"  media="screen" />
  <body>
    <div id="container">
      <h3>Welcome to IAP/CICP integration sample app</h3>
      <div id="main">
        <div id="user-info">
          {{#if photoURL}}
          <div id="photo-container">
            <imd id="photo" src="{{photoURL}}">
          </div>
          {{/if}}
          <div id="sub">{{sub}}</div>
          <div id="name">{{displayName}}</div>
          <div id="email">
            {{email}} (
            {{#if emailVerified}}
              Verified
            {{else}}
              Unverified
            {{/if}}
            )
          </div>
          <div id="tenant">{{tenandId}}</div>
          <div class="claims">
            <pre id="cicp-claims">{{cicpClaims}}</pre>
          </div>
          <div class="claims">
            <pre id="iap-claims">{{iapClaims}}</pre>
          </div>
          <div class="clearfix"></div>
        </div>
        <p>
          <a id="sign-out" href="{{signoutURL}}">Sign Out</a>
        </p>
      </div>
    <div>
  </body>
</html>
`);

module.exports = {
  main,
};