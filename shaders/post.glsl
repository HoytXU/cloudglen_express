void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Output to screen
    vec2 uv = fragCoord/iResolution.xy;
    vec3 col = texture(iChannel0, uv).rgb;
    col *= 0.5 + 0.5*pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.2 );
    fragColor = vec4(col, 1.0);
}