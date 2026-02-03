
import { GoogleGenAI } from "@google/genai";

/**
 * Converts coordinates to an English address using Gemini + Google Maps grounding.
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Explicitly request English address for better consistency and developer preference
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a professional geocoder. What is the precise English address at latitude ${lat}, longitude ${lng}? Use Google Maps to find the building name or street address. Output ONLY the address string in English.`,
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
    
    // 1. Extract info from Grounding Chunks (Direct Maps data)
    let extractedTitle = "";
    let extractedUrl = "";

    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        // Maps tool often returns the most accurate name/address in the title field
        if (chunk.maps.title && !extractedTitle) extractedTitle = chunk.maps.title;
        if (chunk.maps.uri && !extractedUrl) extractedUrl = chunk.maps.uri;
      }
    }

    // 2. Get the text response from the model
    let textResponse = response.text?.trim().replace(/[\*\#\`]/g, "") || "";

    // 3. Logic Decision
    // If textResponse is just coordinates or empty, use the Grounding Title which is more reliable
    const isUselessText = !textResponse || textResponse.length < 5 || /\d+\.\d+/.test(textResponse);
    
    let finalAddress = textResponse;
    if (isUselessText && extractedTitle) {
      finalAddress = extractedTitle;
    }

    // 4. Final Fallback
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
