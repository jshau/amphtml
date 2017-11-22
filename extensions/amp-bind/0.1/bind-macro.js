import {BindExpression} from './bind-expression';
/**
 * A single parsed Bind macro.
 */
export class BindMacro {

  constructor(ampMacro, otherMacros) {
    /** @const @private {string[]} */
    this.argumentNames = ampMacro.argumentNames || [];
    /** @const @private {BindExpression} */
    this.expression_ = new BindExpression(ampMacro.expressionString, otherMacros);
  }

  evaluate(state, args) {
    const scope = Object.assign({}, state);
    for (let i = 0; i < this.argumentNames.length; i++) {
      scope[this.argumentNames[i]] = args[i];
    }
    return this.expression_.evaluate(scope);
  }

  getExpressionSize() {
    return this.expression_.expressionSize;
  }

}
