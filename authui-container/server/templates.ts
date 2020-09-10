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
<!DOCTYPE html>
<html>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/static/script.js" type="text/javascript"></script>
  <body>
    <div id="loading-spinner" class="d-flex justify-content-center">
      <div class="spinner-border text-secondary" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>
    <div class="main-container blend">
      <h4 id="tenant-header" class="heading-center">
      <span id="title"></span>
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
<!DOCTYPE html>
<html>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://unpkg.com/jsonlint@1.6.3/web/jsonlint.js"></script>
  <script src="/static/admin.js" type="text/javascript"></script>
  <body>
    <div id="loading-spinner" class="d-flex justify-content-center">
      <div class="spinner-border text-secondary" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>
    <div class="toast-container">
      <div class="toast" data-autohide="true" data-delay="5000">
        <div class="toast-header">
          <strong class="mr-auto" id="alert-status">Success</strong>
          <button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="toast-body" id="alert-message"></div>
      </div>
    </div>
    <div id="admin-container" style="display: none;">
      <h5 class="heading-center">Customize Authentication UI Configuration</h5>
      <form class="admin-form">
        <textarea rows="20" cols="70" class="config"></textarea><br>
        <button type="submit" class="btn btn-primary mb-2">Save</button>
        <button class="reauth btn btn-primary mb-2" style="display:none;">Reauthenticate</button>
      </form>
      <div title="Copy to clipboard" class="copy-btn copy-to-clipboard" style="display:none;" aria-label="Copy">
        <svg width="100%" height="100%" viewBox="0 0 18 18" fit=""
            preserveAspectRatio="xMidYMid meet" focusable="false">
          <path d="M10.5 7H8v7h5V7h-2.5zM3.99 2a1 1 0 0 0-.99.995V12h1.985V4h6.947V2H3.99zM6 5.996c0-.55.446-.996.998-.996h7.004c.55 0 .998.445.998.996v9.008c0 .55-.446.996-.998.996H6.998A.996.996 0 0 1 6 15.004V5.996z" fill-rule="evenodd">
          </path>
        </svg>
      </div>
    </div>
  </body>
</html>
`);

export {
  main,
  admin,
};
