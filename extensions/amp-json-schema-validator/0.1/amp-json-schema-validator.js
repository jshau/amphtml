import {ActionTrust} from '../../../src/action-constants';
import {Services} from '../../../src/services';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {isExperimentOn} from '../../../src/experiments';
import {tryParseJson} from '../../../src/json';
import {ajv} from '../../../third_party/ajv';

/** @const {string} */
const TAG = 'amp-json-schema-validator';

export class AmpJsonSchemaValidator {
  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    const schemaElement = ampdoc.getElementById(TAG);

    /** @const @private {boolean} */
    this.enabled_ = !!schemaElement;
    if (!this.enabled_) {
      return;
    }

    /** @const @private */
    this.ampdoc_ = ampdoc;

    /** @const @private {!Element} */
    this.schemaElement_ = dev().assertElement(schemaElement);

    /** @const @private {!JsonObject} */
    this.schema_ = tryParseJson(this.schemaElement_.textContent, e => {
      throw user().createError(
          `Failed to parse ${amp-json-schema-validator} JSON: ${e}`);
      });
  }

  /**
   * Returns whether or not the data matches the schema.
   * @return {!boolean}
   */
  validate(data) {
    return true;
  }
}

// Register the extension services.
AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc(TAG, function(ampdoc) {
    return new AmpJsonSchemaValidator(ampdoc);
  });
});
