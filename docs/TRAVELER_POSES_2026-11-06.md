# 人物完整姿态修正 · 2026-11-06

本次修正替代 LIVING_WORLD_2026-11-06.md 中的七片关节人物；旧文件与原素材保留作为历史记录。

## 问题与处理

旧版将头、手臂、躯干和双腿分别旋转，肘膝形变和身体朝向不协调；人物距离被滚轮反复拖动。自动化能验证数值变化，却不能证明动作自然。

当前 Traveler 用一个网格显示完整人物姿态：8 个行走帧，以及站立到抬手的 4 个姿态。每帧在资产构建时对齐躯干中心和鞋底基线，人物肢体不再拆开旋转。帧序按实际位移推进，短暂的帧间混合避免突然换姿势；站立时脚底不动，只有上身极轻微呼吸和围巾尾部形变。

第一次靠近观测站时，人物完成约 2.65 秒的短途行走并站稳。反向滚动只移动镜头，不重放倒走；阅读期间暂停行程，返回后继续。蓄力驱动抬手，松手驱动放下；唤醒开始后保留抬手直到灯光传播，再放下。减少动态效果时保留完整静止姿态，不强制复位人物位置。

长按触点移到手掌高度，在石碑下部补了一条细线接入原有纹路，让手、触点、粒子吸引和向上发光有共同起点。既有镜头路径、文章阅读、导航和历史逻辑沿用。

## 资产

使用内置 image_gen 两次生成，未使用外部 API。源文件为：

- public/images/layers/traveler-poses-v2.png：12 姿态初稿，采用底行 4 个站立/抬手姿态。
- public/images/layers/traveler-walk-v2.png：修订后的 8 帧行走图集。
- public/images/layers/traveler-animation.png / .webp：当前生产图集，4×3 格，每格 384×448，鞋底基线 y=420，躯干中心 x=224。
- public/images/layers/traveler-animation.json：各帧裁切与对齐信息。
- scripts/prepare-traveler.mjs：可重跑的图集打包脚本；保留透明通道，只裁切、等比缩放和对齐，没有重新绘制人物。

源图 1：C:/Users/ASUS/.codex/generated_images/01a19bfd-6376-70e0-8fc7-6fdc7ec31d15/exec-610da431-a99d-48b9-bf5c-cf65aa57b41a.png

源图 2：C:/Users/ASUS/.codex/generated_images/01a19bfd-6376-70e0-8fc7-6fdc7ec31d15/exec-5fb5e23b-720b-4411-b345-7eeb0fc619ff.png

## 验证范围

- 首屏站姿、行走中间姿势、站稳、抬手和唤醒画面：在真实 Edge 中截图，并复查关节是否断开、脚底是否悬空、手与石碑触点是否对应。
- 动作逻辑：推进多个完整姿态、完成短途后停步、反向滚动保留人物位置、蓄力中断与重新长按、阅读暂停、减少动态冻结。
- 既有流程：桌面/手机分类、文章、关闭、浏览器前进后退，搜索、归档、关于、WebGL 和无 JS 降级。
- 异常路径：行走中快速反向滚动；取消蓄力后立即重试；行走中切换减少动态偏好；行走半途打开文章并返回。后三种额外检查的数值证据在 output/playwright/poses/interruption-checks.json。

运行证据在 output/playwright/poses/。初始、行走、站立、蓄力、唤醒、阅读与返回截图和 traveler-poses-actual.webm 都来自浏览器，生图不作为验收截图。

## 当前边界

这是有限姿态的插画逐帧动画，仍有逐帧节奏，不是三维骨骼角色；没有完整转身、自由寻路或面部表演。反向滚动保留人物位置是有意设计。人物初始为站立，与分镜中的初始坐姿仍不同。地形和植物素材、整体构图与分镜仍有差距，本轮没有宣称完整复刻。手机为浏览器模拟，未做实体设备与 Safari 性能测试。

## 初稿完整提示词

Use case: illustration-story.
Asset type: production transparent animation sprite sheet for an illustrated interactive alien observatory, NOT a concept illustration.
Image 1 is the style and character identity reference: use ONLY the small full-body traveler at lower right, preserving dark tousled hair, red-orange long scarf streaming left, cream jacket and trousers, tan small backpack, brown ankle boots, fine dark pen outlines and softly textured pale watercolor. Do NOT include architecture.
Create exactly TWELVE complete full-body drawings of this SAME character on a clean genuinely transparent RGBA background, arranged in a precise 4-column by 3-row equal-cell grid. Each figure stays entirely inside its cell. No grid lines, text, numbers, ground, shadow, glow, props or scenery.
Character faces screen-right in the same rear three-quarter view in every frame. Anatomically coherent adult proportions, relaxed knees, never rigid stick limbs. SAME body size, head size, clothing details, ink weight, camera angle. Head top at 10% of each cell, ground-contact boot sole at 92% of each cell. Pelvis centered horizontally in each cell, with ample room for the scarf to the left and hand to the right. This is a coherent frame-by-frame animated sequence, not twelve different designs.
Top two rows, read left to right, are 8 successive evenly spaced frames of ONE relaxed human walk cycle IN PLACE to the right: 1 left foot forward contact/right foot back, 2 weight goes onto left foot, 3 right foot passes planted left leg, 4 right foot swings ahead, 5 right foot forward contact/left foot back, 6 weight goes onto right foot, 7 left foot passes planted right leg, 8 left foot swings ahead. Natural modest step length, bent knees in passing poses, opposite arm swing, body rises only slightly. Scarf remains softly curved behind. Both feet must not lift at once. Frame8 loops naturally to frame1.
Bottom row, four coherent sequential poses with both feet planted at identical positions: 9 restful standing arms down, 10 right elbow bends and right hand starts to lift in front of chest, 11 right hand reaches forward and slightly up toward an imagined stone surface at head height, 12 right palm extended forward gently touching that imagined surface, left arm relaxed. Do not draw the stone.
These are whole finished drawings to replace a broken segmented puppet: never dismember the character. Enforce exact 4x3 layout, consistent scale, transparent space between cells and no cropping.

## 行走修订完整提示词

Use case: illustration-story. Production animation sprite sheet.
Reference image is character/style identity only. Draw ONE coherent relaxed walk cycle of that same adult explorer, cream clothing, brown boots, small tan backpack, dark hair, red scarf, fine pen outlines, pale textured watercolor. Transparent background.
Output exactly EIGHT full-body sprites in an exact 4-column by 2-row grid. No text, grid, ground or shadows. Each cell identical size, figure hip centered, boot contact baseline at 94%, head top at 8%. Entire figure including scarf inside its cell.
IMPORTANT fix the walk anatomy: reference sprites are NOT a good walk. We need clearly alternating feet and opposite arm swing. View is predominantly SIDE PROFILE FACING SCREEN RIGHT, with a slight rear three-quarter to see the backpack. Hands stay BELOW waist in every frame, loose and relaxed. No reaching or waving. Same scale and torso silhouette, no camera or costume changes.
Read left to right:
1: CONTACT A. NEAR LEG forward, boot at right, knee nearly straight. FAR LEG behind, toe at left touching ground.
2: DOWN A. NEAR LEG supports body, near knee mildly flexed, near boot at mid-right planted. FAR LEG trails behind and starts lifting.
3: PASS A. NEAR LEG planted vertically under pelvis. FAR LEG knee bent and passing forward in front of near knee, far foot in air.
4: UP A. NEAR LEG now trails left with heel raised. FAR LEG reaching right, about to land.
5: CONTACT B. FAR LEG forward at right, nearly straight. NEAR LEG trails behind left, heel raised. Show this as the OPPOSITE of frame1, not same foot.
6: DOWN B. FAR LEG supports body mid-right and knee softly flexed. NEAR LEG lifts from behind.
7: PASS B. FAR LEG planted vertically under pelvis. NEAR LEG bent knee passes forward, near boot in air.
8: UP B. FAR LEG trailing left heel raised. NEAR LEG reaching forward right ready to land. Loops into frame1.
Stride modest not a march, no hopping, head moves only a few pixels vertically. Maintain natural anatomy: one complete coherent person per frame. Scarf trailing left with minimal shape changes. No disjoint body pieces. Both feet never simultaneously in air.

