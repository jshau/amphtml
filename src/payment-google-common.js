/**
 * @fileoverview Description of this file.
 */

import {Services} from './services';
import {isJsonScriptTag} from './dom';
import {tryParseJson} from './json';

/* Types for Google Payment APIs. */

/**
 * Configuration for _Pay with Google_ AMP tags. This configuration should be
 * provided in JSON format in a <script> tag inside the relevant _Pay with
 * Google_ tag.
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
let PaymentDataRequestDef;

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

/**
 * Request object of isReadyToPay.
 *
 * @typedef {{
 *   allowedPaymentMethods: (?Array<string>|undefined),
 * }}
 *
 * @property {Array<string>} allowedPaymentMethods The allowedPaymentMethods can
 *     be 'CARD' or 'TOKENIZED_CARD'.
 */
export let IsReadyToPayRequest;

/** @const {string} */
const IS_TEST_MODE_ = 'is-test-mode';

export class AmpPaymentGoogleBase extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    // Initialize services. Note that accessing the viewer service in the
    // constructor throws an error in unit tests, so it is set in buildCallback.

    /** @protected @const {!./service/viewer-impl.Viewer} */
    this.viewer = null;

    /** @private {boolean} */
    this.shouldUseTestOverride_ = false;
  }

  /** @override */
  buildCallback() {
    this.viewer = Services.viewerForDoc(this.element);
  }

  /**
   * @protected
   * @returns {?PaymentDataRequestDef|undefined}
   */
  getPaymentDataRequest_() {
    const scripts = this.element.getElementsByTagName('script');
    if (scripts.length > 2 || scripts.length < 1) {
      this.user().error(
          this.getTag_(),
          'Should contain 1 or 2 <script> child with JSON config.');
      return;
    }
    let paymentDataRequest;
    let paymentDataRequestTestOverride;
    for (let i = 0; i < scripts.length; i++) {
      const scriptEl = scripts[i];
      if (!isJsonScriptTag(scriptEl)) {
        this.user().error(
            this.getTag_(),
            'PaymentDataRequest should be in a <script> tag with ' +
                'type="application/json".');
        return;
      }
      const json = tryParseJson(scriptEl.textContent, e => {
        this.user().error(
            this.getTag_(),
            'Failed to parse PaymentDataRequest. Is it valid JSON?', e);
        return;
      });
      if (scriptEl.getAttribute('name') === 'test-override') {
        paymentDataRequestTestOverride = json;
      } else {
        paymentDataRequest = json;
      }
    }
    if (!paymentDataRequest) {
      this.user().error(this.getTag_(), 'PaymentDataRequest not found');
      return;
    }
    if (this.shouldUseTestOverride_ && paymentDataRequestTestOverride) {
      // Override paymentDataRequest with paymentDataRequestTestOverride if test
      // mode
      paymentDataRequest =
          Object.assign(paymentDataRequest, paymentDataRequestTestOverride);
    }

    return paymentDataRequest;
  }

  /**
   * @protected
   * @return {!Promise<(JsonObject|undefined)>} the response promise
   */
  initializePaymentClient_() {
    const isTestMode = this.isTestMode_();
    return this.viewer
        .sendMessageAwaitResponse('initializePaymentClient', {isTestMode})
        .then(result => {
          if (result) {
            this.shouldUseTestOverride_ = result['shouldUseTestOverride'];
            return result;
          }
        });
  }

  /**
   * @potected
   * @return {boolean} if is in test mode
   */
  isTestMode_() {
    const testModeAttr = this.element.getAttribute(IS_TEST_MODE_);
    return testModeAttr ? testModeAttr.toLowerCase() == 'true' : false;
  }

  /**
   * @protected
   * @return {!Promise<(boolean|undefined)>} the response promise will contain
   * the boolean result and error message
   */
  isReadyToPay_() {
    const paymentDataRequest = this.getPaymentDataRequest_();
    return this.viewer.sendMessageAwaitResponse(
        'isReadyToPay',
        {'allowedPaymentMethods': paymentDataRequest.allowedPaymentMethods});
  }

  /*
   * @protected
   * @abstract
   */
  getTag_() {
    throw new Error('Must be implemented by subclass');
  }
}

