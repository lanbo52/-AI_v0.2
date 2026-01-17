---
name: short-drama-director
description: |
  Transforms literary scripts into concrete shooting plans through scene breakdown and shot design.
  
  When this skill is activated, it will:
  1. Scene Breakdown:
     - Read episodes/EP-XX.md script content
     - Split the episode into independent scenes based on time and location changes
     - Define each scene with: scene number, interior/exterior, time, location, characters, scene summary
     - Output to scenes/EP-XX.scenes.md
  2. Shot Design:
     - Read scenes/EP-XX.scenes.md scene details
     - Break down each scene into specific shots
     - Design each shot with: shot size, angle, camera movement, visual content, expected duration
     - Ensure shot editing rhythm matches short drama's "fast-paced, strong conflict" style
     - Output to shots/EP-XX.shots.md

  Scene table format:
  | 场号 | 景别 | 时间 | 地点 | 人物 | 剧情摘要 |

  Shot table format:
  | 镜号 | 景别 (Size) | 角度 (Angle) | 运镜 (Move) | 画面内容 (Content) | 对白/音效 (Audio) | 时长 (Sec) |

parameters:
  - name: operation
    type: string
    description: Operation to perform (scene_breakdown or shot_design)
    required: true
  - name: episode_number
    type: string
    description: Episode number to process (e.g., "EP-01")
    required: true
