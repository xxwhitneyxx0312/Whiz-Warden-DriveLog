
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱，深度解析 Google Maps 工具返回的元數據
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // 使用推薦的 2.5 系列模型
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the exact address or place name at latitude ${lat}, longitude ${lng}? Respond with the Traditional Chinese address.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      }
    });

    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const groundingChunks = groundingMetadata?.groundingChunks || [];
    
    // 優先從 Google Maps Grounding Chunks 中找尋標題與網址
    let extractedTitle = "";
    let extractedUrl = "";

    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        if (chunk.maps.title && !extractedTitle) extractedTitle = chunk.maps.title;
        if (chunk.maps.uri && !extractedUrl) extractedUrl = chunk.maps.uri;
      }
    }

    // 獲取模型生成的文字回覆
    let textResponse = response.text?.trim() || "";

    // 邏輯決策：如果模型回覆看起來只是在重複座標，則優先使用地圖工具抓到的標題
    const isCoordinate = /\d+\.\d+/.test(textResponse) && textResponse.includes(",");
    
    let finalAddress = textResponse;
    if (!finalAddress || isCoordinate || finalAddress.length < 5) {
      finalAddress = extractedTitle || textResponse;
    }

    // 如果最後還是什麼都沒有，回傳座標
    if (!finalAddress || finalAddress.length < 3) {
      finalAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return { 
      address: finalAddress, 
      mapsUrl: extractedUrl 
    };
  } catch (error) {
    console.error("Gemini Geocoding Error:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
