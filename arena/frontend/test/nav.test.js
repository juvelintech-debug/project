import { expect, test } from 'vitest';
import { destinationFor, homeFor, NAV_BY_ROLE } from '../src/nav';
test('role destinations follow canonical values and cannot become open redirects', () => {
  expect(homeFor('Student')).toBe('/student'); expect(homeFor('Company')).toBe('/company'); expect(homeFor('Admin')).toBe('/admin');
  for (const path of ['/admin', '//evil.example', 'https://evil.example', '/administrator']) expect(destinationFor('Student', path)).toBe('/student');
  expect(destinationFor('Admin', '/admin/accounts')).toBe('/admin/accounts');
  expect(NAV_BY_ROLE.Student.some((item) => item.to.startsWith('/admin'))).toBe(false);
});
