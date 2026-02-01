
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱，優化針對加拿大地址的提取
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("Missing API Key");
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // 強化 Prompt：要求模型扮演地理編碼專家
    const prompt = `You are a Canadian reverse geocoding specialist. 
Location: latitude ${lat}, longitude ${lng}. 
Task: Find the exact street address or building name for these coordinates using Google Maps.
Output Format: Return ONLY the Traditional Chinese address string (e.g., "123 Main St, Vancouver, BC" or "多倫多伊頓中心"). 
No conversational text, no coordinates in the output.`;

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

    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    
    // 嘗試從 Grounding 數據中直接提取地圖項目的名稱作為備案
    const mapChunk = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.title || chunk.maps?.uri);
    const mapTitle = mapChunk?.maps?.title;
    const mapsUrl = mapChunk?.maps?.uri;
    
    let address = response.text?.trim() || "";
    
    // 如果回傳的是座標或者太短，則優先使用 Grounding 標題
    const isCoordinate = /\d+\.\d+/.test(address) && address.includes(",");
    if ((!address || address.length < 5 || isCoordinate) && mapTitle) {
      address = mapTitle;
    }

    // 如果還是失敗，做最後的清理
    if (!address || address.length < 3) {
      address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return { address, mapsUrl };
  } catch (error) {
    console.error("Gemini Service Detailed Error:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
