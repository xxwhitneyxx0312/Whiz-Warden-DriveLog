
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // 使用 gemini-2.5-flash 以確保地圖功能支援
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `What is the address at latitude ${lat}, longitude ${lng}? Return only the Traditional Chinese address string, no extra text.`,
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
    
    // 優先從地圖元數據提取 URL
    const mapsUrl = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;
    
    // 獲取地址文字
    let address = response.text?.trim() || "";
    
    // 如果回傳空或者是座標，嘗試從 Grounding 獲取標題
    if (!address || address.includes(",") || address.length < 5) {
      const mapTitle = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.title)?.maps?.title;
      if (mapTitle) address = mapTitle;
    }

    if (!address) {
      address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return { address, mapsUrl };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
