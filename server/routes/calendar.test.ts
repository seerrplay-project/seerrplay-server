import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCalendarWeeks } from './calendar';

describe('calendar route query parsing', () => {
  it('accepts the numeric value produced by OpenAPI query coercion', () => {
    assert.strictEqual(parseCalendarWeeks(3), 3);
  });

  it('accepts raw query strings and defaults omitted values to one week', () => {
    assert.strictEqual(parseCalendarWeeks('2'), 2);
    assert.strictEqual(parseCalendarWeeks(undefined), 1);
  });
});
