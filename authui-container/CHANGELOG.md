
#v0.1.0

gcr.io/gcip-iap/authui@sha256:11a871958769d45544794db8c22af958279817a213717e4f793993cc6433bc99

Launch first version of the Cloud Run Hosted UI for IAP external identities.

#v0.1.1

gcr.io/gcip-iap/authui@sha256:7805cdc257ce5296aaa7ebe7addc16628fc6596a013d82c679b93983d7592a7d

Ensures that GCS bucket names for custom configs meet [bucket name requirements](https://cloud.google.com/storage/docs/naming-buckets#requirements).
This includes trimming characters beyond the 63 character limit and requiring the last character to be a letter or number.
