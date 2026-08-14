# A/B Testing & Growth Experimentation Playbook

A structured growth experimentation backlog for the **skills.sh Extractor Landing Page**, applying ICE prioritization, statistical rigor, and metric guardrails.

---

## 🧪 Active Experiment: EXP-001 — Hero Value Proposition Angle

### Hypothesis
```
Because developers and AI engineers encounter two distinct friction points:
(1) Technical friction: fragile CLI installations, privacy fears, and latency, VS
(2) Context economics: wasted context window tokens and format fragmentation,

we believe testing Variant B (Context Reduction & Multi-Agent Standard) against Variant A (Pure WebAssembly Engine & Zero-Install Privacy)
will increase Primary CTA Click-Through Rate ("Launch WASM Studio Free") by +18%+.

We'll know this is true when the CTA click-to-session conversion rate reaches statistical significance (p < 0.05, 95% CI).
```

### Variants

#### Variant A (Control - Speed & Engine Focus)
- **Tagline**: `⚡ Pure Client-Side WebAssembly Architecture`
- **Headline**: `The WebAssembly Compiler for AI Coding Agents`
- **Subheadline**: `Compile, consolidate, and export skills.sh & GitHub repositories into zero-bloat playbooks for Claude Code, Cursor, Windsurf, and Antigravity. Zero server backend, 100% private, sub-millisecond execution.`
- **Primary CTA**: `Launch WASM Studio Free`
- **Secondary CTA**: `Explore Interactive Demo`

#### Variant B (Treatment - Context ROI & Multi-Agent Consolidation Focus)
- **Tagline**: `🚀 Cut Agent Context Bloat by 78%`
- **Headline**: `Turn Scattered Repos into 1-Click AI Agent Superpowers`
- **Subheadline**: `Stop wasting 10,000+ context tokens on bloated helper scripts. Ingest any NPX skill or GitHub repo and compile deterministic playbooks for Claude, Cursor, Windsurf, and Antigravity instantly in your browser.`
- **Primary CTA**: `Compile Your First Skill Free`
- **Secondary CTA**: `Calculate Token Savings`

---

## 📊 Experiment Metrics & Guardrails

| Metric Layer | Metric Name | Measurement Trigger | Target Lift |
|--------------|-------------|---------------------|:-----------:|
| **Primary Metric** | `primary_cta_ctr` | Click on Hero Primary CTA / Hero Impressions | +15% - +25% |
| **Secondary Metric 1** | `simulator_interaction_rate` | Clicks on Playbook Simulator Skill/Format buttons | +20% |
| **Secondary Metric 2** | `token_calculator_engagement` | Sliders adjusted in ROI Calculator | +15% |
| **Secondary Metric 3** | `referral_link_generation` | Clicks on "Copy Referral Link" / Share buttons | +10% |
| **Guardrail Metric 1** | `page_bounce_rate` | Sessions with < 5s dwell time | Must not exceed 35% |
| **Guardrail Metric 2** | `time_to_interactive` | Time until WASM & Simulator load | Must remain < 500ms |

---

## 🎯 ICE Score Backlog

| ID | Experiment Name | Impact (1-10) | Confidence (1-10) | Ease (1-10) | ICE Score | Status |
|:---|:----------------|:-------------:|:-----------------:|:-----------:|:---------:|:------:|
| **EXP-001** | Hero Value Prop (WASM Speed vs. Context ROI) | 9 | 8 | 9 | **8.67** | 🟢 Running |
| **EXP-002** | Interactive Simulator Placement (Above vs. Below Fold) | 8 | 8 | 8 | **8.00** | 🟡 Queued |
| **EXP-003** | Social Proof Badging (GitHub Stars vs. Token Metric Callout) | 7 | 7 | 9 | **7.67** | 🟡 Queued |
| **EXP-004** | Referral Incentive Gamification (Tiered Perks vs. Direct Share) | 8 | 6 | 8 | **7.33** | 🟡 Queued |
| **EXP-005** | Direct Drag-and-Drop Dropzone in Landing Hero | 9 | 6 | 6 | **7.00** | 🟡 Backlog |

---

## 🔬 Sample Size & Duration Calculation

- **Baseline Conversion Rate**: 8.5%
- **Minimum Detectable Effect (MDE)**: 20% relative lift (8.5% -> 10.2%)
- **Significance Level ($\alpha$)**: 0.05 (95% Confidence)
- **Statistical Power ($1 - \beta$)**: 0.80 (80%)
- **Required Sample Size**: ~6,800 visitors per variant (~13,600 total visitors).
- **Test Duration**: Estimated 2 to 3 weeks at standard organic + developer community traffic volume.
