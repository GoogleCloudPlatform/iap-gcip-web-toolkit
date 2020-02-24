/*
 * Copyright 2020 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the
 * License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AuthenticatedRequestHandler} from './authenticated-request-handler';
import {AccessTokenManager} from './token-manager';
import {ApplicationData} from './metadata-server';

/** GCS create bucket endpoint. */
const GCS_CREATE_BUCKET_URL =
    'https://storage.googleapis.com/storage/v1/b?project={projectId}';
/** GCS read file endpoint. */
const GCS_READ_FILE_URL =
    'https://storage.googleapis.com/storage/v1/b/{bucketName}/o/{fileName}?alt=media';
/** GCS write file endpoint. */
const GCS_WRITE_FILE_URL =
    'https://storage.googleapis.com/upload/storage/v1/b/{bucketName}/o?uploadType=media&name={fileName}';
/** Default error message to show when a GCS bucket cannot be created. */
export const DEFAULT_ERROR_MESSAGE_CREATE_BUCKET = 'Unable to create GCS bucket.';
/** Default error message to show when a GCS bucket file cannot be read. */
export const DEFAULT_ERROR_MESSAGE_READ_FILE = 'Unable to read GCS file.';
/** Default error message to show when a GCS bucket file cannot be written to. */
export const DEFAULT_ERROR_MESSAGE_WRITE_FILE = 'Unable to write to GCS file.';
/** Network request timeout duration. */
const TIMEOUT_DURATION = 10000;

/**
 * Utility used to make API calls to GCS. This supports the ability to create
 * storage backets, read and write to them.
 * OAuth scope required: https://www.googleapis.com/auth/devstorage.read_write
 */
export class CloudStorageHandler {
  private createBucketHandler: AuthenticatedRequestHandler;
  private readFileHandler: AuthenticatedRequestHandler;
  private writeFileHandler: AuthenticatedRequestHandler;
  /**
   * Instantiates a Cloud Storage API handler.
   * @param app The application data.
   * @param accessTokenManager The access token manager.
   */
  constructor(
      private readonly app: ApplicationData,
      private readonly accessTokenManager: AccessTokenManager) {
    this.createBucketHandler = new AuthenticatedRequestHandler({
      method: 'POST',
      url: GCS_CREATE_BUCKET_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.readFileHandler = new AuthenticatedRequestHandler({
      method: 'GET',
      url: GCS_READ_FILE_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
    this.writeFileHandler = new AuthenticatedRequestHandler({
      method: 'POST',
      url: GCS_WRITE_FILE_URL,
      timeout: TIMEOUT_DURATION,
    }, this.accessTokenManager);
  }

  /**
   * Creates a new bucket using the name provided.
   * @param bucketName The name of the bucket to be created.
   * @return A promise that resolves on successful creation.
   */
  createBucket(bucketName: string): Promise<void> {
    let urlParams;
    return this.app.getProjectId()
      .then((projectId) => {
        urlParams = {
          projectId,
        }
        return this.app.getZone();
      })
      .then((zone) => {
        return this.createBucketHandler.send({
          urlParams,
          body: {
            name: bucketName,
            location: zone.toUpperCase(),
            storageClass: 'STANDARD',
          },
        }, DEFAULT_ERROR_MESSAGE_CREATE_BUCKET);
      })
      .then((httpResponse) => {
        // Return nothing.
      });
  }

  /**
   * Reads a Cloud Storage bucket for a specified JSON file contents.
   * @param bucketName The name of the bucket where the file is located.
   * @param fileName The name of the file to be read.
   * @return A promise that resolves with the content of the file.
   */
  readFile(bucketName: string, fileName: string): Promise<any> {
    return this.readFileHandler.send({
      urlParams: {
        bucketName,
        fileName,
      },
    }, DEFAULT_ERROR_MESSAGE_READ_FILE).then((httpResponse) => {
      return typeof httpResponse.body === 'object' ?
          httpResponse.body : JSON.parse(httpResponse.body);
    });
  }

  /**
   * Writes to a Cloud Storage bucket file.
   * @param bucketName The name of the bucket where the file is located.
   * @param fileName The name of the file to write to.
   * @return A promise that resolves on successful write.
   */
  writeFile(bucketName: string, fileName: string, content: any): Promise<void> {
    return this.writeFileHandler.send({
      urlParams: {
        bucketName,
        fileName,
      },
      body: content,
    }, DEFAULT_ERROR_MESSAGE_WRITE_FILE).then((httpResponse) => {
      // Return nothing.
    });
  }
}
