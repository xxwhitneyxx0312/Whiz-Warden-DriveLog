
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  // 從環境變數獲取 Key，如果沒有則跳過 API 呼叫
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "") {
    console.warn("未偵測到 API_KEY，將直接顯示座標。");
    return { address: `座標: ${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }

  try {
    // 延遲初始化，確保環境變數已載入
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `座標: 緯度 ${lat}, 經度 ${lng}。請提供這個位置的地標名稱或街道地址（繁體中文）。只需返回地名，不需解釋。`,
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

    const address = response.text?.trim() || `座標: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const mapsUrl = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;

    return { address, mapsUrl };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return { address: `座標: ${lat.toFixed(4)}, ${lng.toFixed(4)}` };
  }
}
