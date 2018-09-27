import {AmpPaymentGoogleIntegration, AmpPaymentGoogleInlineService} from '../../../src/service/payments/amp-payment-google';
import {CSS} from '../../../build/amp-payment-google-inline-0.1.css';
import {Layout} from '../../../src/layout';
import {getServiceForDoc} from '../../../src/service';

/** @const {string} */
const TAG = 'amp-payment-google-inline';

class AmpPaymentGoogleInline extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
  }

  /** @override */
  buildCallback() {
    /**
     * @private {!AmpPaymentGoogleIntegration}
     */
    this.paymentsIntegration_ =
        getServiceForDoc(this.win.document, 'amp-payment-google-integration');
    this.paymentsIntegration_.startInlinePayment(this.element);
  }

  /** @override */
  layoutCallback() {
    return this.paymentsIntegration_.whenInlineWidgetReady();
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == Layout.FIXED_HEIGHT;
  }

  /** @override */
  getTag_() {
    return TAG;
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc(
      'payment-google-inline', AmpPaymentGoogleInlineService);
  AMP.registerServiceForDoc('amp-payment-google-integration', function(ampdoc) {
    return new AmpPaymentGoogleIntegration(ampdoc);
  });
  AMP.registerElement(TAG, AmpPaymentGoogleInline, CSS);
});

