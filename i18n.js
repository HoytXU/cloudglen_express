const htmlEntries = [];
const textEntries = [];
const attributeEntries = [];

function registerHTML(selector, zh) {
  const element = document.querySelector(selector);
  if (!element) {
    console.warn(`Missing translation target: ${selector}`);
    return;
  }
  htmlEntries.push({ element, en: element.innerHTML, zh });
}

function registerParagraphs(titleId, translations) {
  const section = document.querySelector(`section[aria-labelledby="${titleId}"]`);
  if (!section) return;
  const paragraphs = [...section.children].filter((element) => element.tagName === "P");
  for (const [index, zh] of Object.entries(translations)) {
    const element = paragraphs[Number(index)];
    if (!element) {
      console.warn(`Missing paragraph ${index} in ${titleId}`);
      continue;
    }
    htmlEntries.push({ element, en: element.innerHTML, zh });
  }
}

function registerExactText(selector, translations) {
  for (const element of document.querySelectorAll(selector)) {
    const key = element.textContent.trim();
    if (translations[key]) textEntries.push({ element, en: element.innerHTML, zh: translations[key] });
  }
}

function registerAttribute(selector, name, zh) {
  const element = document.querySelector(selector);
  if (!element) return;
  attributeEntries.push({ element, name, en: element.getAttribute(name), zh });
}

registerHTML(".subtitle", "由噪声、图层与遮罩构成的程序化景观");
registerHTML(".shader-hint", "按 <kbd>F</kbd> 进入全屏");
registerHTML(".source-line", "场景改编自 <a href=\"#ref-shadertoy\">[1]</a> · 配乐信息见 <a href=\"#ref-music\">[5]</a>");

registerHTML("#noise-title", "插值");
registerHTML("#cloud-title", "倍频层");
registerHTML("#depth-title", "视差");
registerHTML("#form-title", "遮罩");
registerHTML("#smoke-title", "烟雾");
registerHTML("#synthesis-title", "合成");
registerHTML("#references-title", "参考文献");
registerHTML("section[aria-labelledby=\"noise-title\"] > h3", "采用 Perlin 淡化函数的值噪声");

registerParagraphs("noise-title", {
  1: `令 <i>a</i> 与 <i>b</i> 为两个实数。令 <i>&tau;</i>（希腊字母 tau）为区间 [0,1] 内的参数，用来表示从 <i>a</i> 到 <i>b</i> 的进度。定义线性插值算子 <i><span class="func">L</span>(a,b;&tau;)=(1−&tau;)a+&tau;b</i>，于是插值结果可写为 <i>x(&tau;)=L(a,b;&tau;)</i>。因此，<i><span class="func">L</span>(a,b;0)=a</i>，<i><span class="func">L</span>(a,b;1)=b</i>；其余参数值对应线段 <i>ab</i> 上的点。GLSL 用 <code>mix</code> 实现算子 <span class="func">L</span>。`,
  2: `在二维情形中，<i>&tau;<sub>1</sub></i> 表示水平方向的进度，<i>&tau;<sub>2</sub></i> 表示竖直方向的进度。`,
  3: `着色器把图像平面划分成方形网格，并在每个网格顶点赋予一个随机标量。若用直线连接相邻数值，每个网格内部的斜率为常数，但经过下一个网格点时斜率通常会突然改变，因而出现可见的折角。淡化函数把这种匀速过渡改为起点和终点都平缓的过渡。`,
  4: `Perlin 的五次淡化函数<a class="ref-mark" href="#ref-perlin">[2]</a>保持两个端点不变：<i>S(0)=0</i>、<i>S(1)=1</i>。它在两个端点处的一阶和二阶导数也都为零。从几何上看，每个网格在公共边界处都具有零斜率和零曲率，因此相邻网格的函数值、斜率和曲率均连续衔接。`,
  5: `点 <span class="vec">p</span> 使用全局图像坐标。算子 <span class="operator">fract</span> 去掉坐标的整数部分，即网格编号，只保留该点在当前网格内部的位置：<span class="vec">&xi;</span>=<span class="operator">fract</span>(<span class="vec">p</span>)。`,
  6: `<i>v<sub>ij</sub></i> 的下标表示网格顶点：<i>i=0</i> 或 1 分别表示左侧或右侧，<i>j=0</i> 或 1 分别表示下侧或上侧。对两个局部坐标应用 <i>S</i>，得到 <span class="vec">w</span>=(<i>S(&xi;<sub>1</sub>),S(&xi;<sub>2</sub>)</i>)。它们是插值权重，并非另一个空间位置。下式中的 <i>b<sub>0</sub></i> 与 <i>b<sub>1</sub></i> 分别表示底边和顶边上的水平插值；再对二者作竖直插值，即得到最终值 <i>N(<span class="vec">p</span>)</i>。实际着色器从蓝噪声纹理中读取四个顶点样本<a class="ref-mark" href="#ref-blue-noise">[4]</a>；热力图使用相同纹理和同一个 <i>N</i> 函数。`,
  7: `下图对正方形区域 <i>[0,4]²</i> 进行采样。每个图像位置表示一点 <span class="vec">p</span>=(<i>x,y</i>)，灰度亮度表示标量值 <i>N(<span class="vec">p</span>)</i>：黑色为 0，白色为 1。细网格标出 16 个单位网格，标记点展示一次具体的函数求值。这里的灰度只是数值图例，并不是场景采用的云层颜色。`,
});

registerParagraphs("cloud-title", {
  1: `令 <span class="func">N</span><i>:ℝ²→[0,1]</i> 为第 1 节定义的值噪声场。只在单一尺度上求值时，场中只有较宽广的变化，缺少细小结构。继续加入 <span class="func">N</span> 的副本，并依次提高空间频率、降低振幅，便可加入更小尺度的特征。记三个尺度的归一化组合为 <span class="func">F</span><sub>3,0.7</sub>；下标分别表示尺度数量为 3、振幅倍率为 0.7。`,
  2: `先只考虑两个倍频层。第一层给出大尺度变化；第二层以两倍空间频率计算同一个函数，并以相对权重 <i>g</i> 加入。除以 <i>1+g</i> 可使结果保持在原来的数值范围内。`,
  5: `这是在通式中代入 <i>K=3</i>、<i>g=0.7</i> 后得到的结果。求和指标恰为 <i>k=0,1,2</i>：<i>0.7²=0.49</i>、<i>2²=4</i>，并且 <i>1+0.7+0.49=2.19</i>。因此，上面两种写法是同一个表达式，而不是两个不同的定义。`,
  6: `每一项称为一个倍频层（octave）。更一般地，<i>K</i> 是正整数，表示倍频层数量；<i>g</i> 是严格位于 0 与 1 之间的振幅增益。指标 <i>k</i> 从 0 数到 <i>K−1</i>，Σ 表示“对这些 <i>k</i> 所对应的项求和”。在程序化图形学中，这种归一化的倍频层之和通常称为分形布朗运动（fBm）<a class="ref-mark" href="#ref-fbm">[3]</a>。`,
  7: `在下方通式中，将 <span class="vec">p</span> 乘以 <i>2<sup>k</sup></i>，会使第 <i>k</i> 层在空间中的变化速度增大到 <i>2<sup>k</sup></i> 倍；因子 <i>g<sup>k</sup></i> 则减小该层的贡献。再除以 <i>&Sigma;g<sup>k</sup></i>，所有权重之和便为 1。因此，只要 <i>N(<span class="vec">p</span>)</i> 位于 0 与 1 之间，<i>F<sub>K,g</sub>(<span class="vec">p</span>)</i> 也位于该区间内。`,
  8: `循环与公式逐项对应：<code>p *= 2</code> 产生 <i>2<sup>k</sup><span class="vec">p</span></i>，<code>amplitude *= gain</code> 产生 <i>g<sup>k</sup></i>，而 <code>sum / weight</code> 完成归一化。`,
  9: `下方六幅灰度图都使用同一基础区域 <span class="vec">p</span><i>∈[0,4]²</i>。上排分别显示前三个未经累加的倍频层；下排分别累加 2、3 和 8 个倍频层。左上图正是第 1 节的结果，右下图则是实际云层所使用的八倍频层场。与两层或三层相比，八层保留了明显更细的变化；每增加一层就需要额外计算一次噪声，因此着色器开销大致随 <i>K</i> 线性增长。`,
});

registerParagraphs("depth-title", {
  1: `第 2 节把 <span class="func">F</span><sub>8,0.7</sub> 显示为灰度图，以便观察其数值。场景首先把这些数值转换为一个填充区域的边界。`,
  2: `先取一条一维切片 <i>f(x)=<span class="func">F</span><sub>8,0.7</sub>((x,0))</i>。令 <i>m</i> 为基准高度，<i>A&gt;0</i> 为竖直振幅。减去 ½ 后，噪声以零为中心：大于 ½ 的值抬高边界，小于 ½ 的值降低边界。填充边界下方的所有点，就得到云层轮廓。`,
  4: `随后，通过平移同一噪声场的输入坐标来产生视差。噪声图案本身不变；随时间和表观距离改变的，只是采样位置。`,
  5: `令 <span class="vec">p</span>=(<i>p<sub>1</sub>,p<sub>2</sub></i>) 为按画面高度归一化的场景坐标，<i>t</i> 为缩放后的动画时间。下标 <i>i</i> 标识一个云层。每层具有正的表观距离 <i>d<sub>i</sub></i> 和水平相位 <i>&phi;<sub>i</sub></i>。`,
  7: `着色器在 <i>p<sub>1</sub>+t/d<sub>i</sub></i> 处采样。因此，噪声中的某个固定特征会出现在 <i>p<sub>1</sub>=常数−t/d<sub>i</sub></i> 的位置，并向左移动。其速度大小为 <i>1/d<sub>i</sub></i>，所以较远的图层移动得更慢。`,
  8: `实际实现不再采用前述水平切片，而是进行完整的二维查询。对于每个像素，着色器先计算噪声值，再把它转换为局部阈值，并判断 <i>p<sub>2</sub></i> 是否位于阈值下方。下式定义准确的查询位置 <span class="vec">q</span><sub>i</sub>、场值 <i>z<sub>i</sub></i> 和二值图层遮罩 <i>M<sub>i</sub></i>。参数 <i>m<sub>i</sub></i> 与 <i>A<sub>i</sub></i> 分别表示该层的中间高度和位移振幅。<span class="vec">p</span> 的两个坐标都参与实际噪声场的计算。`,
  9: `四个面板分别单独显示最终着色器中背景层 c12、c11、c10 与 c9 的外部遮罩。白色表示遮罩外部，黑色表示内部。它们的距离依次为 10、15、20、25，因此动画直接展示速度 <i>1/d<sub>i</sub></i> 的递减。最终场景按顺序计算同样的遮罩，再为各层赋予实际颜色。`,
});

registerParagraphs("form-title", {
  1: `空间遮罩 <span class="func">M</span> 为二维图像平面中的每一点 <span class="vec">p</span> 指定一个 0 到 1 之间的数。0 表示排除，1 表示包含。实际列车由矩形遮罩、重复的车厢遮罩和边缘清晰的圆形车轮遮罩组成。符号 𝟙 表示示性函数：下标中的条件成立时取 1，否则取 0。`,
  2: `先从一维开始。区间遮罩选择 <i>a</i> 与 <i>b</i> 之间的点。矩形在水平和竖直坐标上分别应用同一类判断；圆盘则用距离判断取代坐标区间判断。`,
  5: `运算 <span class="operator">fract</span>(9<span class="vec">p</span>) 每隔 <i>1/9</i> 个场景单位重复一次局部坐标，因此一组车厢和车轮图案即可生成整列火车。列车总遮罩是所有部件遮罩的逐点最大值，这在集合意义上就是并集。这些解析判断不需要网格模型或图像素材，并且在任何输出分辨率下都保持清晰边界。`,
  6: `源着色器中的桥梁函数计算保留遮罩 <i>K<sub>B</sub></i>：保留已有场景颜色的位置取 1，填入桥梁颜色的位置取 0。因此，桥梁的包含遮罩为 <i>M<sub>B</sub>=1−K<sub>B</sub></i>。`,
  7: `左侧面板放大显示列车遮罩，右侧面板显示桥梁遮罩。黑色表示 0，白色表示 1。在下方最大值表达式中，每个部件遮罩都在同一点 <span class="vec">p</span> 处求值，因此省略了重复的函数参数。`,
});

registerParagraphs("smoke-title", {
  1: `先从普通的水平条带开始。令 <span class="vec">p</span>=(<i>x,y</i>) 为场景中的一点，<i>c</i> 为条带中心的高度，<i>w&gt;0</i> 为半宽。点 <span class="vec">p</span> 到中心线的竖直距离是 <i>|y−c|</i>。因此，当且仅当 <i>|y−c|&lt;w</i> 时，该点位于条带内部。`,
  2: `<span class="func">D</span>(<span class="vec">p</span>)=|y−c|−w<br>D&lt;0：内部，&nbsp;D=0：边界，&nbsp;D&gt;0：外部`,
  3: `用距离减去 <i>w</i>，得到带符号的边界值 <i>D</i>。结果为负，表示该点到中心的距离小于一个半宽，因此位于内部。让中心 <i>c</i> 和宽度 <i>w</i> 随位置与时间变化，就可以由这条规则构造烟雾。`,
  4: `烟囱位于 <i>x<sub>0</sub>=0.49</i>。烟雾出现在它的左侧，因此定义 <i>s=x<sub>0</sub>−x≥0</i>。<i>s</i> 就是从烟囱出发后沿水平方向移动的距离：源点处 <i>s=0</i>，沿烟羽向远处移动时 <i>s</i> 增大。`,
  5: `令 <i>R(<span class="vec">p</span>,t)</i> 为第 2 节的八倍频层场，并在随时间水平移动的位置上采样。左侧面板显示的就是这个灰度场。中心高度先由平滑曲线 <i>0.16√s+0.12</i> 给出；附加项 <i>−0.4[R−0.55]</i> 再根据噪声使该曲线上下偏移。`,
  6: `宽度为 <i>w(s)=0.8se<sup>−10s</sup></i>。它从零开始增大，在 <i>s=0.1</i> 处达到最大值，随后减小。因子 <i>s</i> 导致初始增长，而指数因子 <i>e<sup>−10s</sup></i> 最终导致衰减。把这个宽度和受噪声扰动的中心代回同一个条带判断，就得到烟羽。条件 <i>D&lt;0</i> 选择全部烟雾；更严格的条件 <i>D&lt;−0.02</i> 选择更靠内部的点，形成内层区域。`,
  7: `因此，左侧面板本身并不是烟雾；它只负责给中心曲线加入细小的竖直变化。右侧面板展示中心、宽度和内外判断组合之后的结果。`,
});

registerParagraphs("synthesis-title", {
  1: `设视口宽度 <i>W&gt;0</i>、高度 <i>H&gt;0</i>，定义归一化显示坐标 <i><span class="vec">u</span>=(x<sub class="label">frag,1</sub>/W,x<sub class="label">frag,2</sub>/H)∈[0,1]²</i>。这与按高度归一化的坐标 <span class="vec">p</span> 不同：这里的两个坐标分别除以对应的视口尺寸。`,
  2: `对于颜色 <span class="vec">a</span>,<span class="vec">b</span><i>∈[0,1]³</i> 和遮罩值 <i>m∈[0,1]</i>，定义合成算子 <span class="operator">Blend</span> 为逐分量线性插值。`,
  4: `遮罩 <i>m</i> 是一个权重。<i>m=0</i> 时结果完全等于 <span class="vec">a</span>；<i>m=1</i> 时完全等于 <span class="vec">b</span>；<i>m=½</i> 时两种颜色贡献相同。当两个不透明遮罩重叠时，后执行的操作决定重叠区域最终可见的颜色。`,
  5: `依次应用 <span class="operator">Blend</span> 时，结果取决于顺序：遮罩等于 1 的位置会被后面的图层替换。实际合成顺序与源着色器<a class="ref-mark" href="#ref-shadertoy">[1]</a>一致。`,
  6: `令 <i>J</i> 为场景绘制过程中有序着色操作的数量。第 <i>j</i> 个操作具有源颜色 <span class="vec">s</span><sub>j</sub> 和遮罩 <i>m<sub>j</sub></i>。这些操作包括分别着色的列车部件、两层烟雾区域、桥梁保留遮罩的补集以及前景云层的不透明度。第 <i>j</i> 次操作后的中间颜色记为 <span class="vec">c</span><sub>j</sub>。`,
  7: `下式中的所有颜色和遮罩都在同一像素、同一时刻求值；为保持表达式清晰，省略这些参数。渲染器按源代码顺序应用该递推式：每次 <code>mix</code> 调用都是一次 <span class="operator">Blend</span>。`,
  8: `合成结束后，<i>V:[0,1]²→[0.5,1]</i> 添加暗角。它在 <span class="vec">u</span>=(½,½) 处等于 1，在每条图像边界上等于 0.5，因此中心保持不变，边缘颜色乘以二分之一。这样可突出中央的列车和云层，同时不改变它们的几何形状或合成顺序。`,
  10: `左侧面板显示 <i>V</i> 本身；右侧把参考网格乘以 <i>V</i>。页面顶部的最终展示对完整场景应用同一个因子。`,
});

const exactTextTranslations = {
  "1D linear interpolation": "一维线性插值",
  "2D bilinear interpolation": "二维双线性插值",
  "interpolate in τ₁, then in τ₂": "先沿 τ₁ 插值，再沿 τ₂ 插值",
  "joining neighbouring samples": "连接相邻样本",
  "linear": "线性",
  "slope jumps": "斜率突变",
  "faded": "淡化后",
  "matching flat tangents": "相接的水平切线",
  "quintic fade": "五次淡化函数",
  "flat": "水平",
  "Linear joins have corners; the quintic fade gives every cell a flat entrance and exit.": "线性连接会产生折角；五次淡化函数使每个网格都以水平切线进入和离开。",
  "image grid": "图像网格",
  "select its cell": "定位所在网格",
  "local unit cell": "局部单位网格",
  "fract converts a global position into coordinates inside one unit cell.": "fract 把全局位置转换为单位网格内部的局部坐标。",
  "same elapsed time t": "相同的经过时间 t",
  "small d: large displacement t/d": "d 较小：位移 t/d 较大",
  "large d: small displacement t/d": "d 较大：位移 t/d 较小",
  "For equal elapsed time, apparent speed is inversely proportional to distance.": "经过时间相同时，表观速度与距离成反比。",
  "interval": "区间",
  "rectangle": "矩形",
  "union": "并集",
  "repetition": "重复",
  "Complex silhouettes are unions and repetitions of elementary inclusion tests.": "复杂轮廓可由基本的包含判断通过并集和重复构成。",
  "constant strip": "等宽条带",
  "curved centre": "弯曲中心线",
  "varying width": "变化的宽度",
  "noise perturbation": "噪声扰动",
  "Curvature controls the route, width controls the envelope, and noise removes mechanical regularity.": "曲率控制走向，宽度控制包络，噪声消除机械式的规则感。",
  "one blend": "一次混合",
  "A, then B": "先 A，后 B",
  "B covers A": "B 覆盖 A",
  "B, then A": "先 B，后 A",
  "A covers B": "A 覆盖 B",
  "Interpolation depends on the mask value; compositing also depends on operation order.": "插值结果取决于遮罩值；合成结果还取决于操作顺序。",
};
registerExactText("svg text, figcaption", exactTextTranslations);

const accessibleFigureTranslations = {
  "A value interpolated along a line": "沿直线插值得到的数值",
  "A point x of tau lies between endpoints a and b.": "由参数 τ 决定的点 x 位于端点 a 与 b 之间。",
  "Interpolation inside a square cell": "方形网格内部的插值",
  "Two horizontal interpolations are joined by one vertical interpolation to estimate a value at point p.": "先进行两次水平插值，再进行一次竖直插值，从而估计点 p 处的数值。",
  "Linear joins compared with fade-smoothed joins": "线性连接与淡化平滑连接的比较",
  "Piecewise linear interpolation has corners where slopes jump. Quintic fading gives horizontal tangents at cell boundaries.": "分段线性插值会在斜率突变处产生折角；五次淡化使网格边界处的切线保持水平。",
  "Global position converted to a local cell coordinate": "把全局位置转换为局部网格坐标",
  "A point p in a large grid is located inside one cell. Enlarging that cell gives fractional coordinates xi one and xi two and four corner values.": "点 p 位于大网格中的某个单元内；放大该单元后，可看到局部坐标 ξ₁、ξ₂ 以及四个顶点值。",
  "Distance controls apparent motion": "距离控制表观运动",
  "Over the same time interval, a near point with small distance moves farther left than a far point with large distance.": "在相同时间内，距离较小的近点比距离较大的远点向左移动得更多。",
  "Building a repeated object from simple masks": "用简单遮罩构造重复对象",
  "An interval becomes a rectangle, rectangles and disks are united, and the result is repeated.": "区间扩展为矩形，再将矩形与圆盘取并集，最后重复所得图形。",
  "From a constant strip to an irregular smoke plume": "从等宽条带到不规则烟羽",
  "A straight constant-width strip is curved, given a varying width, and perturbed by noise.": "将直线等宽条带弯曲、赋予变化的宽度，再用噪声扰动。",
  "Blend weights and order dependence": "混合权重与顺序依赖性",
  "Three blend weights interpolate from dark to light. Two overlapping layers give different results when their order is reversed.": "三个混合权重在暗色与亮色之间插值；两个重叠图层交换顺序后会产生不同结果。",
};
registerExactText("svg title, svg desc", accessibleFigureTranslations);

registerExactText("sub.label", {
  "train": "列车",
  "wheel": "车轮",
  "wagon": "车厢",
  "join": "连接件",
  "roof": "车顶",
  "locomotive": "机车",
  "locomotive roof": "机车车顶",
  "chimney": "烟囱",
  "wheels": "车轮",
  "outer": "外层",
  "inner": "内层",
  "bg": "背景",
  "scene": "场景",
  "out": "输出",
});

registerHTML(".heatmap-title", "<i>N(x,y)</i>，定义域 <i>[0,4]²</i>");
registerHTML("canvas[data-demo=\"train\"] ~ .panel-left", "精确列车遮罩");
registerHTML("canvas[data-demo=\"train\"] ~ .panel-right", "精确桥梁遮罩");
registerHTML("canvas[data-demo=\"smoke\"] ~ .panel-left", "<i>R</i>(<span class=\"vec\">p</span>,t) · 噪声");
registerHTML("canvas[data-demo=\"smoke\"] ~ .panel-right", "外层与内层区域");
registerHTML("canvas[data-demo=\"composition\"] ~ .panel-right", "参考图 × <i>V</i>");

const referenceNotes = document.querySelectorAll(".references li span");
const translatedReferenceNotes = [
  "本研究以此为原始视觉设计与实际 GLSL 的改编来源。",
  "用于引用五次淡化多项式及其端点导数性质。",
  "用于引用程序化图形学中的倍频层分形函数；本页采用的归一化云层求和是该一般思想的一种紧凑实现。",
  "作为蓝噪声分布的背景资料。该资料说明着色器所采样的纹理类别；本文不主张本项目所用 PNG 的具体来源就是此页面。",
  "艺术家本人 YouTube 频道上的原始音乐视频；本页可选配乐的来源与作者信息。",
];
referenceNotes.forEach((element, index) => {
  if (translatedReferenceNotes[index]) htmlEntries.push({ element, en: element.innerHTML, zh: translatedReferenceNotes[index] });
});

registerHTML("footer p", "在 Codex 辅助下对 mdb 发布于 ShaderToy 的 <em>Up in the Cloud Sea</em> 进行拆解，仅供教育用途。");

registerAttribute("meta[name=\"description\"]", "content", "一项关于程序化云层、视差与轮廓合成的渐进式 GLSL 研究。");
registerAttribute("#gl", "aria-label", "Cloudglen Express WebGL 动画");
registerAttribute("canvas[data-demo=\"noise\"]", "aria-label", "二维值噪声场 N 在四乘四网格区域上的灰度热力图");
registerAttribute("canvas[data-demo=\"detail\"]", "aria-label", "六幅灰度热力图，展示各倍频层及其累积归一化和");
registerAttribute("canvas[data-demo=\"layers\"]", "aria-label", "处于不同表观距离的四个实际云层遮罩");
registerAttribute("canvas[data-demo=\"train\"]", "aria-label", "列车和桥梁的二值遮罩；白色表示包含");
registerAttribute("canvas[data-demo=\"smoke\"]", "aria-label", "烟雾噪声场及由此得到的烟雾遮罩");
registerAttribute("canvas[data-demo=\"composition\"]", "aria-label", "精确暗角场及其对参考图像的作用");

const languageToggle = document.querySelector("#language-toggle");

function applyLanguage(language, persist = true) {
  const chinese = language === "zh-CN";
  document.documentElement.lang = chinese ? "zh-CN" : "en";

  for (const entry of htmlEntries) entry.element.innerHTML = chinese ? entry.zh : entry.en;
  for (const entry of textEntries) entry.element.innerHTML = chinese ? entry.zh : entry.en;
  for (const entry of attributeEntries) {
    entry.element.setAttribute(entry.name, chinese ? entry.zh : entry.en);
  }

  languageToggle.textContent = chinese ? "English" : "简体中文";
  languageToggle.lang = chinese ? "en" : "zh-CN";
  languageToggle.setAttribute("aria-label", chinese ? "切换到英文" : "Switch to Simplified Chinese");

  if (persist) {
    try { localStorage.setItem("cloudglen-language", chinese ? "zh-CN" : "en"); } catch {}
  }
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
}

languageToggle.addEventListener("click", () => {
  applyLanguage(document.documentElement.lang === "zh-CN" ? "en" : "zh-CN");
});

let initialLanguage = "en";
try {
  if (localStorage.getItem("cloudglen-language") === "zh-CN") initialLanguage = "zh-CN";
} catch {}
applyLanguage(initialLanguage, false);
