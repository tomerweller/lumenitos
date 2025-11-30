import { NextResponse } from 'next/server';
import { config } from '@/utils/config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const locator = searchParams.get('locator');
    const transactionId = searchParams.get('transactionId');

    if (!locator || !transactionId) {
      return NextResponse.json(
        { error: 'Missing locator or transactionId parameter' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${config.crossmint.apiBase}/${config.crossmint.apiVersion}/wallets/${encodeURIComponent(locator)}/transactions/${transactionId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': config.crossmint.apiKey,
          'Content-Type': 'application/json'
        }
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
