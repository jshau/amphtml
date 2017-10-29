/**
 * Payments extensions that manipulate custom UI.
 * Should be built under ampproject/amphtml.
 */
import {CSS} from '../../../build/amp-payment-0.1.css';
import {Services} from '../../../src/services';
import {installStylesForDoc} from '../../../src/style-installer';

/** @const {string} */
const TAG = 'amp-payment';

class AmpPayment extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
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
    // Don't parse or fetch in prerender mode.
    this.registerAction('load', this.loadPayments_.bind(this));
  }

  /** @override */
  renderOutsideViewport() {
    return true;
  }

  /** @private */
  loadPayments_() {
    const viewer = Services.viewerForDoc(this.getAmpDoc());
    viewer.whenFirstVisible().then(viewer.sendMessage('loadPayments', {}));
    if (!this.registerRenderPayments_) {
      this.registerRenderPayments_ = true;
      viewer.onMessage('renderPayments', this.render_.bind(this));
    }
  }

  /** @private */
  render_(data) {
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }
    // Starts with some basic operations.
    const div = global.document.createElement('div');
    div.innerHTML = '<form' +
        'id="checkout"' +
        'method="post"' +
        'action-xhr="/api/movie/{{movie.id}}/theater/{{theater.id}}/buy/{{showtime.time}}/checkout">' +
        '<div class="form-row">' +
        '<p class="subtitle"> Add a new credit or debit card </p>' +
        '<div class="card-row">' +
        '  <div class="card-number">' +
        '    <label>Card number</label>' +
        '    <input type="text" name="cardNumber" placeholder="4111111111111111">' +
        '  </div>' +
        '  <div class="card-exp-date">' +
        '    <label>Exp date</label>' +
        '    <input type="text" name="expirationDate" placeholder="mm/yy">' +
        '  </div>' +
        '  <div class="card-cvn">' +
        '    <label>CVN</label>' +
        '    <input type="text" name="cvn" placeholder="123">' +
        '  </div>' +
        '</div>' +
        '</form>' +
        '<div class="next-button">' +
        '  <a tabindex="1" on="tap:checkout.submit">PLACE ORDER</a>' +
        '</div>';
    this.element.appendChild(div);
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerElement(TAG, AmpPayment, CSS);
});