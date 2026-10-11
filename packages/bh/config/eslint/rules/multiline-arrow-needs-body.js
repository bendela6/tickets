/**
 * Require a block body (`=> { return X; }`) when an arrow function's expression
 * body spans more than one line. Single-line `() => x` stays untouched.
 */
export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      needsBody: 'Multiline arrow function must use a block body with an explicit return.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      ArrowFunctionExpression(node) {
        if (node.body.type === 'BlockStatement') {
          return;
        }
        const arrowToken = sourceCode.getTokenBefore(
          node.body,
          (token) => token.type === 'Punctuator' && token.value === '=>',
        );
        if (!arrowToken) {
          return;
        }
        if (arrowToken.loc.end.line === node.body.loc.end.line) {
          return;
        }

        return context.report({
          node,
          messageId: 'needsBody',
          fix(fixer) {
            const bodyText = sourceCode.getText(node.body);
            let startRange = node.body.range[0];
            let endRange = node.body.range[1];
            let leftToken = sourceCode.getTokenBefore(node.body);
            let rightToken = sourceCode.getTokenAfter(node.body);
            while (leftToken && rightToken && leftToken.value === '(' && rightToken.value === ')') {
              startRange = leftToken.range[0];
              endRange = rightToken.range[1];
              leftToken = sourceCode.getTokenBefore(leftToken);
              rightToken = sourceCode.getTokenAfter(rightToken);
            }
            return fixer.replaceTextRange([startRange, endRange], `{\n  return ${bodyText};\n}`);
          },
        });
      },
    };
  },
};
