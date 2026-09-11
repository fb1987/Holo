import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertex = `
uniform float uTime;uniform float uSeed;varying vec2 vUv;varying float vFold;
void main(){
 vUv=uv;float t=uv.y;float x=uv.x*2.-1.;float phase=uSeed*1.728;
 float twist=t*5.8+phase+uTime*.18;
 float envelope=pow(sin(t*3.14159),.82);
 float core=1.-step(2.,uSeed);
 float width=envelope*(.34+.19*sin(t*7.+phase))*mix(1.,.55,core);
 float radius=envelope*(.48+.19*sin(t*5.+phase))*mix(1.,.28,core);
 float flutter=sin(t*19.-uTime*1.3+phase+x*2.)*.055*envelope;
 vec3 p;
 p.x=sin(twist)*radius+cos(twist)*x*width+sin(t*5.+uTime*.34)*t*.25;
 p.z=cos(twist)*radius+sin(twist)*x*width+flutter;
 p.y=t*2.8-1.18+sin(x*2.6+t*14.+phase-uTime*.9)*.08*envelope;
 p.x+=sin(t*11.+uTime*.56+phase)*.045*envelope;
 vFold=sin(t*16.+x*4.+phase-uTime*.8)*.5+.5;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment = `
uniform float uTime;uniform float uSeed;uniform float uIntensity;
varying vec2 vUv;varying float vFold;
void main(){
 float edge=pow(sin(vUv.x*3.14159),.65);float tip=pow(sin(vUv.y*3.14159),.7);
 float filaments=pow(.5+.5*sin(vUv.x*83.+sin(vUv.y*18.-uTime)*3.+sin(vUv.y*33.+uTime*.4)),22.);
 float veins=pow(.5+.5*sin(vUv.x*32.+vUv.y*14.-uTime*.35+uSeed),7.);
 vec3 cool=vec3(.10,.85,1.);vec3 violet=vec3(.52,.24,.95);vec3 warm=vec3(1.,.38,.13);
 float shift=sin(vUv.y*4.7+uSeed*.95)*.5+.5;
 vec3 color=mix(cool,violet,smoothstep(.15,.7,shift));
 color=mix(color,warm,pow(max(0.,sin(vUv.y*3.2+uSeed*1.6)),5.)*.8);
 color=mix(color,vec3(1.,.78,.52),(1.-step(3.5,uSeed))*.95);
 color=mix(color,vec3(.72,.95,1.),filaments*.55);
 float coreBoost=mix(1.,1.8,1.-step(3.5,uSeed));
 float alpha=coreBoost*edge*tip*(.075+vFold*.08+filaments*.055+veins*.07)*uIntensity;
 gl_FragColor=vec4(color*(1.1+filaments*.8),alpha);
}`;

function Ribbon({
  seed,
  reducedMotion,
  busy,
}: {
  seed: number;
  reducedMotion: boolean;
  busy: boolean;
}) {
  const ref = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: seed },
      uIntensity: { value: 1 },
    }),
    [seed],
  );
  useFrame((state, dt) => {
    if (!ref.current) return;
    ref.current.uniforms.uTime.value = reducedMotion
      ? 4
      : state.clock.elapsedTime;
    ref.current.uniforms.uIntensity.value = THREE.MathUtils.damp(
      ref.current.uniforms.uIntensity.value,
      busy ? 1.65 : 1,
      3,
      dt,
    );
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[1, 1, 14, 100]} />
      <shaderMaterial
        ref={ref}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

function Embers({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(530 * 3);
    const seeds = new Float32Array(530);
    let n = 42;
    const rand = () => {
      n = (n * 16807) % 2147483647;
      return n / 2147483647;
    };
    for (let i = 0; i < 530; i++) {
      positions[i * 3] = rand();
      positions[i * 3 + 1] = rand();
      positions[i * 3 + 2] = rand();
      seeds[i] = rand();
    }
    return { positions, seeds };
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => {
    if (material.current)
      material.current.uniforms.uTime.value = reducedMotion
        ? 4
        : state.clock.elapsedTime;
  });
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={`uniform float uTime;attribute float aSeed;varying float vAlpha;varying float vSeed;
      void main(){float life=fract(position.y+uTime*(.035+aSeed*.018));float a=position.x*6.283+life*4.+uTime*.12;
      float r=sin(life*3.14159)*(.32+position.z*.7);vec3 p=vec3(sin(a)*r,life*3.45-1.33,cos(a)*r);
      p.x+=sin(life*5.+uTime*.34)*life*.25;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=(1.2+aSeed*2.)*(5./-mv.z);vAlpha=pow(sin(life*3.14159),1.4)*(.2+aSeed*.5);vSeed=aSeed;}`}
        fragmentShader={`varying float vAlpha;varying float vSeed;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=exp(-d*d*25.)*vAlpha;
      vec3 color=mix(vec3(.24,.85,1.),vec3(.82,.5,1.),vSeed);gl_FragColor=vec4(color,a);}`}
      />
    </points>
  );
}

/** A soft, turbulent inner flame gives the orbiting filaments a luminous heart. */
function FlameCore({
  reducedMotion,
  busy,
}: {
  reducedMotion: boolean;
  busy: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uIntensity: { value: 1 } }),
    [],
  );
  useFrame((state, dt) => {
    mesh.current?.quaternion.copy(state.camera.quaternion);
    if (material.current) {
      material.current.uniforms.uTime.value = reducedMotion
        ? 4
        : state.clock.elapsedTime;
      material.current.uniforms.uIntensity.value = THREE.MathUtils.damp(
        material.current.uniforms.uIntensity.value,
        busy ? 1.3 : 1,
        3,
        dt,
      );
    }
  });
  return (
    <mesh ref={mesh} position={[0, 0.14, 0]} frustumCulled={false}>
      <planeGeometry args={[1.55, 2.55]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        vertexShader={`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`
      uniform float uTime;uniform float uIntensity;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.01)*.13;}
      void main(){
        float y=vUv.y;float shift=sin(y*5.+uTime*.34)*y*.16;
        float x=(vUv.x-.5)*1.55-shift;
        float flow=fbm(vec2(x*6.+sin(y*7.+uTime*.25),y*4.-uTime*.65));
        float width=(.035+.20*pow(sin(y*3.14159),.8))*(1.-y*.42);
        x+=(flow-.46)*.19*y;
        float core=exp(-pow(x/width,2.)*2.8);
        float body=exp(-pow(x/(width*1.5),2.)*1.7);
        float ends=smoothstep(.01,.13,y)*(1.-smoothstep(.63,1.,y));
        float turbulence=.30+pow(flow,1.8)*1.7;
        float fine=pow(max(0.,sin(y*23.-uTime*1.8+x*17.)),4.)*.12;
        vec3 color=mix(vec3(1.,.22,.06),vec3(1.,.74,.39),core);
        color=mix(color,vec3(1.,.95,.76),pow(core,3.)*.7);
        float alpha=(core*.58+body*.12)*ends*turbulence*uIntensity+fine*body*ends*.15;
        gl_FragColor=vec4(color,alpha);
      }`}
      />
    </mesh>
  );
}

export function Plasma({
  reducedMotion,
  busy,
}: {
  reducedMotion: boolean;
  busy: boolean;
}) {
  return (
    <group position={[0, -0.05, 0]} scale={0.82}>
      <FlameCore reducedMotion={reducedMotion} busy={busy} />
      {Array.from({ length: 9 }, (_, index) => (
        <Ribbon
          key={index}
          seed={index * 1.13}
          reducedMotion={reducedMotion}
          busy={busy}
        />
      ))}
      <Embers reducedMotion={reducedMotion} />
      <pointLight
        position={[0, -0.9, 0]}
        color="#ffc997"
        intensity={2.5}
        distance={5}
      />
    </group>
  );
}
