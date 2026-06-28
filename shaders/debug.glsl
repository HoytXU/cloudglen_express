vec3 contrastGrid(vec3 color, vec2 p, float opacity) {
    vec2 edgeDistance = min(fract(p),1.0-fract(p));
    float grid = 1.0-smoothstep(0.0,0.018,min(edgeDistance.x,edgeDistance.y));
    vec3 gridColor = color.r>0.5 ? vec3(0.0) : vec3(1.0);
    return mix(color,gridColor,opacity*grid);
}

vec3 renderNoise(vec2 uv) {
    vec2 p = 4.0*uv;
    float value = noise(p);
    vec3 color = contrastGrid(vec3(value),p,0.28);
    float aspect = uResolution.x/uResolution.y;
    vec2 selected = vec2(2.65,1.55)/4.0;
    vec2 delta = vec2((uv.x-selected.x)*aspect,uv.y-selected.y);
    float ring = 1.0-smoothstep(0.003,0.009,abs(length(delta)-0.025));
    vec3 ringColor = noise(vec2(2.65,1.55))>0.5 ? vec3(0.0) : vec3(1.0);
    return mix(color,ringColor,ring);
}

vec3 renderOctaves(vec2 uv) {
    bool top = uv.y>=0.5;
    int column = min(2,int(floor(3.0*uv.x)));
    vec2 local = fract(vec2(3.0*uv.x,2.0*uv.y));
    vec2 p = 4.0*local;
    float value;
    float scale = exp2(float(column));
    if (top) value = noise(scale*p);
    else if (column==0) value = fbm(p,2);
    else if (column==1) value = fbm(p,3);
    else value = fbm(p,8);
    vec3 color = vec3(value);
    if (top) color = contrastGrid(color,scale*p,0.20);
    float verticalDivider = max(
        1.0-smoothstep(0.0,0.006,abs(uv.x-1.0/3.0)),
        1.0-smoothstep(0.0,0.006,abs(uv.x-2.0/3.0))
    );
    float horizontalDivider = 1.0-smoothstep(0.0,0.006,abs(uv.y-0.5));
    float divider = max(verticalDivider,horizontalDivider);
    return mix(color,vec3(0.08),divider);
}

vec3 renderCloudLayers(vec2 uv) {
    bool right = uv.x>=0.5;
    bool top = uv.y>=0.5;
    vec2 local = fract(2.0*uv);
    float t = uTime*4.0;
    float threshold;
    if (top && !right) {
        threshold = productionCloudHeight(local,t,0.30,0.90,10.0,32.5);
    } else if (top) {
        threshold = productionCloudHeight(local,t,0.35,1.00,15.0,30.0);
    } else if (!right) {
        threshold = productionCloudHeight(local,t,0.35,3.50,20.0,27.5);
    } else {
        threshold = productionCloudHeight(local,t,0.45,2.00,25.0,23.0);
    }
    float mask = 1.0-smoothstep(threshold-0.006,threshold+0.006,local.y);
    vec3 color = mix(vec3(0.96),vec3(0.12),mask);
    float divider = max(
        1.0-smoothstep(0.0,0.006,abs(uv.x-0.5)),
        1.0-smoothstep(0.0,0.006,abs(uv.y-0.5))
    );
    return mix(color,vec3(0.02),divider);
}

vec3 renderGeometryMasks(vec2 uv) {
    bool right = uv.x>=0.5;
    vec2 local = vec2(fract(2.0*uv.x),uv.y);
    float t = uTime*4.0;
    float mask;
    if (!right) {
        vec2 scenePosition = vec2(0.55*local.x,0.20*local.y);
        mask = productionTrainCombinedMask(productionTrainMasks(scenePosition));
    } else {
        vec2 scenePosition = vec2(0.55*local.x,mix(-0.08,0.20,local.y));
        mask = 1.0-productionBridgeKeepMask(scenePosition,t);
    }
    vec3 color = vec3(mask);
    float divider = 1.0-smoothstep(0.0,0.006,abs(uv.x-0.5));
    return mix(color,vec3(0.35),divider);
}

vec3 renderSmoke(vec2 uv) {
    bool right = uv.x>=0.5;
    vec2 local = vec2(fract(2.0*uv.x),uv.y);
    vec2 scenePosition = vec2(mix(-0.05,0.49,local.x),mix(-0.02,0.30,local.y));
    float t = uTime*4.0;
    float perturbation = productionSmokeNoise(scenePosition,t);
    vec3 color;
    if (!right) {
        color = vec3(clamp(perturbation+0.55,0.0,1.0));
    } else {
        float distance = productionSmokeDistance(scenePosition,t);
        float outerMask = 1.0-step(0.0,distance);
        float innerMask = 1.0-step(-0.02,distance);
        color = mix(vec3(0.02),vec3(0.72),outerMask);
        color = mix(color,vec3(1.0),innerMask);
    }
    float divider = 1.0-smoothstep(0.0,0.006,abs(uv.x-0.5));
    return mix(color,vec3(0.35),divider);
}

vec3 renderComposition(vec2 uv) {
    bool right = uv.x>=0.5;
    vec2 local = vec2(fract(2.0*uv.x),uv.y);
    float vignette = vignetteFactor(local);
    vec3 color;
    if (!right) {
        color = vec3(vignette);
    } else {
        vec2 cells = floor(8.0*local);
        float checker = mod(cells.x+cells.y,2.0);
        vec3 source = mix(vec3(0.35),vec3(0.88),checker);
        color = vignette*source;
    }
    float divider = 1.0-smoothstep(0.0,0.006,abs(uv.x-0.5));
    return mix(color,vec3(0.1),divider);
}

void main() {
    vec2 uv = gl_FragCoord.xy/uResolution;
    vec3 color;
    if (uDebugMode==1) color = renderNoise(uv);
    else if (uDebugMode==2) color = renderOctaves(uv);
    else if (uDebugMode==3) color = renderCloudLayers(uv);
    else if (uDebugMode==4) color = renderGeometryMasks(uv);
    else if (uDebugMode==5) color = renderSmoke(uv);
    else color = renderComposition(uv);
    outColor = vec4(color,1.0);
}
