// prettier-ignore
export const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);
