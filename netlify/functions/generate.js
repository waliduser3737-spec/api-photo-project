export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }

    // Leonardo.ai Universal Upscaler/Img2Img (Alchemy model)
    const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: body.prompt,
        modelId: "b24e16ff-06e3-416e-8b91-9b3166bbb163", // Leonardo Diffusion XL
        width: 1024,
        height: 1024,
        alchemy: true,
        photoReal: false,
        controlnets: [
          {
            initImageId: imageData, // base64 or you need to upload first
            initImageType: "BASE64",
            preprocessorId: "none",
            weight: 1.0 - (parseFloat(body.strength) || 0.5) // Inverted strength
          }
        ],
        seed: body.seed || undefined
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Leonardo error: ${error}`);
    }

    const result = await response.json();
    const imageUrl = result.generationsByPk?.generatedImages?.[0]?.url;

    if (!imageUrl) throw new Error('No image generated');

    return {
      statusCode: 200,
      body: JSON.stringify({ images: [imageUrl] })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
