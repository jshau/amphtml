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
import * as sinon from 'sinon';
import {AmpFormService} from '../../../../extensions/amp-form/0.1/amp-form';
import {mockServiceForDoc} from '../../../../testing/test-helper';

/** @const {string} */
const IFRAME_URL = 'http://example.com/somesubpath';

/** @const {string} */
const IFRAME_URL_ORIGIN = 'http://example.com';

/** @const {string} */
const SUBMIT_BUTTON_ID = 'submit-button';

/** @const {string} */
const PAYMENT_DATA_INPUT_ID = 'payment-data';

/** @const {string} */
const PAYMENT_TOKEN = 'fake-payment-token';

describes.realWin(
    'amp-payment-google-inline', {
      amp: {
        extensions: ['amp-payment-google-inline', 'amp-form'],
      },
    },
    env => {
      let win, doc;
      let viewerMock, xhrMock, iframeMock;

      beforeEach(() => {
        win = env.win;
        doc = win.document;

        new AmpFormService(env.ampdoc);

        viewerMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'viewer', [
          'isTrustedViewer',
          'sendMessage',
          'sendMessageAwaitResponse',
          'whenFirstVisible',
          'whenNextVisible',
        ]);
        viewerMock.whenFirstVisible.returns(Promise.resolve());
        viewerMock.whenNextVisible.returns(Promise.resolve());

        iframeMock = mockServiceForDoc(
            env.sandbox, env.ampdoc, 'payment-google-inline',
            ['sendIframeMessage', 'sendIframeMessageAwaitResponse']);

        xhrMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'xhr', [
          'fetch',
        ]);

        viewerMock.sendMessageAwaitResponse
        .withArgs('isReadyToPay', sinon.match.any)
        .returns(Promise.resolve(true));
      });

      it('loads initialize payment client with isTestMode', () => {
        const iframes = doc.getElementsByTagName('iframe');
        expect(iframes.length).to.equal(0);

        viewerMock.sendMessageAwaitResponse
            .withArgs('initializePaymentClient', {isTestMode: true})
            .returns(Promise.resolve());
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline(true /* isTestMode */)
            .then(gPayInline => {
              const iframes = gPayInline.getElementsByTagName('iframe');

              expect(iframes.length).to.equal(1);
              expect(iframes[0].src).to.equal(IFRAME_URL);
            });
      });

      it('loads the inline payment iframe', () => {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');

          expect(iframes.length).to.equal(1);
          expect(iframes[0].src).to.equal(IFRAME_URL);
        });
      });

      it('submits the payment data along with the form', () => {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);
          iframeMock.sendIframeMessageAwaitResponse
              .withArgs(iframes[0], IFRAME_URL_ORIGIN, 'getSelectedPaymentData')
              .returns(Promise.resolve({
                paymentMethodToken: {
                  token: PAYMENT_TOKEN,
                },
              }));

          // Before the form is submitted, the hidden input is present, but
          // empty.
          const input = doc.getElementById(PAYMENT_DATA_INPUT_ID);
          expect(input.value).to.equal('');

          const formSubmitted = new Promise((resolve, reject) => {
            xhrMock.fetch.callsFake((url, request) => {
              // Without this try-catch block, the nested promise swallows up
              // any failed expectations and the test times out instead of
              // failing.
              try {
                // The data is present in the form when it is submitted.
                const data =
                    '{"paymentMethodToken":{"token":"' + PAYMENT_TOKEN + '"}}';
                expect(input.value).to.equal(data);
                expect(Array.from(request.body.entries())).to.deep.include([
                  PAYMENT_DATA_INPUT_ID,
                  data,
                ]);
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

      it('should not set payment data if submit fails', () => {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);
          iframeMock.sendIframeMessageAwaitResponse
              .withArgs(iframes[0], IFRAME_URL_ORIGIN, 'getSelectedPaymentData')
              .returns(Promise.reject('getSelectedPaymentData fail'));

          // Before the form is submitted, the hidden input is present, but
          // empty.
          const input = doc.getElementById(PAYMENT_DATA_INPUT_ID);
          expect(input.value).to.equal('');

          const formSubmitted = new Promise((resolve, reject) => {
            expect(input.value).to.equal('');
            resolve();
          });

          const button = doc.getElementById(SUBMIT_BUTTON_ID);
          button.click();

          return formSubmitted;
        });
      });

      it('should call loadPaymentData if requested by iframe', function() {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));
        viewerMock.sendMessageAwaitResponse.withArgs('loadPaymentData', {})
            .returns(
                Promise.resolve({data: {paymentMethodToken: PAYMENT_TOKEN}}));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);
          iframeMock.sendIframeMessage
              .withArgs(
                  iframes[0], IFRAME_URL_ORIGIN, 'loadPaymentData',
                  {data: {paymentMethodToken: PAYMENT_TOKEN}})
              .returns();

          window.postMessage(
              {
                message: 'loadPaymentData',
                data: {},
              },
              '*');
        });
      });

      it('should not call loadPaymentData if failed', function() {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));
        viewerMock.sendMessageAwaitResponse.withArgs('loadPaymentData', {})
            .throws('loadPaymentData fail');

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);
          iframeMock.sendIframeMessage
              .withArgs(
                  iframes[0], IFRAME_URL_ORIGIN, 'loadPaymentData',
                  sinon.match.any)
              .throws('Should not call with this argument');

          window.postMessage(
              {
                message: 'loadPaymentData',
                data: {},
              },
              '*');
        });
      });

      it('should call prefetchPaymentData if requested by iframe', function() {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));
        viewerMock.sendMessage.withArgs('prefetchPaymentData', {}).returns();

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);

          window.postMessage(
              {
                message: 'prefetchPaymentData',
                data: {},
              },
              '*');
        });
      });

      it('should reply validation viewer request from frame in trusted viewer',
          function() {
            viewerMock.sendMessageAwaitResponse
                .withArgs('getInlinePaymentIframeUrl', {})
                .returns(Promise.resolve(IFRAME_URL));
            viewerMock.isTrustedViewer.returns(Promise.resolve(true));

            // Send intial status change event for initiating the iframe
            // component.
            window.postMessage(
                {
                  message: 'paymentReadyStatusChanged',
                  data: {},
                },
                '*');


            return getAmpPaymentGoogleInline().then(gPayInline => {
              const iframes = gPayInline.getElementsByTagName('iframe');
              expect(iframes.length).to.equal(1);
              iframeMock.sendIframeMessage.withArgs(
                  iframes[0], IFRAME_URL_ORIGIN, 'validateViewerReply',
                  {'result': true});

              window.postMessage(
                  {
                    message: 'validateViewer',
                    data: {},
                  },
                  '*');
            });
          });

      it('should not reply validation viewer in non-trusted viewer',
          function() {
            viewerMock.sendMessageAwaitResponse
                .withArgs('getInlinePaymentIframeUrl', {})
                .returns(Promise.resolve(IFRAME_URL));
            viewerMock.isTrustedViewer.returns(Promise.resolve(false));

            // Send intial status change event for initiating the iframe
            // component.
            window.postMessage(
                {
                  message: 'paymentReadyStatusChanged',
                  data: {},
                },
                '*');


            return getAmpPaymentGoogleInline().then(gPayInline => {
              const iframes = gPayInline.getElementsByTagName('iframe');
              expect(iframes.length).to.equal(1);
              iframeMock.sendIframeMessage.withArgs(
                  iframes[0], IFRAME_URL_ORIGIN, 'validateViewerReply',
                  {'result': false});

              window.postMessage(
                  {
                    message: 'validateViewer',
                    data: {},
                  },
                  '*');
            });
          });

      it('should call logPaymentData if requested by iframe', function() {
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));
        viewerMock.sendMessage.withArgs('logPaymentData', {}).returns();

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(gPayInline => {
          const iframes = gPayInline.getElementsByTagName('iframe');
          expect(iframes.length).to.equal(1);

          window.postMessage(
              {
                message: 'logPaymentData',
                data: {},
              },
              '*');
        });
      });

      it('should throw error if isReadyToPay returns false', () => {
        viewerMock.sendMessageAwaitResponse
        .withArgs('isReadyToPay', sinon.match.any)
        .returns(Promise.resolve(false));
        viewerMock.sendMessageAwaitResponse
            .withArgs('getInlinePaymentIframeUrl', {})
            .returns(Promise.resolve(IFRAME_URL));

        // Send intial status change event for initiating the iframe component.
        window.postMessage(
            {
              message: 'paymentReadyStatusChanged',
              data: {},
            },
            '*');

        return getAmpPaymentGoogleInline().then(
            gPayInline => {
              throw new Error('Should not be called');
            },
            error => {
              expect(error).to.equal('Google Pay is not supported');
            });
      });

      function getAmpPaymentGoogleInline(opt_isTestMode) {
        const form = doc.createElement('form');
        form.setAttribute('method', 'post');
        form.setAttribute('action-xhr', '/my-form-handler');
        doc.body.appendChild(form);

        const button = doc.createElement('button');
        button.id = SUBMIT_BUTTON_ID;
        form.appendChild(button);

        const input = doc.createElement('input');
        input.id = PAYMENT_DATA_INPUT_ID;
        input.setAttribute('type', 'hidden');
        input.setAttribute('name', PAYMENT_DATA_INPUT_ID);
        form.appendChild(input);

        const inline = doc.createElement('amp-payment-google-inline');
        inline.setAttribute(
            'data-payment-data-input-id', PAYMENT_DATA_INPUT_ID);
        inline.setAttribute('is-test-mode', opt_isTestMode);
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

