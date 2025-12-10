exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const text = body.text;

        if (!text) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing text input' })
            };
        }

        const prompt = `
            You are a fraud detection expert. Analyze the following conversation text for signs of scams, social engineering, or phishing.
            
            Text to analyze:
            "${text}"
            
            Return ONLY a valid JSON object with the following structure (do not include markdown ticks):
            {
                "riskScore": (integer 0-100, where 100 is definite scam),
                "riskLevel": (string, e.g., "Low", "Medium", "High", "Critical"),
                "category": (string, e.g., "Phishing", "Pig Butchering", "Emotional Blackmail", "Safe"),
                "summary": (string, a concise summary of why this is or isn't a scam, in Traditional Chinese),
                "anomalies": (array of strings, listing specific suspicious points in Traditional Chinese),
                "recommendations": (array of strings, advice for the user in Traditional Chinese)
            }
        `;

        // 1. Try standard models first
        const primaryModels = ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-pro'];
        let successfulResponse = null;
        let errors = [];

        // Helper
        const generateContent = async (modelName) => {
            return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });
        };

        // Try primary models
        for (const model of primaryModels) {
            try {
                const response = await generateContent(model);
                if (response.ok) {
                    successfulResponse = response;
                    break;
                } else { errors.push(`${model}: ${response.statusText}`); }
            } catch (e) { errors.push(`${model}: ${e.message}`); }
        }

        // 2. Dynamic Discovery
        if (!successfulResponse) {
            try {
                const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
                if (listResp.ok) {
                    const listData = await listResp.json();
                    const availableModels = (listData.models || [])
                        .filter(m => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
                        .map(m => m.name.replace('models/', ''));

                    for (const model of availableModels) {
                        if (primaryModels.includes(model)) continue;
                        try {
                            const response = await generateContent(model);
                            if (response.ok) {
                                successfulResponse = response;
                                break;
                            }
                        } catch (e) { }
                    }
                    if (!successfulResponse) {
                        throw new Error(`Auto-discovery failed. Available models: ${availableModels.join(', ')}`);
                    }
                } else {
                    throw new Error(`ListModels failed (${listResp.status}). Check API Key.`);
                }
            } catch (discoveryError) {
                throw new Error(`Diagnosis failed: ${discoveryError.message}`);
            }
        }

        if (!successfulResponse) {
            throw new Error('All attempts failed.');
        }

        const data = await successfulResponse.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates returned from AI');
        }

        const rawText = data.candidates[0].content.parts[0].text;
        const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(jsonString);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(parsedResult)
        };

    } catch (error) {
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
