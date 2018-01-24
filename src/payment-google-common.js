/**
 * @fileoverview Description of this file.
 */

import {isJsonScriptTag} from './dom';
import {tryParseJson} from './json';

/* Types for Google Payment APIs. */

/**
 * Configuration for _Pay with Google_ AMP tags. This configuration should be
 * provided in JSON format in a <script> tag inside the relevant _Pay with Google_
 * tag.
 *
 * @typedef {{
 *   merchantId: (?string|undefined),
 *   allowedPaymentMethods: (?Array<string>|undefined),
 *   paymentMethodTokenizationParameters: ?PaymentMethodTokenizationParameters,
 *   cardRequirements: ?CardRequirements,
 *   phoneNumberRequired: (?boolean|undefined),
 *   emailRequired: (?boolean|undefined),
 *   shippingAddressRequired: (?boolean|undefined),
 *   shippingAddressRequirements: ?ShippingAddressRequirements,
 *   transactionInfo: ?TransactionInfo,
 *   swg: ?SwgParameters,
 * }}
 *
 * @property {string} merchantId The obfuscated merchant gaia id.
 * @property {Array<string>} allowedPaymentMethods The allowedPaymentMethods can
 *     be 'CARD' or 'TOKENIZED_CARD'.
 * @property {PaymentMethodTokenizationParameters}
 *     paymentMethodTokenizationParameters.
 * @property {CardRequirements} cardRequirements.
 * @property {boolean} phoneNumberRequired.
 * @property {boolean} emailRequired.
 * @property {boolean} phoneNumberRequired.
 * @property {boolean} shippingAddressRequired.
 * @property {ShippingAddressRequirements} shippingAddressRequirements.
 * @property {TransactionInfo} transactionInfo
 * @property {SwgParameters} swg
 */
let PaymentDataRequest;

/**
 * Response returned by loadPaymentData.
 *
 * @typedef {{
 *   paymentMethodToken: !PaymentMethodToken,
 *   cardInfo: !CardInfo,
 *   shippingAddress: (?UserAddress|undefined),
 *   email: (?string|undefined),
 * }}
 *
 * @property {PaymentMethodToken} paymentMethodToken Chargeable token.
 * @property {CardInfo} cardInfo Information about the selected card.
 * @property {UserAddress} Shipping address, if shippingAddressRequired was set
 *     to true in the PaymentDataRequest.
 * @property {email} Email address, if emailRequired was set to true in the
 *     PaymentDataRequest.
 */
export let PaymentData;

const PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_ = "data-payment-token-input-id";

export class AmpPaymentGoogleBase extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
  }

  /** @override */
  buildCallback() {
    /* @const @private {string} */
    this.paymentTokenInputId_ = this.element.getAttribute(PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_);
  }

  /**
   * @protected
   * @returns {?PaymentDataRequest|undefined}
   */
  getPaymentDataRequest_() {
    const scripts = this.element.getElementsByTagName('script');
    if (scripts.length != 1) {
      this.user().error(
          this.getTag_(), 'Should contain exactly one <script> child with JSON config.');
      return;
    }
    const firstChild = scripts[0];
    if (!isJsonScriptTag(firstChild)) {
      this.user().error(this.getTag_(),
          'PaymentDataRequest should be in a <script> tag with type="application/json".');
      return;
    }
    const json = tryParseJson(firstChild.textContent, e => {
      this.user().error(
          this.getTag_(), 'Failed to parse PaymentDataRequest. Is it valid JSON?', e);
    });
    return json;
  }

  /*
   * @protected
   * @abstract
   */
  getTag_() {
    throw new Error("Must be implemented by subclass");
  }
}
