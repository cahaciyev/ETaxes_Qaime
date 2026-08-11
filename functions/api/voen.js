// Cloudflare Pages Function: server-side proxy for the public e-Taxes
// taxpayer lookup service. Runs entirely on the edge — never exposed to
// the client bundle — so browser CORS restrictions on the upstream
// government API don't apply here (server-to-server request).

const UPSTREAM_URL = "https://new.e-taxes.gov.az/api/po/authless/public/v1/authless/findTaxpayer";

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function onRequestPost(context) {
  let payload;
  try {
    payload = await context.request.json();
  } catch (e) {
    return json({ ok: false, error: "Yanlış sorğu formatı." }, 400);
  }

  const tin = String((payload && payload.tin) || "").trim();
  if (!/^\d{10}$/.test(tin)) {
    return json({ ok: false, error: "VÖEN 10 rəqəmdən ibarət olmalıdır." }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sessionId": crypto.randomUUID()
      },
      body: JSON.stringify({
        middleName: null,
        type: "legalEntity",
        tin,
        serviceCode: "findTaxpayerByTinAndName"
      })
    });
  } catch (e) {
    return json({ ok: false, error: "Vergi orqanının servisinə qoşulmaq mümkün olmadı." }, 502);
  }

  if (upstream.status === 404) {
    return json({ ok: false, notFound: true, error: "Bu VÖEN üzrə vergi ödəyicisi tapılmadı." }, 404);
  }
  if (!upstream.ok) {
    return json({ ok: false, error: "Vergi orqanının servisi hazırda cavab vermir." }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch (e) {
    return json({ ok: false, error: "Vergi orqanının cavabı oxuna bilmədi." }, 502);
  }

  const t = data && Array.isArray(data.taxpayers) ? data.taxpayers[0] : null;
  if (!t) {
    return json({ ok: false, notFound: true, error: "Bu VÖEN üzrə vergi ödəyicisi tapılmadı." }, 404);
  }

  const legal = t.legalTaxpayerStatus || {};
  return json({
    ok: true,
    taxpayer: {
      name: t.name || null,
      tin: t.tin || tin,
      active: !!t.active,
      riskyPayer: !!t.riskyPayer,
      vatPayer: !!t.vatPayer,
      debt: typeof t.debt === "number" ? t.debt : 0,
      organizationType: t.organizationType || null,
      taxAuthority: (t.taxAuthority && t.taxAuthority.name && t.taxAuthority.name.az) || null,
      legalAddress: legal.legalAddress || null,
      legitimate: legal.legitimate || null,
      voenRegisteredAt: legal.voenRegisteredAt || null,
      statusName: (legal.taxpayerStatus && legal.taxpayerStatus.name && legal.taxpayerStatus.name.az) || null
    }
  }, 200);
}

export async function onRequestGet() {
  return json({ ok: false, error: "Yalnız POST metodu dəstəklənir." }, 405);
}
