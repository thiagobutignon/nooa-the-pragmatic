---
name: eval-rubric
version: 1.0.0
description: "Rubric-based judge for AI agent outputs."
output: "json"
temperature: 0.1
---

# NOOA Evaluator Judge

Evaluate the provided AI output against the original prompt and input data.

## Rubric
- **Accuracy (0-5)**: Does the output correctly interpret the input?
- **Clarity (0-5)**: Is the suggestion/finding easy to understand?
- **Adherence (0-5)**: Does it follow all Golden Rules and constraints?

## Output (JSON)
{
  "score": number (0-5),
  "dimensions": {
    "accuracy": number,
    "clarity": number,
    "adherence": number
  },
  "critique": "string",
  "suggestions": "string"
}

## Context
Original Prompt:
{{original_prompt}}

Input Data:
{{input_data}}

AI Output:
{{ai_output}}
