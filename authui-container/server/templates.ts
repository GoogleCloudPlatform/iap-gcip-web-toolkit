/*
 * Copyright 2020 Google Inc. All Rights Reserved.
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

import handlebars = require('handlebars');

/** Main template used for handling sign-in with IAP. */
const main = handlebars.compile(`
<html>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/static/script.js" type="text/javascript"></script>
  <body>
    <div class="main-container blend">
      <h4 id="tenant-header" class="heading-center">
      <span id="tid"></span>
      </h4>
      <div id="separator" style="display:none;">
        <div class="separator"><img id="logo" src="{{logo}}" style="max-width:64px;"></div>
      </div>
      <div id="firebaseui-container"></div>
    </div>
  </body>
</html>
`);

/**
 * Main template used for handling administrative functionality for customizing the
 * Auth UI configuration.
 */
const admin = handlebars.compile(`
<html>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/static/admin.js" type="text/javascript"></script>
  <body>
    <div style="position: fixed; top: 20; right: 20;">
      <div class="toast" style="position: absolute; top: 0; right: 0;"
          data-autohide="true" data-delay="5000">
        <div class="toast-header">
          <strong class="mr-auto" id="alert-status">Success</strong>
          <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="toast-body" id="alert-message"></div>
      </div>
    </div>
    <div class="main-container2" style="display: none;">
      <h5 id="tenant-header" class="heading-center">Customize Authentication UI Configuration</h5>
      <form id="admin-form">
        <textarea rows="20" cols="70" id="config"> </textarea><br>
        <button type="submit" class="btn btn-primary mb-2">Save</button>
        <button id="copy-to-clipboard" class="btn btn-primary mb-2">Copy to clipboard</button>
        <button id="reauth" class="btn btn-primary mb-2" style="display:none;">Reauthenticate</button>
      </form>
    </div>
  </body>
</html>
`);

export {
  main,
  admin,
};
