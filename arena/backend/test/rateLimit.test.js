'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createThrottle } = require('../src/middleware/rateLimit');
const make = (extra = {}) => createThrottle({ name: 'login', windowMinutes: 15, max: 2, keyFor: () => 'test', countWhen: (_req, res) => res.statusCode === 401, ...extra });
function invoke(throttle, status = 401) {
  const res = new EventEmitter(); res.statusCode = status; let error;
  throttle({}, res, (e) => { error = e; }); return { res, error };
}
test('in-flight reservations prevent parallel requests bypassing the limit', () => {
  const limit = make(); const one = invoke(limit); const two = invoke(limit); const three = invoke(limit);
  assert.equal(one.error, undefined); assert.equal(two.error, undefined); assert.equal(three.error.status, 429);
  one.res.emit('finish'); two.res.emit('finish'); assert.equal(limit.peek('test').count, 2);
});
test('successes/outages do not consume failed-login budget; reset permits retry', () => {
  const limit = make(); invoke(limit, 200).res.emit('finish'); invoke(limit, 503).res.emit('finish'); assert.equal(limit.peek('test').count, 0);
  invoke(limit).res.emit('finish'); invoke(limit).res.emit('finish'); assert.equal(invoke(limit).error.status, 429);
  limit.reset('test'); assert.equal(invoke(limit).error, undefined);
});
test('an aborted response releases its reservation exactly once', () => {
  const limit = make(); const one = invoke(limit); one.res.emit('close'); one.res.emit('finish'); assert.deepEqual(limit.peek('test'), { count: 0, inFlight: 0 });
});
test('capacity stays bounded without deleting fresh attack counters', () => {
  const limit = make({ maxKeys: 1, keyFor: (req) => req.key }); const a = new EventEmitter();
  limit({ key: 'a' }, a, (err) => assert.equal(err, undefined));
  limit({ key: 'b' }, new EventEmitter(), (err) => assert.equal(err.status, 429));
});
