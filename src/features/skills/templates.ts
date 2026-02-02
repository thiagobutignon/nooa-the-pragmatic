
export const skillTemplate = (name: string, description: string) => `---
name: ${name}
description: ${description}
---

# ${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

## Overview

${description}

## Instructions

(Add detailed instructions here)
`;
