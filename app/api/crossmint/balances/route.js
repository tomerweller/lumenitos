import { NextResponse } from 'next/server';

const CROSSMINT_API_BASE = 'https://staging.crossmint.com/api';
const API_VERSION = '2025-06-09';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const locator = searchParams.get('locator');

    if (!locator) {
      return NextResponse.json(
        { error: 'locator parameter is required' },
        { status: 400 }
      );
    }

    const cacheBuster = `_t=${Date.now()}`;
    const url = `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/balances?tokens=XLM&${cacheBuster}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.CROSSMINT_API_KEY,
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.message || response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
