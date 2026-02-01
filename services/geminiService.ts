
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱，優化針對加拿大地址的提取
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    // 嚴格按照規範初始化
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    
    // 使用支援 Maps Grounding 的 2.5 系列模型
    const prompt = `Location: ${lat}, ${lng}. Return the full Canadian street address or landmark name in Traditional Chinese. Only the address name string, no extra text. Example: "123 Main St, Vancouver, BC"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-latest",
      contents: prompt,
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

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const mapsUrl = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;
    
    let address = response.text?.trim() || "";
    
    // 清理非地址文字
    if (!address || address.length < 5 || address.includes("緯度") || address.includes("Latitude")) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, mapsUrl };
    }

    return { address, mapsUrl };
  } catch (error) {
    console.error("Gemini Service Error:", error);
    // 即使失敗也回傳座標，避免 UI 卡死
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
