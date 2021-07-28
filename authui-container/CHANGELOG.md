
#v0.1.0

gcr.io/gcip-iap/authui@sha256:11a871958769d45544794db8c22af958279817a213717e4f793993cc6433bc99

Launch first version of the Cloud Run Hosted UI for IAP external identities.

#v0.1.1

gcr.io/gcip-iap/authui@sha256:7805cdc257ce5296aaa7ebe7addc16628fc6596a013d82c679b93983d7592a7d

Ensures that GCS bucket names for custom configs meet [bucket name requirements](https://cloud.google.com/storage/docs/naming-buckets#requirements).
This includes trimming characters beyond the 63 character limit and requiring the last character to be a letter or number.

#v0.1.2

gcr.io/gcip-iap/authui@sha256:a7dc58008bb7fb2510cb78c8c834f3b9d6ab9d03919b8c261bcb22e4cc7a848d

Updates `firebaseui` version. The latest update supports customization of IdP buttons like Google, Email, etc. This includes the ability to overwrite the entire button label via `fullLabel` field.

#v0.1.3

gcr.io/gcip-iap/authui@sha256:3e2c606a2cce4944c9f7e816dacc968e3306d0a3aea6f14892b9837241497273

Updates `gcip-iap` module dependency to handle browsers with 3P cookies and site data disabled.

#v0.1.4

gcr.io/gcip-iap/authui@sha256:5c3030f22afffba367c3106acb3674bbbee7be826c9b9de0c64e1b26885e64f6

Updates `firebaseui` version. The latest update supports customization of tenant selection buttons. This includes the ability to overwrite the entire button label via `fullLabel` field.

#v0.1.5

gcr.io/gcip-iap/authui@sha256:d74bcbc4ba8797da73bc98f1a2695625eb7df78eb5bb4405213265f8a2350baa

Fixes authui-container support in pre-Chromium Edge and IE 11 browsers.

#v0.1.6

gcr.io/gcip-iap/authui@sha256:b7d58fed82542e39f12ac7d920c61629bde7f8baa3ba7abc5b2def7c16f6cb57

Fixes unexpected fragment parsing when determining selected tenant info.

#v0.1.7

gcr.io/gcip-iap/authui@sha256:362f671689af6b265c8dbd59caf99d06fae1af425758df121f39e8193766d270

Updates `firebaseui`, `firebase` versions and ES6 firebase/app import.

#v0.1.8

gcr.io/gcip-iap/authui@sha256:fa6d5e92351a4683235b5aaf1e126509667954a2ad5afa01b5f73f4e09f41ce0

Updates `gcip-iap` module dependency to `0.1.4`.

#v0.1.9

gcr.io/gcip-iap/authui@sha256:db842770d654782001b7aba24532458fdb9ef9953b70ea2fcd162b2a133abf29

Updates `firebaseui` dependency version to `4.8.0` to support disabling new user sign up in email providers, disabling new user sign up via project settings and blocking functions.

#v0.1.10

gcr.io/gcip-iap/authui@sha256:c9bc65e24793d5f69bfd5bfa3b518defd80ee39ee1a0efedac99b2b2c6ffba07

Fixes GCS file/bucket not found error handling.

#v0.1.11

gcr.io/gcip-iap/authui@sha256:7703925296db259590bae47e7004118d75f1727a132b742e76991a8407755905

Updates `firebaseui` dependency version to `4.8.1` to provide UI support for all identity provider sign up operations when they are restricted by site administrators.
