/** Exact fraction for akshara positions/durations (ported from Java Fraction). */
export class Fraction {
  readonly num: number;
  readonly den: number;

  static readonly ZERO = new Fraction(0, 1);
  static readonly ONE = new Fraction(1, 1);

  constructor(num: number, den: number) {
    if (den === 0) throw new Error("zero denominator");
    if (!Number.isInteger(num) || !Number.isInteger(den)) {
      throw new Error("Fraction requires integer numerator and denominator");
    }
    if (den < 0) {
      num = -num;
      den = -den;
    }
    let g = gcd(Math.abs(num), den);
    if (g === 0) g = 1;
    this.num = num / g;
    this.den = den / g;
  }

  static of(whole: number): Fraction {
    return new Fraction(whole, 1);
  }

  add(o: Fraction): Fraction {
    return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(o: Fraction): Fraction {
    return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(k: number): Fraction {
    return new Fraction(this.num * k, this.den);
  }

  div(k: number): Fraction {
    return new Fraction(this.num, this.den * k);
  }

  times(o: Fraction): Fraction {
    return new Fraction(this.num * o.num, this.den * o.den);
  }

  /** Modulo against a positive whole-number cycle length (akshara count). */
  mod(cycleLen: number): Fraction {
    if (cycleLen <= 0) return this;
    const cycle = Fraction.of(cycleLen);
    const n = Math.floor(this.doubleValue() / cycle.doubleValue());
    return this.sub(cycle.mul(n));
  }

  isWhole(): boolean {
    return this.den === 1;
  }

  isZero(): boolean {
    return this.num === 0;
  }

  doubleValue(): number {
    return this.num / this.den;
  }

  compareTo(o: Fraction): number {
    const left = this.num * o.den;
    const right = o.num * this.den;
    return left === right ? 0 : left < right ? -1 : 1;
  }

  gte(o: Fraction): boolean {
    return this.compareTo(o) >= 0;
  }
  gt(o: Fraction): boolean {
    return this.compareTo(o) > 0;
  }
  lt(o: Fraction): boolean {
    return this.compareTo(o) < 0;
  }
  lte(o: Fraction): boolean {
    return this.compareTo(o) <= 0;
  }

  equals(o: Fraction): boolean {
    return this.num === o.num && this.den === o.den;
  }

  toString(): string {
    return this.den === 1 ? String(this.num) : `${this.num}/${this.den}`;
  }
}

function gcd(a: number, b: number): number {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a === 0 ? 1 : a;
}
