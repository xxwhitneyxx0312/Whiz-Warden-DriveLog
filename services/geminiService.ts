
import { GoogleGenAI } from "@google/genai";

/**
 * Converts coordinates to a precise English address.
 * Optimized for Gemini 2.5 Flash + Google Maps Grounding.
 */
export async function getAddressFromCoords(lat: number, lng: number): Promise<{ address: string; mapsUrl?: string }> {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Improved prompt to handle edge cases where exact street addresses aren't available
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide the precise English address or descriptive location name for coordinates (${lat}, ${lng}). 
      If a specific street address is unavailable, name the nearest landmark or district in English. 
      Output ONLY the location string. No coordinates in the output.`,
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
    
    // 1. Try to extract the most descriptive name from Maps Grounding Chunks
    let mapsLabel = "";
    let mapsUrl = "";

    for (const chunk of groundingChunks) {
      if (chunk.maps) {
        // Prefer the most descriptive title available in chunks
        if (chunk.maps.title && chunk.maps.title.length > mapsLabel.length) {
          mapsLabel = chunk.maps.title;
        }
        if (chunk.maps.uri) {
          mapsUrl = chunk.maps.uri;
        }
      }
    }

    // 2. Extract and clean the textual response
    let textOutput = response.text?.trim()
      .replace(/[\*\#\`]/g, "")
      .replace(/\n/g, ", ")
      .trim() || "";

    // 3. Selection Logic:
    // We want to avoid returning raw coordinates (e.g. "22.3, 114.1")
    const isCoordinateOnly = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(textOutput);
    
    let finalAddress = "";

    // Priority 1: Use the maps label if it exists and text is coordinate-like or too short
    if (mapsLabel && (isCoordinateOnly || textOutput.length < 5)) {
      finalAddress = mapsLabel;
    } 
    // Priority 2: Use the model's text output if it's not just coordinates
    else if (textOutput && !isCoordinateOnly) {
      finalAddress = textOutput;
    }
    // Priority 3: Use mapsLabel as a last-resort descriptive name
    else if (mapsLabel) {
      finalAddress = mapsLabel;
    }

    // 4. Final cleaning and English check
    // Remove any remaining Chinese characters as per user preference
    finalAddress = finalAddress.replace(/[\u4e00-\u9fa5]/g, '').replace(/,\s*,/g, ',').trim();
    
    // Cleanup leading/trailing commas
    finalAddress = finalAddress.replace(/^,|,$/g, '').trim();

    // 5. Hard Fallback
    if (!finalAddress || finalAddress.length < 3) {
      finalAddress = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }

    return { 
      address: finalAddress, 
      mapsUrl: mapsUrl 
    };
  } catch (error) {
    console.error("Geocoding Service Error:", error);
    return { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
  }
}
