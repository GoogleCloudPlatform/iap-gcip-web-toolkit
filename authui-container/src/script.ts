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

import '../node_modules/bootstrap/dist/css/bootstrap.min.css';
import '../node_modules/firebaseui/dist/firebaseui.css';
import '../public/style.css';
import './polyfill';

import { SignInUi } from './sign-in-ui';
import { onDomReady } from './utils/index';

// The query selector where then sign-in UI will be rendered.
const UI_ELEMENT_SELECTOR = '#firebaseui-container';

// When document is ready, initialize and render the SignInUi.
onDomReady(document)
  .then(() => {
    const ui = new SignInUi(UI_ELEMENT_SELECTOR);
    return ui.render();
  });
