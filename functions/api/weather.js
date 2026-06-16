const TARGET = 'https://zgis185.geo.sbg.ac.at/group04/api/weather';

export async function onRequest() {
  try {
    const r = await fetch(TARGET, {
      headers: { 'Accept': 'application/json' },
      cf: { tlsClientAuth: false },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}