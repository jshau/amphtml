/**
 * @fileoverview Types for _Pay with Google_ AMP APIs.
 */

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
export let PaymentDataRequest;
