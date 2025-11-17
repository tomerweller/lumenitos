import { NextResponse } from 'next/server';

const CROSSMINT_API_BASE = 'https://staging.crossmint.com/api';
const API_VERSION = '2025-06-09';

export async function POST(request) {
  try {
    const body = await request.json();
    const { locator, tokenLocator, transferParams } = body;

    const response = await fetch(
      `${CROSSMINT_API_BASE}/${API_VERSION}/wallets/${encodeURIComponent(locator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.CROSSMINT_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(transferParams)
      }
    );

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
