const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHmac } = require('node:crypto');
const ts = require('typescript');
const tokens = { onlygym: 'gym-fixture-'.repeat(6), onlyturn: 'turn-fixture-'.repeat(6) };
function api(fetch, extra = {}) {
  const env = { HUB_SAAS_MANAGEMENT_PRODUCTS: 'onlygym,onlyturn,onlyfood,onlypadel,onlycars,onlyerp', HUB_MANAGEMENT_ONLYGYM_TOKEN: tokens.onlygym, HUB_MANAGEMENT_ONLYTURN_TOKEN: tokens.onlyturn, ...extra }, cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, process: { env }, fetch, Buffer, URLSearchParams, AbortSignal, require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name) }, { filename: file });
    return module.exports;
  }
  return load(path.resolve(__dirname, '../src/lib/saas-management.ts'));
}
const cmd = { requestId: '13d16e21-0221-4f4d-9cd7-38c5f2b3b9c7', operation: 'tenant.status', input: { tenantId: 'fixture', version: '2026-01-01T00:00:00.000Z', status: 'SUSPENDED' } };

test('OnlyShop has independent opt-in, fixed signed destination and native ARS billing', async()=>{
 const key='shop-fixture-'.repeat(6);let calls=0;
 assert.equal(api(()=>{throw Error();}).isManagementEnabled('onlyshop'),false);
 const sdk=api(async(url,options)=>{
  calls++;assert.equal(url,'https://onlyshop.nanoapps.ar/api/integrations/nanolabs/management');
  assert.equal(options.headers.Authorization,'Bearer '+key);
  const body=JSON.parse(options.body);assert.equal(body.actor,'trusted-owner');
  const timestamp=options.headers['X-NanoLabs-Timestamp'];
  assert.equal(options.headers['X-NanoLabs-Signature'],createHmac('sha256',key).update([timestamp,'POST',new URL(url).pathname,'trusted-owner',options.body].join('\n')).digest('hex'));
  return Response.json({success:true,contract:'nanolabs.saas.management.v1',product:'onlyshop',requestId:body.requestId,data:{tenantId:'fixture'}});
 },{HUB_SAAS_MANAGEMENT_PRODUCTS:'onlyshop',HUB_MANAGEMENT_ONLYSHOP_TOKEN:key});
 await sdk.callSaaSManagement('onlyshop','trusted-owner',new URLSearchParams(),{...cmd,operation:'payment.record',input:{tenantId:'fixture',amountCents:100,reference:'test',method:'Transferencia',days:0}});
 for(const operation of ['domain.add','payment.status'])await assert.rejects(sdk.callSaaSManagement('onlyshop','trusted-owner',new URLSearchParams(),{...cmd,operation}),e=>e.status===400);
 assert.equal(calls,1);
});

test('OnlyERP requires its own opt-in token and signs native username/calendar commands', async () => {
  const key='erp-fixture-'.repeat(6); let calls=0;
  assert.equal(api(()=>{throw Error();}).isManagementEnabled('onlyerp'),false);
  const sdk=api(async(url,options)=>{
    calls++; assert.equal(url,'https://onlyerp.nanoapps.ar/api/integrations/nanolabs/management');
    assert.equal(options.headers.Authorization,'Bearer '+key);assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);assert.equal(body.actor,'trusted-owner');
    assert.equal(options.headers['X-NanoLabs-Signature'],createHmac('sha256',key).update([options.headers['X-NanoLabs-Timestamp'],'POST','/api/integrations/nanolabs/management',body.actor,options.body].join('\n')).digest('hex'));
    if(body.operation==='admin.update'){assert.equal(body.input.username,'legacy-owner');assert.equal(body.input.email,undefined);}
    if(body.operation==='payment.record'){assert.equal(body.input.month,10);assert.equal(body.input.applySubscription,false);assert.equal(body.input.days,undefined);}
    return Response.json({success:true,contract:'nanolabs.saas.management.v1',product:'onlyerp',requestId:cmd.requestId,data:{tenantId:'1'}});
  },{HUB_MANAGEMENT_ONLYERP_TOKEN:key});
  await sdk.callSaaSManagement('onlyerp','trusted-owner',new URLSearchParams(),{...cmd,operation:'admin.update',input:{tenantId:'1',userId:'2',username:'legacy-owner',name:'Owner'}});
  await sdk.callSaaSManagement('onlyerp','trusted-owner',new URLSearchParams(),{...cmd,operation:'payment.record',input:{tenantId:'1',currency:'ARS',amountCents:100,month:10,year:2026,applySubscription:false}});
  for(const operation of ['domain.add','payment.status'])await assert.rejects(sdk.callSaaSManagement('onlyerp','trusted-owner',new URLSearchParams(),{...cmd,operation}),e=>e.status===400);
  assert.equal(calls,2);
});

test('OnlyCars requires opt-in, signs its fixed destination and keeps native payment/domain contracts', async () => {
  const token = 'cars-fixture-'.repeat(6); let calls = 0;
  assert.equal(api(() => { throw Error(); }).isManagementEnabled('onlycars'), false);
  assert.equal(api(() => { throw Error(); }, { HUB_MANAGEMENT_ONLYCARS_TOKEN: token, HUB_SAAS_MANAGEMENT_PRODUCTS: 'onlygym' }).isManagementEnabled('onlycars'), false);
  const sdk = api(async (url, options) => {
    calls++; assert.equal(url, 'https://onlycars.nanoapps.ar/api/integrations/nanolabs/management');
    assert.equal(options.headers.Authorization, 'Bearer ' + token); assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body); assert.equal(body.actor, 'trusted-admin');
    assert.equal(options.headers['X-NanoLabs-Signature'], createHmac('sha256', token).update([options.headers['X-NanoLabs-Timestamp'], 'POST', '/api/integrations/nanolabs/management', body.actor, options.body].join('\n')).digest('hex'));
    if (body.operation === 'payment.record') { assert.equal(body.input.currency, 'USD'); assert.ok(body.input.start && body.input.end); assert.equal(body.input.days, undefined); }
    if (body.operation === 'domain.add') assert.equal(body.input.confirmOwnership, true);
    return Response.json({ success: true, contract: 'nanolabs.saas.management.v1', product: 'onlycars', requestId: cmd.requestId, data: { tenantId: 'fixture' } });
  }, { HUB_MANAGEMENT_ONLYCARS_TOKEN: token });
  await sdk.callSaaSManagement('onlycars', 'trusted-admin', new URLSearchParams(), { ...cmd, operation: 'payment.record', input: { currency: 'USD', amountCents: 1000, start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' } });
  await sdk.callSaaSManagement('onlycars', 'trusted-admin', new URLSearchParams(), { ...cmd, operation: 'domain.add', input: { hostname: 'fixture.example.invalid', confirmOwnership: true } });
  await assert.rejects(sdk.callSaaSManagement('onlycars', 'trusted-admin', new URLSearchParams(), { ...cmd, operation: 'payment.status' }), e => e.status === 400);
  await assert.rejects(sdk.callSaaSManagement('onlygym', 'trusted-admin', new URLSearchParams(), { ...cmd, operation: 'domain.add' }), e => e.status === 400);
  assert.equal(calls, 2);
});
test('protected products are rejected before any network call even if configured', async () => {
  let calls = 0; const sdk = api(async () => { calls++; throw Error(); });
  for (const product of ['onlypadel', 'onlymob', 'unknown']) {
    assert.equal(sdk.isManagementEnabled(product), false);
    await assert.rejects(sdk.callSaaSManagement(product, 'admin', new URLSearchParams()), error => error.status === 403);
  }
  assert.equal(calls, 0);
});
test('only configured products with separate management credentials are enabled', async () => {
  const sdk = api(() => { throw Error('Unexpected fetch'); }, { HUB_MANAGEMENT_ONLYGYM_TOKEN: '', HUB_SAAS_MANAGEMENT_PRODUCTS: 'onlygym' });
  assert.equal(sdk.isManagementEnabled('onlygym'), false); assert.equal(sdk.isManagementEnabled('onlyturn'), false);
  await assert.rejects(sdk.callSaaSManagement('onlygym', 'admin', new URLSearchParams()), error => error.status === 503);
});
test('OnlyFood requires explicit credentials and preserves its payment lifecycle payload', async () => {
  const token = 'food-fixture-'.repeat(6);
  const missing = api(() => { throw Error('Unexpected fetch'); });
  assert.equal(missing.isManagementEnabled('onlyfood'), false);
  let calls = 0;
  const sdk = api(async (url, options) => {
    calls++; assert.equal(url, 'https://onlyfood.nanoapps.ar/api/integrations/nanolabs/management');
    const body = JSON.parse(options.body); assert.equal(body.operation, 'payment.status'); assert.equal(body.input.status, 'OVERDUE');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    return Response.json({ success: true, contract: 'nanolabs.saas.management.v1', product: 'onlyfood', requestId: cmd.requestId, data: { tenantId: 'legacy-default-tenant' } });
  }, { HUB_MANAGEMENT_ONLYFOOD_TOKEN: token });
  assert.equal(sdk.isManagementEnabled('onlyfood'), true);
  await sdk.callSaaSManagement('onlyfood', 'trusted-admin', new URLSearchParams(), { ...cmd, operation: 'payment.status', input: { tenantId: 'legacy-default-tenant', version: 'a'.repeat(64), paymentId: 'fixture', status: 'OVERDUE', paidAt: null } });
  await assert.rejects(sdk.callSaaSManagement('onlygym', 'admin', new URLSearchParams(), { ...cmd, operation: 'payment.status' }), error => error.status === 400);
  assert.equal(calls, 1);
});
test('writes use a fixed destination and bind actor, exact payload, path and timestamp', async () => {
  let count = 0;
  const sdk = api(async (url, options) => {
    count++;
    assert.equal(url, 'https://onlygym.nanoapps.ar/api/integrations/nanolabs/management');
    assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer ' + tokens.onlygym);
    const body = JSON.parse(options.body); assert.equal(body.actor, 'trusted-admin'); assert.equal(body.requestId, cmd.requestId);
    const expected = createHmac('sha256', tokens.onlygym).update([options.headers['X-NanoLabs-Timestamp'], 'POST', '/api/integrations/nanolabs/management', 'trusted-admin', options.body].join('\n')).digest('hex');
    assert.equal(options.headers['X-NanoLabs-Signature'], expected);
    return Response.json({ success: true, contract: 'nanolabs.saas.management.v1', product: 'onlygym', requestId: cmd.requestId, data: { tenantId: 'fixture' } });
  });
  const result = await sdk.callSaaSManagement('onlygym', 'trusted-admin', new URLSearchParams(), cmd);
  assert.equal(result.tenantId, 'fixture'); assert.equal(count, 1); assert.ok(!JSON.stringify(result).includes(tokens.onlygym));
});
test('refuses invalid commands and mismatched product/receipt contracts', async () => {
  const sdk = api(async () => Response.json({ success: true, contract: 'nanolabs.saas.management.v1', product: 'onlyturn', requestId: cmd.requestId, data: {} }));
  await assert.rejects(sdk.callSaaSManagement('onlygym', 'admin', new URLSearchParams(), { ...cmd, operation: 'dropDatabase' }), error => error.status === 400);
  await assert.rejects(sdk.callSaaSManagement('onlygym', 'admin', new URLSearchParams(), cmd), error => error.status === 502);
});
test('hides private connection errors and preserves known conflict messages', async () => {
  const disconnected = api(async () => { throw Error('postgres://private-password'); });
  await assert.rejects(disconnected.callSaaSManagement('onlygym', 'admin', new URLSearchParams(), cmd), error => error.status === 502 && !error.message.includes('private-password'));
  const conflict = api(async () => Response.json({ success: false, code: 'STALE_VERSION', error: 'Actualizá la ficha.' }, { status: 409 }));
  await assert.rejects(conflict.callSaaSManagement('onlygym', 'admin', new URLSearchParams(), cmd), error => error.status === 409 && error.message === 'Actualizá la ficha.');
});

