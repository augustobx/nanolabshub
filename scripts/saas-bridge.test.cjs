const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function bridge(env = {}, fetch = () => { throw Error('Unexpected request'); }) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports, process: { env }, fetch, Buffer, AbortSignal,
      require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name),
    }, { filename: file });
    return module.exports;
  }
  return load(path.resolve(__dirname, '../src/lib/saas-bridge.ts'));
}
function response(product, offset = 0, capabilities = {}) {
  return Response.json({
    success: true, contract: 'nanolabs.saas.tenants.v1', product,
    tenants: [{ id: String(offset + 1), slug: 'fixture', name: 'Fixture', status: 'ACTIVE', rawStatus: 'ACTIVE', plan: null, createdAt: '2026-01-01T00:00:00Z' }],
    nextOffset: null,
    capabilities: { tenantsRead: true, tenantWrite: false, moduleWrite: false, ...capabilities },
  });
}
const configured = {
  HUB_SAAS_INTEGRATION_ENABLED: 'true', HUB_SAAS_INTEGRATION_PRODUCTS: 'onlygym, onlyturn',
  HUB_INTEGRATION_ONLYGYM_TOKEN: 'g'.repeat(64), HUB_INTEGRATION_ONLYTURN_TOKEN: 't'.repeat(64),
};
test('global switch and explicit product selection both fail closed', async () => {
  for (const env of [{}, { ...configured, HUB_SAAS_INTEGRATION_ENABLED: 'false' },
    { ...configured, HUB_SAAS_INTEGRATION_PRODUCTS: '' },
    { ...configured, HUB_SAAS_INTEGRATION_PRODUCTS: 'ONLYGYM,onlygy,unknown' }]) {
    const overview = await bridge(env).getUniversalGovernanceOverview();
    assert.equal(overview.totalTenants, 0);
    assert.ok(overview.sources.every(source => source.status === 'disabled' && source.count === null));
  }
});
test('only selected products are fetched and secrets stay in authorization headers', async () => {
  const calls = [];
  const overview = await bridge(configured, async (url, options) => {
    calls.push(url);
    const product = new URL(url).hostname.split('.')[0];
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer ' + configured['HUB_INTEGRATION_' + product.toUpperCase() + '_TOKEN']);
    return response(product);
  }).getUniversalGovernanceOverview();
  assert.equal(calls.length, 2);
  assert.equal(overview.totalTenants, 2);
  assert.equal(overview.activeTenants, 2);
  assert.equal(overview.sources.filter(source => source.status === 'disabled').length, 5);
  assert.ok(!JSON.stringify(overview).includes(configured.HUB_INTEGRATION_ONLYGYM_TOKEN));
});
test('connection failure has null count, hides private details and preserves other sources', async () => {
  const overview = await bridge(configured, async url => {
    if (url.includes('onlygym.')) throw Error('Private infrastructure detail');
    return response('onlyturn');
  }).getUniversalGovernanceOverview();
  const gym = overview.sources.find(source => source.saas === 'onlygym');
  assert.equal(gym.status, 'unavailable');
  assert.equal(gym.count, null);
  assert.equal(overview.totalTenants, 1);
  assert.ok(!JSON.stringify(overview).includes('Private infrastructure detail'));
});
test('missing credentials never trigger requests', async () => {
  const overview = await bridge({ ...configured, HUB_INTEGRATION_ONLYGYM_TOKEN: '', HUB_INTEGRATION_ONLYTURN_TOKEN: 'short' }).getUniversalGovernanceOverview();
  assert.equal(overview.sources.filter(source => source.status === 'unavailable').length, 2);
});
test('read-only contract rejects either write capability', async () => {
  for (const capabilities of [{ tenantWrite: true }, { moduleWrite: true }, { moduleWrite: undefined }]) {
    const overview = await bridge(configured, async url => response(new URL(url).hostname.split('.')[0], 0, capabilities)).getUniversalGovernanceOverview();
    assert.equal(overview.totalTenants, 0);
    assert.equal(overview.sources.filter(source => source.status === 'unavailable').length, 2);
  }
});
test('pagination completes and rejects repeated offsets', async () => {
  for (const invalid of [false, true]) {
    let calls = 0;
    const overview = await bridge({ ...configured, HUB_SAAS_INTEGRATION_PRODUCTS: 'onlygym' }, async () => {
      const data = await response('onlygym', calls++).json();
      data.nextOffset = calls === 1 ? 100 : invalid ? 100 : null;
      return Response.json(data);
    }).getUniversalGovernanceOverview();
    assert.equal(calls, 2);
    assert.equal(overview.totalTenants, invalid ? 0 : 2);
    assert.equal(overview.sources.find(source => source.saas === 'onlygym').status, invalid ? 'unavailable' : 'available');
  }
});
test('writes remain blocked', async () => {
  const api = bridge(configured);
  await assert.rejects(api.updateTenantStatusInDB(), /Edición bloqueada/);
  await assert.rejects(api.toggleTenantModuleInDB(), /Edición bloqueada/);
});
