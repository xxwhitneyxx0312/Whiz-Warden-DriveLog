
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱，優化針對加拿大地址的提取
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  // 優先讀取真正注入的 API_KEY
  const apiKey = (typeof process !== 'undefined' && process.env.API_KEY) ? process.env.API_KEY : "";
  
  if (!apiKey || apiKey === "") {
    console.warn("未偵測到有效的 API_KEY，將直接顯示座標。");
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // 使用 Gemini 2.5 Flash 模型，這是支援地圖 Grounding 的標準模型
    const prompt = `Location: ${lat}, ${lng}. Return the full Canadian street address or landmark name in Traditional Chinese. Only the address name string, no extra text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-latest",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        // 可選：包含用戶位置環境（假設在加拿大）
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

    // 取得 Grounding 的數據
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const mapsUrl = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;
    
    let address = response.text?.trim() || "";
    
    // 如果返回結果異常（例如包含了經緯度描述），則清理
    if (address.includes("緯度") || address.includes("Latitude") || address.length < 3) {
      address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return { address: address, mapsUrl };
  } catch (error) {
    console.error("Geocoding API error:", error);
    // 發生錯誤時至少返回座標
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
