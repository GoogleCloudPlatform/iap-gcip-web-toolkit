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

import { expect } from 'chai';
import { MainPage } from './webdriver/main-page';
import { FirebaseUiPage } from './webdriver/firebaseui-page';
import { AppPage } from './webdriver/app-page';
import * as admin from 'firebase-admin';
import {random} from 'lodash';
import client = require('firebase-tools');
import {URL} from 'url';
import request = require('request');

let deleteQueue = Promise.resolve();

/**
 * Deploys the Auth UI sample app with the latest changes to Firebase Hosting.
 * @param credential The service account credential.
 * @param projectId The project ID.
 * @return A promise that resolves after successful deployment to Firebase Hosting.
 */
function deployAuthUi(credential: admin.credential.Credential, projectId: string): Promise<void> {
  return credential.getAccessToken().then((googleOAuthAccessToken) => {
    // Deploy sample authui app to Firebase Hosting.
    return client.deploy({
      project: projectId,
      token: googleOAuthAccessToken.access_token,
      force: true,
      cwd: './sample/authui',
    });
  });
}

/**
 * Generates a random string of the specified length using alphanumeric characters.
 *
 * @param length The length of the string to generate.
 * @return A random string of the provided length.
 */
function generateRandomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += alphabet.charAt(random(alphabet.length - 1));
  }
  return text;
}

describe('GCIP/IAP sign-in automated testing', () => {
  describe('Using IAP resource configured with 3P Auth project level IdPs', () => {
    const uids = [];
    const serviceAccount = require('../resources/key.json');
    const projectId = serviceAccount.project_id;
    const appUrl = `https://${projectId}.appspot.com`;
    const credential = admin.credential.cert(serviceAccount);
    const signInUrl = `https://${projectId}.firebaseapp.com`;
    const app = admin.initializeApp({
      credential,
    }, 'project-level');
    const mainPage = new MainPage(appUrl);

    before(() => {
      return deployAuthUi(credential, projectId);
    });

    after(() => {
      // Delete all temporary users.
      return cleanup(app, uids).then(() => {
        // Delete Admin instance.
        return app.delete();
      }).then(() => {
        return mainPage.quit();
      });
    });

    it('should handle sign-in and sign-out successfully for custom UI', () => {
      let appPage: AppPage;
      let currentUid: string;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);
      // Create a temporary user.
      return app.auth().createUser({email, password})
        .then((userRecord) => {
          currentUid = userRecord.uid;
          uids.push(userRecord.uid);
          // Visit the GAE app.
          // The application has to be configured with IAP already.
          // In addition, the GAE app has to have been deployed already.
          return mainPage.start();
        })
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Get the original URL.
          return mainPage.getOriginalUrl();
        })
        .then((originalUrl) => {
          // Confirm original URL is the expected app URL that was originally visited.
          expect(originalUrl).to.equal(`${appUrl}/`);
          // Start sign in with email.
          return mainPage.startSignInWithEmail();
        })
        .then(() => {
          return mainPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          return mainPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return mainPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.be.undefined;
          expect(results.email).to.equal(`securetoken.google.com/${projectId}:${email}`);
          expect(results.sub).to.equal(`securetoken.google.com/${projectId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });

    it('should handle sign-in and sign-out successfully for FirebaseUI', () => {
      let appPage: AppPage;
      let currentUid: string;
      let firebaseuiPage: FirebaseUiPage;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);
      // Create a temporary user.
      return app.auth().createUser({email, password})
        .then((userRecord) => {
          currentUid = userRecord.uid;
          uids.push(userRecord.uid);
          // Visit the GAE app.
          // The application has to be configured with IAP already.
          // In addition, the GAE app has to have been deployed already.
          return mainPage.start();
        })
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Redirect to FirebaseUI page.
          return mainPage.getFirebaseUiPage();
        })
        .then((page) => {
          firebaseuiPage = page;
          // Start sign in with email.
          return firebaseuiPage.startSignInWithEmail();
        })
        .then(() => {
          // Enter email and click next button.
          return firebaseuiPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          // Enter password and click sign in button.
          return firebaseuiPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return firebaseuiPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.be.undefined;
          expect(results.email).to.equal(`securetoken.google.com/${projectId}:${email}`);
          expect(results.sub).to.equal(`securetoken.google.com/${projectId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });
  });

  describe('Using IAP resource configured with 3P Auth single tenant level IdPs', () => {
    let tenantId: string;
    const uids = [];
    const serviceAccount = require('../resources/key_single_tenant.json');
    const projectId = serviceAccount.project_id;
    const appUrl = `https://${projectId}.appspot.com`;
    const credential = admin.credential.cert(serviceAccount);
    const signInUrl = `https://${projectId}.firebaseapp.com`;
    const app = admin.initializeApp({
      credential,
    }, 'single-tenant-level');
    const mainPage = new MainPage(appUrl);

    before(() => {
      return deployAuthUi(credential, projectId);
    });

    after(() => {
      // Delete all temporary users.
      return cleanup(app, uids, tenantId).then(() => {
        // Delete Admin instance.
        return app.delete();
      }).then(() => {
        return mainPage.quit();
      });
    });

    it('should handle sign-in and sign-out successfully for custom UI', () => {
      let appPage: AppPage;
      let currentUid: string;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);

      // Visit the GAE app.
      // The application has to be configured with IAP already.
      // In addition, the GAE app has to have been deployed already.
      return mainPage.start()
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Get Tenant ID and create user for that tenant.
          const queryParams = url.searchParams;
          tenantId = queryParams.get('tid');
          expect(tenantId).to.not.be.undefined;
          // Get the original URL.
          return mainPage.getOriginalUrl();
        })
        .then((originalUrl) => {
          // Confirm original URL is the expected app URL that was originally visited.
          expect(originalUrl).to.equal(`${appUrl}/`);
          // Create a temporary user.
          return app.auth()
            .tenantManager()
            .authForTenant(tenantId)
            .createUser({email, password});
        })
        .then((userRecord) => {
          uids.push(userRecord.uid);
          currentUid = userRecord.uid;
          // Start sign in with email.
          return mainPage.startSignInWithEmail();
        })
        .then(() => {
          return mainPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          return mainPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return mainPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.equal(tenantId);
          expect(results.email).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${email}`);
          expect(results.sub).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });

    it('should handle sign-in and sign-out successfully for FirebaseUI', () => {
      let appPage: AppPage;
      let currentUid: string;
      let firebaseuiPage: FirebaseUiPage;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);
      // Visit the GAE app.
      // The application has to be configured with IAP already.
      // In addition, the GAE app has to have been deployed already.
      return mainPage.start()
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Get Tenant ID and create user for that tenant.
          const queryParams = url.searchParams;
          tenantId = queryParams.get('tid');
          expect(tenantId).to.not.be.undefined;
          // Create a temporary user.
          return app.auth()
            .tenantManager()
            .authForTenant(tenantId)
            .createUser({email, password});
        })
        .then((userRecord) => {
          currentUid = userRecord.uid;
          uids.push(userRecord.uid);
          // Redirect to FirebaseUI page.
          return mainPage.getFirebaseUiPage();
        })
        .then((page) => {
          firebaseuiPage = page;
          // Start sign in with email.
          return firebaseuiPage.startSignInWithEmail();
        })
        .then(() => {
          // Enter email and click next button.
          return firebaseuiPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          // Enter password and click sign in button.
          return firebaseuiPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return firebaseuiPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.equal(tenantId);
          expect(results.email).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${email}`);
          expect(results.sub).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });
  });

  describe('Using IAP resource configured with 3P Auth multi-tenant level IdPs', () => {
    let tenantId: string;
    const uids = [];
    const serviceAccount = require('../resources/key_multi_tenant.json');
    const projectId = serviceAccount.project_id;
    const appUrl = `https://${projectId}.appspot.com`;
    const credential = admin.credential.cert(serviceAccount);
    const signInUrl = `https://${projectId}.firebaseapp.com`;
    const app = admin.initializeApp({
      credential,
    }, 'multi-tenant-level');
    const mainPage = new MainPage(appUrl);

    before(() => {
      return deployAuthUi(credential, projectId);
    });

    after(() => {
      // Delete all temporary users.
      return cleanup(app, uids, tenantId).then(() => {
        // Delete Admin instance.
        return app.delete();
      }).then(() => {
        return mainPage.quit();
      });
    });

    it('should handle sign-in and sign-out successfully for custom UI', () => {
      let appPage: AppPage;
      let currentUid: string;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);

      // Visit the GAE app.
      // The application has to be configured with IAP already.
      // In addition, the GAE app has to have been deployed already.
      return mainPage.start()
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to tenant selection page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          const queryParams = url.searchParams;
          expect(queryParams.get('mode')).to.equal('selectAuthSession');
          // Get the original URL.
          return mainPage.getOriginalUrl();
        })
        .then((originalUrl) => {
          // Confirm original URL is the expected app URL that was originally visited.
          expect(originalUrl).to.equal(`${appUrl}/`);
          // Select the second visible tenant.
          return mainPage.selectTenant(1);
        })
        .then((selectedTenantId) => {
          tenantId = selectedTenantId;
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page for that tenant.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Confirm tenant ID and create user for that tenant.
          const queryParams = url.searchParams;
          expect(queryParams.get('mode')).to.equal('login');
          expect(queryParams.get('tid')).to.equal(tenantId);
          expect(tenantId).to.not.be.undefined;
          // Create a temporary user.
          return app.auth()
            .tenantManager()
            .authForTenant(tenantId)
            .createUser({email, password});
        })
        .then((userRecord) => {
          uids.push(userRecord.uid);
          currentUid = userRecord.uid;
          // Start sign in with email.
          return mainPage.startSignInWithEmail();
        })
        .then(() => {
          return mainPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          return mainPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return mainPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.equal(tenantId);
          expect(results.email).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${email}`);
          expect(results.sub).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });

    it('should handle sign-in and sign-out successfully for FirebaseUI', () => {
      let appPage: AppPage;
      let currentUid: string;
      let firebaseuiPage: FirebaseUiPage;
      const email = `user_${generateRandomString(20).toLowerCase()}@example.com`;
      const password = generateRandomString(10);
      // Visit the GAE app.
      // The application has to be configured with IAP already.
      // In addition, the GAE app has to have been deployed already.
      return mainPage.start()
        .then(() => {
          return mainPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          const queryParams = url.searchParams;
          expect(queryParams.get('mode')).to.equal('selectAuthSession');
          return mainPage.getFirebaseUiPage();
        })
        .then((page) => {
          firebaseuiPage = page;
          // Select the second visible tenant.
          return firebaseuiPage.selectTenant(1);
        })
        .then((selectedTenantId) => {
          tenantId = selectedTenantId;
          // Wait for provider sign-in page to be displayed and then verify
          // the sign-in URL.
          return firebaseuiPage.startSignInWithEmail();
        })
        .then(() => {
          return firebaseuiPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Should be redirected to sign-in page for that tenant.
          const url = new URL(currentUrl);
          expect(url.protocol + '//' + url.hostname).to.equal(signInUrl);
          // Confirm tenant ID and create user for that tenant.
          const queryParams = url.searchParams;
          expect(queryParams.get('mode')).to.equal('login');
          expect(queryParams.get('tid')).to.equal(tenantId);
          expect(tenantId).to.not.be.undefined;
          // Create a temporary user.
          return app.auth()
            .tenantManager()
            .authForTenant(tenantId)
            .createUser({email, password});
        })
        .then((userRecord) => {
          uids.push(userRecord.uid);
          currentUid = userRecord.uid;
          // Enter email and click next button.
          return firebaseuiPage.inputEmailAndSubmit(email);
        })
        .then(() => {
          // Enter password and click sign in button.
          return firebaseuiPage.inputPasswordAndSignIn(password);
        })
        .then(() => {
          return firebaseuiPage.getAppPage();
        })
        .then((page) => {
          appPage = page;
          return appPage.getSignInResult();
        })
        .then((results) => {
          // Confirm user signed and IAP token issued with gcip claims.
          expect(results.gcip).to.not.be.undefined;
          expect(results.gcip.firebase).to.not.be.undefined;
          expect(results.gcip.firebase.identities).to.not.be.undefined;
          expect(results.gcip.firebase.identities.email).to.not.be.undefined;
          expect(results.gcip.email).to.equal(email);
          expect(results.gcip.firebase.identities.email[0]).to.equal(email);
          expect(results.gcip.firebase.sign_in_provider).to.equal('password');
          expect(results.gcip.firebase.tenant).to.equal(tenantId);
          expect(results.email).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${email}`);
          expect(results.sub).to.equal(
              `securetoken.google.com/${projectId}/${tenantId}:${currentUid}`);
          expect(results.iss).to.equal('https://cloud.google.com/iap');
          return appPage.getCurrentUrl();
        })
        .then((currentUrl) => {
          // Original URL should be redirected to.
          expect(currentUrl).to.equal(`${appUrl}/resource`);
          return appPage.clickSignOutAndWaitForRedirect(signInUrl);
        });
    });
  });
});

/**
 * Runs cleanup routine that could affect outcome of tests and removes any
 * intermediate users created.
 * @param app The admin SDK instance.
 * @param uids The list of uids to delete.
 * @param tenantId The corresponding tenant ID that the user belongs to if available.
 * @return A promise that resolves when the cleanup routine is completed.
 */
function cleanup(
    app: admin.app.App, uids: string[], tenantId: string | null = null): Promise<void[]> {
  const promises: Array<Promise<void>> = [];
  uids.forEach((uid) => {
    // Use safeDelete to avoid getting throttled.
    promises.push(safeDelete(app, uid, tenantId));
  });
  return Promise.all(promises);
}

/**
 * Safely deletes a specificed user identified by uid. This API chains all delete
 * requests and throttles them as the Auth backend rate limits this endpoint.
 * A bulk delete API is being designed to help solve this issue.
 *
 * @param app The admin SDK instance.
 * @param uid The identifier of the user to delete.
 * @param tenantId The corresponding tenant ID that the user belongs to if available.
 * @return A promise that resolves when delete operation resolves.
 */
function safeDelete(
    app: admin.app.App, uid: string, tenantId: string | null = null): Promise<void> {
  // Wait for delete queue to empty.
  const deletePromise = deleteQueue
    .then(() => {
      if (tenantId) {
        return app.auth()
          .tenantManager()
          .authForTenant(tenantId)
          .deleteUser(uid);
      } else {
        return app.auth().deleteUser(uid);
      }
    })
    .catch((error) => {
      // Suppress user not found error.
      if (!error || error.code !== 'auth/user-not-found') {
        throw error;
      }
    });
  // Suppress errors in delete queue to not spill over to next item in queue.
  deleteQueue = deletePromise.catch((error) => {
    // Do nothing.
  });
  return deletePromise;
}
