# Next Steps: Run LLM Validation

**Status:** twitter-scout skill has been restructured per Minko Gechev pattern ✅

**What was done:**
- ✅ SKILL.md created (< 500 lines, navigation-focused)
- ✅ references/ created (detailed guides loaded on-demand)
- ✅ scripts/ created (deterministic bash CLIs)
- ✅ assets/ created (templates and output formats)
- ✅ LLM-VALIDATION.md written (4-step validation process)

**What needs to be done:**

## Run LLM Validation (4 Steps)

Open `LLM-VALIDATION.md` and:

1. **Discovery Validation** (10 min)
   - Paste YAML + prompt into Claude
   - Get feedback on description clarity
   - Check false-positive/false-negative triggers

2. **Logic Validation** (15 min)
   - Paste SKILL.md + directory tree
   - LLM simulates execution
   - Identifies ambiguities in instructions

3. **Edge Case Testing** (10 min)
   - LLM asks hard questions (bird failures, auth, rate limits, etc.)
   - You answer each question
   - Document answers

4. **Architecture Refinement** (10 min)
   - LLM rewrites SKILL.md based on edge cases
   - Suggests new reference files (e.g., ERROR-HANDLING.md)
   - You apply changes

**Total time:** ~45 minutes

---

## After Validation

1. Update SKILL.md with LLM feedback
2. Create any new reference files suggested (e.g., references/ERROR-HANDLING.md)
3. Test scripts/scout-fire-patrol.sh and scripts/scout-brand-building.sh
4. Commit:
   ```bash
   git commit -m "refactor: LLM-validated twitter-scout skill (minko pattern) - discovery/logic/edge-cases validated"
   ```

---

## Why This Matters

**Before:** SCOUT-FIRE-PATROL.md and SCOUT-BRAND-BUILDING.md were 6-7KB each, all details mixed together

**After:** 
- SKILL.md (navigation only)
- references/ (details loaded on-demand)
- scripts/ (executable, deterministic)
- assets/ (templates)

**Benefit:** Agent loads only what it needs, context window stays lean, no hallucinating missing steps.

---

## Files Structure (Final)

```
playbooks/twitter-scout/
├── SKILL.md                         (< 500 lines, brain)
├── LLM-VALIDATION.md                (instructions for validation)
├── VALIDATION-NEXT-STEPS.md         (this file)
├── scripts/
│   ├── scout-fire-patrol.sh         (deterministic CLI)
│   └── scout-brand-building.sh      (deterministic CLI)
├── references/
│   ├── FIRE-PATROL.md               (detailed guide, loaded on-demand)
│   ├── BRAND-BUILDING.md            (detailed guide, loaded on-demand)
│   ├── QUERIES.md                   (all search terms)
│   ├── REPLY-TEMPLATES.md           (Hook First formula + examples)
│   ├── EXCLUSION-PATTERNS.md        (spam/bot filters)
│   └── ERROR-HANDLING.md            (TODO: after validation)
└── assets/
    ├── output-format.md             (JSON structure, markdown format)
```

---

**Previous version backup:** `/home/openclaw/.openclaw/workspace/backups/twitter-scout-v1-20260227-035929/`

Ready when you are! 🚀
