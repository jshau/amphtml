/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import {listen} from '../../../src/event-helper';
import {dict} from '../../../src/utils/object';
import {iterateCursor} from '../../../src/dom';
import {
  getFieldAsObject,
  setFieldIdForElement,
  elementOrNullForFieldId,
} from '../../../src/field';

/**
 * The list of touch event properites to copy.
 * @const {!Array<string>}
 */
const EVENT_PROPERTIES = [
  'timeStamp', 'type',
];

/**
 * The list of target element properties to copy.
 * @const {!Array<string>}
 */
const TARGET_ELEMENT_ATTRIBUTES = [
  'autocomplete'
];

/**
 * @const {string} Request name to set a field's value.
 */
const SET_FIELD_VALUES = 'setFieldValues';

/**
 * @const {string} Request name to set focus on an element.
 */
const SET_FOCUS = 'setFocus';


/**
 * @fileoverview Forward input focus events from the AMP doc to the viewer.
 */
export class FocusHandler {

  /**
   * @param {!Window} win
   * @param {!./messaging/messaging.Messaging} messaging
   */
  constructor(win, messaging) {
    /** @const {!Window} */
    this.win = win;
    /** @const @private {!./messaging/messaging.Messaging} */
    this.messaging_ = messaging;
    /**
     * @const @private {!Array<function()>}
     */
    this.unlistenHandlers_ = [];

    this.fields = dict();

    messaging.registerHandler(SET_FIELD_VALUES, this.setFieldValuesHandler_.bind(this));
    messaging.registerHandler(SET_FOCUS, this.setFocusHandler_.bind(this));

    this.listenForFocusEvents_();
  }

  listenForFocusEvents_() {
    const doc = this.win.document;

    const options = {
      capture: false,
    };

    this.fields = dict();
    iterateCursor(doc.querySelectorAll('form'), (form) => {
      let id = form.getAttribute('id');
      iterateCursor(form.elements, (element) => {
        setFieldIdForElement(element);
        this.unlistenHandlers_.push(listen(element, 'focus', this.handleFocusEvent_.bind(this), options));
      });
    });

  }

  unlisten_() {
    this.unlistenHandlers_.forEach(unlisten => unlisten());
    this.unlistenHandlers_.length = 0;
  }

  /**
   * @param {!Event} e
   * @private
   */
  handleFocusEvent_(e) {
    const focusedField = e.target;
    const form = focusedField.form;
    const fields = [];
    for (let i = 0; i < form.elements.length; i++) {
      fields.push(getFieldAsObject(form.elements[i]));
    }
    this.messaging_.sendRequest('focus', {
      field: getFieldAsObject(focusedField),
      form: {
        id: form.id,
        fields: fields
      }
    }, false);
  }

  /**
   * Handles setFieldValues requests from the viewer to set the value of certain fields.
   * @param {string} type Unused.
   * @param {*} payload Object containing the field ampIds and values to set.
   * @param {boolean} awaitResponse
   * @return {!Promise<?>|undefined}
   * @private
   */
  setFieldValuesHandler_(type, payload, awaitResponse) {
    const missingAmpIds = [];
    for (let i = 0; i < payload.fields.length; i++) {
      const ampId = payload.fields[i].ampId;
      const element = elementOrNullForFieldId(ampId);
      if (element) {
        element.value = payload.fields[i].value;
        element.dispatchEvent(new Event('change', {bubbles: true}));
      } else {
        missingAmpIds.push(ampId);
      }
    }

    if (!awaitResponse) {
      return undefined;
    } else if (missingAmpIds.length) {
      return Promise.reject('Could not find form field(s) with ampId = ' + missingAmpIds.join(', '));
    } else {
      return Promise.resolve({});
    }
  }

  /**
   * Handles setFocus requests from the viewer to set the focus on a given field.
   * @param {string} type Unused.
   * @param {*} payload Object containing the ampId of the field to set focus on.
   * @param {boolean} awaitResponse
   * @return {!Promise<?>|undefined}
   * @private
   */
  setFocusHandler_(type, payload, awaitResponse) {
    const missingAmpIds = [];
    const element = elementOrNullForFieldId(payload.ampId);

    if (!element) {
      return awaitResponse ? Promise.reject('Could not find form field with ampId = ' + payload.ampId) : undefined;
    }
    element.focus();
    return awaitResponse ? Promise.resolve({}) : undefined;
  }

}
