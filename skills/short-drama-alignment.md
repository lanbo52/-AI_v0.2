---
name: short-drama-alignment
description: |
  Performs systematic quality checks on short drama scripts, ensuring consistency across type, structure, character, pacing, and foreshadowing management.
  
  When this skill is activated, it will:
  1. Prepare by gathering all relevant script files (outline, character, episode index, and specific episode scripts)
  2. Read reference documents to extract key settings (protagonist profile, worldbuilding, emotional tone, core conflicts, commercial goals)
  3. Execute staged checks:
     - Outline check: genre clarity, episode count, conflict intensity, structure completeness, basic logic
     - Character check: protagonist memorability, character tags, relationship network, alignment with outline
     - Episode index check: attraction point distribution, paywall point (episode 20), talking points, alignment with overall outline
     - Episode check: consistency with episode index, character behavior, scene count, dialogue density, conflict/reversal, foreshadowing handling, special episode requirements, plot logic
  4. Output PASS or FAIL with specific feedback

  Output format:
  - PASS: "✅ **检查状态：PASS**"
  - FAIL: "❌ **检查状态：FAIL**\n需要修改以下问题：\n**问题1**：\n- 位置：<具体问题描述>\n- 原因：<违反了什么规则>\n- 修改方向：<具体怎么改>"

parameters:
  - name: check_type
    type: string
    description: Type of check to perform (outline, character, episode_index, episode)
    required: false
  - name: episode_number
    type: string
    description: Episode number if checking a specific episode (e.g., "EP-01")
    required: false
