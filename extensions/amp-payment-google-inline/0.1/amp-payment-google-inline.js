/**
 * @fileoverview Tests for the amp-payment-google-inline extension.
 */

import {AmpPaymentGoogleBase} from '../../../src/payment-google-common';
import {CSS} from '../../../build/amp-payment-google-inline-0.1.css';
import {closestByTag} from '../../../src/dom';
import {formOrNullForElement} from '../../../src/form';
import {getServiceForDoc} from '../../../src/service';
import {map} from '../../../src/utils/object';

/** @const {string} */
const TAG = 'amp-payment-google-inline';

/** @const {string} */
const SERVICE_TAG = 'payment-google-inline';

/** @const {string} */
const PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_ = 'data-payment-token-input-id';

class AmpPaymentGoogleInline extends AmpPaymentGoogleBase {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.iframe_ = null;

    this.iframeService_ = getServiceForDoc(this.win.document, SERVICE_TAG);
  }

  /** @override */
  buildCallback() {
    super.buildCallback();

    this.viewer.whenFirstVisible()
        .then(() => super.initializePaymentClient_())
        .then(() => {
          return this.viewer
              .sendMessageAwaitResponse('getInlinePaymentIframeUrl', {});
        })
        .then(data => this.render_(data));
  }

  /** @override */
  isLayoutSupported(unusedLayout) {
    return true;
  }

  /**
   * Render the inline widget.
   * @param {string} iframeSrc The source of the iframe hosting the inline
   *     widget.
   * @private
   */
  render_(iframeSrc) {
    if (iframeSrc) {
      window.addEventListener('message', event => this.onMessage_(event));

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
  }

  /**
   * Handler for messages from the iframe. This handler is for requests sent
   * from the iframe to the AMP page; the @link {AmpPaymentGoogleInlineService}
   * handles messages which are responses to requests sent by the AMP page.
   *
   * @private
   */
  onMessage_(event) {
    if (event.data.message === 'loadPaymentData') {
      this.viewer
          .sendMessageAwaitResponse('loadPaymentData',
              this.getPaymentDataRequest_())
          .then(data => {
            this.iframeService_
                .sendIframeMessage(this.iframe_, 'loadedPaymentData', data);
            this.getPaymentTokenInput_().value = data.paymentMethodToken.token;
          });
    }
  }

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
    return this.iframeService_
        .sendIframeMessageAwaitResponse(this.iframe_, 'loadDefaultPaymentData')
        .then(data => {
          input.value = data.paymentMethodToken.token;
        });
  }

  /**
   * @protected
   * @returns {Element}
   */
  getPaymentTokenInput_() {
    const paymentTokenInputId = this.element.getAttribute(
        PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_);

    const input = this.win.document.getElementById(
        paymentTokenInputId);
    if (!input) {
      this.user().error(
          this.getTag_(),
          'Document must contain an element with ID ' + paymentTokenInputId);
    }

    if (input.nodeName !== 'INPUT') {
      this.user().error(
          this.getTag_(),
          PAYMENT_TOKEN_INPUT_ID_ATTRIBUTE_ + ' must specify the ID of an ' +
          '<input> element; #' + paymentTokenInputId + ' is a ' +
          input.nodeName + '.');
    }

    return input;
  }

  /** @override */
  getTag_() {
    return TAG;
  }
}


/**
 * Container for data about a postMessage request sent to an iframe. The data is
 * used to match incoming messages (responses) to the requests that prompted
 * them.
 *
 * @typedef {{
 *   resolve: !Function,
 *   origin: string,
 *   messageName: string,
 * }}
 *
 * @property {!Function} resolve A function which will be called to resolve the
 *     promise for the request.
 * @property {string} origin The origin of the frame to which this request was
 *     sent. This is used to check that the response comes from the same frame.
 * @property {string} messageName The name of the request message. Should match
 *     the name of the response message.
 */
let MessageRequestDataDef;

/**
 * Handles messaging with iframe. This can be mocked in tests.
 */
export class AmpPaymentGoogleInlineService {
  constructor() {
    // /** @private {Map<number, MessageRequestDataDef>} */
    this.requestData_ = map();

    /** @private {number} */
    this.nextMessageId_ = 0;

    const service = this;
    window.addEventListener('message', event => {
      const request = service.requestData_[event.data.messageId];
      if (request && event.origin === request.origin
                  && event.data.message === request.messageName) {
        request.resolve(event.data.data);
      }
    });
  }

  /**
   * Send a message to the widget iframe and return a promise which will be
   * fulfilled with the response to the message.
   *
   * Note that in order for responses to be processed correctly, the iframe
   * receiving the request must return the messageId in the 'messageId' field of
   * the response payload.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} messageName
   * @param {!Object} [messagePayload]
   * @returns {!Promise}
   */
  sendIframeMessageAwaitResponse(iframe, messageName, messagePayload) {
    const messageId = this.nextMessageId_++;
    const promise = new Promise(resolve => {
      this.requestData_[messageId] = {
        resolve,
        messageName,
        origin: iframe.contentWindow.origin,
      };
    });

    this.sendIframeMessageWithId_(
        iframe, messageName, messageId, messagePayload);

    return promise;
  }

  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} messageName
   * @param {!Object} [messagePayload]
   */
  sendIframeMessage(iframe, messageName, messagePayload) {
    this.sendIframeMessageInternal_(iframe, {
      message: messageName,
    }, messagePayload);
  }

  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} messageName
   * @param {number} messageId
   * @param {!Object} [messagePayload]
   * @private
   */
  sendIframeMessageWithId_(iframe, messageName, messageId, messagePayload) {
    this.sendIframeMessageInternal_(iframe, {
      message: messageName,
      messageId,
    }, messagePayload);
  }


  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {{ message: string, messageId: ?number }} message
   * @param {!Object} [messagePayload]
   * @private
   */
  sendIframeMessageInternal_(iframe, message, messagePayload) {
    if (messagePayload) {
      message.data = messagePayload;
    }

    iframe.contentWindow.postMessage(message, iframe.contentWindow.origin);
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc(SERVICE_TAG, AmpPaymentGoogleInlineService);
  AMP.registerElement(TAG, AmpPaymentGoogleInline, CSS);
});
