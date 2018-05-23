/**
 * @fileoverview Tests for the amp-payment-google-inline extension.
 */

import {ActionTrust} from '../../../src/action-constants';
import {AmpPaymentGoogleBase} from '../../../src/payment-google-common';
import {CSS} from '../../../build/amp-payment-google-inline-0.1.css';
import {Layout} from '../../../src/layout';
import {Services} from '../../../src/services';
import {closestByTag} from '../../../src/dom';
import {createCustomEvent} from '../../../src/event-helper';
import {formOrNullForElement} from '../../../src/form';
import {getServiceForDoc} from '../../../src/service';
import {map} from '../../../src/utils/object';
import {parseUrl} from '../../../src/url';
import {setStyles} from '../../../src/style';

/** @const {string} */
const TAG = 'amp-payment-google-inline';

/** @const {string} */
const SERVICE_TAG = 'payment-google-inline';

/** @const {string} */
const PAYMENT_DATA_INPUT_ID_ATTRIBUTE_ = 'data-payment-data-input-id';

/** @const {string} */
const PAYMENT_READY_STATUS_CHANGED = 'paymentReadyStatusChanged';

/** @const {number} */
const GOOGLE_PAY_LOG_INLINE_PAYMENT_WIDGET_INITIALIZE = 4;

/** @const {number} */
const GOOGLE_PAY_TYPE_AMP_INLINE = 8;

class AmpPaymentGoogleInline extends AmpPaymentGoogleBase {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.iframe_ = null;

    this.iframeService_ = getServiceForDoc(this.win.document, SERVICE_TAG);

    /** @private {string} */
    this.iframeOrigin_ = '';

    /** @private {function()|null} */
    this.iframeReadyResolver_ = null;

    /** @private {function()|null} */
    this.iframeReadyRejector_ = null;

    /** @private {Promise} */
    this.iframeReadyPromise_ = new Promise((resolve, reject) => {
      this.iframeReadyResolver_ = resolve;
      this.iframeReadyRejector_ = reject;
    });

    /** @private {number} */
    this.iframeInitializeLatency_ = Date.now();
  }

  /** @override */
  buildCallback() {
    super.buildCallback();

    this.actions_ = Services.actionServiceForDoc(this.element);

    this.viewer.whenFirstVisible()
        .then(() => super.initializePaymentClient_())
        .then(
            () => {
              return super.isReadyToPay_();
            },
            error => {
              this.user().error(
                  'Initialize payment client failed with error: ' + error);
            })
        .then(result => {
          if (result) {
            return this.viewer.sendMessageAwaitResponse(
                'getInlinePaymentIframeUrl', this.getPaymentDataRequest_());
          } else {
            // Unblock layoutCallback.
            this.iframeReadyRejector_('Google Pay is not supported');
          }
        })
        .then(data => this.render_(data));
  }

  /** @override */
  layoutCallback() {
    return this.iframeReadyPromise_;
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == Layout.FIXED_HEIGHT;
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
      this.iframeOrigin_ = parseUrl(iframeSrc).origin;
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
          .sendMessageAwaitResponse(
              'loadPaymentData', this.getPaymentDataRequest_())
          .then(
              data => {
                this.iframeService_.sendIframeMessage(
                    this.iframe_, this.iframeOrigin_, 'loadPaymentData', data);
              },
              error => {this.user().error(
                  this.getTag_(),
                  'Error while calling loadPaymentData: ' + error);});
    } else if (event.data.message === 'paymentReadyStatusChanged') {
      if (this.iframeReadyResolver_) {
        this.iframeReadyResolver_();
        this.iframeReadyResolver_ = null;
        this.sendLogDataMessage_({
          'eventType': GOOGLE_PAY_LOG_INLINE_PAYMENT_WIDGET_INITIALIZE,
          'clientLatencyStartMs': this.iframeInitializeLatency_,
          'buyFlowMode': GOOGLE_PAY_TYPE_AMP_INLINE,
        });
      }
      const name = PAYMENT_READY_STATUS_CHANGED;
      const customEvent =
          createCustomEvent(this.win, `${TAG}.${name}`, event.data.data);
      this.actions_.trigger(this.element, name, customEvent, ActionTrust.HIGH);
    } else if (event.data.message === 'prefetchPaymentData') {
      this.viewer
          .sendMessage(
              'prefetchPaymentData', this.getPaymentDataRequest_());
    } else if (event.data.message === 'resize') {
      this.resizeIframe_(event.data.data);
    } else if (event.data.message === 'validateViewer') {
      this.viewer.isTrustedViewer().then(result => {
        this.iframeService_.sendIframeMessage(
            this.iframe_, this.iframeOrigin_, 'validateViewerReply',
            {'result': result});
      });
    } else if (event.data.message === 'logPaymentData') {
      this.sendLogDataMessage_(event.data.data);
    }
  }

  /**
   * @private
   * @returns {!Promise}
   */
  populatePaymentToken_() {
    const input = this.getPaymentTokenInput_();

    // If the payment token is not yet present, then we need to fetch it before
    // submitting the form. This will happen if the user decides to use the
    // default instrument shown in the inline widget.
    return this.iframeService_
        .sendIframeMessageAwaitResponse(
            this.iframe_, this.iframeOrigin_, 'getSelectedPaymentData')
        .then(
            data => {
              input.value = JSON.stringify(data);
            },
            error => {this.user().error(
                this.getTag_(),
                'Error on submission: ' + error);});
  }

  /**
   * @protected
   * @returns {Element}
   */
  getPaymentTokenInput_() {
    const paymentTokenInputId = this.element.getAttribute(
        PAYMENT_DATA_INPUT_ID_ATTRIBUTE_);

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
          PAYMENT_DATA_INPUT_ID_ATTRIBUTE_ + ' must specify the ID of an ' +
          '<input> element; #' + paymentTokenInputId + ' is a ' +
          input.nodeName + '.');
    }

    return input;
  }

  /**
   * @param {!Object} resizeRequest
   * @private
   */
  resizeIframe_(resizeRequest) {
    setStyles(this.iframe_, {
      transition: resizeRequest['transition'],
      height: resizeRequest['frameHeight'] + 'px',
    });
    setStyles(this.element, {
      transition: resizeRequest['transition'],
      height: resizeRequest['frameHeight'] + 'px',
    });
  }

  /**
   * @param {!Object} data
   * @private
   */
  sendLogDataMessage_(data) {
    this.viewer.sendMessage('logPaymentData', data);
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
 *   reject: !Function,
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
        if (event.data.error) {
          request.reject(event.data.error);
        } else {
          request.resolve(event.data.data);
        }
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
   * @param {string} iframeOrigin
   * @param {string} messageName
   * @param {!Object} [messagePayload]
   * @returns {!Promise}
   */
  sendIframeMessageAwaitResponse(
    iframe, iframeOrigin, messageName, messagePayload) {
    const messageId = this.nextMessageId_++;
    const promise = new Promise((resolve, reject) => {
      this.requestData_[messageId] = {
        resolve,
        reject,
        messageName,
        origin: iframeOrigin,
      };
    });

    this.sendIframeMessageWithId_(
        iframe, iframeOrigin, messageName, messageId, messagePayload);

    return promise;
  }

  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} iframeOrigin
   * @param {string} messageName
   * @param {!Object} [messagePayload]
   */
  sendIframeMessage(iframe, iframeOrigin, messageName, messagePayload) {
    this.sendIframeMessageInternal_(
        iframe, iframeOrigin, {
          message: messageName,
        },
        messagePayload);
  }

  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} iframeOrigin
   * @param {string} messageName
   * @param {number} messageId
   * @param {!Object} [messagePayload]
   * @private
   */
  sendIframeMessageWithId_(
    iframe, iframeOrigin, messageName, messageId, messagePayload) {
    this.sendIframeMessageInternal_(
        iframe, iframeOrigin, {
          message: messageName,
          messageId,
        },
        messagePayload);
  }


  /**
   * Send a message to the widget iframe without waiting for a response.
   *
   * @param {HTMLIFrameElement} iframe
   * @param {string} iframeOrigin
   * @param {{ message: string, messageId: ?number }} message
   * @param {!Object} [messagePayload]
   * @private
   */
  sendIframeMessageInternal_(iframe, iframeOrigin, message, messagePayload) {
    if (messagePayload) {
      message.data = messagePayload;
    }

    iframe.contentWindow.postMessage(message, iframeOrigin);
  }
}

AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc(SERVICE_TAG, AmpPaymentGoogleInlineService);
  AMP.registerElement(TAG, AmpPaymentGoogleInline, CSS);
});

