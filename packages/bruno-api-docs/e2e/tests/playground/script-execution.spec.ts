import { test, expect } from '../../playwright';
import type { Page } from '@playwright/test';
import type { CodeEditorComponent } from '../../components/code-editor/code-editor.component';

const LIBRARY_TESTS_SCRIPT = `
const moment = require('moment');
const CryptoJS = require('crypto-js');
const { v4, validate } = require('uuid');
const { nanoid } = require('nanoid');
const tv4 = require('tv4');

test('moment formats a date', function () {
  expect(moment('2026-01-02').format('YYYY-MM-DD')).to.equal('2026-01-02');
});

test('crypto-js hashes and uuid validates', function () {
  expect(CryptoJS.SHA256('abc').toString()).to.equal('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(validate(v4())).to.equal(true);
  expect(nanoid(10)).to.have.lengthOf(10);
});

test('tv4 validates against a schema', function () {
  expect(tv4.validate({ a: 1 }, { type: 'object' })).to.equal(true);
});
`;

const LIBRARY_FUNCTIONS_SCRIPT = `
const chai = require('chai');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

test('chai.expect and chai.assert', function () {
  chai.expect(2 + 3).to.equal(5);
  if (typeof chai.assert === 'function') {
    chai.assert.equal(4, 4);
  }
});

test('Buffer btoa atob globals', function () {
  expect(Buffer.from('hello').toString('base64')).to.equal('aGVsbG8=');
  expect(Buffer.from('6272756e6f', 'hex').toString('utf8')).to.equal('bruno');
  expect(btoa('hello')).to.equal('aGVsbG8=');
  expect(atob('aGVsbG8=')).to.equal('hello');
});

test('path.resolve join and basename', function () {
  expect(path.resolve('/a/b', '../c')).to.equal('/a/c');
  expect(path.join('a', 'b')).to.include('b');
  expect(path.basename('foo.txt')).to.equal('foo.txt');
});

test('ajv with ajv-formats', function () {
  const ajv = new Ajv();
  addFormats(ajv);
  const validate = ajv.compile({ type: 'string', format: 'email' });
  expect(validate('qa@usebruno.com')).to.equal(true);
  expect(validate('not-an-email')).to.equal(false);
});
`;

const AXIOS_GET_SCRIPT = `
const axios = require('axios');
const url = bru.interpolate('{{host}}/api/users');
const echo = await axios.get(url);

test('axios.get via the sandbox shim', function () {
  expect(echo.status).to.equal(200);
  expect(echo.data.users[0].name).to.equal('Ada');
});
`;

const JWT_UNSUPPORTED_SCRIPT = `
test('jsonwebtoken is not supported in the playground', function () {
  var message = '';
  try {
    require('jsonwebtoken');
  } catch (e) {
    message = String(e && e.message ? e.message : e);
  }
  expect(message).to.contain('not currently supported in the docs playground');
});
`;

const PRE_REQUEST_MOMENT_SCRIPT = `
const moment = require('moment');
const { v4 } = require('uuid');
const stamp = moment.utc('2026-09-03T12:00:00Z').format('YYYY-MM-DD');
req.setHeader('X-Moment-Date', stamp);
bru.setVar('preRequestMoment', stamp);
bru.setVar('preRequestUuid', v4());
`;

const PRE_REQUEST_MOMENT_TESTS = `
test('pre-request moment and uuid ran before send', function () {
  expect(bru.getVar('preRequestMoment')).to.equal('2026-09-03');
  expect(bru.getVar('preRequestUuid')).to.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});
`;

const POST_RESPONSE_CRYPTO_SCRIPT = `
const CryptoJS = require('crypto-js');
const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
bru.setVar('responseSha256', CryptoJS.SHA256(body).toString());
`;

const POST_RESPONSE_CRYPTO_TESTS = `
test('post-response crypto-js hashed the body', function () {
  const digest = bru.getVar('responseSha256');
  expect(digest).to.be.a('string');
  expect(digest).to.have.lengthOf(64);
  expect(digest).to.match(/^[0-9a-f]{64}$/);
});
`;

const REQUIRE_FS_TESTS_SCRIPT = `
test('ran before the throw', function () { expect(1).to.equal(1); });
require('fs');
test('never reached', function () { expect(1).to.equal(1); });
`;

const UNREACHABLE_HOST_POST_RESPONSE_SCRIPT = `
const axios = require('axios');
await axios.get('https://unreachable.invalid/get');
`;

const REQUIRE_LODASH_PRE_REQUEST_SCRIPT = `
const _ = require('lodash');
`;

const setEditorScript = async (page: Page, editor: CodeEditorComponent, script: string): Promise<void> => {
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(script);
};

test.describe('playground script execution', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('runs a tests script using the safe-mode libraries on Send', async ({ page, playground, responsePane }) => {
    await page.route('**/api/users**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      })
    );

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');

    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, LIBRARY_TESTS_SCRIPT);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
  });

  test('runs chai Buffer path and ajv library functions on Send', async ({ page, playground, responsePane }) => {
    await page.route('**/api/users**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      })
    );

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, LIBRARY_FUNCTIONS_SCRIPT);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
  });

  test('runs axios.get through the sandbox shim on Send', async ({ page, playground, responsePane }) => {
    await page.route('**/api/users**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      })
    );

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, AXIOS_GET_SCRIPT);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
  });

  test('jsonwebtoken require is rejected with a playground-specific error', async ({ page, playground, responsePane }) => {
    await page.route('**/api/users**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      })
    );

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, JWT_UNSUPPORTED_SCRIPT);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
  });

  test('uses moment and uuid in a pre-request script on Send', async ({ page, playground, responsePane }) => {
    let momentHeader = '';
    await page.route('**/api/users**', (route) => {
      momentHeader = route.request().headers()['x-moment-date'] || '';
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      });
    });

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('scripts');
    await setEditorScript(page, playground.preRequestScriptEditor, PRE_REQUEST_MOMENT_SCRIPT);
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, PRE_REQUEST_MOMENT_TESTS);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
    expect(momentHeader).toBe('2026-09-03');
  });

  test('runs crypto-js in a post-response script on Send', async ({ page, playground, responsePane }) => {
    await page.route('**/api/users**', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ users: [{ id: 1, name: 'Ada' }] })
      })
    );

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('scripts');
    await page.getByTestId('scripts-tabs-tab-post-response').click();
    await setEditorScript(page, playground.postResponseScriptEditor, POST_RESPONSE_CRYPTO_SCRIPT);
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, POST_RESPONSE_CRYPTO_TESTS);

    await responsePane.send();
    await responsePane.switchToTab('tests');

    await expect(page.getByText(/Passed: [1-9]\d*, Failed: 0/).first()).toBeVisible();
    await expect(page.getByText(/Failed: [1-9]/)).toHaveCount(0);
  });

  test('a tests script that throws shows a dismissable Test Script Error card and keeps the tests that ran', async ({ page, playground, responsePane }) => {
    await responsePane.mockUsersResponse(JSON.stringify({ users: [] }));

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('tests');
    await setEditorScript(page, playground.testsEditor, REQUIRE_FS_TESTS_SCRIPT);

    await responsePane.send();

    await expect(responsePane.status).toContainText('200');
    await expect(responsePane.scriptErrors.getByTestId('error-title')).toHaveText('Test Script Error');
    await expect(responsePane.scriptErrors.getByTestId('error-message')).toContainText('\'fs\' is a Node.js builtin');

    await responsePane.switchToTab('tests');
    await expect(responsePane.testsPanel.getByText('Tests (2), Passed: 1, Failed: 1')).toBeVisible();
    await expect(responsePane.testsPanel.getByText('ran before the throw')).toBeVisible();
    await expect(responsePane.testsPanel.getByText('never reached')).toHaveCount(0);
    await expect(responsePane.testsScriptErrors.getByTestId('error-title')).toHaveText('Test Script Error');

    await responsePane.testsScriptErrorsDismiss.click();
    await expect(responsePane.testsScriptErrors).toHaveCount(0);
    await responsePane.switchToTab('response');
    await expect(responsePane.scriptErrors).toHaveCount(0);
    await expect(responsePane.bodyEditor.surface).toBeVisible();
  });

  test('a pre-request script that throws shows a Pre-Request Script Error card instead of a response', async ({ page, playground, responsePane }) => {
    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('scripts');
    await setEditorScript(page, playground.preRequestScriptEditor, REQUIRE_LODASH_PRE_REQUEST_SCRIPT);

    await responsePane.send();

    await expect(responsePane.errorTitle).toHaveText('Pre-Request Script Error');
    await expect(responsePane.errorMessage).toContainText('\'lodash\' is only available in the Bruno desktop app\'s developer mode');
    await expect(responsePane.status).toHaveCount(0);
  });

  test('a post-response script that throws shows a Post-Response Script Error card while the body still renders', async ({ page, playground, responsePane }) => {
    await responsePane.mockUsersResponse(JSON.stringify({ users: [] }));
    await page.route('https://unreachable.invalid/**', (route) => route.abort('namenotresolved'));

    await page.goto('/#/?pg=1&dock=bottom');
    await playground.openSidebarItem('get users');
    await playground.selectTab('scripts');
    await page.getByTestId('scripts-tabs-tab-post-response').click();
    await setEditorScript(page, playground.postResponseScriptEditor, UNREACHABLE_HOST_POST_RESPONSE_SCRIPT);

    await responsePane.send();

    await expect(responsePane.status).toContainText('200');
    await expect(responsePane.scriptErrors.getByTestId('error-title')).toHaveText('Post-Response Script Error');
    await expect(responsePane.scriptErrors.getByTestId('error-message')).toHaveText('Network Error');
    await expect(responsePane.bodyEditor.surface).toBeVisible();

    await responsePane.switchToTab('tests');
    await expect(responsePane.testsPanel.getByText('Tests (1), Passed: 0, Failed: 1')).toBeVisible();
    await expect(responsePane.testsPanel.getByText('Post-Response Script Error').first()).toBeVisible();
  });
});
