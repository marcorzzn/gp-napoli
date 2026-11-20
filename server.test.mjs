import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.js';

async function withServer(fn) {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('serves root launcher page with Napoli 127, 3 Posillipo eras, and quality bar', async () => {
  await withServer(async (baseUrl) => {
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { ok: true });

    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const html = await rootRes.text();
    assert.match(html, /Gran Premio di Napoli/);
    assert.match(html, /Fiat 127/);
    assert.match(html, /Alfa Romeo 12C-36/);
    assert.match(html, /Lancia D50/);
    assert.match(html, /Ferrari SF-26/);
    assert.match(html, /Molto Bassa \(APU 2014\)/);
  });
});

test('serves all five standalone WebGPU game builds intact', async () => {
  await withServer(async (baseUrl) => {
    const expected = [
      ['/napoli/', 'Gran Premio di Napoli · Fiat 127 Napoli 1926'],
      ['/posillipo/', 'Circuito di Posillipo · Gran Premio di Napoli'],
      ['/fable/', 'Uno com escada — circuito'],
      ['/opus/', 'Mille EP — Circuito da Serra'],
      ['/astra/', 'Serra do Lume'],
    ];
    for (const [route, titleSnippet] of expected) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `${route} should return 200`);
      const text = await res.text();
      assert.ok(text.includes(titleSnippet), `${route} should contain "${titleSnippet}"`);
    }
  });
});

test('serves Napoli and Posillipo archival assets, repository screenshots, and 404 on missing routes', async () => {
  await withServer(async (baseUrl) => {
    const refAssets = [
      ['image_f3e260ec.png', /image\/png/],
      ['image_352b7143.png', /image\/png/],
      ['00_posillipo_cartolina_aerea_circuito_1937_9706b9ff.jpg', /image\/jpeg/],
      ['01_1937_Alfa_Romeo_12C36_Nuvolari_Farina_bce79b35.jpg', /image\/jpeg/],
      ['02_1955_Lancia_D50_Ascari_serbatoi_siluro_9e550be9.jpg', /image\/jpeg/],
      ['03_2026_Ferrari_SF26_HyperF1_9c46ea40.webp', /image\/webp/],
    ];
    for (const [img, mime] of refAssets) {
      const res = await fetch(`${baseUrl}/assets/aistudio/${img}`);
      assert.equal(res.status, 200, `${img} should load`);
      assert.match(res.headers.get('content-type') || '', mime);
    }

    for (const img of ['fable-largada.jpg', 'opus-largada.jpg', 'astra-largada.jpg']) {
      const res = await fetch(`${baseUrl}/screenshots/${img}`);
      assert.equal(res.status, 200, `${img} should load`);
      assert.match(res.headers.get('content-type') || '', /image\/jpeg/);
    }

    const missing = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(missing.status, 404);
  });
});
