/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '../amp-payment-google-inline';
import {AmpFormService} from '../../../../extensions/amp-form/0.1/amp-form';
import {mockServiceForDoc} from '../../../../testing/test-helper';

/** @const {string} */
const IFRAME_URL = 'http://example.com';

/** @const {string} */
const SUBMIT_BUTTON_ID = 'submit-button';

/** @const {string} */
const PAYMENT_TOKEN_INPUT_ID = 'payment-token';

/** @const {string} */
const PAYMENT_TOKEN = 'fake-payment-token';

describes.realWin('amp-payment-google-inline', {
  amp: {
    extensions: ['amp-payment-google-inline', 'amp-form'],
  },
}, env => {
  let win, doc;
  let viewerMock, xhrMock, iframeMock;

  beforeEach(() => {
    win = env.win;
    doc = win.document;

    new AmpFormService(env.ampdoc);

    viewerMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'viewer', [
      'whenFirstVisible',
      'whenNextVisible',
      'sendMessageAwaitResponse',
    ]);
    viewerMock.whenFirstVisible.returns(Promise.resolve());
    viewerMock.whenNextVisible.returns(Promise.resolve());

    iframeMock = mockServiceForDoc(
        env.sandbox, env.ampdoc, 'payment-google-inline',
        ['sendIframeMessageAwaitResponse']);

    xhrMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'xhr', [
      'fetch',
    ]);
  });

  it('loads the inline payment iframe', () => {
    viewerMock.sendMessageAwaitResponse
        .withArgs('getInlinePaymentIframeUrl', {})
        .returns(Promise.resolve(IFRAME_URL));

    return getAmpPaymentGoogleInline().then(gPayInline => {
      const iframes = gPayInline.getElementsByTagName('iframe');

      expect(iframes.length).to.equal(1);
      expect(iframes[0].src).to.equal(IFRAME_URL);
    });
  });

  it('submits the payment token along with the form', () => {
    viewerMock.sendMessageAwaitResponse
        .withArgs('getInlinePaymentIframeUrl', {})
        .returns(Promise.resolve(IFRAME_URL));

    return getAmpPaymentGoogleInline().then(gPayInline => {
      const iframes = gPayInline.getElementsByTagName('iframe');
      expect(iframes.length).to.equal(1);
      iframeMock.sendIframeMessageAwaitResponse
          .withArgs(iframes[0], 'loadDefaultPaymentData')
          .returns(Promise.resolve({
            paymentMethodToken: {
              token: PAYMENT_TOKEN,
            },
          }));

      // Before the form is submitted, the hidden input is present, but empty.
      const input = doc.getElementById(PAYMENT_TOKEN_INPUT_ID);
      expect(input.value).to.equal('');

      const formSubmitted = new Promise((resolve, reject) => {
        xhrMock.fetch.callsFake((url, request) => {
          // Without this try-catch block, the nested promise swallows up any
          // failed expectations and the test times out instead of failing.
          try {
            // The token is present in the form when it is submitted.
            expect(input.value).to.equal(PAYMENT_TOKEN);
            expect(Array.from(request.body.entries()))
                .to.deep.include([PAYMENT_TOKEN_INPUT_ID, PAYMENT_TOKEN]);
            resolve();
          } catch (e) {
            reject(e);
          }

          // Minimal mocked FetchResponse.
          return {
            json: () => Promise.resolve('{}'),
          };
        });
      });

      const button = doc.getElementById(SUBMIT_BUTTON_ID);
      button.click();

      return formSubmitted;
    });
  });

  function getAmpPaymentGoogleInline() {
    const form = doc.createElement('form');
    form.setAttribute('method', 'post');
    form.setAttribute('action-xhr', '/my-form-handler');
    doc.body.appendChild(form);

    const button = doc.createElement('button');
    button.id = SUBMIT_BUTTON_ID;
    form.appendChild(button);

    const input = doc.createElement('input');
    input.id = PAYMENT_TOKEN_INPUT_ID;
    input.setAttribute('type', 'hidden');
    input.setAttribute('name', PAYMENT_TOKEN_INPUT_ID);
    form.appendChild(input);

    const inline = doc.createElement('amp-payment-google-inline');
    inline.setAttribute('data-payment-token-input-id', PAYMENT_TOKEN_INPUT_ID);
    form.appendChild(inline);

    const config = doc.createElement('script');
    config.setAttribute('type', 'application/json');
    config.innerHTML = '{}';
    inline.appendChild(config);

    return inline.build()
        .then(() => inline.layoutCallback())
        .then(() => inline);
  }
});
