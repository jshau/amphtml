/**
 * @fileoverview Description of this file.
 */

import {ActionTrust} from '../../../src/action-trust';
import {CSS} from '../../../build/amp-payment-google-inline-0.1.css';
import {createCustomEvent} from '../../../src/event-helper';
import {Services} from '../../../src/services';
import {toWin} from '../../../src/types';

/** @const {string} */
const TAG = 'amp-payment-google-inline';

class AmpPaymentGoogleInline extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.iframe_ = null;

    /** @const @private {!Window} */
    this.win_ = toWin(element.ownerDocument.defaultView);

    /** @const @private {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(element);

    /** @const @private {!../../../src/service/action-impl.ActionService} */
    this.actions_ = Services.actionServiceForDoc(element);
  }

  /** @override */
  buildCallback() {
    this.viewer_.whenFirstVisible()
        .then(() => this.viewer_.sendMessageAwaitResponse('loadPayments', {}))
        .then(this.render_.bind(this));
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
  render_(data) {
    if (data.iframeSrc) {
      window.addEventListener('message', this.onMessage_.bind(this));

      this.iframe_ = global.document.createElement('iframe');
      this.iframe_.src = data.iframeSrc;
      this.iframe_.classList.add('google-pay-iframe');
      this.element.appendChild(this.iframe_);
    }
  };

  onMessage_(event) {
    if (event.data.message === 'renderInstrumentSelector') {
      this.viewer_.sendMessageAwaitResponse('renderInstrumentSelector', {})
          .then((data) => {
            this.iframe_.contentWindow.postMessage({
              message: 'loadedPaymentData',
              paymentData: data
            }, '*');
            this.firePaymentMethodChangedEvent_(data);
          });
    } else if (event.data.message === 'googlePayLoaded') {
      // Fire 'paymentMethodChanged' event when the iframe loads.
      this.firePaymentMethodChangedEvent_(event.data.paymentInfo.defaultInstrument);
    }
  };

  firePaymentMethodChangedEvent_(data) {
    if (data.cardNumber && data.paymentToken) {
      const name = 'paymentMethodChanged';
      const event = createCustomEvent(this.win_, `${TAG}.${name}`, data);
      this.actions_.trigger(this.element, name, event, ActionTrust.HIGH);
    }
  };
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, AmpPaymentGoogleInline, CSS);
});
