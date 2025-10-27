# Build Cost Estimator - Manual Installation Guide

## Quick Reference

All code is in: `cost-estimator-code.js`

## Installation Steps

### Step 1: Add ITEM_VALUES, LABOR_RATES, and COST_ESTIMATOR constants

**Location:** After `BUILDING_VALIDATOR` closes (around line 2818)

**Look for:**
```javascript
  }
};

/**
 * Look up a terrain profile by name or normalized name
```

**Insert BETWEEN the `};` and the `/**` comment:**
- Copy everything from PART 1 in `cost-estimator-code.js`
- This includes:
  - `ITEM_VALUES` constant (180+ items)
  - `LABOR_RATES` constant
  - `COST_ESTIMATOR` object with all methods

---

### Step 2: Add cost calculation in planBuildTask

**Location:** In `planBuildTask` function, after validation (around line 4127)

**Look for:**
```javascript
  // Validate build plan comprehensively
  const validation = BUILDING_VALIDATOR.validateBuildPlan(
    {
      dimensions,
      materials: materialRequirements,
      // ...
    }
  );

  const notes = [];
```

**Insert BETWEEN the validation closing `);` and `const notes = [];`:**
- Copy PART 2 from `cost-estimator-code.js`
- This calculates: `costEstimate`, `budget`, `budgetComparison`, `costOptimizations`

---

### Step 3: Add cost notes

**Location:** In the notes section, after validation notes (around line 4305)

**Look for:**
```javascript
      if (worldVal && worldVal.clearanceAbove !== undefined && worldVal.clearanceBelow !== undefined) {
        notes.push(`Height clearance: ${worldVal.clearanceBelow} blocks below, ${worldVal.clearanceAbove} blocks above.`);
      }
    }
  }

  return createPlan({
```

**Insert BETWEEN the validation `}` and `return createPlan({`:**
- Copy PART 3 from `cost-estimator-code.js`
- This adds all cost-related notes to the plan

---

### Step 4: Update return statement

**Location:** In the `return createPlan({` section (around line 4380)

**Look for:**
```javascript
    // Add validation metadata
    validation
  });
}
```

**Change TO:**
```javascript
    // Add validation metadata
    validation,
    // Add cost estimation metadata
    costEstimate,
    budgetComparison,
    costOptimizations
  });
}
```

---

## Verification

After installation, run:
```bash
node --check tasks/plan_build.js
```

Should show: ✅ No errors

---

## What This Adds

- **180+ item values** in emeralds
- **Labor cost calculator** with skill/environment/difficulty multipliers
- **Tool depreciation** tracking
- **Budget comparison** and warnings
- **Cost optimization** suggestions
- **10% contingency** buffer

---

## Example Output

```
✓ Estimated total cost: 6.60 emeralds
✓ Cost breakdown: materials: 4.40, labor: 1.50, tools: 0.10 emeralds
✓ Labor: 0.30 hours @ 5.00 emeralds/hour
✓ Within budget: 80.0% of 10 emerald budget (2.00 remaining)
```
