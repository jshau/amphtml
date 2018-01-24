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

/** @const {string} */
const AUTOFILL_PROP_ = '__AMP_AUTOFILL';

/** @const {string} */
const FIELD_ID_PROP_ = '__AMP_FIELD_ID';

let currentFieldId = 1;

const fieldIdMap = {};

/**
 * @param {!Element} element
 * @return {number}
 */
export function fieldIdOrNullForElement(element) {
  return element[FIELD_ID_PROP_] || null;
}

/**
 * @param {number} fieldId
 * @return {Element}
 */
export function elementOrNullForFieldId(fieldId) {
  return fieldIdMap[fieldId] || null;
}

/**
 * @param {!Element} element
 */
export function setFieldIdForElement(element) {
  if (!element[FIELD_ID_PROP_]) {
    element[FIELD_ID_PROP_] = currentFieldId++;
    fieldIdMap[element[FIELD_ID_PROP_]] = element;
  }
}

/**
 * Sets the current autofill value for the given element.
 * @param {!Element} element
 * @param {string} autofill
 */
export function setAutofillForElement(element, autofill) {
  element[AUTOFILL_PROP_] = autofill;
}

/**
 * Gets the current autofill value for the given element.
 * @param {!Element} element
 */
export function getAutofillOrNullForElement(element) {
  return element[AUTOFILL_PROP_] || null;
}

/**
 * Clears the current autofill value for the given element.
 * @param {!Element} element
 */
export function clearAutofillForElement(element) {
  delete element[AUTOFILL_PROP_];
}

/**
 * Returns field as a JSON object.
 * @param {!Element} element
 * @return {!JsonObject}
 */
export function getFieldAsObject(element) {
  return /** @type {!JsonObject} */ ({
    ampId: fieldIdOrNullForElement(element),
    tagName: element.tagName,
    type: element.type,
    name: element.name,
    value: element.value,
    autocomplete: element.autocomplete,
    autofill: getAutofillOrNullForElement(element),
  });
}
