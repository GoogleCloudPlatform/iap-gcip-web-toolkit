# Configuring IAP with a Single Federated non-Google Provider Using FirebaseUI

This sample walks you through deploying an App Engine flexible environment
application and securing it with
[Cloud Identity-Aware Proxy](https://cloud.google.com/iap/docs/external-identities)
(Cloud IAP) external identities, powered by
[Google Cloud Identity Platform](https://cloud.google.com/identity-platform/)
(GCIP). This sample will also work for a GCE or GKE IAP resource.

More specifically, this quickstart sample demonstrates using a federated provider
like Facebook to sign in to an IAP gated resource (GAE app). The same flow can be
applied for other federated providers (SAML, OIDC, OAuth, etc) with minimal
adjustments to the code.

This quickstart works for single project level IdP or single tenant level IdP.

## Table of Contents

1. [Dependencies](#dependencies)
2. [Prerequisite](#prerequisite)
3. [Enable GCIP](#enable-gcip)
4. [Deploy the authentication page](#deploy-the-authentication-page)
5. [Deploy to App Engine Flexible Environment](#deploy-to-app-engine-flexible-environment)
6. [Enable IAP](#enable-iap)
7. [Test Access](#test-access)

## Dependencies

To set up a development environment to build the sample from source, you must
have the following installed:

- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

Download the sample application source code and its dependencies with:

```bash
git clone https://github.com/GoogleCloudPlatform/iap-gcip-web-toolkit.git
cd iap-gcip-web-toolkit/sample/app
npm install
```

## Prerequisite
Create your project in the [Cloud Console](https://console.cloud.google.com).

You will need to create the GAE app, IAP and GCIP projects in the same Google
Cloud project. You cannot use cross project external identities with IAP.

## Enable Identity Platform

In order to use non-Google identities with IAP, Google Cloud Identity Platform
needs to be enabled. For this quickstart, Facebook provider needs to be configured
for this project. Go to the Identity Platform
[Cloud Console](https://console.cloud.google.com/customer-identity/providers/)
page to configure it.

OAuth callback URL should be set as instructed:
`https://firebase-project-id.firebaseapp.com/__/auth/handler`

[Multi-tenancy](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart)
is not required for this sample. However, the IdP can also be configured on
the tenant too for this quickstart. In that case, only one tenant should be
associated with the IAP resource.

## Deploy the authentication page

Note that it is not a requirement to have the same Firebase Hosting project
as your GCIP project. It is only done here for convenience. Firebase Hosting
is merely used as a static file hosting service here. However, if a different
project is used, the Firebase hosting domain has to be whitelisted in the GCIP
list of authorized domains.

Install all dependencies for the sample `AuthUI` in `iap-gcip-web-toolkit` repo.

```bash
cd sample/authui-firebaseui
npm install
```

(Optional) If you want to use a different provider (eg.
[SAML](https://cloud.google.com/identity-platform/docs/how-to-enable-application-for-saml)
or
[OIDC](https://cloud.google.com/identity-platform/docs/how-to-enable-application-for-oidc)),
change the following line in `sample/authui-firebaseui/src/script.ts`:

```javascript
// ...
signInOptions: [
  // Replace Facebook if you want to use a different IdP.
  // FacebookAuthProvider.PROVIDER_ID,
  {
    // Copy provider ID from the Cloud Console.
    provider: 'saml.myProvider', // or 'oidc.myProvider', etc.
  }
],
// ...
```

Install the Firebase command line tool with `npm install -g firebase-tools` (See
[docs](https://firebase.google.com/docs/cli/#setup)).

Deploy the sample app to one of your own Firebase Hosting instance:

```bash
firebase use --add
```

Select the project you have created in the prerequisite, and type in `default` or
any other name as the alias to use for this project.

To deploy the authentication UI to production, in the same directory
`sample/authui-firebaseui`, run:

```bash
npm run deploy
```

This will deploy the authentication UI to:
`https://firebase-project-id.firebaseapp.com`

You can use this URL as your authentication URL when configuring IAP.

## Deploy to App Engine Flexible Environment

Follow the instructions to [deploy your GAE application](../app/README.md).

## Enable IAP

- Go to the
  [IAP Cloud Console page](https://console.cloud.google.com/security/iap).
- If you don‘t already have an active project, you'll be prompted to
  select the project you want to secure with Cloud IAP. Select the project
  where your GAE IAP resource is configured. The same project that was used
  to configure GCIP must be used for enabling IAP.
- On the **Identity-Aware Proxy** page, under **HTTP Resource**, find the
  GAE app you want to restrict access to. The **Published** column shows the
  URL of the app. To turn on Cloud IAP for the app, click the **Switch**
  icon in the IAP column.
- Toggle the switch on. This will display the IAM side panel.
- To enable external identities, select the "Use external identities for
  authorization". Doing so will remove all existing access from the resource.
  The previous settings would be restored if you revert to IAM.
- If you have not already enabled GCIP, you will be prompted to do so.
- Identity Platform can now be configured for the selected resource. The
  following information needs to be provided in the Identity Platform panel
  - Authentication URL: This is the URL noted above. IAP will redirect to this
    address for unauthenticated requests to the current resource. This page needs
    to be configured to handle authentication. Follow the instructions above to
    configure that page.
  - Facebook should already be configured for this GCIP project. Select the
    project level Facebook IdP in the permissions section. If the IdP was
    configured on a GCIP tenant, the corresponding tenant should be selected
    instead from the list of tenants.
- Click **SAVE** and you are now ready to use external identities with IAP.

## Test access

- Go to `https://[YOUR_PROJECT_ID].appspot.com`. You should be redirected to
  Facebook to sign in.
- After sign-in, you should be redirected back to the original app and your
  user's profile populated and displayed.
- Click **Sign Out** link. You should be redirected back to Facebook to sign in.
