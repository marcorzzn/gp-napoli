// Materiali PBR monoposto Posillipo (1937 Alfa Romeo 12C-36 · 1955 Lancia D50 Ascari · 2026 Ferrari SF-26)
#include mesh_vert
@group(3) @binding(0) var tAtlas: texture_2d<f32>;

fn surf(in: V2F, ff: bool) -> Surface {
  var s = surfDefault(normalize(in.nrm));
  let id = matId(in.mat);
  let sub = u32(round(matA(in.mat) * 255.0));
  let lp = in.ext.xyz;
  let tex = textureSampleLevel(tAtlas, sLin, in.uv, 0.0);
  let fl = textureSampleLevel(tNoise, sLin, lp.xz * 18.0 + lp.xy * 9.0, 0.0).r - 0.5;
  s.albedo = in.col.rgb;

  switch (id) {
    case 1u: {
      // Vernice carrozzeria (Rosso Alfa/Lancia/Scuderia o bianco SF-26) con clearcoat PBR
      s.albedo = in.col.rgb * (1.0 + 0.035 * fl);
      s.metal = select(0.18, 0.28, sub == 0u);
      s.rough = select(0.20, 0.16, sub == 0u) + 0.02 * fl;
      s.coat = 1.0;
    }
    case 2u: {
      // Nero opaco / Fibra di carbonio (sub == 2u: trama carbonio intrecciata)
      if (sub == 2u) {
        let weave = sin(lp.x * 260.0 + lp.z * 260.0) * sin(lp.x * 260.0 - lp.z * 260.0);
        s.albedo = in.col.rgb * (0.88 + 0.24 * (0.5 + 0.5 * weave));
        s.metal = 0.22;
        s.rough = 0.28 + 0.06 * weave;
        s.coat = 0.45;
      } else {
        s.albedo = in.col.rgb;
        s.metal = 0.05;
        s.rough = 0.62;
      }
    }
    case 4u: {
      // Pneumatici (battistrada sub=0 / spalla sub=1)
      let n = textureSampleLevel(tNoise, sLin, in.uv * 16.0, 0.0).r;
      s.albedo = in.col.rgb * (0.88 + 0.22 * n);
      s.metal = 0.0;
      s.rough = select(0.76, 0.84, sub == 0u);
#ifdef ERA_2026
      // Banda rossa Pirelli P-Zero Soft sulla spalla degli pneumatici 2026
      if (sub == 1u) {
        let r = length(lp.xy);
        let stripe = smoothstep(0.245, 0.255, r) * (1.0 - smoothstep(0.270, 0.280, r));
        s.albedo = mix(s.albedo, vec3f(0.78, 0.04, 0.03), stripe * 0.92);
        s.rough = mix(s.rough, 0.42, stripe);
      }
#else
      // Scanalature battistrada stretto 1937 / 1955
      if (sub == 0u) {
        let gr = smoothstep(0.72, 0.95, abs(sin(in.uv.x * 38.0)));
        s.albedo *= (1.0 - 0.35 * gr);
      }
#endif
    }
    case 5u: {
      // Cerchi ruota (raggi Borrani alluminio 1937/1955 o lega scura 2026)
      s.albedo = in.col.rgb;
      s.metal = 0.88;
      s.rough = select(0.26, 0.34, sub == 1u);
    }
    case 6u: {
      // Meccanica / bracci sospensione / sottoscocca
      s.albedo = in.col.rgb;
      s.metal = 0.65;
      s.rough = 0.46;
    }
    case 7u: {
      // Cromo (sub=0), scarico spazzolato (sub=1), titanio Halo (sub=2)
      s.albedo = in.col.rgb;
      s.metal = select(0.92, 0.98, sub == 0u);
      s.rough = select(select(0.24, 0.32, sub == 2u), 0.10, sub == 0u);
    }
    case 8u: {
      // Cuoio sedile / legno volante / tuta pilota
      s.albedo = in.col.rgb * (0.94 + 0.12 * fl);
      s.metal = 0.0;
      s.rough = select(0.58, 0.78, sub == 1u);
    }
    case 9u: {
      // Luce pioggia FIA posteriore / display volante
      s.albedo = in.col.rgb;
      s.rough = 0.18;
      s.emissive = select(0.35, 0.22, sub == 1u);
    }
    case 12u: {
      // Livrea, numeri di gara (#32, #6, #16), stemmi e sponsor HP da atlas 2D
      s.albedo = tex.rgb;
      s.metal = 0.14;
      s.rough = 0.22;
      s.coat = 0.95;
    }
    case 13u: {
      // Prese d'aria e radiatori interni
      s.albedo = in.col.rgb;
      s.metal = 0.30;
      s.rough = 0.72;
    }
    case 16u: {
      // Calandra / griglia radiatore cromata
      let meshP = smoothstep(0.25, 0.75, abs(sin(lp.y * 120.0)) * abs(sin(lp.z * 120.0)));
      s.albedo = in.col.rgb * (0.45 + 0.55 * meshP);
      s.metal = 0.85;
      s.rough = 0.26;
    }
    case 17u: {
      // Casco lucido pilota (celeste Ascari / rosso SF-26)
      s.albedo = in.col.rgb;
      s.metal = 0.12;
      s.rough = 0.14;
      s.coat = 1.0;
    }
    default: {
      s.albedo = in.col.rgb;
      s.rough = 0.45;
    }
  }
  return s;
}
