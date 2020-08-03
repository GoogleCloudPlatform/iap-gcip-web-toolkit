
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
