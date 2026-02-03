
import { GoogleGenAI } from "@google/genai";

/**
 * Converts coordinates to a precise English address.
 * Optimized to prioritize metadata from Google Maps tool.
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Using a more descriptive prompt to encourage the model to use its tools effectively
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Identify the specific English street address or place name at these coordinates: ${lat}, ${lng}. 
      Use the Google Maps tool to be precise. 
      I need the full English address including street name and area.`,
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
    
    // 1. Direct metadata extraction - often more reliable than the text response
    let mapsTitle = "";
    let mapsUrl = "";

    // Iterate through all chunks to find the best map data
    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        if (chunk.maps.title && chunk.maps.title.length > mapsTitle.length) {
          mapsTitle = chunk.maps.title;
        }
        if (chunk.maps.uri) {
          mapsUrl = chunk.maps.uri;
        }
      }
    }

    // 2. Clean the text response
    let textOutput = response.text?.trim()
      .replace(/[\*\#\`]/g, "")
      .replace(/\n/g, ", ")
      .split("Coordinates:")[0] // Remove trailing coordinate mentions
      .trim() || "";

    // 3. Selection Logic:
    // If mapsTitle exists and looks like a real place (not just coords), prefer it.
    // If textOutput is just repeating the coordinates, use mapsTitle.
    const textIsJustCoords = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/.test(textOutput);
    
    let finalAddress = textOutput;

    // Prioritize mapsTitle if text is empty, too short, or just coords
    if (mapsTitle && (finalAddress.length < 10 || textIsJustCoords)) {
      finalAddress = mapsTitle;
    }

    // 4. Final Fallback if everything failed
    if (!finalAddress || finalAddress.length < 5 || textIsJustCoords) {
      finalAddress = `Location near ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    // Ensure it doesn't contain Chinese characters (as per user request "English Only")
    // Simple filter to strip common Chinese ranges if model ignores prompt
    finalAddress = finalAddress.replace(/[\u4e00-\u9fa5]/g, '').replace(/,\s*,/g, ',').trim();

    return { 
      address: finalAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, 
      mapsUrl: mapsUrl 
    };
  } catch (error) {
    console.error("Gemini Geocoding Error:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
