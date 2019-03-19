# CICP/IAP Authentication UI Quickstart

This sample demonstrates how to integrate a CICP authentication UI with
a GAE application gated with Cloud IAP. While this sample is hosted with
Firebase Hosting, it could be hosted using any other service. Firebase
Hosting was chosen to demonstrate cross domain authentication and the
ability to use the same authentication UI with multiple IAP resources.

## Table of Contents

1. [Prerequisite](#prerequisite)
2. [Installation](#installation)
3. [Deploy](#deploy)
4. [Next steps](#next-steps)

## Prerequisite

You need to have created a CICP Project in the
[Cloud Console](https://pantheon.corp.google.com/customer-identity/providers/).

## Installation

### Build the CICP/IAP JS binary

To set up a development environment to build the sample from source, you must
have the following installed:
- Node.js (>= 8.0.0)
- npm (should be included with Node.js)

Download the sample application source and its dependencies with:

```bash
git clone sso://team/cicp-eng/cicp-iap-js
cd cicp-iap-js
npm install
# Build JS binary
npm run build
```

### If you plan to use FirebaseUI

Generate the latest development `firebaseui` tarball which implements the
`AuthenticationHandler` interface required to work with CIAP JS library.
Save the file in `sample/authui` as `firebaseui.tgz`.

Generate the latest development `firebase` JS SDK tarball which supports
multi-tenancy and `AuthCredential` serialization required for `firebaseui`
dependency.
Save the file in `sample/authui` as `firebase.tgz`.

### Install Sample App dependencies

Install all dependencies for the sample AuthUI:

```bash
cd sample/authui
npm install
```

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
as your CICP project. It is only done here for convenience. Firebase Hosting
is merely used as a static file hosting service here. However, if a
different project is used, the Firebase hosting domain has to be whitelisted
in the CICP list of authorized domains.

### Configure multi-tenancy

Enable multi-tenancy for the CICP project and configure a couple of
tenants with different sign-in providers. You can do this by following the
[multi-tenant quickstart documentation](https://docs.google.com/document/d/11xhYFb7wKeZ4OHfccJDwbRqhazYlQUSue5YXK8PiFME/).

### Configuring Authentication URL

You have 2 options to deploy an authentication page:

- Using FirebaseUI
  Update the multi-tenancy configuration in `src/script.js`.
  You will need to substitute the tenant ID/IdP configurations in `uiConfigs`.
  This page will be accessible via `/` URL path.
- Using custom UI
  This sample app uses an email/password provider and a SAML provider.
  You will need to enable email/password provider for that tenant and update
  the `SAML_PROVIDER_ID` constant in `src/custom.js` identifying the SAML provider
  configured.
  This page will be accessible via `/custom` URL path.

## Deploy

To deploy the authentication UI locally, in the same directory `sample/authui`, run:
```bash
npm run start
```

This will deploy the authentication UI to
`http://localhost:5000`.

To deploy the authentication UI to production, in the same directory
`sample/authui`, run:

```bash
npm run deploy
```

This will deploy the authentication UI to:
- FirebaseUI: `https://firebase-project-id.firebaseapp.com`
- Custom UI: `https://firebase-project-id.firebaseapp.com/custom`

You can use this URL as your authentication URL when configuring IAP.

## Next steps

You are now ready to [deploy your GAE applications](../app/README.md).
