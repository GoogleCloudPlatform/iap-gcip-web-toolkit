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
import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import App from './app';
import FirebaseUi from './firebaseui';
import PrivacyPolicy from './privacypolicy';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <div>
        <nav></nav>
        <Route path="/" exact component={FirebaseUi}></Route>
        <Route path="/custom" exact component={App}></Route>
        <Route path="/tos" exact component={PrivacyPolicy}></Route>
        <Route path="/privacypolicy" exact component={PrivacyPolicy}></Route>
      </div>
    </Router>
  );
}

export default AppRouter;
