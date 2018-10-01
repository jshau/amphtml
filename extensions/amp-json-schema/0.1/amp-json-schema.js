import {dev, user} from '../../../src/log';
import {tryParseJson} from '../../../src/json';
import Ajv from '../../../third_party/ajv/ajv.min';

/** @const {string} */
const TAG = 'amp-json-schema-validator';

export class AmpJsonSchema {
  /**
   * @param {!../../../src/service/ampdoc-impl.AmpDoc} ampdoc
   */
  constructor(ampdoc) {
    /** @const @private */
    this.ampdoc_ = ampdoc;

    /** @const @private */
    this.ajv_ = new Ajv();
  }

  /**
   * Validates the data against a given schema.
   * The schema should be declared in the AMP Doc in a script element
   * with id='amp-json-schema-{schemaName}'.
   * @param {string} schemaName The name of the schema defined in the ampdoc.
   * @param {!Object} data The data to be validated
   * @return {boolean} Whether or not the data fits the schema
   */
  validate(schemaName, data) {
    const schemaElement = this.ampdoc_.getElementById(`amp-json-schema-${schemaName}`);
    if(!schemaElement){
      user().error(`amp-json-schema-${schemaName} element does not exist`);
      return false;
    }

    /** @const {!JsonObject} */
    const schema = tryParseJson(schemaElement.textContent, e => {
      user().error(
          `Failed to parse ${schemaName} Schema JSON: ${e}`);
      });

    if(!schema){
      return false;
    }

    const valid = this.ajv_.validate(schema, data);

    if(!valid){
      user().error(
        `Schema validation failed: ${this.ajv_.errorsText()}`);
    }

    return valid;
  }
}

// Register the extension services.
AMP.extension(TAG, '0.1', function(AMP) {
  AMP.registerServiceForDoc('json-schema', function(ampdoc) {
    return new AmpJsonSchema(ampdoc);
  });
});
