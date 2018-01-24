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

import {mockServiceForDoc} from '../../../../testing/test-helper';
import {Services} from '../../../../src/services';
import * as sinon from 'sinon';
import '../amp-payment-google-button';

describes.realWin('amp-payment-google-button', {
  amp: {
    extensions: ['amp-payment-google-button'],
  },
}, env => {
  let win, doc;
  let viewerMock;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    viewerMock = mockServiceForDoc(env.sandbox, env.ampdoc, 'viewer', [
      'whenFirstVisible',
      'sendMessageAwaitResponse',
    ]);

    viewerMock.whenFirstVisible.returns(Promise.resolve());
  });

  it('loads a button and displays the selected instrument', () => {
    return getAmpPaymentGoogleButton().then(gPayButton => {
      viewerMock.sendMessageAwaitResponse
          .withArgs('loadPaymentData', sinon.match.any)
          .returns(Promise.resolve({
            paymentMethodToken: {
              token: 'fakeToken',
            },
          }));

      const trigger = sandbox.spy(gPayButton.implementation_.actions_, 'trigger');

      const buttons = gPayButton.getElementsByTagName('button');
      expect(buttons.length).to.equal(1);
      buttons.item(0).click();

      // Delay until the 'loadPaymentData' message response is processed.
      return Services.timerFor(win).promise(50).then(() => {
        expect(trigger).to.be.calledWith(
            gPayButton,
            'loadPaymentData',
            sinon.match.any);

        trigger.restore();
      });
    });
  });

  function getAmpPaymentGoogleButton() {
    const button = doc.createElement('amp-payment-google-button');

    const config = doc.createElement('script');
    config.setAttribute('type', 'application/json');
    config.innerHTML = '{}';
    button.appendChild(config);

    doc.body.appendChild(button);

    return button.build()
        .then(() => button.layoutCallback())
        .then(() => button);
  }
});
