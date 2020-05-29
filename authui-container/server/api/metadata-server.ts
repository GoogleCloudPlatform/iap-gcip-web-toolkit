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

import {HttpServerRequestHandler} from '../../server/utils/http-server-request-handler';
import {TokenManager, AccessTokenManager} from './token-manager';

/** Metadata server project number endpoint. */
const METADATA_SERVER_PROJECT_NUMBER_URL =
    'http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id';
/** Metadata server project ID endpoint. */
const METADATA_SERVER_PROJECT_ID_URL =
    'http://metadata.google.internal/computeMetadata/v1/project/project-id';
/** Metadata server zone endpoint. */
const METADATA_SERVER_ZONE_URL =
    'http://metadata.google.internal/computeMetadata/v1/instance/zone';
/** Network request timeout duration. */
const TIMEOUT_DURATION = 10000;
/** Default zone to use when it is not determined for whatever reason. */
export const DEFAULT_ZONE = 'US-CENTRAL1';
/** Default error message to show when project ID fails to be determined. */
export const DEFAULT_ERROR_MESSAGE_PROJECT_ID = 'Unable to retrieve the project ID.';
/** Default error message to show when project number fails to be determined. */
export const DEFAULT_ERROR_MESSAGE_PROJECT_NUMBER = 'Unable to retrieve the project number.';
/** Default error message to show when GCP zone fails to be determined. */
export const DEFAULT_ERROR_MESSAGE_ZONE = 'Unable to retrieve the GCP zone.';

/** Interface defining all application related data. */
export interface ApplicationData {
  getProjectId(): Promise<string>;
  getProjectNumber(): Promise<string>;
  getZone(): Promise<string>;
  log(...args: any[]): void;
}

/**
 * Metadata server APIs for retrieving OAuth access tokens, project ID,
 * numeric project ID, current GCP zone, etc.
 */
export class MetadataServer implements AccessTokenManager, ApplicationData {
  private readonly tokenManager: TokenManager;
  private readonly projectIdRetriever: HttpServerRequestHandler;
  private readonly projectNumberRetriever: HttpServerRequestHandler;
  private readonly zoneRetriever: HttpServerRequestHandler;
  private projectId: string;
  private projectNumber: string;
  private zone: string;

  /**
   * Instantiates an instance of the metadata server APIs handler.
   * @param scopes The OAuth scopes to set on the generated access tokens.
   * @param logger The optional logging function used to log request information for debugging purposes.
   *   This can be accessed via Cloud Run LOGS tab.
   */
  constructor(scopes?: string[], private readonly logger?: (...args: any[]) => void) {
    this.tokenManager = new TokenManager(scopes);
    this.projectIdRetriever = new HttpServerRequestHandler({
      method: 'GET',
      url: METADATA_SERVER_PROJECT_ID_URL,
      headers: {
        'Metadata-Flavor': 'Google',
      },
      timeout: TIMEOUT_DURATION,
    }, logger);
    this.projectNumberRetriever = new HttpServerRequestHandler({
      method: 'GET',
      url: METADATA_SERVER_PROJECT_NUMBER_URL,
      headers: {
        'Metadata-Flavor': 'Google',
      },
      timeout: TIMEOUT_DURATION,
    }, logger);
    this.zoneRetriever = new HttpServerRequestHandler({
      method: 'GET',
      url: METADATA_SERVER_ZONE_URL,
      headers: {
        'Metadata-Flavor': 'Google',
      },
      timeout: TIMEOUT_DURATION,
    }, logger);
  }

  /**
   * Used to log underlying operations for debugging purposes, if a logger is available.
   * @param args The list of arguments to log.
   */
  log(...args: any[]) {
    if (this.logger) {
      this.logger(...args);
    }
  }

  /**
   * @return A promise that resolves with a Google OAuth access token.
   *     A cached token is returned if it is not yet expired.
   */
  getAccessToken(forceRefresh: boolean = false): Promise<string> {
    return this.tokenManager.getAccessToken(forceRefresh)
      .then((result) => {
        return result.access_token;
      })
      .catch((error) => {
        // For access token getter, only log errors.
        this.log('Error encountered while getting Metadata server access token', error);
        throw error;
      });
  }

  /** @return A promise that resolves with the project ID. */
  getProjectId(): Promise<string> {
    if (this.projectId) {
      return Promise.resolve(this.projectId);
    } else {
      return this.projectIdRetriever.send(null, DEFAULT_ERROR_MESSAGE_PROJECT_ID)
        .then((httpResponse) => {
          if (httpResponse.statusCode === 200 &&
              httpResponse.body) {
            this.projectId = httpResponse.body as string;
            return this.projectId;
          } else {
            // No data in body.
            throw new Error(DEFAULT_ERROR_MESSAGE_PROJECT_ID);
          }
        });
    }
  }

  /** @return A promise that resolves with the project number. */
  getProjectNumber(): Promise<string> {
    if (this.projectNumber) {
      return Promise.resolve(this.projectNumber);
    } else {
      return this.projectNumberRetriever.send(null, DEFAULT_ERROR_MESSAGE_PROJECT_NUMBER)
        .then((httpResponse) => {
          if (httpResponse.statusCode === 200 &&
              httpResponse.body) {
            this.projectNumber = httpResponse.body.toString();
            return this.projectNumber;
          } else {
            // No data in body.
            throw new Error(DEFAULT_ERROR_MESSAGE_PROJECT_NUMBER);
          }
        });
    }
  }

  /** @return A promise that resolves with the zone. */
  getZone(): Promise<string> {
    if (this.zone) {
      return Promise.resolve(this.zone);
    } else {
      return this.zoneRetriever.send(null, DEFAULT_ERROR_MESSAGE_ZONE)
        .then((httpResponse) => {
          if (httpResponse.statusCode === 200 &&
              httpResponse.body) {
            const zoneName: string = httpResponse.body;
            // Format: projects/327715512941/zones/us-central1-1
            const matches = zoneName.match(/\/zones\/(.*)\-[a-zA-Z1-9]$/);
            this.zone = matches && matches.length > 1 ? matches[1] : DEFAULT_ZONE;
            return this.zone;
          } else {
            // No data in body.
            throw new Error(DEFAULT_ERROR_MESSAGE_ZONE);
          }
        });
    }
  }
}