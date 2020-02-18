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
  /**
   * Creates an instance of the auth server using the specified express application instance.
   * @param app The express application instance.
   */
  constructor(private readonly app: express.Application) {
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
  }
}
