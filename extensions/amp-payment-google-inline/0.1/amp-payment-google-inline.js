/**
 * @fileoverview Description of this file.
 */

import {CSS} from '../../../build/amp-payment-google-inline-0.1.css';
import {ActionTrust} from '../../../src/action-trust';
import {closestByTag, isJsonScriptTag} from '../../../src/dom';
import {createCustomEvent} from '../../../src/event-helper';
import {formOrNullForElement} from '../../../src/form';
import {tryParseJson} from '../../../src/json';
import {AmpPaymentGoogleBase} from '../../../src/payment-google-common';
import {Services} from '../../../src/services';
import {toWin} from '../../../src/types';

/** @const {string} */
const TAG = 'amp-payment-google-inline';


class AmpPaymentGoogleInline extends AmpPaymentGoogleBase {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.iframe_ = null;

    /** @const @private {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(element);
  }

  /** @override */
  buildCallback() {
    super.buildCallback();
    this.viewer_.whenFirstVisible()
        .then(() => this.viewer_.sendMessageAwaitResponse('getInlinePaymentIframeUrl', {}))
        .then((data) => this.render_(data));
  }

  /** @override */
  isLayoutSupported(unusedLayout) {
    return true;
  }

  /**
   * Render payment section with prefetched payment data.
   * {Object} data
   * @private
   */
  render_(iframeSrc) {
    if (iframeSrc) {
      window.addEventListener('message', this.onMessage_.bind(this));

      this.iframe_ = this.win.document.createElement('iframe');
      this.iframe_.src = iframeSrc;
      this.iframe_.classList.add('google-pay-iframe');
      this.element.appendChild(this.iframe_);
    }

    const enclosingForm = closestByTag(this.element, 'form');
    if (!enclosingForm) {
      this.user().error(
          TAG, 'Should be inside a <form> element.');
      return;
    }

    const enclosingAmpForm = formOrNullForElement(enclosingForm);
    if (!enclosingAmpForm) {
      this.user().error(
          TAG, '<form> should have an associated AmpForm.');
      return;
    }

    enclosingAmpForm.addPresubmitHandler(() => this.populatePaymentToken_());
  };

  /**
   * Handler for messages from the iframe.
   * @private
   */
  onMessage_(event) {
    if (event.data.message === 'loadPaymentData') {
      this.viewer_.sendMessageAwaitResponse('loadPaymentData', this.getPaymentDataRequest_())
          .then((data) => {
            this.sendIframeMessage_('loadedPaymentData', data);
            this.getPaymentTokenInput_().value = data.paymentMethodToken.token;
          });
    }
  };

  /**
   * @private
   * @returns {!Promise}
   */
  populatePaymentToken_() {
    const input = this.getPaymentTokenInput_();

    // If the payment token is already present, then we can submit the form
    // immediately.
    // TODO(justinmanley): Handle the case where the user has tapped 'Continue'
    // in the instrument selector and then immediately triggered the form submit
    // (e.g. tapped 'Buy now') before the payment token was loaded and added to
    // the <input> tag. We want to ensure that there is no race condition there.
    if (input.value) {
      return Promise.resolve();
    }

    // If the payment token is not yet present, then we need to fetch it before
    // submitting the form. This will happen if the user decides to use the
    // default instrument shown in the inline widget.
    return this.sendIframeMessageAwaitResponse_('loadDefaultPaymentData')
        .then((data) => {
          input.value = data.paymentMethodToken.token;
        });
  }

  /**
   * Send a message to the widget iframe and return a promise which will be
   * fulfilled with the response to the message.
   *
   * @param {string} messageName
   * @param {Object} [messagePayload]
   * @returns {!Promise}
   * @private
   */
  sendIframeMessageAwaitResponse_(messageName, messagePayload) {
    const promise = new Promise((resolve, reject) => {
      window.addEventListener('message', (event) => {
        if (event.data.message === messageName) {
          resolve(event.data.data);
        }
      });
    });

    this.sendIframeMessage_(messageName, messagePayload);

    return promise;
  }

  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {string} messageName
   * @param {Object} [messagePayload]
   * @private
   */
  sendIframeMessage_(messageName, messagePayload) {
    let message = {
      message: messageName
    };

    if (messagePayload) {
      message.data = messagePayload;
    }

    this.iframe_.contentWindow.postMessage(message, '*');
  }

  /**
   * @protected
   * @returns {Element}
   */
  getPaymentTokenInput_() {
    const input = this.win.document.getElementById(this.paymentTokenInputId_);
    if (!input) {
      this.user().error(
          this.getTag_(),
          'Document must contain an element with ID ' + this.paymentTokenInputId_);
    }

    if (input.nodeName !== 'INPUT') {
      this.user().error(
          this.getTag_(),
          PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_ + ' must specify the ID of an <input> ' +
          'element; ' + this.paymentTokenInputId_ + ' is a ' + input.nodeName + '.');
    }

    return input;
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, AmpPaymentGoogleInline, CSS);
});
