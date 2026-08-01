// Assertions and the result tally. Kept separate from run.js so test files can
// import it without creating an import cycle with the loader.

const state = { passed: 0, failed: 0, current: null, failures: [] };

export function test(name, fn) {
  state.current = name;
  try {
    fn();
    state.passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    state.failed++;
    state.failures.push({ name, err });
    process.stdout.write(`  ✗ ${name}\n    ${err.message}\n`);
  }
}

export function group(name, fn) {
  process.stdout.write(`\n${name}\n`);
  fn();
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function near(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

export function throws(fn, message) {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
  }
  if (!threw) throw new Error(message || 'expected the call to throw');
}


export function summary() {
  return state;
}
