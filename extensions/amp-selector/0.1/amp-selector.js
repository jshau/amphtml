/**
 * Copyright 2016 The AMP HTML Authors. All Rights Reserved.
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

import {ActionTrust} from '../../../src/action-constants';
import {AmpEvents} from '../../../src/amp-events';
import {CSS} from '../../../build/amp-selector-0.1.css';
import {Keys} from '../../../src/utils/key-codes';
import {Services} from '../../../src/services';
import {areEqualOrdered} from '../../../src/utils/array';
import {closestBySelector, isRTL, tryFocus} from '../../../src/dom';
import {createCustomEvent} from '../../../src/event-helper';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {mod} from '../../../src/utils/math';
import {toArray} from '../../../src/types';
const TAG = 'amp-selector';

/**
 * Set of namespaces that can be set for lifecycle reporters.
 *
 * @enum {string}
 */
const KEYBOARD_SELECT_MODES = {
  NONE: 'none',
  FOCUS: 'focus',
  SELECT: 'select',
};


export class AmpSelector extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private {boolean} */
    this.isMultiple_ = false;

    /** @private {!Array<!Element>} */
    this.selectedOptions_ = [];

    /** @private {!Array<!Element>} */
    this.options_ = [];

    /** @private {!Array<!Element>} */
    this.inputs_ = [];

    /** @private {?../../../src/service/action-impl.ActionService} */
    this.action_ = null;

    /**
     * The index of the option that should receive tab focus. Only one
     * option should ever receive tab focus, with the other options reachable
     * by arrow keys when the option is in focus.
     * @private {number}
     */
    this.focusedIndex_ = 0;

    /** @private {!KEYBOARD_SELECT_MODES} */
    this.kbSelectMode_ = KEYBOARD_SELECT_MODES.NONE;
  }

  /** @override */
  isLayoutSupported() {
    return true;
  }

  /** @override */
  buildCallback() {
    this.action_ = Services.actionServiceForDoc(this.element);
    this.isMultiple_ = this.element.hasAttribute('multiple');

    if (!this.element.hasAttribute('role')) {
      this.element.setAttribute('role', 'listbox');
    }

    if (this.isMultiple_) {
      this.element.setAttribute('aria-multiselectable', 'true');
    }

    if (this.element.hasAttribute('disabled')) {
      this.element.setAttribute('aria-disabled', 'true');
    }

    let kbSelectMode = this.element.getAttribute('keyboard-select-mode');
    if (kbSelectMode) {
      kbSelectMode = kbSelectMode.toLowerCase();
      user().assertEnumValue(KEYBOARD_SELECT_MODES, kbSelectMode);
      user().assert(
          !(this.isMultiple_ && kbSelectMode == KEYBOARD_SELECT_MODES.SELECT),
          '[keyboard-select-mode=select] not supported for multiple ' +
        'selection amp-selector');
    } else {
      kbSelectMode = KEYBOARD_SELECT_MODES.NONE;
    }
    this.kbSelectMode_ = kbSelectMode;

    this.registerAction('clear', this.clearAllSelections_.bind(this));

    this.init_();

    this.element.addEventListener('click', this.clickHandler_.bind(this));
    this.element.addEventListener('keydown', this.keyDownHandler_.bind(this));

    this.registerAction('selectUp', invocation => {
      const {args} = invocation;
      const delta = (args && args['delta'] !== undefined) ? -args['delta'] : -1;
      this.select_(delta);
    }, ActionTrust.LOW);

    this.registerAction('selectDown', invocation => {
      const {args} = invocation;
      const delta = (args && args['delta'] !== undefined) ? args['delta'] : 1;
      this.select_(delta);
    }, ActionTrust.LOW);

    this.registerAction('toggle', invocation => {
      const {args} = invocation;
      user().assert(args['index'] >= 0, '\'index\' must be greater than 0');
      user().assert(args['index'] < this.options_.length, '\'index\' must be ' +
        'less than the length of options in the <amp-selector>');
      if (args && args['index'] !== undefined) {
        this.toggle_(args['index'], args['value']);
      }
    }, ActionTrust.LOW);

    // Triggers on DOM children updates
    this.element.addEventListener(AmpEvents.DOM_UPDATE,
        this.maybeRefreshOnUpdate_.bind(this));
  }

  /** @override */
  mutatedAttributesCallback(mutations) {
    const selected = mutations['selected'];
    if (selected !== undefined) {
      this.selectedAttributeMutated_(selected);
    }
    const disabled = mutations['disabled'];
    if (disabled !== undefined) {
      if (disabled) {
        this.element.setAttribute('aria-disabled', 'true');
      } else {
        this.element.removeAttribute('aria-disabled');
      }
    }
  }

  /**
   * Handles mutation of the `selected` attribute.
   * @param {null|boolean|string|number|Array|Object} newValue
   * @private
   */
  selectedAttributeMutated_(newValue) {
    if (newValue === null) {
      this.clearAllSelections_();
      return;
    }
    let selectedArray = Array.isArray(newValue) ? newValue : [newValue];
    // Only use first value if multiple selection is disabled.
    if (!this.isMultiple_) {
      selectedArray = selectedArray.slice(0, 1);
    }
    // Convert array values to strings and create map for fast lookup.
    const selectedMap = selectedArray.reduce((map, value) => {
      map[value] = true;
      return map;
    }, Object.create(null));
    // Iterate through elements and toggle selection as necessary.
    for (let i = 0; i < this.options_.length; i++) {
      const element = this.options_[i];
      const option = element.getAttribute('option');
      if (selectedMap[option]) {
        this.setSelection_(element);
      } else {
        this.clearSelection_(element);
      }
    }
    this.updateFocus_();
    // Update inputs.
    this.setInputs_();
  }

  /**
   * Update focus such that only one option in the selector can receive focus.
   * When keyboard-select-mode is not none, this function handles focus as if
   * the selector options are set of radio buttons. Otherwise, this function
   * is a no-op.
   *
   * If no element is provided, this function will determine which option should
   * receive focus.
   *
   * In multi-select selectors, focus should go to the first option.
   * In single-select selectors, focus should go to the initially selected
   * option, or to the first option if none are initially selected.
   * @param {Element=} opt_focusEl Element to put focus on
   * @private
   */
  updateFocus_(opt_focusEl) {
    if (this.kbSelectMode_ == KEYBOARD_SELECT_MODES.NONE) {
      // Don't manage focus.
      return;
    }

    this.options_.forEach(option => {
      option.tabIndex = -1;
    });

    let focusElement = opt_focusEl;
    if (!focusElement) {
      if (this.isMultiple_) {
        focusElement = this.options_[0];
      } else {
        focusElement = this.selectedOptions_[0] || this.options_[0];
      }
    }
    if (focusElement) {
      this.focusedIndex_ = this.options_.indexOf(focusElement);
      focusElement.tabIndex = 0;
    }
  }

  /**
   * Calls init_ again if options element has changed
   * @param {Event} unusedEvent
   * @private
   */
  maybeRefreshOnUpdate_(unusedEvent) {
    const newOptions = toArray(this.element.querySelectorAll('[option]'));
    if (areEqualOrdered(this.options_, newOptions)) { // no updates
      return;
    }
    // Clear prev states
    this.options_ = [];
    this.selectedOptions_ = [];
    this.inputs_ = [];
    this.init_(newOptions);
  }

  /**
   * @param {Array<Element>=} opt_options
   * @private
   */
  init_(opt_options) {
    const options = opt_options ?
      opt_options :
      toArray(this.element.querySelectorAll('[option]'));
    options.forEach(option => {
      if (!option.hasAttribute('role')) {
        option.setAttribute('role', 'option');
      }
      if (option.hasAttribute('disabled')) {
        option.setAttribute('aria-disabled', 'true');
      }
      if (option.hasAttribute('selected')) {
        this.setSelection_(option);
      } else {
        this.clearSelection_(option);
      }
      option.tabIndex = 0;
      this.options_.push(option);
    });
    this.updateFocus_();
    this.setInputs_();
  }

  /**
   * Creates inputs for the currently selected elements and returns a string
   * array of their option values.
   * Note: Ignores elements that have `disabled` attribute set.
   * @return {!Array<string>}
   * @private
   */
  setInputs_() {
    const selectedValues = [];
    const elementName = this.element.getAttribute('name');
    if (!elementName || this.element.hasAttribute('disabled')) {
      return selectedValues;
    }
    const formId = this.element.getAttribute('form');

    this.inputs_.forEach(input => {
      this.element.removeChild(input);
    });
    this.inputs_ = [];
    const doc = this.win.document;
    const fragment = doc.createDocumentFragment();
    this.selectedOptions_.forEach(option => {
      if (!option.hasAttribute('disabled')) {
        const hidden = doc.createElement('input');
        const value = option.getAttribute('option');
        hidden.setAttribute('type', 'hidden');
        hidden.setAttribute('name', elementName);
        hidden.setAttribute('value', value);
        if (formId) {
          hidden.setAttribute('form', formId);
        }
        this.inputs_.push(hidden);
        fragment.appendChild(hidden);
        selectedValues.push(value);
      }
    });
    this.element.appendChild(fragment);
    return selectedValues;
  }

  /**
   * Handles user selection on an option.
   * @param {!Element} el The element selected.
   */
  onOptionPicked_(el) {
    if (el.hasAttribute('disabled')) {
      return;
    }

    this.mutateElement(() => {
      /** @type {?Array<string>} */
      let selectedValues;
      if (el.hasAttribute('selected')) {
        if (this.isMultiple_) {
          this.clearSelection_(el);
          selectedValues = this.setInputs_();
        }
      } else {
        this.setSelection_(el);
        selectedValues = this.setInputs_();
      }

      // Don't trigger action or update focus if
      // selected values haven't changed.
      if (selectedValues) {
        // Newly picked option should always have focus.
        this.updateFocus_(el);

        // Trigger 'select' event with two data params:
        // 'targetOption' - option value of the selected or deselected element.
        // 'selectedOptions' - array of option values of selected elements.
        const name = 'select';
        const selectEvent =
            createCustomEvent(this.win, `amp-selector.${name}`, dict({
              'targetOption': el.getAttribute('option'),
              'selectedOptions': selectedValues,
            }));
        this.action_.trigger(this.element, name, selectEvent,
            ActionTrust.HIGH);
      }
    });
  }

  /**
   * Handles click events for the selectables.
   * @param {!Event} event
   */
  clickHandler_(event) {
    if (this.element.hasAttribute('disabled')) {
      return;
    }
    let el = dev().assertElement(event.target);
    if (!el) {
      return;
    }
    if (!el.hasAttribute('option')) {
      el = closestBySelector(el, '[option]');
    }
    if (el) {
      this.onOptionPicked_(el);
    }
  }

  /**
   * Handles toggle action.
   * @param {number} index
   * @param {boolean=} opt_value
   */
  toggle_(index, opt_value) {
    // Change the selection to the next element in the specified direction.
    // The selection should loop around if the user attempts to go one
    // past the beginning or end.
    const indexCurrentStatus = this.options_[index].hasAttribute('selected');
    const indexFinalStatus =
      opt_value !== undefined ? opt_value : !indexCurrentStatus;
    const selectedIndex = this.options_.indexOf(this.selectedOptions_[0]);

    if (indexFinalStatus === indexCurrentStatus) {
      return;
    }

    // There is a change of the `selected` attribute for the element
    if (selectedIndex !== index) {
      this.setSelection_(this.options_[index]);
      this.clearSelection_(this.options_[selectedIndex]);
    } else {
      this.clearSelection_(this.options_[index]);
    }
  }


  /**
   * Handles selectUp events.
   * @param {number} delta
   */
  select_(delta) {
    // Change the selection to the next element in the specified direction.
    // The selection should loop around if the user attempts to go one
    // past the beginning or end.
    const previousIndex = this.options_.indexOf(this.selectedOptions_[0]);
    const index = previousIndex + delta;
    const normalizedIndex = mod(index, this.options_.length);

    this.setSelection_(this.options_[normalizedIndex]);
    this.clearSelection_(this.options_[previousIndex]);
  }

  /**
   * Handles keyboard events.
   * @param {!Event} event
   */
  keyDownHandler_(event) {
    if (this.element.hasAttribute('disabled')) {
      return;
    }
    const {key} = event;
    switch (key) {
      case Keys.LEFT_ARROW: /* fallthrough */
      case Keys.UP_ARROW: /* fallthrough */
      case Keys.RIGHT_ARROW: /* fallthrough */
      case Keys.DOWN_ARROW:
        if (this.kbSelectMode_ != KEYBOARD_SELECT_MODES.NONE) {
          this.navigationKeyDownHandler_(event);
        }
        return;
      case Keys.ENTER: /* fallthrough */
      case Keys.SPACE:
        this.selectionKeyDownHandler_(event);
        return;
    }
  }

  /**
   * Handles keyboard navigation events. Should not be called if
   * keyboard selection is disabled.
   * @param {!Event} event
   */
  navigationKeyDownHandler_(event) {
    const doc = this.win.document;
    let dir = 0;
    switch (event.key) {
      case Keys.LEFT_ARROW:
        // Left is considered 'previous' in LTR and 'next' in RTL.
        dir = isRTL(doc) ? 1 : -1;
        break;
      case Keys.UP_ARROW:
        // Up is considered 'previous' in both LTR and RTL.
        dir = -1;
        break;
      case Keys.RIGHT_ARROW:
        // Right is considered 'next' in LTR and 'previous' in RTL.
        dir = isRTL(doc) ? -1 : 1;
        break;
      case Keys.DOWN_ARROW:
        // Down is considered 'next' in both LTR and RTL.
        dir = 1;
        break;
      default:
        return;
    }

    event.preventDefault();

    // Make currently selected option unfocusable
    this.options_[this.focusedIndex_].tabIndex = -1;

    // Change the focus to the next element in the specified direction.
    // The selection should loop around if the user attempts to go one
    // past the beginning or end.
    this.focusedIndex_ = (this.focusedIndex_ + dir) % this.options_.length;
    if (this.focusedIndex_ < 0) {
      this.focusedIndex_ = this.focusedIndex_ + this.options_.length;
    }

    // Focus newly selected option
    const newSelectedOption = this.options_[this.focusedIndex_];
    newSelectedOption.tabIndex = 0;
    tryFocus(newSelectedOption);

    const focusedOption = this.options_[this.focusedIndex_];
    if (this.kbSelectMode_ == KEYBOARD_SELECT_MODES.SELECT) {
      this.onOptionPicked_(focusedOption);
    }
  }

  /**
   * Handles keyboard selection events.
   * @param {!Event} event
   */
  selectionKeyDownHandler_(event) {
    const {key} = event;
    if (key == Keys.SPACE || key == Keys.ENTER) {
      if (this.options_.includes(event.target)) {
        event.preventDefault();
        const el = dev().assertElement(event.target);
        this.onOptionPicked_(el);
      }
    }
  }

  /**
   * Clears a given element from the list of selected options.
   * @param {!Element} element
   * @private
   */
  clearSelection_(element) {
    element.removeAttribute('selected');
    element.setAttribute('aria-selected', 'false');
    const selIndex = this.selectedOptions_.indexOf(element);
    if (selIndex !== -1) {
      this.selectedOptions_.splice(selIndex, 1);
    }
  }

  /**
   * Clears all selected options.
   * @private
   */
  clearAllSelections_() {
    while (this.selectedOptions_.length > 0) {
      // Clear selected options for single select.
      const el = this.selectedOptions_.pop();
      this.clearSelection_(el);
    }
    this.setInputs_();
  }

  /**
   * Marks a given element as selected and clears the others if required.
   * @param {!Element} element
   * @private
   */
  setSelection_(element) {
    // Exit if `element` is already selected.
    if (this.selectedOptions_.includes(element)) {
      return;
    }
    if (!this.isMultiple_) {
      this.clearAllSelections_();
    }
    element.setAttribute('selected', '');
    element.setAttribute('aria-selected', 'true');
    this.selectedOptions_.push(element);
  }
}


AMP.extension(TAG, '0.1', AMP => {
  AMP.registerElement(TAG, AmpSelector, CSS);
});
