import {ActionTrust} from '../../../src/action-trust';
import {Services} from '../../../src/services';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {tryParseJson} from '../../../src/json';


/** @const {string} */
const TAG = 'amp-action';

export class ActionService {
  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    const actionElement = ampdoc.getElementById('amp-action');

    /** @const @private {boolean} */
    this.enabled_ = !!actionElement;
    if (!this.enabled_) {
      return;
    }

    /** @const @private {!Element} */
    this.actionElement_ = dev().assertElement(actionElement);

    /** @const @private {!JsonObject} */
    this.configJson_ = tryParseJson(this.actionElement_.textContent, e => {
      throw user().createError('Failed to parse "amp-action" JSON: ' + e);
    });

    /** @private @const {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(ampdoc);

    Services.actionServiceForDoc(ampdoc).installActionHandler(
        this.actionElement_, this.actionHandler_.bind(this), ActionTrust.HIGH);
  }

  /**
   * @param {!../../../src/service/action-impl.ActionInvocation} invocation
   * @return {?Promise}
   * @private
   */
  actionHandler_(invocation) {
    if (invocation.method == 'orderCompleted' && !!invocation.args) {
      this.viewer_.sendMessage('orderCompleted', invocation.args);
    }
    return null;
  }

  /**
   * @private
   */
  start_() {
    if (!this.enabled_) {
      user().info(TAG, 'Invalid AMP Action - no "id=amp-action" element');
      return this;
    }
    this.viewer_.sendMessage('actionConfig', dict({
      'config': this.configJson_,
    }));
    return this;
  }
}

// Register the extension services.
AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc('aog-action', function(ampdoc) {
    return new ActionService(ampdoc).start_();
  });
});
