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

const createElement = (type, className, children) => {
  const element = global.document.createElement(type);
  element.classList.add(className);
  appendChildren(element, children);
  return element;
};

const appendChildren = (element, children) => {
  children = (!children) ? [] : Array.isArray(children) ? children : [children];
  children.forEach(child => element.appendChild(child));
};

class AmpPayment extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @const @private {!Window} */
    this.win_ = toWin(element.ownerDocument.defaultView);

    /** @const @private {!../../../src/service/action-impl.ActionService} */
    this.actions_ = Services.actionServiceForDoc(element);

    /** @const @private {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(element);
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
    this.viewer_.whenFirstVisible()
        .then(() => this.viewer_.sendMessageAwaitResponse('loadPayments', {}))
        .then(this.renderPaymentSection_.bind(this));
  }

  /** @override */
  renderOutsideViewport() {
    return true;
  }

  /** @private */
  renderInstrumentSelector_() {
    this.viewer_
        .sendMessageAwaitResponse(
            'renderInstrumentSelector',
            {currentCardToken: this.cardToken_.value})
        .then(this.completedCallback_.bind(this));
  }

  /**
   * Render payment section with prefetched payment data.
   * {Object} data
   * @private
   */
  renderPaymentSection_(data) {
    const div = createElement('div', 'payment-section', [
      createElement(
          'div', 'payment-logo', createElement('img', 'payment-logo-img')),
      createElement(
          'div', 'payment-detail',
          [
            createElement('div', 'payment-brand'),
            createElement('div', 'payment-number'),
            createElement('input', 'payment-card-token')
          ]),
      createElement('div', 'payment-button')
    ]);
    div.getElementsByClassName('payment-logo-img')[0].setAttribute(
        'src', data.paymentLogo);
    div.getElementsByClassName('payment-brand')[0].innerHTML =
        'Pay with Google';
    this.cardNumber_ = div.getElementsByClassName('payment-number')[0];
    this.cardNumber_.innerHTML = data.defaultCardNumber;

    this.cardToken_ = div.getElementsByClassName('payment-card-token')[0];
    this.cardToken_.classList.add('hidden');
    this.cardToken_.value = data.defaultCardToken;
    const button = div.getElementsByClassName('payment-button')[0];
    button.innerHTML = 'CHANGE';

    button.addEventListener('click', this.renderInstrumentSelector_.bind(this));

    this.element.appendChild(div);
  };

  /** @private */
  completedCallback_(data) {
    if (data.cardNumber && data.paymentToken) {
      this.cardNumber_.innerHTML = data.cardNumber;
      this.cardToken_.value = data.paymentToken;
    }
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, AmpPayment, CSS);
});
