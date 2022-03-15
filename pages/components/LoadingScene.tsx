import React, {useEffect, useState} from 'react'
import Script from 'next/script'
import * as THREE from "three"

const LoadingScene = () => {
  
  let scene: THREE.Object3D<THREE.Event>, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer
  let uniforms: { u_resolution: any; u_time?: { type: string; value: number }; u_noise?: { type: string; value: THREE.Texture }; u_mouse?: { type: string; value: THREE.Vector2 } }
  let container: HTMLElement | null


  const webGLRender = () => {    
    container = document.getElementById('loadingScene')
    if (typeof container === "undefined" || container === null) return

    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true });
    container.appendChild( renderer.domElement )
    camera = new THREE.PerspectiveCamera( 75, container.clientWidth / container.clientHeight, 0.1, 100000 )
    camera.position.set(0, 150, 800)    

    renderer.setClearColor('#000000', 0.1)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)

    scene = new THREE.Scene()
    let loader = new THREE.TextureLoader();
    let texture: THREE.Texture;
    loader.setCrossOrigin("anonymous");
    loader.load(
    'https://s3-us-west-2.amazonaws.com/s.cdpn.io/982762/noise.png',
    function do_something_with_texture(tex) {
      texture = tex;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      init();
      animate(0.1);
    });

    function init() {
      var geometry = new THREE.PlaneBufferGeometry(2, 2);
      uniforms = {
        u_time: { type: "f", value: 1.0 },
        u_resolution: { type: "v2", value: new THREE.Vector2() },
        u_noise: { type: "t", value: texture },
        u_mouse: { type: "v2", value: new THREE.Vector2() } };
    
      var material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: 
          `void main() {
            gl_Position = vec4( position, 1.0 );
          }`,
        fragmentShader: 
          `
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_time;
            uniform sampler2D u_noise;
            
            #define PI 3.141592653589793
            #define TAU 6.283185307179586
            
            const int octaves = 2;
            const float seed = 43758.5453123;
            const float seed2 = 73156.8473192;
              
            // float r1 = 0.1 + ((u_mouse.y + 0.5) * .1);
            // float r2 = 0.4 + (u_mouse.x * .2);
            float r1 = 0.2;
            float r2 = 0.9;
            
            // These awesome complex Math functions curtesy of 
            // https://github.com/mkovacs/reim/blob/master/reim.glsl
            vec2 cCis(float r);
            vec2 cLog(vec2 c); // principal value
            vec2 cInv(vec2 c);
            float cArg(vec2 c);
            float cAbs(vec2 c);
            
            vec2 cMul(vec2 a, vec2 b);
            vec2 cDiv(vec2 a, vec2 b);

            vec2 cCis(float r)
            {
              return vec2( cos(r), sin(r) );
            }
            vec2 cExp(vec2 c)
            {
              return exp(c.x) * cCis(c.y);
            }
            vec2 cConj(vec2 c)
            {
              return vec2(c.x, -c.y);
            }
            vec2 cInv(vec2 c)
            {
              return cConj(c) / dot(c, c);
            }
            vec2 cLog(vec2 c)
            {
              return vec2( log( cAbs(c) ), cArg(c) );
            }
            float cArg(vec2 c)
            {
              return atan(c.y, c.x);
            }
            float cAbs(vec2 c)
            {
              return length(c);
            }
            vec2 cMul(vec2 a, vec2 b)
            {
              return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
            }
            vec2 cDiv(vec2 a, vec2 b)
            {
              return cMul(a, cInv(b));
            }

            float hash(float p)
            {
              vec2 o = texture2D( u_noise, vec2((p+0.5)/256.0), -100.0 ).xy;
              return o.x;
            }
            vec2 hash(vec2 p)
            {
              vec2 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).xy;
              return o - .5;
            }
            vec3 hash3(vec2 p)
            {
              vec3 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).xyz;
              return o;
            }
            vec4 hash4(vec2 p)
            {
              vec4 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 );
              return o;
            }

            // LUT Noise by Inigo Quilez - iq/2013
            // https://www.shadertoy.com/view/4sfGzS
            float noiseLUT( in vec3 x )
            {
              vec3 p = floor(x);
              vec3 f = fract(x);
              f = f*f*(3.0-2.0*f);
              vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
              vec2 rg = texture2D(u_noise, (uv+0.5)/256.0).yx - .5;
              return mix( rg.x, rg.y, f.z );
            }

            float fbm1(in vec2 _st, float seed) {
              float v = 0.0;
              float a = 0.5;
              vec2 shift = vec2(100.0);
              // Rotate to reduce axial bias
              mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
              for (int i = 0; i < octaves; ++i) {
                  v += a * noiseLUT(vec3(_st, 1.));
                  // v += a * noise(_st, seed);
                  _st = rot * _st * 2.0 + shift;
                  a *= 0.4;
              }
              return v;
            }

            float pattern(vec2 uv, float seed, float time, inout vec2 q, inout vec2 r) {
              q = vec2( fbm1( uv + vec2(0.0,0.0), seed ),
                fbm1( uv + vec2(5.2,1.3), seed ) );
              r = vec2( fbm1( uv + 4.0*q + vec2(1.7 - time / 2.,9.2), seed ), 
                fbm1( uv + 4.0*q + vec2(8.3 - time / 2.,2.8), seed ) );
              return fbm1( uv + 4.0*r, seed );
            }

            vec2 hash2(vec2 p)
            {
              vec2 o = texture2D( u_noise, (p+0.5)/256.0, -100.0 ).xy;
              return o;
            }
            
            vec3 hsb2rgb( in vec3 c ){
              vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0 );
              rgb = rgb*rgb*(3.0-2.0*rgb);
              return c.z * mix( vec3(1.0), rgb, c.y);
            }
            
            vec3 domain(vec2 z){
              return vec3(hsb2rgb(vec3(atan(z.y,z.x)/TAU,1.,1.)));
            }
            vec3 colour(vec2 z) {
                return domain(z);
            }
            
            vec2 Droste(vec2 uv) {
              
              // 5. Take the tiled strips back to ordinary space.
              uv = cLog(uv); 
              // 4. Scale and rotate the strips
              float scale = log(r2/r1);
              float angle = atan(scale/(2.0*PI));
              uv = cDiv(uv, cExp(vec2(0,angle))*cos(angle)); 
              // 3. this simulates zooming in the tile
              uv -= u_time * .2;
              // 2. Tile the strips
              uv.x = mod(uv.x,log(r2/r1)); 
              // 1. Take the annulus to a strip
              uv = cExp(uv)*r1;
              
              return uv;
            }

            void main() {
              vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
              uv *= 2.;
              vec2 _uv = uv;
              vec2 polar = vec2(length(_uv), atan(uv.y, uv.x));
              
              uv = Droste(uv);
              
              float rInv = 1./length(uv);
              uv = uv * rInv - vec2(rInv, 1.);
              
              vec2 p;
              vec2 q;
              float pat = pattern(uv * 5., seed, u_time * 5., p, q);
              
              vec3 fragcolour = mix(
                mix( vec3(.9, .7, 0.), vec3(1., .55, 0.1), abs(q.x*p.y)*20.),
                vec3(.5, .3, 0.), pat
              );
              fragcolour -= smoothstep(-.1, .9, p.x) * .5;
              fragcolour += smoothstep(-.1, .5, p.y) * .5;
              
              fragcolour += (1. - length(_uv * 2.)) *.5 ;
              float lcol = clamp(length((_uv) * 4.) - .2, 0., 1.);
              
              float raynoise = fbm1(polar*10.-u_time*2., seed);
              
              fragcolour = mix(
                fragcolour, 
                vec3(sin(p.y * 10.), cos(q.y * 10.), pat * 2.) * .5 + 1.5, 
                clamp( abs( sin(polar.y * 50.) ) * 1. / length(_uv * _uv * 3.) * raynoise - .2,  0.,  1.) * .2);
              
              fragcolour = mix(vec3(1.), fragcolour, lcol);              

              gl_FragColor = vec4(fragcolour,1.0);
            }
          ` 
      })
      // material.extensions.derivatives = true
    
      var mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh)
      onWindowResize();
      window.addEventListener('resize', onWindowResize, false);
      function onWindowResize() { 
        if (typeof container === "undefined" || container === null) return      
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();      
        renderer.setSize( container.clientWidth, container.clientHeight );
        uniforms.u_resolution.value.x = renderer.domElement.width;
        uniforms.u_resolution.value.y = renderer.domElement.height;
      }
    }    
    function animate(delta: number) {
      requestAnimationFrame( animate );
      
      let _uniforms: any = uniforms;
      _uniforms.u_time.value = -11000 + delta * 0.0005;
      renderer.render( scene, camera );    
    }
  }

  useEffect(() => {    
    if(typeof document !== "undefined"){
      webGLRender()
    }
  }, [])

  return (
    <>
      <div id="loadingScene" className='absolute top-0 left-0 w-full h-full'/>
    </>
  )
}

export default LoadingScene