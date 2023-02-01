# Configuring Authentication UI for IAP External Identities (Angular)

This sample walks you through how to secure an application with
[Cloud Identity-Aware Proxy](https://cloud.google.com/iap/docs/external-identities)
(Cloud IAP) external identities by hosting an authentication UI, powered by
[Google Cloud Identity Platform](https://cloud.google.com/identity-platform/)
(GCIP). This sample will also work for a GAE, GCE or GKE IAP resource.

The sample app provides guidelines on how to build the required authentication
UI using either
[FirebaseUI](https://github.com/firebase/firebaseui-web/tree/master/firebaseuihandler)
or a custom authentication UI using the [Angular](https://angular.io/) framework
and the [Bootstrap](https://getbootstrap.com/) front-end component library,
and host it with [Firebase Hosting](https://firebase.google.com/docs/hosting).
In addition, it exposes the capabilities provided by the `gcip-iap`
module, such as the ability to look up the original URL the user was
visiting before getting redirected to the authentication UI.

You are not required to use the above frameworks when building the
authentication UI and there are no restrictions on the service used to
host this page. The frameworks and hosting service used in this sample app
have been chosen only for convenience. A similar sample authentication UI is
provided using the [ReactJS framework](../authui-react/README.md).

The provided sample authentication UI is compatible with the different
[tenant](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart)
hierarchy structures that
[IAP supports](https://cloud.google.com/iap/docs/external-identities#multi-tenancy).

- **No tenants**: The sample authentication UI requires Email/Password, Google
  or a Facebook IdP to be enabled as project-level IdPs in GCIP.
- **One tenant per resource**: The sample authentication UI requires
  Email/Password or a SAML provider configure on the associated GCIP tenant.
- **Multiple tenants per resource**: The sample authentication UI requires
  Email/Password or a SAML provider configure on the associated GCIP tenants.

The sample authentication UI can be modified to support other combinations of
identity providers.

## Table of Contents

1. [Prerequisite](#prerequisite)
1. [Enable Identity Platform](#enable-identity-platform)
1. [Installation](#installation)
1. [Configure the authentication URL](#configure-the-authentication-url)
1. [Configure Firebase Hosting](#configure-firebase-hosting)
1. [Deploy the authentication page](#deploy-the-authentication-page)
1. [Configure the app](#configure-the-app)
1. [Enable IAP](#enable-iap)
1. [Test access](#test-access)

## Prerequisite

Create your project in the [Cloud Console](https://console.cloud.google.com).

You will need to create the app (GAE, GCE or GKE), IAP and GCIP projects in
the same Google Cloud project. You cannot use cross project external
identities with IAP.

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
- For this sample app specifically, the following IdPs need to be configured
  depending on your setup:
  - No tenants: Email/password, Google or Facebook project-level IdPs.
  - Single tenant: Single tenant-level email/password or SAML IdPs.
  - Multiple tenants: More than one tenant needs to be configured with an
    email/password or SAML IdP.

## Installation

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 10.0.0)
- npm (should be included with Node.js)

Download the sample application source code:

```bash
git clone https://github.com/GoogleCloudPlatform/iap-gcip-web-toolkit.git
```

Install the sample authentication app:

```bash
cd iap-gcip-web-toolkit/sample/authui
npm install
```

## Configure the authentication URL

The provided sample authentication UI provides 2 flavors of how an authentication
UI can be built for supporting external identities with IAP.
Both implementations are compatible with the different
[tenant](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart)
hierarchy structures that
[IAP supports](https://cloud.google.com/iap/docs/external-identities#multi-tenancy).

- **Using FirebaseUI**
  [FirebaseUI](https://github.com/firebase/firebaseui-web), makes it easy
  to build an authentication page for using external identities with IAP by
  providing an implementation of the `AuthenticationHandler` required by the
  `gcip-iap` module.

  In order to use this flow with your configured tenants/identity providers,
  you will need to substitute the tenant ID/IdP configurations in the
  required `tenantsConfig` object in `src/app/firebaseui.component.ts`.

  This page will be accessible via `/` URL path. For further `firebaseui`
  customization and documentation, refer to the
  [public references]((https://github.com/firebase/firebaseui-web/tree/master/firebaseuihandler).

- **Using a custom UI**
  The `gcip-iap` library defines an interface `AuthenticationHandler` that can
  be implemented to handle UI customizations for the above operations. A custom
  implementation of the `AuthenticationHandler` interface is provided in this
  sample app.

  When configured with a single or multi-tenant hierarchy, the
  `SAML_PROVIDER_ID` constant in `src/app/app.component.ts`
  identifying the SAML provider configured for the IAP resource tenant will
  need to be updated.

  This page will be accessible via `/custom` URL path.
  [Learn more](../../README.md#create-your-own-custom-authentication-ui)
  on how to build a custom UI with `gcip-iap` NPM module.

For modifying the sample authentication to use either the `FirebaseUI` or the
custom authentication, additional changes will be needed:

- The navbar link needs to be removed from the custom authentication UI.
- The `appRoutes` need to be modified in `src/app/app.module.ts` to
  reflect the implementation used.

## Configure Firebase Hosting

Install the Firebase command line tool with `npm install -g firebase-tools` (See
[docs](https://firebase.google.com/docs/cli/#setup)).

If you are doing this for the first time, you may want to login first with your google account.

```bash
firebase login
```

Deploy the sample app to one of your own Firebase Hosting instance,
configure it using the following command:

```bash
firebase use --add
```

Select the project you have created in the prerequisite, and type in `default` or
any other name as the alias to use for this project.

Note that it is not a requirement to have the same Firebase Hosting project
as your GCIP project. It is only done here for convenience. Firebase Hosting
provisions a unique domain `project-id.firebaseapp.com` that is already
whitelisted by the corresponding GCIP project.
In addition, Firebase Hosting automatically sets the project configuration
`apiKey`, `authDomain` in a well known JSON path `/__/firebase/init.json`
avoiding the need to hardcode them in the app.

Firebase Hosting is merely used as a static file hosting service here.
However, if a different project is used, the Firebase hosting domain has to be
whitelisted in the GCIP list of authorized domains.

## Deploy the authentication page

While the authentication UI can be deployed locally to `http://localhost:5000`
by running `npm run start` in the same directory `sample/authui`,
it is not usable for authentication without the the necessary URL
query parameters automatically appended after an IAP authentication
redirect:

To deploy the authentication UI to production, in the same directory
`sample/authui`, run:

```bash
npm run deploy
```

This will deploy the authentication UI:
- Using the FirebaseUI implementation:
  `https://firebase-project-id.firebaseapp.com`
- Using a custom UI implementation:
  `https://firebase-project-id.firebaseapp.com/custom`

You can use either URL as your authentication URL when enabling IAP.
You can also switch from the custom UI implementation to `FirebaseUI` by
clicking the `Switch to FirebaseUI` link in the custom authentication UI
page header.

## Configure the app

You are now ready to [deploy your application](../app/README.md).
For simplicity, a GAE app is used to demonstrate usage with an IAP
resource but the authentication UI is agnostic of the underlying app type
(GCE, GKE).

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
    requests to the current resource. Use one of the 2 authentication URLs
    configured above: `https://firebase-project-id.firebaseapp.com` or
    `https://firebase-project-id.firebaseapp.com/custom`.
  - The GCIP tenants to associate with this resource. You can either select
    the current GCIP project and all its IdPs or associate tenant-level IdPs
    with this resource. This will display the existing tenants and IdPs
    previously configured. You can always manage tenants and their identity
    providers from the Identity Platform Console UI, add or remove providers,
    etc.
- Click **SAVE** and you are now ready to use external identities with IAP.

## Test access

- After configuring the authentication URL and registering it with IAP, for
  GAE apps, navigate to
  `https://[YOUR_PROJECT_ID].appspot.com`.
  You should be redirected to the configured authentication URL and prompted
  to sign in.

- Sign in with GCIP. You should be redirected back to previous page and your
  user's profile populated from the underlying GCIP ID token.

- Click **Sign Out** button. You should be redirected back to the authentication
  page. If you have configured the IAP resource with multiple tenants, you
  can also use the **Switch Tenant** link to sign in with a different tenant
  Without having to sign out from the existing tenant.
