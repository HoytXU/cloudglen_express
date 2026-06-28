void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Output to screen
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = texture(iChannel0, uv).rgb;
    col *= vignetteFactor(uv);
    fragColor = vec4(col, 1.0);
}
