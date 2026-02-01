
import { GoogleGenAI } from "@google/genai";

/**
 * 將經緯度轉換為地址名稱，優化針對加拿大地址的提取
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "") {
    console.warn("未偵測到 API_KEY，將直接顯示座標。");
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // 強化提示詞，要求具體的加拿大地址格式
    const prompt = `
      位置座標: 緯度 ${lat}, 經度 ${lng}。
      請精確提供此座標在加拿大的完整街道地址或著名地標名稱（繁體中文）。
      格式要求：如果是街道，請包含門牌號碼和路名；如果是商場或公園，請提供其名稱。
      只需返回名稱字符串，不要包含任何解釋或座標數字。
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    // 取得 Grounding 的地址通常更準確
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const mapsUrl = groundingMetadata?.groundingChunks?.find(chunk => chunk.maps?.uri)?.maps?.uri;
    
    // 如果模型回覆包含座標文字，嘗試清理
    let address = response.text?.trim() || "";
    if (address.includes("緯度") || address.includes("Latitude")) {
      address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    return { address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, mapsUrl };
  } catch (error) {
    console.error("Geocoding failed:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
