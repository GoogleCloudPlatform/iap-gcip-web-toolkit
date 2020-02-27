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

import express = require('express');
import bodyParser = require('body-parser');
import * as templates from  './templates';
import path = require('path');
import {Server} from 'http';
import { MetadataServer } from './api/metadata-server';
import { CloudStorageHandler } from './api/cloud-storage-handler';
import { ErrorResponse, ERROR_MAP } from '../utils/error';
import { isNonNullObject } from '../utils/validator';

// Defines the Auth server OAuth scopes needed for internal usage.
// This is used to query APIs to determine the default config.
export const AUTH_SERVER_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/identitytoolkit',
];

// Configuration file name.
const CONFIG_FILE_NAME = 'config.json';

/**
 * Renders the sign-in UI HTML container and serves it in the response.
 * @param req The expressjs request.
 * @param res The expressjs response.
 */
function serveContentForSignIn(req: any, res: any) {
  const logo = 'https://img.icons8.com/cotton/2x/cloud.png';
  res.set('Content-Type', 'text/html');
  res.end(templates.main({
    logo,
  }));
}

/** Abstracts the express JS server used to handle all authentication related operations. */
export class AuthServer {
  /** The http.Server instance corresponding to the started server. */
  public server: Server;
  /** Metadata server instance. */
  private metadataServer: MetadataServer;
  /** Bucket name where custom configurations will be stored. */
  private bucketName: string | null;

  /**
   * Creates an instance of the auth server using the specified express application instance.
   * @param app The express application instance.
   */
  constructor(private readonly app: express.Application) {
    // Metadata server is used to retrieve current app data (project ID, number, GCP zone, etc).
    // It is also used to call APIs on behalf of the service. This is mostly for read operations.
    // For example to read the default app configuration.
    // For write operations, the admin OAuth access token is used.
    this.metadataServer = new MetadataServer(AUTH_SERVER_SCOPES);
    this.bucketName = null;
    this.init();
  }

  /**
   * Starts the authentication server at the specified port number.
   * @param port The port to start the server with. This defaults to 8080.
   * @return A promise that resolves on readiness.
   */
  start(port: string = '8080'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(parseInt(port, 10), () => {
        resolve();
      });
    });
  }

  /** Closes the server. */
  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Initializes the server endpoints.
   */
  private init() {
    this.app.enable('trust proxy');
    // Support JSON-encoded bodies.
    this.app.use(bodyParser.json());
    // Support URL-encoded bodies.
    this.app.use(bodyParser.urlencoded({
      extended: true
    }));
    // Static assets.
    this.app.use('/static', express.static(path.join(__dirname, '../public')));

    // IAP sign-in flow.
    this.app.get('/', (req: express.Request, res: express.Response) => {
      // Serve content for signed in user.
      return serveContentForSignIn(req, res);
    });

    // Administrative sign-in UI config customization.
    this.app.get('/admin', (req: express.Request, res: express.Response) => {
      res.set('Content-Type', 'text/html');
      res.end(templates.admin({}));
    });

    // Administrative API for reading the current app configuration.
    // This could be either saved in GCS (custom config), environment variable (custom config)
    // or in memory (default config).
    this.app.get('/get_admin_config', (req: express.Request, res: express.Response) => {
      // TODO: add this functionality when default config builer is ready.
    });

    // Administrative API for writing a custom configuration to.
    // This will save the configuration in a predetermined GCS bucket.
    this.app.post('/set_admin_config', (req: express.Request, res: express.Response) => {
      if (!req.headers.authorization ||
          req.headers.authorization.split(' ').length <= 1) {
        this.handleErrorResponse(res, ERROR_MAP.UNAUTHENTICATED);
      } else if (!isNonNullObject(req.body) ||
                 Object.keys(req.body).length === 0) {
        this.handleErrorResponse(res, ERROR_MAP.INVALID_ARGUMENT);
      } else {
        const accessToken = req.headers.authorization.split(' ')[1];
        // TODO: validate config before saving it.
        this.setConfigForAdmin(accessToken, req.body).then(() => {
          res.set('Content-Type', 'application/json');
          res.send(JSON.stringify({
            status: 200,
            message: 'Changes successfully saved.',
          }));
        }).catch((err) => {
          this.handleError(res, err);
        });
      }
    });

  }

  /** @return A promise that resolves with the service GCS bucket name. */
  private getBucketName(): Promise<string> {
    const bucketPrefix = `gcip-iap-bucket-${process.env.K_CONFIGURATION}-`;
    if (this.bucketName) {
      return Promise.resolve(this.bucketName);
    } else if (process.env.GCS_BUCKET_NAME) {
      this.bucketName = process.env.GCS_BUCKET_NAME;
      return Promise.resolve(this.bucketName);
    }
    return this.metadataServer.getProjectNumber()
      .then((projectNumber) => {
        this.bucketName = `${bucketPrefix}${projectNumber}`;
        return this.bucketName;
      });
  }

  /**
   * Saves the custom configuration to the expected GCS bucket.
   * @param accessToken The personal admin user OAuth access token.
   * @param customConfig The custom configuration JSON file to be saved.
   * @return A promise that resolves on successful saving.
   */
  private setConfigForAdmin(accessToken: string, customConfig: any): Promise<void> {
    let bucketName: string;
    const fileName = CONFIG_FILE_NAME;
    // Required OAuth scope: https://www.googleapis.com/auth/devstorage.read_write
    const accessTokenManager = {
      getAccessToken: () => Promise.resolve(accessToken),
    };
    const cloudStorageHandler = new CloudStorageHandler(this.metadataServer, accessTokenManager);
    // Check bucket exists first.
    return this.getBucketName()
      .then((retrievedBucketName) => {
        bucketName = retrievedBucketName;
        return cloudStorageHandler.readFile(bucketName, fileName);
      })
      .catch((error) => {
        if (error.message && error.message.toLowerCase().indexOf('not found') !== -1) {
          // Create bucket.
          return cloudStorageHandler.createBucket(bucketName);
        }
        throw error;
      })
      .then(() => {
        // Bucket either exists or just created. Write update file to it.
        return cloudStorageHandler.writeFile(bucketName, fileName, customConfig);
      });
  }

  /**
   * Handles the provided error response object.
   * @param res The express response object.
   * @param errorResponse The error response to return in the response.
   */
  private handleErrorResponse(
      res: express.Response,
      errorResponse: ErrorResponse) {
    res.status(errorResponse.error.code).json(errorResponse);
  }

  /**
   * Handles the provided error.
   * @param res The express response object.
   * @param error The associated error object.
   */
  private handleError(res: express.Response, error: Error) {
    if (error && (error as any).cloudCompliant) {
      this.handleErrorResponse(res, (error as any).rawResponse);
    } else {
      // Response with unknown error.
      this.handleErrorResponse(
          res,
          {
            error: {
              code: 500,
              status: 'UNKNOWN',
              message: error.message || 'Unknown server error.',
            },
          });
    }
  }
}
