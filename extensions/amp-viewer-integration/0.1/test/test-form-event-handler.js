/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
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

import * as lolex from 'lolex';
import {FormEventHandler} from '../form-event-handler';
import {Messaging} from '../messaging/messaging';

describes.fakeWin('FormEventHandler', {
  amp: true,
  location: 'https://pub.com/doc1',
}, env => {
  describe('FormEventHandler Unit Tests', function() {

    class WindowPortEmulator {
      constructor(win, origin) {
        /** @const {!Window} */
        this.win = win;
        /** @private {string} */
        this.origin_ = origin;
      }

      addEventListener() {}

      postMessage(data, origin) {
        messages.push({
          data,
          origin,
        });
      }
      start() {}
    }

    function getForm(doc) {
      const form = doc.createElement('form');
      form.setAttribute('method', 'POST');
      form.setAttribute('action-xhr', 'https://example.com');

      const nameInput = doc.createElement('input');
      nameInput.setAttribute('name', 'name');
      nameInput.setAttribute('value', 'John Miller');
      form.appendChild(nameInput);

      const emailInput = doc.createElement('input');
      emailInput.setAttribute('name', 'email');
      emailInput.setAttribute('value', '');
      form.appendChild(emailInput);

      return form;
    }

    let win;
    let clock;
    let formEventHandler;
    let messaging;
    let messages;
    let form;

    beforeEach(() => {
      messages = [];
      win = env.win;
      form = getForm(win.document);
      clock = lolex.install({target: win, toFake: ['Date', 'setTimeout']});
      const port =
        new WindowPortEmulator(this.messageHandlers_, 'origin doesnt matter');
      messaging = new Messaging(win, port);
      formEventHandler = new FormEventHandler(win, messaging, env.ampdoc);
      sandbox.stub(formEventHandler.resources_, 'getElementLayoutBox')
          .callsFake(unusedElement => {
            return Promise.resolve({
              left: 50,
              right: 150,
              width: 100,
              top: 20,
              bottom: 180,
              height: 160,
            });
          });
    });

    afterEach(() => {
      formEventHandler = null;
    });

    it('should forward supported form events', () => {
      const nameInput = form.children[0];
      formEventHandler.handleEvent_({
        type: 'focus',
        target: nameInput,
      });
      formEventHandler.handleEvent_({
        type: 'change',
        target: nameInput,
      });
      formEventHandler.handleEvent_({
        type: 'blur',
        target: nameInput,
      });
      return Promise.resolve()
          .then(() => {
            expect(messages).to.have.length(3);
            expect(messages[0].data.name).to.equal('focus');
            expect(messages[1].data.name).to.equal('change');
            expect(messages[2].data.name).to.equal('blur');
          });
    });

    it('should forward supported scroll events', () => {
      formEventHandler.focusedElement_ = form.children[0];
      formEventHandler.handleScrollEvent_();
      formEventHandler.handleScrollEvent_();
      expect(messages).to.have.length(0);
      return Promise.resolve().then(() => {
        expect(messages).to.have.length(1);
        expect(messages[0].data.name).to.equal('fieldScrollStart');
        clock.tick(500);
      }).then(() => {
        expect(messages).to.have.length(2);
        expect(messages[1].data.name).to.equal('fieldScrollEnd');
      });
    });
  });
});
