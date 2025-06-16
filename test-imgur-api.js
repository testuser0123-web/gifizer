#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 1x1ピクセルの透明GIF（Base64エンコード済み）
const SAMPLE_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function testImgurAPI() {
  const clientId = process.env.IMGUR_CLIENT_ID;
  
  console.log('🔍 Imgur API テスト開始');
  console.log('Client ID:', clientId ? `${clientId.substring(0, 8)}...` : 'Not found');
  
  if (!clientId) {
    console.error('❌ IMGUR_CLIENT_ID が .env.local に設定されていません');
    return;
  }

  try {
    console.log('📤 サンプル画像をアップロード中...');
    
    const formData = new FormData();
    formData.append('image', SAMPLE_GIF_BASE64);
    formData.append('type', 'base64');
    formData.append('name', 'test.gif');
    formData.append('title', 'API Test Image');

    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${clientId}`,
      },
      body: formData,
    });

    console.log('📡 レスポンス状態:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ アップロード失敗');
      console.error('エラー詳細:', errorText);
      
      if (response.status === 403) {
        console.error('💡 Client IDが無効の可能性があります');
      } else if (response.status === 429) {
        console.error('💡 レート制限に達しました');
      }
      return;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ アップロード成功！');
      console.log('画像ID:', result.data.id);
      console.log('画像URL:', result.data.link);
      console.log('削除ハッシュ:', result.data.deletehash);
      console.log('ファイルサイズ:', result.data.size, 'bytes');
      
      // 削除テスト
      console.log('🗑️  削除テスト実行中...');
      const deleteResponse = await fetch(`https://api.imgur.com/3/image/${result.data.deletehash}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Client-ID ${clientId}`,
        },
      });
      
      if (deleteResponse.ok) {
        const deleteResult = await deleteResponse.json();
        console.log('✅ 削除成功:', deleteResult.success);
      } else {
        console.log('⚠️  削除失敗:', deleteResponse.status);
      }
      
    } else {
      console.error('❌ Imgurがエラーを返しました:', result);
    }

  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error.message);
  }
}

// Node.js環境でFormDataを使用するためのポリフィル
if (typeof FormData === 'undefined') {
  global.FormData = require('form-data');
}

if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testImgurAPI();