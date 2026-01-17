---
name: short-drama-recorder
description: |
  Automatically extracts key information from outline.md, character.md, episode_index.md, and EP-XX.md and updates script.progress.md. Maintains episode progress, foreshadowing tracking, creative decisions, and calculates real-time progress percentage.
  
  When this skill is activated, it will:
  1. File check and initialization - Check if script.progress.md exists, initialize with template if not
  2. Read document contents - Read relevant documents based on data type
  3. Script semantic extraction - Extract key information from read documents
  4. Episode merge processing - Locate specific episode, update its status, content, and progress
  5. Global information update - Creative decisions, creation rules, inspiration notes, pending items, foreshadowing master table
  6. Generate/update complete script.progress.md

  Output: Complete script.progress.md content

  Self-check requirements:
  1) Complete and concentrated episode information
  2) Unified timestamp format (YYYY-MM-DD HH:MM)
  3) Foreshadowing tracking dual recording (per episode + master table)
  4) Character changes recorded as needed
  5) No duplicates or omissions
  6) Format compliant, markdown tables aligned, correct heading levels, no garbled text
  7) No redundant information

parameters:
  - name: operation
    type: string
    description: Operation type (full_record or incremental_update)
    required: false
  - name: episode_number
    type: string
    description: Episode number if recording specific episode (e.g., "EP-01")
    required: false
