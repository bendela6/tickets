import { iconWriter, isLoopback } from './icon-writer';

test('the plugin only exists while serving', () => {
  const plugin = iconWriter({ repoRoot: '/repo' });
  expect(plugin.name).toBe('icon-writer');
  expect(plugin.apply).toBe('serve');
});

test('loopback addresses are allowed', () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']) {
    expect(isLoopback(addr), addr).toBe(true);
  }
});

test('anything else is refused, including an absent address', () => {
  for (const addr of ['192.168.1.20', '10.0.0.4', '203.0.113.9', undefined]) {
    expect(isLoopback(addr), String(addr)).toBe(false);
  }
});
