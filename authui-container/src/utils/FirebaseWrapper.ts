/*
 * Copyright 2023 Google Inc. All Rights Reserved.
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

// tslint:disable-next-line:no-submodule-imports
import { initializeApp } from 'firebase/app';
// tslint:disable-next-line:no-submodule-imports
import { getAuth, getRedirectResult, reauthenticateWithPopup, signInWithRedirect } from 'firebase/auth';
import { getCredentialFromResult } from './index';
// This wrapper is primarily used in order to stub these methods during testing with sinon
// Sinon does not allow stubbing standalone functions. See https://github.com/sinonjs/sinon/issues/562
const firebaseWrapper = {
    _initializeApp: ((config) => {
        return initializeApp(config)
    }),

    _getAuth: ((app) => {
        return getAuth(app);
    }),
    _getRedirectResult: ((auth) => {
        return getRedirectResult(auth);
    }),
    _getCredentialFromResult: ((auth) => {
        return getCredentialFromResult(auth)
    }),
    _reauthenticateWithPopup: ((user, provider) => {
        return reauthenticateWithPopup(user, provider);
    }),
    _signInWithRedirect: ((auth, provider) => {
        return signInWithRedirect(auth, provider);
    })
  };

export default firebaseWrapper;