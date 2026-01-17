---
name: short-drama-visualizer
description: |
  Transforms shot lists into detailed, straightforward text-to-image prompts, directly describing scenes, characters, environments, and atmosphere without protocol replacement, ensuring prompts can be directly used for AI drawing generation. Features intelligent keyframe judgment capability.
  
  When this skill is activated, it will:
  1. Read EP-XX.shots.md
  2. Analyze each shot to determine if keyframes (start/end frames) are needed
     - Must generate keyframes: camera movement includes push/pull/pan/tracking/dolly, shot duration over 5 seconds, significant character movements, obvious scene changes, special effects changes
     - Can generate single frame: fixed shot, minor character movements, short duration, static display shots
  3. Generate corresponding detailed descriptions
     - For keyframe shots: generate two corresponding text-to-image prompts (start frame and end frame)
     - For single frame shots: generate one prompt
  4. Ensure style consistency for characters, costumes, and environments within the same scene
  5. Output in straightforward narrative format: "主体在什么环境中做什么，周围的景物是什么样的，氛围是如何的"

  Output format - Text-to-Image Prompt List (Intelligent Keyframe Version):
  | 镜号 | 帧类型 | 画面详细描述 (Prompt) | 负面提示 (Negative Prompt) | 参数设置 | 是否需要首尾帧 | 判断理由 |

parameters:
  - name: episode_number
    type: string
    description: Episode number to process (e.g., "EP-01")
    required: true
