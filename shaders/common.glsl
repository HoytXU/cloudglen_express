float latticeSample(vec2 p) {
    return texture(iChannel0,p/1024.0).x;
}

float noise(vec2 x) {
    vec2 xi = fract(x);
    vec2 w = xi*xi*xi*(xi*(xi*6.0-15.0)+10.0);
    vec2 cell = floor(x);
    float v00 = latticeSample(cell+vec2(0.0,0.0));
    float v10 = latticeSample(cell+vec2(1.0,0.0));
    float v01 = latticeSample(cell+vec2(0.0,1.0));
    float v11 = latticeSample(cell+vec2(1.0,1.0));
    return v00+(v10-v00)*w.x+(v01-v00)*w.y
        +(v00-v10-v01+v11)*w.x*w.y;
}

float fbm(vec2 p, int K) {
    float sum = 0.0;
    float amplitude = 1.0;
    float weight = 0.0;
    float gain = 0.7;
    for (int k = 0; k < K; ++k) {
        sum += amplitude*noise(p);
        weight += amplitude;
        amplitude *= gain;
        p *= 2.0;
    }
    return sum/weight;
}

float fbm2(vec2 x, int detail) {
    float sum = 0.0;
    float amplitude = 1.0;
    float weight = 0.0;
    for (int i = 0; i < detail; i++) {
        sum += amplitude*noise(x);
        weight += amplitude;
        amplitude *= 0.9;
        x *= 2.0;
    }
    return sum/weight;
}

float box(vec2 uv, float x1, float x2, float y1, float y2) {
    return (uv.x>x1 && uv.x<x2 && uv.y>y1 && uv.y<y2) ? 1.0 : 0.0;
}

#define dot2(v) dot(v,v)

float productionCloudHeight(
    vec2 uv,
    float t,
    float midlevel,
    float displacement,
    float distance,
    float phase
) {
    vec2 samplePosition = uv+vec2(t/distance+phase,0.0);
    return midlevel+(fbm(samplePosition,8)-0.5)*displacement;
}

struct TrainMasks {
    float wagon;
    float joinMask;
    float roof;
    float locomotive;
    float chimneyBody;
    float chimneyTop;
    float locomotiveRoof;
    float wheels;
};

TrainMasks productionTrainMasks(vec2 uv) {
    vec2 repeated = fract(uv*9.0);
    TrainMasks masks;

    masks.wagon = 1.0;
    masks.wagon *= 1.0-step(0.45,uv.x);
    masks.wagon *= 1.0-step(0.115,uv.y);
    masks.wagon *= step(0.103,uv.y);
    masks.wagon *= step(0.05,1.0-abs(repeated.x*2.0-1.0));

    masks.joinMask = 1.0;
    masks.joinMask *= 1.0-step(0.45,uv.x);
    masks.joinMask *= 1.0-step(0.11,uv.y);
    masks.joinMask *= step(0.107,uv.y);

    masks.roof = 1.0;
    masks.roof *= 1.0-step(0.45,uv.x);
    masks.roof *= 1.0-step(0.117,uv.y);
    masks.roof *= step(0.11,uv.y);
    masks.roof *= step(0.15,1.0-abs(repeated.x*2.0-1.0));

    masks.locomotive = box(uv,0.45,0.5,0.103,0.112);
    masks.chimneyBody = box(uv,0.49,0.495,0.103,0.12);
    masks.chimneyTop = box(uv,0.488,0.496,0.12,0.123);
    masks.locomotiveRoof = box(uv,0.443,0.47,0.11,0.117);

    masks.wheels = 1.0-step(0.00004,dot2(uv-vec2(0.457,0.106)));
    masks.wheels += 1.0-step(0.00002,dot2(uv-vec2(0.487,0.105)));
    masks.wheels += 1.0-step(0.00002,dot2(uv-vec2(0.497,0.105)));
    if (uv.x<0.45 && uv.y>0.025 && uv.y<0.2) {
        masks.wheels += 1.0-step(0.002,dot2(repeated-vec2(0.2,0.95)));
        masks.wheels += 1.0-step(0.002,dot2(repeated-vec2(0.8,0.95)));
    }
    return masks;
}

float productionTrainCombinedMask(TrainMasks masks) {
    return min(1.0,max(
        max(max(masks.wagon,masks.joinMask),max(masks.roof,masks.locomotive)),
        max(max(masks.chimneyBody,masks.chimneyTop),max(masks.locomotiveRoof,masks.wheels))
    ));
}

float productionSmokeNoise(vec2 uv, float t) {
    vec2 samplePosition = uv+vec2(t/5.0+3.5,0.0);
    samplePosition.x -= t/5.0*0.2;
    return fbm2(samplePosition,8)-0.55;
}

float productionSmokeDistance(vec2 uv, float t) {
    float trailingDistance = 0.49-uv.x;
    float perturbation = productionSmokeNoise(uv,t);
    return abs(uv.y+0.4*perturbation-0.16*sqrt(max(trailingDistance,0.0))-0.12)
        -0.8*trailingDistance*exp(-10.0*trailingDistance);
}

float productionBridgeKeepMask(vec2 uv, float t) {
    vec2 repeated = uv+vec2(t/5.0+32.5,0.0);
    repeated.x = fract(repeated.x*3.0);
    float k = 1.0;
    k *= smoothstep(0.001,0.003,abs(repeated.y-pow(repeated.x-0.5,2.0)*0.15-0.12));
    k *= min(step(0.05,1.0-abs(repeated.x*2.0-1.0))+step(0.17,repeated.y),1.0);
    k *= min(smoothstep(0.02,0.05,1.0-abs(repeated.x*2.0-1.0))+step(0.177,repeated.y),1.0);
    k *= min(step(0.1,repeated.y)
        +smoothstep(-0.09,-0.085,-repeated.y-0.001/(1.0-abs(repeated.x*2.0-1.0))),1.0);
    k *= min(smoothstep(0.05,0.2,1.0-abs(fract(repeated.x*16.0)*2.0-1.0))
        +step(0.12,repeated.y-pow(repeated.x-0.5,2.0)*0.15)
        +step(-0.1,-repeated.y),1.0);
    return k;
}
