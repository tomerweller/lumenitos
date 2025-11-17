import { NextResponse } from 'next/server';
import { config } from '@/utils/config';

export async function POST(request) {
  try {
    const body = await request.json();
    const { locator, tokenLocator, transferParams } = body;

    const response = await fetch(
      `${config.crossmint.apiBase}/${config.crossmint.apiVersion}/wallets/${encodeURIComponent(locator)}/tokens/${encodeURIComponent(tokenLocator)}/transfers`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': config.crossmint.apiKey,
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
