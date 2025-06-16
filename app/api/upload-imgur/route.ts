import { NextRequest, NextResponse } from 'next/server';

interface ImgurResponse {
  data: {
    id: string;
    link: string;
    deletehash: string;
    type: string;
    size: number;
  };
  success: boolean;
  status: number;
}

export async function POST(request: NextRequest) {
  try {
    // リクエストサイズチェック
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 15 * 1024 * 1024) { // 15MB制限
      return NextResponse.json({ 
        error: 'リクエストサイズが大きすぎます。ファイルサイズを小さくしてください。' 
      }, { status: 413 });
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('Request JSON parse error:', parseError);
      return NextResponse.json({ 
        error: 'リクエストデータの解析に失敗しました。ファイルが大きすぎる可能性があります。' 
      }, { status: 400 });
    }

    const { base64Gif, filename } = requestData;
    
    if (!base64Gif) {
      return NextResponse.json({ error: 'GIFデータが見つかりません' }, { status: 400 });
    }

    // Base64データサイズチェック
    const estimatedSize = (base64Gif.length * 3) / 4; // Base64 -> バイナリ変換の推定サイズ
    console.log(`Base64 string length: ${base64Gif.length}`);
    console.log(`Estimated binary size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (estimatedSize > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json({ 
        error: `ファイルサイズが大きすぎます (推定${(estimatedSize / 1024 / 1024).toFixed(1)}MB)。Imgurの制限は10MBです。` 
      }, { status: 413 });
    }

    const clientId = process.env.IMGUR_CLIENT_ID;
    if (!clientId) {
      // 開発環境でのデモ用
      if (process.env.NODE_ENV === 'development' && process.env.DEMO_MODE === 'true') {
        console.log('Demo mode: returning dummy Imgur data');
        
        // ダミーのImgurレスポンス（実際のデモGIFのURL）
        return NextResponse.json({
          success: true,
          id: 'demo' + Date.now(),
          link: 'data:image/gif;base64,R0lGODlhEAAQAPIAAP///wAAAMLCwkJCQgAAAGJiYoKCgpKSkiH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAEAAQAAADMwi63P4wyklrE2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQJCgAAACwAAAAAEAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUkKhIAIfkECQoAAAAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9HMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkECQoAAAAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYumCYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkECQoAAAAsAAAAABAAEAAAAzIIunInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQJCgAAACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJibufbSlKAAAh+QQJCgAAACwAAAAAEAAQAAADMgi63P7wjRDKufy8R4WK4xR2YAiCxmKH4IpWRTUAGYmTlVJjrI4s9J4u7BqBQk+7d6KA',
          deleteHash: 'demo_delete_hash_' + Date.now(),
          size: 1024,
          type: 'image/gif'
        });
      }
      
      return NextResponse.json({ error: 'Imgur Client IDが設定されていません' }, { status: 500 });
    }

    // Imgur APIにアップロード
    const formData = new FormData();
    formData.append('image', base64Gif);
    formData.append('type', 'base64');
    formData.append('name', filename || 'converted.gif');
    formData.append('title', 'Gifizer変換画像');

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = 'Imgurへのアップロードに失敗しました';
      let errorText = '';
      
      try {
        errorText = await response.text();
        console.error('Imgur API error:', response.status, errorText);
        
        // Imgur APIの具体的なエラーメッセージを解析
        if (errorText.includes('file is over the size limit') || response.status === 413) {
          errorMessage = 'ファイルサイズが10MBを超えています。小さなサイズに調整してください。';
        } else if (response.status === 429) {
          errorMessage = 'アップロード制限に達しました。しばらく時間をおいてから再試行してください。';
        } else if (response.status === 400) {
          errorMessage = 'ファイル形式またはデータが無効です。';
        } else if (response.status >= 500) {
          errorMessage = 'Imgurサーバーエラーです。しばらく待ってから再試行してください。';
        }
      } catch (textError) {
        console.error('Error reading Imgur error response:', textError);
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    let imgurData: ImgurResponse;
    try {
      imgurData = await response.json();
    } catch (parseError) {
      console.error('Imgur response parse error:', parseError);
      return NextResponse.json(
        { error: 'Imgurレスポンスの解析に失敗しました' },
        { status: 500 }
      );
    }
    
    if (!imgurData.success) {
      return NextResponse.json(
        { error: 'Imgurアップロードが失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: imgurData.data.id,
      link: imgurData.data.link,
      deleteHash: imgurData.data.deletehash,
      size: imgurData.data.size,
      type: imgurData.data.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: 'アップロード中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Imgur画像削除API
export async function DELETE(request: NextRequest) {
  try {
    const { deleteHash } = await request.json();
    
    if (!deleteHash) {
      return NextResponse.json({ error: '削除ハッシュが見つかりません' }, { status: 400 });
    }

    const clientId = process.env.IMGUR_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Imgur Client IDが設定されていません' }, { status: 500 });
    }

    const response = await fetch(`https://api.imgur.com/3/image/${deleteHash}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Imgur delete error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Imgurからの削除に失敗しました' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      deleted: result.success
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { 
        error: '削除中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}