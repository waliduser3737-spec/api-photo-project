export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    console.log('Received generation request (Hugging Face)');

    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: apiKey, prompt, or template' 
        })
      };
    }

    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }

    // UPDATED: Using base SDXL model which is available on the router
    // Alternative models if this doesn't work: 
    // - "stabilityai/stable-diffusion-2-1" 
    // - "runwayml/stable-diffusion-v1-5"
    const API_URL = 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0';
    
    console.log('Calling Hugging Face Router API...');
    
    const parameters = {
      image: imageData,
      strength: parseFloat(body.strength) || 0.5,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      negative_prompt: 'low quality, blurry, distorted, watermark, text, letters, bad anatomy'
    };
    
    if (body.seed && !isNaN(body.seed)) {
      parameters.seed = body.seed;
    }
    
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
      
      if (response.status === 404) {
        return {
          statusCode: 404,
          body: JSON.stringify({ 
            error: 'Model not found. Try a different model like stabilityai/stable-diffusion-2-1 or check your Hugging Face token access.' 
          })
        };
      }
      
      if (response.status === 503) {
        return {
          statusCode: 503,
          body: JSON.stringify({ 
            error: 'Model is loading or unavailable. Please wait 10-20 seconds and try again.' 
          })
        };
      }
      
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Hugging Face API error: ${errorText}` })
      };
    }

    const imageBlob = await response.blob();
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
        model: 'stabilityai/stable-diffusion-xl-base-1.0'
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
