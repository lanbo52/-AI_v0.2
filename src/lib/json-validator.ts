
/**
 * A lightweight JSON schema validator to replace Zod in environments where we can't easily add dependencies.
 * Focuses on cleaning LLM output and validating structure.
 */

export interface Schema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    optional?: boolean;
    properties?: Record<string, Schema>; // For object
    items?: Schema; // For array
}

export const cleanJsonOutput = (text: string): string => {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?|\n?```/g, '');
    // Remove potential leading text
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    let start = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
        start = Math.min(firstBrace, firstBracket);
    } else {
        start = Math.max(firstBrace, firstBracket);
    }

    if (start !== -1) {
        cleaned = cleaned.substring(start);
    }

    // Find the last closing brace/bracket
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const end = Math.max(lastBrace, lastBracket);

    if (end !== -1) {
        cleaned = cleaned.substring(0, end + 1);
    }

    return cleaned;
};

export const validate = (data: any, schema: Schema, path: string = ''): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (data === undefined || data === null) {
        if (schema.optional) return { valid: true, errors: [] };
        return { valid: false, errors: [`Missing required value at ${path}`] };
    }

    if (schema.type === 'array') {
        if (!Array.isArray(data)) {
            return { valid: false, errors: [`Expected array at ${path}, got ${typeof data}`] };
        }
        if (schema.items) {
            data.forEach((item, index) => {
                const result = validate(item, schema.items!, `${path}[${index}]`);
                if (!result.valid) {
                    errors.push(...result.errors);
                }
            });
        }
    } else if (schema.type === 'object') {
        if (typeof data !== 'object' || Array.isArray(data)) {
            return { valid: false, errors: [`Expected object at ${path}, got ${typeof data}`] };
        }
        if (schema.properties) {
            Object.entries(schema.properties).forEach(([key, propSchema]) => {
                const result = validate(data[key], propSchema, `${path}.${key}`);
                if (!result.valid) {
                    errors.push(...result.errors);
                }
            });
        }
    } else {
        if (typeof data !== schema.type) {
            // Allow number strings for number type if they are valid numbers
            if (schema.type === 'number' && typeof data === 'string' && !isNaN(Number(data))) {
                // It's acceptable
            } else {
                return { valid: false, errors: [`Expected ${schema.type} at ${path}, got ${typeof data}`] };
            }
        }
    }

    return { valid: errors.length === 0, errors };
};

// Pre-defined Schemas
export const SceneSchema: Schema = {
    type: 'object',
    properties: {
        id: { type: 'string', optional: true },
        location: { type: 'string' },
        summary: { type: 'string' },
        shots: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    shotType: { type: 'string' },
                    angle: { type: 'string' },
                    movement: { type: 'string' },
                    visual: { type: 'string' },
                    audio: { type: 'string' },
                    duration: { type: 'number' }
                }
            }
        }
    }
};

export const VisualizerSchema: Schema = {
    type: 'object',
    properties: {
        visualPrompt: { type: 'string' },
        negativePrompt: { type: 'string', optional: true },
        paramSettings: { type: 'string', optional: true },
        isKeyframe: { type: 'boolean', optional: true },
        keyframeReason: { type: 'string', optional: true },
        visualPromptStart: { type: 'string', optional: true },
        visualPromptEnd: { type: 'string', optional: true }
    }
};

export const MotionSchema: Schema = {
    type: 'object',
    properties: {
        motionPrompt: { type: 'string' },
        motionParameters: { type: 'string', optional: true }
    }
};
