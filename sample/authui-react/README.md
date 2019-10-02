# GCIP/IAP Authentication UI Quickstart (React)

This sample demonstrates how to integrate a GCIP authentication UI with
a GAE application gated with Cloud IAP using React JS framework.
While this sample is hosted with Firebase Hosting, it could be hosted
using any other service. Firebase Hosting was chosen to demonstrate cross
domain authentication and the ability to use the same authentication UI with
multiple IAP resources.

## Table of Contents

1. [Prerequisite](#prerequisite)
2. [Installation](#installation)
3. [Deploy](#deploy)
4. [Next steps](#next-steps)

## Prerequisite

You need to have created a GCIP Project in the
[Cloud Console](https://console.cloud.google.com/customer-identity/providers/).

## Installation

### Build the GCIP/IAP JS binary

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 10.0.0)
- npm (should be included with Node.js)

Download the sample application source and its dependencies with:

```bash
git clone sso://team/cicp-eng/cicp-iap-js
cd cicp-iap-js
# Next 2 commands are optional as this will be triggered by installation
# in sample/authui-react.
npm install
# Build JS binary
npm run build
```

### If you plan to use FirebaseUI

Generate the latest development `firebaseui` tarball which implements the
`AuthenticationHandler` interface required to work with CIAP JS library.
Save the file in `builds/firebaseui` as `firebaseui.tgz`.

### Install Sample React App dependencies

Install all dependencies for the sample AuthUI:

```bash
cd sample/authui-react
npm install
```

This will depend on the `gcip-iap-js` module in the root folder `../..` as
defined in the `authui-react` `package.json` file.

Install the Firebase command line tool with `npm install -g firebase-tools` (See
[docs](https://firebase.google.com/docs/cli/#setup)).

### Configure Firebase Hosting

Deploy the sample app to one of your own Firebase Hosting instance,
configure it using the following command:

```bash
firebase use --add
```

Select the project you have created in the prerequisite, and type in `default` or
any other name as the alias to use for this project.

Note that it is not a requirement to have the same Firebase Hosting project
as your GCIP project. It is only done here for convenience. Firebase Hosting
is merely used as a static file hosting service here. However, if a
different project is used, the Firebase hosting domain has to be whitelisted
in the GCIP list of authorized domains.

### Using multi-tenancy flow

This is the recommended setting if you require session isolation between different
IAP resources.

#### Configure multi-tenancy

Enable multi-tenancy for the GCIP project and configure a couple of
tenants with different sign-in providers. You can do this by following the
[multi-tenant documentation](https://cloud.google.com/identity-platform/docs/multi-tenancy-quickstart).

#### Configuring Authentication URL

You have 2 options to deploy an authentication page:

- Using FirebaseUI
  Update the multi-tenancy configuration in `src/components/firebaseui.tsx`.
  You will need to substitute the tenant ID/IdP configurations in `uiConfigs`.
  This page will be accessible via `/` URL path.
- Using custom UI
  This sample app uses an email/password provider and a SAML provider.
  You will need to enable email/password provider for that tenant and update
  the `SAML_PROVIDER_ID` constant in `src/components/app.tsx` identifying the SAML
  provider configured.
  This page will be accessible via `/custom` URL path.

You will also need to whitelist the IAP redirect domain as an Authorized
domain in your GCIP settings: `iap.googleapis.com`.

### Using GCIP non-tenant flow

If you do not require session isolation between different IAP resources, you
can directly use your GCIP providers to sign in users to your GAE or GCE app
without having to enable multi-tenancy.

#### Configure GCIP

In the GCIP `providers` section, configure the providers you require to
authenticate your users. In the sample app used, only email/password, Google
and Facebook are required.

#### Configuring Authentication URL

You have 2 options to deploy an authentication page:

- Using FirebaseUI
  No changes are needed in `src/components/firebaseui.tsx`.
  This page will be accessible via `/` URL path.
- Using custom UI
  No changes are needed in `src/components/app.tsx`.
  This page will be accessible via `/custom` URL path.

You will also need to whitelist the IAP redirect domain as an Authorized
domain in your GCIP settings: `iap.googleapis.com`.

## Deploy

To deploy the authentication UI locally, in the same directory
`sample/authui-react`, run:
```bash
npm run start
```

This will deploy the authentication UI to
`http://localhost:5000`.

To deploy the authentication UI to production, in the same directory
`sample/authui-react`, run:

```bash
npm run deploy
```

This will deploy the authentication UI to:
- FirebaseUI: `https://firebase-project-id.firebaseapp.com`
- Custom UI: `https://firebase-project-id.firebaseapp.com/custom`

You can use this URL as your authentication URL when configuring IAP.

## Next steps

You are now ready to [deploy your GAE applications](../app/README.md).
