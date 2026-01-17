---
name: short-drama-motion
description: |
  Adds detailed motion descriptions to static images, including camera movement, dynamic content, and transitions, generating comprehensive image-to-video prompts suitable for AI video generation tools (Runway, Pika, Sora). Includes complete narrative descriptions.
  
  When this skill is activated, it will:
  1. Read shots/EP-XX.shots.md (for camera movement and action descriptions)
  2. Read prompts/EP-XX.t2i.md (for visual descriptions)
  3. Generate complete motion descriptions for each shot, including:
     - Core story and emotion
     - Protagonist detailed appearance (features, costume, expressions)
     - Scene atmosphere (environment, lighting, color tone, mood)
     - Complete story content narration
     - Professional camera movement descriptions
     - Audio elements (narration/dialogue, background music, sound effects)
     - Physical motion plausibility
  
  Output format - Image-to-Video Prompt List:
  | 镜号 | 基础画面描述 | 动态指令（完整版） | 故事内容 | 主角形象 | 场景氛围 | 运镜设计 | 旁白台词 | 背景音乐 | 参数设置 |

parameters:
  - name: episode_number
    type: string
    description: Episode number to process (e.g., "EP-01")
    required: true
