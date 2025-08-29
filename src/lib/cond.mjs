export function cond(...args) {
  // Support both LJSP alternating signature and legacy array-of-tuples:
  // - Alternating: cond(test1, expr1, test2, expr2, ..., [defaultExpr])
  // - Legacy: cond([test, expr], [test, expr], ...) OR cond([[test, expr], ...])
  const isClauseTuple = (a) => Array.isArray(a) && a.length === 2;

  // Normalize legacy forms into alternating args
  if (args.length === 1 && Array.isArray(args[0]) && Array.isArray(args[0][0])) {
    // cond([[t,e],[t,e]])
    const pairs = args[0];
    args = pairs.flat();
  } else if (args.length > 0 && args.every(isClauseTuple)) {
    // cond([t,e], [t,e], ...)
    args = args.flat();
  }

  return function (...callArgs) {
    const hasDefault = args.length % 2 === 1;
    const end = hasDefault ? args.length - 1 : args.length;

    for (let i = 0; i < end; i += 2) {
      const test = args[i];
      const expr = args[i + 1];
      let matched = false;

      if (typeof test === "function") {
        try {
          matched = Boolean(test.apply(this, callArgs));
        } catch {
          matched = false;
        }
      } else if (test === "else" || test === true || test === cond.ELSE || test === cond.DEFAULT || test === cond._) {
        matched = true;
      } else {
        matched = Boolean(test);
      }

      if (matched) {
        return typeof expr === "function" ? expr.apply(this, callArgs) : expr;
      }
    }

    if (hasDefault) {
      const def = args[args.length - 1];
      return typeof def === "function" ? def.apply(this, callArgs) : def;
    }

    return undefined;
  };
}

// Symbol-based sentinels for catch-all semantics
cond.ELSE = Symbol.for("cond.ELSE");
cond.DEFAULT = cond.ELSE;
cond._ = cond.ELSE;
