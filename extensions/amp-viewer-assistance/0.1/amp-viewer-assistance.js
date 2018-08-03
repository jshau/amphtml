import {ActionTrust} from '../../../src/action-constants';
import {Services} from '../../../src/services';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {tryParseJson} from '../../../src/json';


/** @const {string} */
const TAG = 'amp-viewer-assistance';

/** @const {string} */
const GSI_TOKEN_PROVIDER = 'actions-on-google-gsi';

export class AmpViewerAssistance {
  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    const assistanceElement = ampdoc.getElementById('amp-viewer-assistance');

    /** @const @private {boolean} */
    this.enabled_ = !!assistanceElement;
    if (!this.enabled_) {
      return;
    }

    /** @const @private */
    this.ampdoc_ = ampdoc;

    /** @const @private {!Element} */
    this.assistanceElement_ = dev().assertElement(assistanceElement);

    /** @const @private {!JsonObject} */
    this.configJson_ = tryParseJson(this.assistanceElement_.textContent, e => {
      throw user().createError(
          'Failed to parse "amp-viewer-assistance" JSON: ' + e);
    });

    /** @private @const {!../../../src/service/viewer-impl.Viewer} */
    this.viewer_ = Services.viewerForDoc(ampdoc);

    /** @private @const {!../../../src/service/action-impl.ActionService} */
    this.action_ = Services.actionServiceForDoc(ampdoc);

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
   * @restricted
   */
  start_() {
    if (!this.enabled_) {
      user().info(
          TAG, 'Invalid AMP Action - no "id=amp-viewer-assistance" element');
      return this;
    }
    return this.viewer_.isTrustedViewer().then(isTrustedViewer => {
      if (!isTrustedViewer) {
        this.enabled_ = false;
        user().info(TAG, 'Disabling AMP Action since viewer is not trusted');
        return this;
      }
      this.action_.installActionHandler(
          this.assistanceElement_, this.actionHandler_.bind(this),
          ActionTrust.HIGH);

      this.variableSource_.set('IDENTITY_TOKEN', () => this.getIdToken_());

      this.viewer_.sendMessage('actionConfig', dict({
        'config': this.configJson_,
      }));
      return this;
    });
  }

  /**
   * @private
   * @return {!Promise<string>}
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
            this.assistanceElement_, 'signedIn', null, ActionTrust.HIGH);
      }
    });
  }

  /**
   * Toggles the CSS classes related to the status of the identity token.
   * @private
   * @param {boolean} available
   */
  setIdTokenStatus_(available) {
    this.toggleTopClass_('amp-viewer-assistance-identity-available', available);
    this.toggleTopClass_(
        'amp-viewer-assistance-identity-unavailable', !available);
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
  AMP.registerServiceForDoc('amp-viewer-assistance', function(ampdoc) {
    return new AmpViewerAssistance(ampdoc).start_();
  });
});
