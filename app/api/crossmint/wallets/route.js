import { NextResponse } from 'next/server';
import { config } from '@/utils/config';

export async function POST(request) {
  try {
    const body = await request.json();
    const { publicKey, userEmail } = body;

    const response = await fetch(`${config.crossmint.apiBase}/${config.crossmint.apiVersion}/wallets`, {
      method: 'POST',
      headers: {
        'X-API-KEY': config.crossmint.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chainType: 'stellar',
        type: 'smart',
        config: {
          adminSigner: {
            type: 'external-wallet',
            address: publicKey
          }
        },
        owner: `email:${userEmail}`
      })
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

    const response = await fetch(
      `${config.crossmint.apiBase}/${config.crossmint.apiVersion}/wallets/${encodeURIComponent(locator)}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': config.crossmint.apiKey
        }
      }
    );

    if (response.status === 404) {
      return NextResponse.json(null, { status: 404 });
    }

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
