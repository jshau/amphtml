import {ActionTrust} from '../../../src/action-trust';
import {Services} from '../../../src/services';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {tryParseJson} from '../../../src/json';


/** @const {string} */
const TAG = 'amp-action';

const GSI_TOKEN_PROVIDER = 'actions-on-google-gsi';

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

    /** @const @private */
    this.ampdoc_ = ampdoc;

    /** @const @private {!Element} */
    this.actionElement_ = dev().assertElement(actionElement);

    /** @const @private {!JsonObject} */
    this.configJson_ = tryParseJson(this.actionElement_.textContent, e => {
      throw user().createError('Failed to parse "amp-action" JSON: ' + e);
    });

    /** @private @const {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(ampdoc);

    /** @private @const {!../../../src/service/action-impl.ActionService} */
    this.action_ = Services.actionServiceForDoc(ampdoc);
    this.action_.installActionHandler(
        this.actionElement_, this.actionHandler_.bind(this), ActionTrust.HIGH);

    /** @private @const {!../../../src/service/variable-source.VariableSource} */
    this.variableSource_ = Services.urlReplacementsForDoc(ampdoc)
        .getVariableSource();

    /** @private @const {!../../../src/service/vsync-impl.Vsync} */
    this.vsync_ = Services.vsyncFor(ampdoc.win);
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
    if (invocation.method == 'signIn') {
      this.requestSignIn_();
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

    this.variableSource_.set('IDENTITY_TOKEN', () => this.getIdToken_());

    this.viewer_.sendMessage('actionConfig', dict({
      'config': this.configJson_,
    }));
    return this;
  }

  /**
   * @private
   * @returns {!Promise<string>}
   */
  getIdToken_() {
    return this.viewer_.sendMessageAwaitResponse('getAccessTokenPassive', dict({
      // For now there's only 1 provider option, so we just hard code it
      'providers': [GSI_TOKEN_PROVIDER],
    })).then(token => {
      this.setIdTokenStatus_(Boolean(token));
      return token;
    }).catch(() => {
      this.setIdTokenStatus_(/*available=*/false);
    });
  }

  /**
   * @private
   */
  requestSignIn_() {
    this.viewer_.sendMessageAwaitResponse('requestSignIn', dict({
      'providers': [GSI_TOKEN_PROVIDER],
    })).then(token => {
      user().info(TAG, 'Token: ' + token);
      if (token) {
        this.setIdTokenStatus_(/*available=*/true);
        this.action_.trigger(
            this.actionElement_, 'signedIn', null, ActionTrust.HIGH);
      }
    });
  }

  /**
   * Toggles the CSS classes related to the status of the identity token.
   * @private
   * @param {boolean} available
   */
  setIdTokenStatus_(available) {
    this.toggleTopClass_('amp-action-identity-available', available);
    this.toggleTopClass_('amp-action-identity-unavailable', !available);
  }

  /**
   * Gets the root element of the AMP doc.
   * @return {!Element}
   * @private
   */
  getRootElement_() {
    const root = this.ampdoc_.getRootNode();
    return dev().assertElement(root.documentElement || root.body || root);
  }

  /**
   * Toggles a class on the root element of the AMP doc.
   * @param {string} className
   * @param {boolean} on
   * @private
   */
  toggleTopClass_(className, on) {
    this.vsync_.mutate(() => {
      this.getRootElement_().classList.toggle(className, on);
    });

  }
}

// Register the extension services.
AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc('aog-action', function(ampdoc) {
    return new ActionService(ampdoc).start_();
  });
});
