
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
    
    // 使用 gemini-2.5-flash，這是目前 Maps 工具支援最完整的模型
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a professional geocoder. What is the precise Traditional Chinese address at latitude ${lat}, longitude ${lng}? Use Google Maps to find the building name or street address. Output ONLY the address string.`,
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
    
    // 1. 深度遍歷 Grounding Chunks 尋找資料
    let extractedTitle = "";
    let extractedUrl = "";

    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        // 優先抓取 title 或 address 相關欄位
        if (chunk.maps.title && !extractedTitle) extractedTitle = chunk.maps.title;
        if (chunk.maps.uri && !extractedUrl) extractedUrl = chunk.maps.uri;
      }
    }

    // 2. 獲取文字回覆
    let textResponse = response.text?.trim().replace(/[\*\#\`]/g, "") || "";

    // 3. 邏輯決策
    // 如果 textResponse 包含座標字樣，說明模型沒能生成有效地址，則改用 Grounding Title
    const isUselessText = !textResponse || textResponse.length < 5 || /\d+\.\d+/.test(textResponse);
    
    let finalAddress = textResponse;
    if (isUselessText && extractedTitle) {
      finalAddress = extractedTitle;
    }

    // 4. 最後的保底
    if (!finalAddress || finalAddress.length < 3) {
      finalAddress = `經緯度: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
