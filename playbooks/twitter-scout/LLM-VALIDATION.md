# LLM Validation for twitter-scout Skill

**Method:** Based on Minko Gechev's skills-best-practices validation approach.

Run these 4 validation steps to ensure the skill works correctly.

---

## STEP 1: Discovery Validation

**Goal:** Test if agents correctly understand when to load this skill.

**Prompt to LLM:**

> I am building an Agent Skill based on the agentskills.io spec. Agents will decide whether to load this skill based entirely on the YAML metadata below.
>
> ```
> name: twitter-scout
> description: |
>   Finds relevant Twitter engagement opportunities for @mttrly using bird CLI.
>   Two modes: fire-patrol (real-time pain points: server down, aws bills, crashes) 
>   or brand-building (trends: vibe coding, indie hackers, philosophy).
>   Generates Hook First replies with strict engagement thresholds.
>   Use when the user wants to discover tweets for @mttrly engagement, 
>   run scheduled scans (morning/evening), or generate qualified reply candidates.
>   Don't use for: manual tweet posting (approval only), analytics (use x-smart-read),
>   or general Twitter search (not optimized for discovery).
> ```
>
> Based strictly on this description:
> 1. Generate 3 realistic user prompts that you are 100% confident should trigger this skill.
> 2. Generate 3 user prompts that sound similar but should NOT trigger this skill (e.g., general Twitter search, analytics, auto-posting).
> 3. Critique the description: Is it clear? Suggest optimized rewrite if needed.

**Expected output:**
- ✅ Fire-patrol requests trigger the skill
- ✅ Brand-building/trend requests trigger the skill
- ✅ General Twitter search, analytics, auto-posting do NOT trigger
- ✅ Description is clear and specific

---

## STEP 2: Logic Validation

**Goal:** Ensure step-by-step instructions are deterministic (no hallucinating missing steps).

**Prompt to LLM:**

> Here is the full SKILL.md and directory structure for my twitter-scout skill:
>
> [Paste the FULL contents of SKILL.md here]
>
> Directory structure:
> ```
> twitter-scout/
> ├── SKILL.md
> ├── scripts/
> │   ├── scout-fire-patrol.sh
> │   └── scout-brand-building.sh
> ├── references/
> │   ├── FIRE-PATROL.md
> │   ├── BRAND-BUILDING.md
> │   ├── QUERIES.md
> │   ├── REPLY-TEMPLATES.md
> │   └── EXCLUSION-PATTERNS.md
> └── assets/
>     ├── output-format.md
> ```
>
> Scenario: User requests "Run fire patrol scan and generate reply candidates for pain-point tweets."
>
> Act as an autonomous agent that just triggered this skill. Simulate your execution step-by-step:
> 1. What exactly are you doing at this step?
> 2. Which specific file/script are you reading or executing?
> 3. Flag any Execution Blockers: Where are you forced to guess/hallucinate because instructions are ambiguous?
>
> Write your internal monologue for each step. Don't fix issues yet, just identify them.

**Expected output:**
- ✅ Agent correctly reads SKILL.md first
- ✅ Agent loads references/FIRE-PATROL.md when needed
- ✅ Agent executes scripts/scout-fire-patrol.sh
- ✅ Agent can identify output format and next steps
- ⚠️ Agent flags any ambiguities (we'll fix in Step 4)

---

## STEP 3: Edge Case Testing

**Goal:** Force the LLM to hunt for vulnerabilities and failure modes.

**Prompt to LLM:**

> Now switch roles. Act as a ruthless QA tester. Your goal is to break this skill.
>
> Ask 5-7 highly specific, challenging edge case questions about the twitter-scout skill. Focus on:
> - What happens if bird CLI fails or returns 429 rate-limit error?
> - What if the user's auth token in ~/.env.bird is expired?
> - What if a query returns 0 results?
> - How do you handle tweets older than 72h in brand-building mode?
> - What if engagement scoring produces identical scores (ties)?
> - Are there assumptions about follower counts being available?
> - How do you handle author names with unicode/emojis?
>
> Do NOT fix these issues. Just ask me the numbered questions and wait for answers.

**Expected output:**
- ✅ Questions identify real edge cases
- ✅ Questions reveal gaps in error handling
- ✅ Questions surface assumptions about data structure

---

## STEP 4: Architecture Refinement

**Goal:** Fix identified issues and optimize context window (progressive disclosure).

**Prompt to LLM:**

> Based on my answers to your edge-case questions and any execution blockers you identified in Step 2:
>
> Rewrite the SKILL.md file with these rules:
> 1. Keep it strictly < 500 lines as a navigation guide + high-level procedures (third-person imperative)
> 2. If there are error-handling rules, dense query lists, or complex filtering logic, move them to references/
> 3. Add an "Error Handling & Edge Cases" section at the bottom incorporating my answers
> 4. Add explicit instructions for when to read each reference file (JiT loading)
> 5. Suggest what should go in references/ERROR-HANDLING.md (new file)
>
> Output the rewritten SKILL.md and tell me what new/updated reference files to create.

**Expected output:**
- ✅ SKILL.md is still < 500 lines
- ✅ Error handling is explicit
- ✅ JiT loading is clear ("When X happens, read Y file")
- ✅ New reference files are identified

---

## Running the Validation

**Command:**
```bash
# Copy this entire validation prompt into Claude or your LLM of choice
# Run through all 4 steps in order
# Document any issues found
# Update SKILL.md and references based on feedback

# Then commit:
git add playbooks/twitter-scout/
git commit -m "refactor: LLM-validated twitter-scout skill (minko pattern)"
```

---

## Success Criteria

After all 4 validation steps:

- ✅ **Discovery:** Skill triggers on correct prompts, not false positives
- ✅ **Logic:** Agent can execute without guessing/hallucinating
- ✅ **Edge Cases:** All identified issues have explicit handling
- ✅ **Architecture:** SKILL.md is clean JiT-loading hub, not a wall of text

---

**Validation Date:** 2026-02-27  
**Based on:** Minko Gechev's skills-best-practices (https://github.com/mgechev/skills-best-practices)  
**Next:** Review LLM feedback + iterate on SKILL.md
