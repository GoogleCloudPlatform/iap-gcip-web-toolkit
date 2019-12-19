# Using IAP External Identities in App Engine

[IAP](https://cloud.google.com/iap/docs/external-identities) controls
access to your cloud applications and VMs running on Google Cloud.
By default, IAP uses Google identities and Cloud IAM. By leveraging
[Identity Platform](https://cloud.google.com/identity-platform/) instead,
you can authenticate users with a wide range of external identity providers,
such as OAuth (Google, Facebook, Twitter, Microsoft, Apple etc.), SAML,
OIDC, etc.

This sample app demonstrates how a [GAE](https://cloud.google.com/appengine/)
app can be gated with IAP external identities.

This app has to be used in conjunction with a hosted authentication page.
Sample authentication pages are available in this repo. The
[Configuring IAP with a Single Federated Provider](../authui-firebaseui/README.md)
quickstart demonstrates how to deploy the authentication URL as a proxy for
a single non-Google federated provider.
Learn more on how to
[enable external identities](https://cloud.google.com/iap/docs/enable-external-identities)
in IAP.

The sample app demonstrates the following concepts:

- IAP redirect to authentication page when no user is signed in.
- Parsing
  [IAP JWT](https://cloud.google.com/iap/docs/signed-headers-howto#jwts_for_external_identities)
  from the request header and verifying it.
- Inspecting underlying IAP and GCIP JWT payloads.
- Sign out from the current IAP resource.
- Switch currently signed in tenant (for multi-tenant resources).
- [Managing sessions](https://cloud.google.com/iap/docs/external-identity-sessions)
  beyond the one hour limit using an embedded session refresher hidden iframe.

The same concepts can be applied to other types of IAP resources.

## Table of Contents

1. [Dependencies](#dependencies)
2. [Prerequisite](#prerequisite)
3. [Deploy to App Engine Flexible Environment](#deploy-to-app-engine-flexible-environment)
4. [Enable GCIP](#enable-gcip)
5. [Deploy the authentication page](#deploy-the-authentication-page)
6. [Enable IAP](#enable-iap)
7. [Test access](#test-access)

## Dependencies

This app uses Google App Engine Node.js flexible envionment but any other GAE
supported language can be used. In addition, the same concepts can be applied
for non-GAE IAP resources, such as GCE or GKE.

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)
- [Google Cloud SDK](https://cloud.google.com/sdk/) which includes the
  `gcloud` command line tool.

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

## Deploy to App Engine Flexible Environment

To deploy the sample app to Google App Engine flexible environment, follow the
following instructions:

- Run the following `gcloud` CLI command to configure your GCP project for the
  sample app. Make sure you select the project you created above.

  ```bash
  gcloud init
  ```

- Deploy the sample app by running the following in the root folder.

  ```bash
  npm run deploy
  ```

  This will launch the default GAE service `https://[YOUR_PROJECT_ID].appspot.com`.

  To learn more about Google App Engine Node.js flexible envionment, refer to
  the
  [online documentation](https://cloud.google.com/appengine/docs/flexible/nodejs/).

## Enable Identity Platform

In order to use non-Google identities with IAP,
[Google Cloud Identity Platform] (https://cloud.google.com/identity-platform/)
needs to be enabled, multi-tenancy enabled on that project if needed, and the corresponding IdPs configured.

- Go to the
  [Identity Platform Cloud Console page](https://console.cloud.google.com/customer-identity/providers).
- If you plan to use one or more GCIP tenant with an IAP resource, you will need
  to enable GCIP multi-tenancy and configure IdPs for the created tenants. To
  learn more about this, follow the
  [Getting started with multi-tenancy](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart)
  instructions. If you plan to use project level IdPs without resource isolation,
  you can skip this step and just configure your IdPs at the project level.

## Deploy the authentication page
- For a quick authentication page with a single federated provider,
  follow the instructions in [../authui-firebaseui](../authui-firebaseui/README.md).
  For more advanced usage of sample authentication UIs with Angular or React,
  refer to [../authui/README.md](../authui/README.md) or
  [../authui-react/README.md](../authui-react/README.md).

- Take note of the URL where the authentication page is deployed.

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
  - Authentication URL: IAP will redirect to this address for unauthenticated
    requests to the current resource. This page still needs to be configured
    to handle authentication.
  - The GCIP tenants to associate with this resource. You can either select
    the current GCIP project and all the project-level IdPs or associate
    tenant-level IdPs with this resource. This will display the existing
    tenants and IdPs previously configured. You can always manage tenants and
    their identity providers from the Identity Platform Console UI, add or
    remove providers, etc.
- Click **SAVE** and you are now ready to use external identities with IAP.

## Test access

- After configuring the authentication URL and registering it with IAP. Go to
  `https://[YOUR_PROJECT_ID].appspot.com`.
  You should be redirected to the authentication page and prompted to sign in.

- Sign-in with GCIP. You should be redirected back to previous page and your
  user's profile populated from the underlying GCIP ID token.

- Click **Sign Out** link. You should be redirected back to the authentication
  page. If you have configured the IAP resource with multiple tenants, you
  can also use the **Switch Tenant** link to sign in with a different tenant
  without having to sign out from the existing tenant.
