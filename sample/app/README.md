# GAE app gated by IAP/CICP Quickstart

This sample app demonstrates how a GAE app can be gated by IAP with CICP
authenticated users.

Note this app has to be used in conjunction with an authentication page
using CICP/IAP JS module along with Firebase Auth/FirebaseUI. The latter
can be hosted independently on a different domain.

## Table of Contents

1. [Developer Setup](#developer-setup)
  1. [Dependencies](#dependencies)
  2. [Configuring the app](#configuring-the-app)
  3. [Deploy to App Engine Flexible Environment](#deploy-to-app-engine-flexible-environment)
  4. [Enable CICP](#enable-cicp)
  5. [Deploy the authentication page](#deploy-the-authentication-page)
  6. [Enable IAP](#enable-iap)
  7. [Test access](#test-access)

## Developer Setup

### Dependencies

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

Download the sample application source and its dependencies with:

```bash
git clone sso://team/cicp-eng/cicp-iap-js
cd cicp-iap-js/sample/app
npm install
```

### Configuring the app

Create your project in the [Cloud Console](https://console.cloud.google.com).

You will need to create the GAE app, the IAP and CICP projects in the
same Google Cloud project.

TODO: provide instructions on full developer journey.

### Deploy to App Engine Flexible Environment

To deploy the same app to Google App Engine flexible environment, follow the
following instructions:

- Create a GCP project in the [Google Cloud Console](https://console.cloud.google.com/).
- Run the following command in the root folder to configure your GCP project
  for the sample app. Make sure you select the project you created above.

  ```bash
  gcloud init
  ```

- Deploy the sample app by running the following in the root folder.

  ```bash
  gcloud app deploy
  ```
  This will launch your sample app at `http://[YOUR_PROJECT_ID].appspot.com`.

  To learn more about Google App Engine Node.js flexible envionment, refer to
  the
  [online documentation](https://cloud.google.com/appengine/docs/flexible/nodejs/).

### Enable CICP
- Go to the
  [CICP Cloud Console page](https://pantheon.corp.google.com/customer-identity/providers).

- Enable CICP multi-tenancy (UI not yet available).

- Create a CICP tenant with various identity providers. You can
  do this using the Firebase Admin SDK multi-tenancy management API currently
  under development.

- Take note of the tenant ID.

### Deploy the authentication page
- Follow the instruction to deploy the authentication page in
  [../authui/README.md](../authui/README.md).

- Take note of the URL where the authentication page is deployed.

### Enable IAP
The following instructions are not yet finalized and subject to change.

- Go to the
  [IAP Cloud Console page](https://console.cloud.google.com/security/iap).

- If you don't already have an active project, you'll be prompted to select
  the project you want to secure with Cloud IAP. Select the project to which
  you deployed the sample application.

- On the **Identity-Aware Proxy** page, under **Resource**, find the App
  Engine app you want to restrict access to. The **Published** column shows
  the URL of the app. To turn on Cloud IAP for the app, click the **Switch**
  icon in the IAP column.

- Click **TURN ON**. So far, accessing this application will require google
  identity authentiation.

- In alpha, customers need to provide the following information which IAP will
  store for the application:
  - Application identifier
    - For GAE, use the project ID.
    - For GCE backend service, use the backend service ID
      - To get the backend service ID, run:
        `gcloud compute backend-services describe BACKEND_SERVICE_NAME`
  - Tenant ID created in CICP, eg. `tenant1` created above.
  - The authentication URL noted in the previous step. This should be in the
    format: `https://firebase-project-id.firebaseapp.com/?apiKey=[API_KEY].
    The API key can be obtained from the CICP console **setup details** snippet.

- Once IAP team whitelists the application with the provided information above,
  the application will start to apply the authentication configured in CICP.

- Click **TURN ON**

### Test access

- Go to `https://project-id.appspot.com/resource1`. You should be redirected
  to the CICP sign-in page to sign-in. Providers configured for `tenant1`
  should be displayed.

- Sign-in with CICP. You should be redirected back to previous page and your
  `tenant1` user's profile populated.

- Click **Sign Out** button. You should be redirected back to the CICP
  sign-in page.
