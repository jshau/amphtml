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


import {iterateCursor} from '../../../src/dom';
import {listen} from '../../../src/event-helper';
import {
  elementOrNullForFieldId,
  getFieldAsObject,
  setFieldIdForElement
} from '../../../src/field';

/**
 * Request name to set a field's value.
 * @const {string}
 */
const SET_FIELD_VALUES = 'setFieldValues';

/**
 * Request name to set focus on an element.
 * @const {string}
 */
const SET_FOCUS = 'setFocus';

/**
 * @fileoverview Forward form events from the current AMP document to the
 * enclosing AMP Viewer.
 */
export class FormEventHandler {
  /**
   * @param {!Window} win
   * @param {!./messaging/messaging.Messaging} messaging
   */
  constructor(win, messaging) {
    /** @const {!Window} */
    this.win = win;

    /** @const @private {!./messaging/messaging.Messaging} */
    this.messaging_ = messaging;

    this.listenForFormEvents_();
    this.listenForViewerEvents_();
  }

  /**
   * Attach forwarding listeners for 'focus', 'change', and 'blur' events to
   * every form input within the AMP document, to propagate the given events
   * to the enclosing Viewer.
   * @private
   */
  listenForFormEvents_() {
    const handleEvent = this.handleEvent_.bind(this);
    const options = {capture: false};

    iterateCursor(this.win.document.querySelectorAll('form'), (form) => {
      iterateCursor(form.elements, (element) => {
        setFieldIdForElement(element);
        listen(element, 'focus', handleEvent, options);
        listen(element, 'change', handleEvent, options);
        listen(element, 'blur', handleEvent, options);
      });
    });
  }

  /**
   * Forwards a single form field event to the Viewer.
   * @param {!Event} e
   * @private
   */
  handleEvent_(e) {
    const formFields = [];
    for (let i = 0; i < e.target.form.elements.length; i++) {
      formFields.push(getFieldAsObject(e.target.form.elements[i]));
    }
    const message = {
      field: getFieldAsObject(e.target),
      form: {
        fields: formFields,
        id: e.target.form.id
      }
    };

    this.messaging_.sendRequest(e.type, message, false);
  }

  /**
   * Attach listeners for events sent by the Viewer.
   * @private
   */
  listenForViewerEvents_() {
    this.messaging_.registerHandler(
        SET_FIELD_VALUES, this.setFieldValuesHandler_.bind(this));
    this.messaging_.registerHandler(
        SET_FOCUS, this.setFocusHandler_.bind(this));
  }

  /**
   * Handles setFieldValues requests from the viewer to set the value of certain
   * fields.
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
      return Promise.reject(
          'Could not find form field(s) with ampId = ' +
          missingAmpIds.join(', '));
    } else {
      return Promise.resolve({});
    }
  }

  /**
   * Handles setFocus requests from the viewer to set the focus on a given
   * field.
   * @param {string} type Unused.
   * @param {*} payload Object containing the ampId of the field to set focus on.
   * @param {boolean} awaitResponse
   * @return {!Promise<?>|undefined}
   * @private
   */
  setFocusHandler_(type, payload, awaitResponse) {
    const element = elementOrNullForFieldId(payload.ampId);

    if (!element) {
      return awaitResponse ?
          Promise.reject(
              'Could not find form field with ampId = ' + payload.ampId) :
          undefined;
    }
    element.focus();
    return awaitResponse ? Promise.resolve({}) : undefined;
  }
}
