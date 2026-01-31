export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Clean base64
    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }

    // Also process product image if provided
    let productData = body.product || null;
    if (productData && productData.startsWith('data:image')) {
      productData = productData.split(',')[1];
    }

    // Build content parts (text + images)
    const parts = [];
    
    // Add instruction text
    parts.push({
      text: body.prompt + ". Generate a professional advertisement image based on the reference style."
    });
    
    // Add template image as reference
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: imageData
      }
    });
    
    // Add product image if available
    if (productData) {
      parts.push({
        inlineData: {
          mimeType: "image/png", 
          data: productData
        }
      });
    }

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${body.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            responseModalities: ["Text", "Image"],
            temperature: 0.7,
            seed: body.seed || undefined
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    
    // Extract generated image from response
    let imageUrl = null;
    
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error('No image generated - check if image generation is enabled in your API key');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        images: [imageUrl],
        source: 'gemini-2.0-flash'
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
