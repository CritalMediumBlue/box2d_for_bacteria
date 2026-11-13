/** A random number generator returning floats in [0, 1), like Math.random. */
export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32). The same seed always gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random 32-bit seed, for when none is given. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
