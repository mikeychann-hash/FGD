# Zod Validation Examples

## Real-World API Usage Examples

### Example 1: Creating a Valid Bot

**HTTP Request:**
```http
POST /api/bots HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "role": "miner",
  "name": "DiamondDigger",
  "description": "An expert mining bot specializing in diamond extraction",
  "personality": {
    "curiosity": 0.8,
    "patience": 0.9,
    "motivation": 0.85
  },
  "position": {
    "x": 100,
    "y": 12,
    "z": -250
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Bot DiamondDigger created and spawned successfully",
  "bot": {
    "id": "npc_5f8d3a2b",
    "role": "miner",
    "type": "miner",
    "personalitySummary": "curious and patient",
    "personalityTraits": {
      "curiosity": 0.8,
      "patience": 0.9,
      "motivation": 0.85
    },
    "description": "An expert mining bot specializing in diamond extraction",
    "position": {
      "x": 100,
      "y": 12,
      "z": -250
    }
  },
  "spawned": true
}
```

---

### Example 2: Invalid Role Error

**HTTP Request:**
```http
POST /api/bots HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "role": "wizard",
  "name": "MagicBot"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "role",
      "message": "Role must be one of: miner, builder, scout, guard, gatherer",
      "code": "invalid_value"
    }
  ]
}
```

---

### Example 3: Multiple Validation Errors

**HTTP Request:**
```http
POST /api/bots HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "role": "invalid_role",
  "name": "AB",
  "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
  "personality": {
    "curiosity": 1.5,
    "patience": -0.3
  },
  "position": {
    "x": 0,
    "y": 400,
    "z": 0
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "role",
      "message": "Role must be one of: miner, builder, scout, guard, gatherer",
      "code": "invalid_value"
    },
    {
      "field": "description",
      "message": "Too big: expected string to have <=500 characters",
      "code": "too_big"
    },
    {
      "field": "personality.curiosity",
      "message": "Too big: expected number to be <=1",
      "code": "too_big"
    },
    {
      "field": "personality.patience",
      "message": "Too small: expected number to be >=0",
      "code": "too_small"
    },
    {
      "field": "position.y",
      "message": "Too big: expected number to be <=320",
      "code": "too_big"
    }
  ]
}
```

---

### Example 4: Assigning a Task (Valid)

**HTTP Request:**
```http
POST /api/bots/npc_5f8d3a2b/task HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "action": "mine",
  "target": "diamond_ore",
  "priority": "high",
  "parameters": {
    "quantity": 64,
    "depth": "deepslate",
    "area": {
      "minX": -100,
      "maxX": 100,
      "minZ": -100,
      "maxZ": 100
    }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task assigned to bot npc_5f8d3a2b",
  "task": {
    "action": "mine",
    "target": "diamond_ore",
    "priority": "high"
  }
}
```

---

### Example 5: Task Assignment Error (Missing Required Field)

**HTTP Request:**
```http
POST /api/bots/npc_5f8d3a2b/task HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "target": "diamond_ore",
  "priority": "high"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "action",
      "message": "Action is required",
      "code": "invalid_type"
    }
  ]
}
```

---

### Example 6: Updating a Bot (Valid)

**HTTP Request:**
```http
PUT /api/bots/npc_5f8d3a2b HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "description": "An experienced diamond miner with 1000+ ores collected",
  "personality": {
    "patience": 0.95,
    "motivation": 0.9
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bot npc_5f8d3a2b updated successfully",
  "bot": {
    "id": "npc_5f8d3a2b",
    "role": "miner",
    "description": "An experienced diamond miner with 1000+ ores collected",
    "personalityTraits": {
      "curiosity": 0.8,
      "patience": 0.95,
      "motivation": 0.9
    }
  }
}
```

---

### Example 7: Query Filtering (Valid)

**HTTP Request:**
```http
GET /api/bots?status=active&role=miner HTTP/1.1
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "bots": [
    {
      "id": "npc_5f8d3a2b",
      "role": "miner",
      "status": "active",
      "description": "An experienced diamond miner"
    },
    {
      "id": "npc_7a9b2c3d",
      "role": "miner",
      "status": "active",
      "description": "Coal mining specialist"
    },
    {
      "id": "npc_8c1d4e5f",
      "role": "miner",
      "status": "active",
      "description": "Iron ore collector"
    }
  ]
}
```

---

### Example 8: Query Parameter Error

**HTTP Request:**
```http
GET /api/bots?status=invalid_status&role=wizard HTTP/1.1
Authorization: Bearer <token>
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Invalid query parameters",
  "details": [
    {
      "field": "status",
      "message": "Invalid option: expected one of \"active\"|\"inactive\"|\"idle\"|\"working\"",
      "code": "invalid_value"
    },
    {
      "field": "role",
      "message": "Role must be one of: miner, builder, scout, guard, gatherer",
      "code": "invalid_value"
    }
  ]
}
```

---

### Example 9: Spawning a Bot (Valid)

**HTTP Request:**
```http
POST /api/bots/npc_5f8d3a2b/spawn HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "position": {
    "x": 150,
    "y": 64,
    "z": -300
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Bot npc_5f8d3a2b spawned successfully",
  "position": {
    "x": 150,
    "y": 64,
    "z": -300
  }
}
```

---

### Example 10: Spawn Position Error (Out of Bounds)

**HTTP Request:**
```http
POST /api/bots/npc_5f8d3a2b/spawn HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>

{
  "position": {
    "x": 0,
    "y": -100,
    "z": 0
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "message": "Invalid input data",
  "details": [
    {
      "field": "position.y",
      "message": "Too small: expected number to be >=-64",
      "code": "too_small"
    }
  ]
}
```

---

## cURL Examples

### Create a Bot
```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "role": "miner",
    "name": "TestMiner",
    "personality": {
      "curiosity": 0.7,
      "patience": 0.8
    }
  }'
```

### List Active Miners
```bash
curl -X GET "http://localhost:3000/api/bots?status=active&role=miner" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Assign a Task
```bash
curl -X POST http://localhost:3000/api/bots/npc_5f8d3a2b/task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "action": "mine",
    "target": "diamond_ore",
    "priority": "high"
  }'
```

### Update a Bot
```bash
curl -X PUT http://localhost:3000/api/bots/npc_5f8d3a2b \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "description": "Updated description",
    "personality": {
      "patience": 0.95
    }
  }'
```

---

## Error Code Reference

| Code | Description | Example |
|------|-------------|---------|
| `invalid_type` | Expected type doesn't match | Expected string, got undefined |
| `invalid_value` | Value not in allowed set | Role must be miner, builder, scout, guard, or gatherer |
| `too_big` | Value exceeds maximum | Number > 1 or string > 500 chars |
| `too_small` | Value below minimum | Number < 0 or string < 3 chars |
| `invalid_string` | String format invalid | Invalid email or URL format |

---

## Frontend Integration

### JavaScript/TypeScript Example

```javascript
async function createBot(botData) {
  try {
    const response = await fetch('/api/bots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(botData)
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors
      if (data.error === 'Validation failed') {
        console.error('Validation errors:');
        data.details.forEach(error => {
          console.error(`  - ${error.field}: ${error.message}`);
        });
        return { success: false, errors: data.details };
      }
      throw new Error(data.message);
    }

    return { success: true, bot: data.bot };
  } catch (error) {
    console.error('Error creating bot:', error);
    return { success: false, error: error.message };
  }
}

// Usage
const result = await createBot({
  role: 'miner',
  name: 'MyBot',
  personality: {
    curiosity: 0.8,
    patience: 0.7
  }
});

if (result.success) {
  console.log('Bot created:', result.bot);
} else {
  console.error('Failed to create bot:', result.errors);
}
```

### React Hook Example

```javascript
import { useState } from 'react';

function useCreateBot() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState(null);

  const createBot = async (botData) => {
    setLoading(true);
    setErrors(null);

    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(botData)
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Validation failed') {
          setErrors(data.details);
          return null;
        }
        throw new Error(data.message);
      }

      return data.bot;
    } catch (error) {
      setErrors([{ field: 'general', message: error.message }]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createBot, loading, errors };
}

// Component usage
function CreateBotForm() {
  const { createBot, loading, errors } = useCreateBot();

  const handleSubmit = async (formData) => {
    const bot = await createBot(formData);
    if (bot) {
      console.log('Bot created successfully!', bot);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {errors && (
        <div className="errors">
          {errors.map((error, idx) => (
            <div key={idx} className="error">
              <strong>{error.field}:</strong> {error.message}
            </div>
          ))}
        </div>
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Bot'}
      </button>
    </form>
  );
}
```

---

**Last Updated:** 2025-11-18
