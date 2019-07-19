/*!
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Builder, By, until, ThenableWebDriver, WebElement,
} from 'selenium-webdriver';
import chrome = require('selenium-webdriver/chrome');

/**
 * @return A Chrome options instance used for the web driver tests.
 */
function initializeChromeOptions(): chrome.Options {
  const chromeOptions = new chrome.Options();
  chromeOptions.addArguments('disable-w3c');
  chromeOptions.addArguments('start-fullscreen');
  chromeOptions.addArguments('disable-infobars');
  // Comment out to see the test running live in the browser window.
  chromeOptions.addArguments('headless');
  chromeOptions.setUserPreferences({ credential_enable_service: false });
  return chromeOptions;
}

/**
 * The delay to wait in milliseconds before timing out when looking for
 * web driver conditions to be specified.
 */
const DELAY = 15000;

/**
 * The base page class to be extended for each new page where the webdriver test will be run.
 */
export class BasePage {
  static chromeOptions = initializeChromeOptions();
  protected driver: ThenableWebDriver;

  /**
   * Initializes the web driver for Chrome browser with the expected
   * browser options.
   * @param driver Optional web driver instance. When not provided, a new instance is
   *     initialized.
   */
  constructor(driver?: ThenableWebDriver) {
    this.driver = driver || new Builder()
        .setChromeOptions(BasePage.chromeOptions)
        .forBrowser('chrome')
        .build();
  }

  /**
   * Quits the current session.
   * @return A promise that resolves after session is closed.
   */
  quit(): Promise<void> {
    return this.driver.quit();
  }

  /**
   * @return A promise that resolves with the current URL string.
   */
  getCurrentUrl(): Promise<string> {
    return this.driver.getCurrentUrl();
  }

  /**
   * Visits the specified URL.
   * @param url The URL to redirect to.
   * @return A promise that resolves after the redirect.
   */
  protected visit(url: string): Promise<void> {
    return this.driver.get(url);
  }

  /**
   * Waits for the element identified by ID to be found.
   * @param id The ID of the element to look for.
   * @return A promise that resolves with the WebElement to look for.
   */
  protected findById(id: string): Promise<WebElement> {
    return this.driver.wait(
        until.elementLocated(By.id(id)),
        DELAY,
        'Locating element')
        .then(() => {
          return this.driver.findElement(By.id(id));
        });
  }

  /**
   * Waits for the element identified by name to be found.
   * @param name The name of the element to look for.
   * @return A promise that resolves with the WebElement to look for.
   */
  protected findByName(name: string): Promise<WebElement> {
    return this.driver.wait(
        until.elementLocated(By.name(name)),
        DELAY,
        'Locating element')
        .then(() => {
          return this.driver.findElement(By.name(name));
        });
  }

  /**
   * Waits for the element identified by className to be found.
   * @param className The class name of the element to look for.
   * @return A promise that resolves with the WebElement to look for.
   */
  protected findByClassName(className: string): Promise<WebElement> {
    return this.driver.wait(
        until.elementLocated(By.className(className)),
        DELAY,
        'Locating element')
        .then(() => {
          return this.driver.findElement(By.className(className));
        });
  }

  /**
   * Waits for the page to navigate to a URL containing the specified
   * substring.
   * @param substrUrl The substring of the URL to wait for.
   * @return A promise that resolves when the URL substring is redirected to.
   */
  protected waitUntilUrlContains(substrUrl: string): Promise<void> {
    return this.driver.wait(
        until.urlContains(substrUrl),
        DELAY,
        'Waiting for URL');
  }

  /**
   * Waits for the page to navigate to a URL matching the specified
   * regular expression.
   * @param regex The regular expression to test against.
   * @return A promise that resolves when the matching URL regular expression
   *     is redirected to.
   */
  protected waitUntilUrlMatches(regex: RegExp): Promise<void> {
    return this.driver.wait(
        until.urlMatches(regex),
        DELAY,
        'Waiting for URL match');
  }

  /**
   * Inputs the specified text into the web elements.
   * @param el The WebElement where the text will be inputted.
   * @param txt The text to input.
   * @return A promise that resolves after the text is inputted.
   */
  protected write(el: WebElement, txt: string): Promise<void> {
    return el.sendKeys(txt);
  }
}
