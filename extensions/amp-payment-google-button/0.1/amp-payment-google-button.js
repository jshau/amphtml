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

import {PaymentsClient} from '../../../third_party/payjs/src/payjs';
import {createButtonHelper} from '../../../third_party/payjs/src/button';
import {ActionTrust} from '../../../src/action-constants';
import {AmpPaymentGoogleBase} from '../../../src/payment-google-common';
import {Services} from '../../../src/services';
import {createCustomEvent} from '../../../src/event-helper';

/** @const {string} */
const TAG = 'amp-payment-google-button';

/** @const {string} */
const LOAD_PAYMENT_DATA_EVENT_NAME = 'loadPaymentData';

class AmpPaymentGoogleButton extends AmpPaymentGoogleBase {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    // Initialize the action service. Note that accessing this service in the
    // constructor throws an error in unit tests, so it is set in the
    // buildCallback.

    /** @private {?../../../src/service/action-impl.ActionService} */
    this.actions_ = null;

    /** @private {?PaymentsClient} */
    this.client_ = null;
  }

  /** @override */
  isLayoutSupported(unusedLayout) {
    return true;
  }

  /** @override */
  buildCallback() {
    super.buildCallback();

    this.actions_ = Services.actionServiceForDoc(this.element);

    return this.viewer.whenFirstVisible()
        .then(() => this.viewer.isTrustedViewer())
        .then(result => {
          if (result) {
            return super.initializePaymentClient_()
                .then(() => super.isReadyToPay_())
                .then(response => {
                  if (response['result']) {
                    this.render_(() => this.onClickButton_());
                  } else {
                    throw new Error('Google Pay is not supported');
                  }
                });
          } else {
            // not in Google Viewer, use Google Payments Client directly
            this.localInitializePaymentClient_();
            return this.localIsReadyToPay_()
                .then(response => {
                  if (response['result']) {
                    this.render_(() => this.localOnClickButton_());
                  } else {
                    throw new Error('Google Pay is not supported');
                  }
                });
          }
    });
  }

  /**
   * Render the google pay button with specified on click function.
   *
   * @param {!function(): void} onClickFunc on click function of the google pay button
   * @private
   */
  render_(onClickFunc) {
    this.element.appendChild(createButtonHelper({
      onClick: onClickFunc,
    }));
  }

  /**
   * Request payment data, which contains necessary information to
   * complete a payment, and trigger the load payment data event.
   *
   * @private
   */
  onClickButton_() {
    this.viewer
        .sendMessageAwaitResponse(
            'loadPaymentData', super.getPaymentDataRequest_())
        .then(data => this.triggerAction_(data));
  }

  /**
   * Trigger load payment data event with the given payment data
   *
   * @param {!PaymentData} paymentData payment data from load payment data function
   * @private
   */
  triggerAction_(paymentData) {
    const name = LOAD_PAYMENT_DATA_EVENT_NAME;
    const event = createCustomEvent(this.win, `${TAG}.${name}`, paymentData);
    this.actions_.trigger(this.element, name, event, ActionTrust.HIGH);
  }

  /**
   * Initialize a PaymentsClient object. Initial development will use a
   * TEST environment returning dummy payment methods suitable for referencing
   * the structure of a payment response. A selected payment method is not
   * capable of a transaction.
   *
   * @private
   */
  localInitializePaymentClient_() {
    const isTestMode = super.isTestMode_();
    let options;
    if (isTestMode) {
        options = {'environment': 'TEST'};
    } else {
        options = {'environment': 'PRODUCTION'};
    }
    this.client_ = new PaymentsClient(options);
  }

  /**
   * Check in local payments client that if the user can make payments
   * using the Payment API. Will return if the Google Pay API is supported
   * by the current browser for the specified payment methods.
   *
   * @return {!Promise<(boolean|undefined)>} the response promise will contain
   * the boolean result and error message
   * @private
   */
  localIsReadyToPay_() {
    const paymentDataRequest = super.getPaymentDataRequest_();
    return this.client_.isReadyToPay(
        {'allowedPaymentMethods': paymentDataRequest.allowedPaymentMethods}
    );
  }

  /**
   * Request payment data, which contains necessary information to
   * complete a payment on local payments client and trigger the load
   * payment data event.
   *
   * @private
   */
  localOnClickButton_() {
    this.client_.loadPaymentData(super.getPaymentDataRequest_())
        .then(data => this.triggerAction_(data));
  }

  /** @override */
  getTag_() {
    return TAG;
  }
}

AMP.extension(TAG, '0.1', AMP => {
  AMP.registerElement(TAG, AmpPaymentGoogleButton);
});

