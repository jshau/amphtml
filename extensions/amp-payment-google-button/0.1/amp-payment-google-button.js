/**
 * Copyright 2015 The AMP HTML Authors. All Rights Reserved.
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

import {ActionTrust} from '../../../src/action-trust';
import {AmpPaymentGoogleBase} from '../../../src/payment-google-common';
import {Services} from '../../../src/services';
import {createCustomEvent} from '../../../src/event-helper';

/** @const {string} */
const TAG = 'amp-payment-google-button';

/** @const {string} */
const LOAD_PAYMENT_DATA_EVENT_NAME = 'loadPaymentData';

// This code has been copied from payjs. Avoid modifying this code as much as
// possible in order to keep it in sync with payjs.
// TODO(b/72448795): Remove this code once pay.js has been open-sourced and
// included in the AMP repo.
// START payjs

/**
 * Supported Pay with Google Button type.
 *
 * @enum {string}
 */
const ButtonType = {
  SHORT: 'short',
  LONG: 'long',
};

/** @const {string} */
const LONG_BUTTON_SVG =
    'url(\'https://www.gstatic.com/instantbuy/svg/buy_with_gpay_btn.svg\')';

/** @const {string} */
const SHORT_BUTTON_SVG =
    'url(\'https://www.gstatic.com/instantbuy/svg/gpay_btn.svg\')';

/**
 * Return a <div> element containing "Pay With Google" button.
 *
 * @param {ButtonOptions=} options
 * @return {!Element}
 * @export
 */
function createButton(options = {}) {
  try {
    const button = document.createElement('button');
    if (!Object.values(ButtonType).includes(options.buttonType)) {
      options.buttonType = ButtonType.LONG;
    }
    const backgroundImage = options.buttonType == ButtonType.LONG ?
      LONG_BUTTON_SVG :
      SHORT_BUTTON_SVG;
    const width = options.buttonType == ButtonType.LONG ? '240px' : '160px';
    const styles = [
      'background-color:#fff;', `background-image:${backgroundImage};`,
      'background-position:center;', 'background-origin:content-box;',
      'background-repeat:no-repeat;', 'background-size:contain;',
      'box-shadow:0 1px 3px 0 #6d6d6d;', 'border:0;', 'border-radius:4px;',
      'cursor:pointer;', 'height:40px;', 'outline:0;', 'padding:10px 0;',
      `width:${width};`,
    ];
    button.setAttribute('style', styles.join(''));
    button.addEventListener('focus', function() {
      button.style.boxShadow = '0 1px 3px 0 #6d6d6d, inset 0 0 0 1px #a8abb3';
    });
    button.addEventListener('mousedown', function() {
      button.style.backgroundColor = '#e7e8e8';
    });
    button.addEventListener('mouseup', function() {
      button.style.backgroundColor = '#fff';
    });
    if (options.onClick) {
      button.addEventListener('click', options.onClick);
    } else {
      // TODO(b/69853059): Create different error type so it won't page.
      throw new Error('Parameter \'onClick\' must be set.');
    }

    const div = document.createElement('div');
    div.appendChild(button);
    return div;
  } catch (e) {
    // NOTE: Removed call to PaymentsClient#handleError because PaymentsClient
    // is not available in AMP.
    console.log('Error', e);
  }
}

// END payjs


class AmpPaymentGoogleButton extends AmpPaymentGoogleBase {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    // Initialize the action service. Note that accessing this service in the
    // constructor throws an error in unit tests, so it is set in the
    // buildCallback.

    /** @private {?../../../src/service/action-impl.ActionService} */
    this.actions_ = null;
  }

  /** @override */
  isLayoutSupported(unusedLayout) {
    return true;
  }

  /** @override */
  buildCallback() {
    super.buildCallback();

    this.actions_ = Services.actionServiceForDoc(this.element);

    this.viewer.whenFirstVisible()
        .then(() => super.initializePaymentClient_())
        .then(() => {
          this.render_();
        });
  }

  render_() {
    this.element.appendChild(createButton({
      onClick: () => this.onClickButton_(),
    }));
  }

  onClickButton_() {
    this.viewer
        .sendMessageAwaitResponse(
            'loadPaymentData', this.getPaymentDataRequest_())
        .then(data => {
          const name = LOAD_PAYMENT_DATA_EVENT_NAME;
          const event = createCustomEvent(this.win, `${TAG}.${name}`, data);
          this.actions_.trigger(this.element, name, event, ActionTrust.HIGH);
        });
  }

  /** @override */
  getTag_() {
    return TAG;
  }
}

AMP.extension(TAG, '0.1', AMP => {
  AMP.registerElement(TAG, AmpPaymentGoogleButton);
});

