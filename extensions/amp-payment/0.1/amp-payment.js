/**
 * Payments extensions that manipulate custom UI.
 * Should be built under ampproject/amphtml.
 */
import {CSS} from '../../../build/amp-payment-0.1.css';
import {ActionTrust} from '../../../src/action-trust';
import {createCustomEvent} from '../../../src/event-helper';
import {Services} from '../../../src/services';
import {installStylesForDoc} from '../../../src/style-installer';
import {toWin} from '../../../src/types';

/** @const {string} */
const TAG = 'amp-payment';

const logoUrl =
    'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_32dp.png';

class AmpPayment extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @const @private {!Window} */
    this.win_ = toWin(element.ownerDocument.defaultView);

    /** @const @private {!../../../src/service/action-impl.ActionService} */
    this.actions_ = Services.actionServiceForDoc(element);
  }

  /** @override */
  getPriority() {
    // Loads after other content.
    return 1;
  }

  /** @override */
  isAlwaysFixed() {
    return true;
  }

  /** @override */
  isLayoutSupported(unusedLayout) {
    return true;
  }

  /** @override */
  buildCallback() {
    this.renderButton_();
  }

  /** @override */
  renderOutsideViewport() {
    return true;
  }

  /** @private */
  loadPayment_() {
    const viewer = Services.viewerForDoc(this.getAmpDoc());
    viewer.whenFirstVisible()
        .then(() => viewer.sendMessageAwaitResponse('loadPayments', {}))
        .then(this.completedCallback_.bind(this));
  }

  /** @private */
  renderButton_() {
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    const button = global.document.createElement('button');
    button.addEventListener('click', this.loadPayment_.bind(this));
    button.classList.add('amp-payment-button');

    this.element.appendChild(button);
  }

  /** @private */
  completedCallback_(data) {
    const name = 'completed';
    const eventPayload = {
      cardNumber: data.cardNumber,
      cardExpDate: data.cardExpDate,
      paymentToken: data.paymentToken
    };
    const event = createCustomEvent(this.win_, `${TAG}.${name}`, eventPayload);
    this.actions_.trigger(this.element, name, event, ActionTrust.HIGH);
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, AmpPayment, CSS);
});
