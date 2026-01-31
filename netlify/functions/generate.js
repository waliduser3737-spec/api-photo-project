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

    // This model works on HF free tier for image-to-image
    const API_URL = 'https://router.huggingface.co/hf-inference/models/runwayml/stable-diffusion-v1-5';
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: imageData,
        parameters: {
          prompt: body.prompt,
          strength: parseFloat(body.strength) || 0.5,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          seed: body.seed || undefined
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `HF API error: ${errorText}` })
      };
    }

    const imageBlob = await response.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        images: [`data:image/png;base64,${base64Image}`]
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
