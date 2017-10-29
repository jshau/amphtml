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
const SET_FIELD_VALUE = 'setFieldValue';


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

    messaging.registerHandler(SET_FIELD_VALUE, this.setFieldValueHandler_.bind(this));

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
      this.fields[id] = dict();
      iterateCursor(form.elements, (element) => {
        let name = element.getAttribute('name');
        this.fields[id][name] = this.fields[id][name] || [];
        const index = this.fields[id][name].length;
        const targetElKey = [id, name, index].join('.');
        this.fields[id][name].push({
          element: element,
          unlisten: listen(element, 'focus', this.handleEvent_.bind(this, targetElKey), options)
        });
      });
    });

  }

  unlisten_() {
    // this.unlistenHandlers_.forEach(unlisten => unlisten());
    // this.unlistenHandlers_.length = 0;
  }

  /**
   * @param {!string} targetElKey
   * @param {!Event} e
   * @private
   */
  handleEvent_(targetElKey, e) {
    switch (e.type) {
      case 'focus':
        this.forwardEvent_(targetElKey, e);
        break;
      default:
        return;
    }
  }

  /**
   * @param {!Event} e
   * @private
   */
  forwardEvent_(targetElKey, e) {
    if (e && e.type) {
      const msg = this.copyEvent_(targetElKey, e);
      this.messaging_.sendRequest(e.type, msg, false);
    }
  }


  /**
   * Makes a partial copy of the event.
   * @param {!Event} e The event object to be copied.
   * @return {!JsonObject}
   * @private
   */
  copyEvent_(targetElKey, e) {
    const copiedEvent = this.copyProperties_(e, EVENT_PROPERTIES);
    if (e.target) {
      copiedEvent['target'] = this.copyTarget_(targetElKey, e.target);
    }
    return copiedEvent;
  }


  /**
   * Copies the target element.
   * @param {!Object} target
   * @return {!Object}
   * @private
   */
  copyTarget_(targetElKey, target) {
    const attributesObject = dict();
    for (let i = 0; i < target.attributes.length; i++) {
      const a = target.attributes[i];
      attributesObject[a.name] = a.value;
    }
    return {
      tagName: target.tagName,
      attributes: attributesObject,
      formFieldKey: targetElKey
    };
  }

   /**
   * Copies specified properties of o to a new object.
   * @param {!Object} o The source object.
   * @param {!Array<string>} properties The properties to copy.
   * @return {!JsonObject} The copy of o.
   * @private
   */
  copyProperties_(o, properties) {
    const copy = dict();
    for (let i = 0; i < properties.length; i++) {
      const p = properties[i];
      if (o[p] !== undefined) {
        copy[p] = o[p];
      }
    }
    return copy;
  }

    /**
   * Handles scrollLock requests from the viewer to change the scrollLock state.
   * @param {string} type Unused.
   * @param {*} payload True to disable event forwarding / lock scrolling.
   * @param {boolean} awaitResponse
   * @return {!Promise<?>|undefined}
   * @private
   */
  setFieldValueHandler_(type, payload, awaitResponse) {
    const keyParts = payload.formFieldKey.split('.');
    const formId = keyParts[0];
    const fieldName = keyParts[1];
    const fieldIndex = parseInt(keyParts[2], 10);

    if (!this.fields[formId] || !this.fields[formId][fieldName] || !this.fields[formId][fieldName][fieldIndex]) {
      return awaitResponse ? Promise.reject('Could not find form field with formFieldKey = ' + payload.formFieldKey) : undefined;
    }
    const formFieldEl = this.fields[formId][fieldName][fieldIndex].element;
    formFieldEl.value = payload.value;
    return awaitResponse ? Promise.resolve({}) : undefined;
  }

}
