# GCIP/IAP Authentication UI Quickstart with FirebaseUI

This sample demonstrates how to integrate a GCIP authentication UI with
a GAE application gated with Cloud IAP. While this sample is hosted with
Firebase Hosting, it could be hosted using any other service. Firebase
Hosting was chosen to demonstrate cross domain authentication and the
ability to use the same authentication UI with multiple IAP resources.

This quickstart sample demonstrates using a federated provider like
Facebook to sign in to an IAP gated resource. The same flow can be applied
for other federated providers (SAML, OIDC, OAuth, etc) with minimal
adjustments to the code.

## Table of Contents

1. [Prerequisite](#prerequisite)
2. [Installation](#installation)
3. [Deploy](#deploy)
4. [Next steps](#next-steps)

## Prerequisite

You need to have created a GCIP Project in the
[Cloud Console](https://console.cloud.google.com/customer-identity/providers/).

Facebook identity provider should be enabled.
OAuth callback URL should be set as instructed:
`https://firebase-project-id.firebaseapp.com/__/auth/handler`

## Installation

### Install Sample App dependencies

Install all dependencies for the sample AuthUI:

```bash
cd sample/authui-firebaseui
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
as your GCIP project. It is only done here for convenience. Firebase Hosting
is merely used as a static file hosting service here. However, if a
different project is used, the Firebase hosting domain has to be whitelisted
in the GCIP list of authorized domains.

#### Configuring Authentication URL

When configuring your authentication URL with IAP, select the root URL:

`https://firebase-project-id.firebaseapp.com/`

Select the project level IdPs in the Permissions section.

## Deploy

To deploy the authentication UI locally, in the same directory
`sample/authui-firebaseui`, run:
```bash
npm run start
```

This will deploy the authentication UI to
`http://localhost:5000`.

To deploy the authentication UI to production, in the same directory
`sample/authui-firebaseui`, run:

```bash
npm run deploy
```

This will deploy the authentication UI to:
`https://firebase-project-id.firebaseapp.com`

You can use this URL as your authentication URL when configuring IAP.

## Next steps

You are now ready to [deploy your GAE applications](../app/README.md).
