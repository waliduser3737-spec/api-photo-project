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

    // Convert base64 to binary if needed
    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      // Remove data URL prefix
      imageData = imageData.split(',')[1];
    }

    // Using Hugging Face Inference API with SDXL image-to-image
    // Model: stabilityai/stable-diffusion-xl-refiner-1.0 (free tier)
    const API_URL = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-refiner-1.0';
    
    console.log('Calling Hugging Face API...');
    
    // Make request with proper payload format
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: body.prompt,
        parameters: {
          image: imageData,  // base64 image
          strength: parseFloat(body.strength) || 0.5,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          negative_prompt: 'low quality, blurry, distorted, watermark'
        },
        options: {
          wait_for_model: true,
          use_cache: false
        }
      })
    });

    console.log('Response status:', response.status);

    // Handle model loading (503)
    if (response.status === 503) {
      const errorData = await response.json();
      if (errorData.error && errorData.error.includes('loading')) {
        return {
          statusCode: 503,
          body: JSON.stringify({ 
            error: 'Model is loading. Please wait a few seconds and try again.' 
          })
        };
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', errorText);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        images: [imageUrl]  // Return as array for compatibility
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
