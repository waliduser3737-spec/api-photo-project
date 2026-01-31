export async function handler(event, context) {
  try {
    const body = JSON.parse(event.body);
    
    if (!body.apiKey || !body.prompt || !body.template) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Convert base64 to buffer
    let imageData = body.template;
    if (imageData.startsWith('data:image')) {
      imageData = imageData.split(',')[1];
    }

    // Use InstructPix2Pix - confirmed working for image-to-image on HF
    const API_URL = 'https://router.huggingface.co/hf-inference/models/timbrooks/instruct-pix2pix';
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${body.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: imageData,  // Base64 image
        parameters: {
          prompt: body.prompt,
          num_inference_steps: 20,
          guidance_scale: 7.5,
          image_guidance_scale: 1.5
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
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
