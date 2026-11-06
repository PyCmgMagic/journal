# 2026-11-06 人物动作与环境呼应

本次针对人物整张图片平移、环境缺少联系的问题，替换了旧人物渲染。不是增加一组未接入的展示组件。

## 已接入

- `Traveler.tsx`：七块插画组成关节层级，头、身体、双臂、双腿、围巾分别运动。腿与手臂的 shader 在膝／肘位置做局部弯折；围巾从颈部固定点向末端递增摆幅。
- 旅行者沿观测站前方行走，路径在地面上。移动距离推动步态相位，速度控制步幅，停下后收步；反向滚动会沿路返回。单次快速滚动后，人物以速度上限追上目标位置。
- 待机有微弱呼吸和观察动作；指针与路灯探索影响头部方向。蓄力时抬起右臂、身体略前倾，取消时放下，唤醒后微微抬头。脚底有固定地面接触阴影。
- `runtime.wind` 由渲染循环计算，围巾、草丛、红色植物和树冠共享风速、各自保留空间相位。唤醒期间风增强后回落。云层有缓慢漂移。
- 路灯悬停亮度阻尼变化，`LampMotes.tsx` 的九个光点在当前探索的路灯附近聚集；离开时衰减。
- 阅读期间行走停止，背景按需渲染；减少动态模式冻结身体、围巾、环境和光点。沿用原有面板、历史和取消逻辑。

## 素材

`public/images/layers/traveler-rig.png`，1254×1254 真透明 PNG；网站加载 WebP，约 242 KB。原图为 `observatory-atlas.png`，由内置 image_gen 编辑并补齐被遮挡的肢体。输出源：`C:/Users/ASUS/.codex/generated_images/01a19bfd-6376-70e0-8fc7-6fdc7ec31d15/exec-d650c04b-7652-4534-86a9-0f3422c90b5b.png`。

完整提示词：

Production animation CUTOUT RIG sprite atlas for ONLY the traveler in the bottom right of the reference. Preserve his exact adult proportions, cream expedition jacket and long cream trousers, brown boots and small tan backpack, dark short hair, red scarf, finely inked pastel Moebius illustration. BACK THREE-QUARTER VIEW FACING RIGHT, matching source. Square canvas, EXACT regular 3 by 3 grid of equal cells, invisible grid, each part isolated within its own cell with transparent padding, no overlap. All background genuine alpha. Row1 col1: HEAD with short dark hair, small visible right ear/cheek and short bare neck, no scarf/body. Row1 col2: TORSO with jacket and backpack attached, neck opening at top and jacket hem at bottom, NO head, NO arms, NO legs, NO scarf. Row1 col3: a LONG RED SCARF TAIL extending LEFT from a small neck knot on its RIGHT, thin flowing horizontal cloth with inked folds, no neck/person. Row2 col1: LEFT ARM, entire cream sleeve from rounded shoulder at top to relaxed bare hand at bottom, hanging straight vertically, rear view. Row2 col2: RIGHT ARM, entire cream sleeve from rounded shoulder at top to open bare palm at bottom, hanging straight vertically, rear/right view, slightly bent natural elbow but overall straight downward. Row2 col3: EMPTY transparent. Row3 col1: LEFT LEG from rounded hip at top to complete brown boot at bottom, cream trouser straight vertical, boot points right, rear three-quarter view. Row3 col2: RIGHT LEG, matched size/style, hip at top and boot at bottom, vertical relaxed stance, boot points right. Row3 col3: EMPTY transparent. Arms and legs have generous hidden overlap at top joints, painted complete even where original body overlapped. DO NOT draw assembled figures, outlines of grid, labels, text, UI, shadows, ground, sky, monolith, building, extras. Head, torso, scarf, two arms and two legs ONLY, exactly seven distinct pieces with ample clear gaps. Consistent fine ink outlines and fabric folds across all pieces, ready to assemble and articulate in code.

## 验证和边界

`scripts/verify-life.mjs` 记录实际交互录像并检查待机、迈步、停止、反向、长按取消、阅读冻结、减少动态。证据在 `output/playwright/life/`。原有完整导航、触摸、降级验证仍由 `scripts/verify-browser.mjs` 执行。

人物为二维分层关节动画，肢体具有局部变形；没有完整三维皮肤、全方向转身或面部表情。反向移动使用倒退步态。快速跳到观测站时人物需要约数秒沿地面追上，不会瞬移。阴影是绘制的接触阴影，不是物理实时光照。
