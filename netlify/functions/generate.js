export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    console.log('Received generation request (Hugging Face)');

    // Validate required fields
    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: apiKey, prompt, or template' 
        })
      };
    }

    // Convert base64 to clean base64 (remove data URL prefix if present)
    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }

    // NEW ENDPOINT: Using Hugging Face Router API instead of old inference API
    const API_URL = 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-refiner-1.0';
    
    console.log('Calling Hugging Face Router API...');
    
    // Build parameters object
    const parameters = {
      image: imageData,
      strength: parseFloat(body.strength) || 0.5,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      negative_prompt: 'low quality, blurry, distorted, watermark, text, letters, bad anatomy'
    };
    
    // Add seed if provided
    if (body.seed && !isNaN(body.seed)) {
      parameters.seed = body.seed;
    }
    
    // Make request
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: body.prompt,
        parameters: parameters
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      
      // Handle specific errors
      if (response.status === 503) {
        return {
          statusCode: 503,
          body: JSON.stringify({ 
            error: 'Model is loading or unavailable. Please wait 10-20 seconds and try again.' 
          })
        };
      }
      
      if (response.status === 429) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            error: 'Too many requests. Please wait a moment and try again.'
          })
        };
      }
      
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Hugging Face API error: ${errorText}` })
      };
    }

    // Get the image as blob
    const imageBlob = await response.blob();
    
    // Convert blob to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    console.log('Image generated successfully');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        images: [imageUrl],
        model: 'stabilityai/stable-diffusion-xl-refiner-1.0'
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
