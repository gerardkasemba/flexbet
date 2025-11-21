import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport')
  const league = searchParams.get('league')

  if (!sport || !league) {
    return NextResponse.json(
      { error: 'Sport and league parameters are required' },
      { status: 400 }
    )
  }

  try {
    // Build the ESPN API URL
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams`
    
    console.log('Fetching from ESPN:', espnUrl)
    
    const response = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Return the raw ESPN data - let the frontend handle parsing
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching from ESPN:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}