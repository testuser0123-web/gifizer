import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 });
    }

    // URL validation
    try {
      const urlObj = new URL(url);
      
      // Twitter video URLs or direct video file URLs
      if (urlObj.hostname !== 'video.twimg.com' && 
          !url.match(/\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i)) {
        return NextResponse.json({ 
          error: 'サポートされていないURL形式です' 
        }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: '無効なURLです' }, { status: 400 });
    }

    // Fetch the video
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ 
        error: `動画の取得に失敗しました (${response.status})` 
      }, { status: response.status });
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('video/')) {
      return NextResponse.json({ 
        error: '指定されたURLは動画ファイルではありません' 
      }, { status: 400 });
    }

    // Stream the video data
    const videoBuffer = await response.arrayBuffer();
    
    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Fetch video error:', error);
    return NextResponse.json(
      { 
        error: '動画の取得中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}