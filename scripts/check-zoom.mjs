// Optional browser regression: CHROME_PATH=/path/to/chrome node scripts/check-zoom.mjs
import { build } from 'vite';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const chrome = process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const tmp = await mkdtemp(join(tmpdir(), 'ztd-zoom-'));
try {
  const entry = join(tmp, 'entry.js');
  const renderer = fileURLToPath(new URL('../src/dom-renderer.js', import.meta.url));
  await writeFile(entry, `import {renderChartDom} from ${JSON.stringify(renderer)};
    const stage=document.createElement('div'), host=document.createElement('div');
    document.body.append(stage); stage.append(host); stage.style.transformOrigin='0 0';
    host.style.cssText='width:480px; transform-origin:0 0';
    const title='GDP 2025 한글 기온 편차', wait=()=>new Promise(r=>setTimeout(r,100));
    async function verify(){
      let cleanup;
      for (const stylePreset of ['', 'bars', '']) {
        for(const [zoom,bake] of [[0.5,0.5],[1.4,1],[2,2]]) {
          cleanup?.(); stage.style.transform='scale('+zoom/bake+')'; host.style.transform='scale('+bake+')';
          cleanup=renderChartDom(host,{chartType:'bar',title,stylePreset},undefined,'chart'); await wait();
          const child=host.firstElementChild, box=child.getBoundingClientRect();
          if (Math.abs(box.width-480*zoom)>0.1 || Math.abs(box.height-340*zoom)>0.1 || !child.textContent.includes(title)) throw Error('Layout or title at zoom '+zoom+' / '+stylePreset);
          const label=child.querySelector('[data-chart-field=title]');
          const family=getComputedStyle(label).fontFamily;
          for (const weight of [400, 700]) {
            const faces=await document.fonts.load(weight+' 16px "CMU Serif"','GDP 2025');
            if (!faces.some(f=>f.status==='loaded')) throw Error('Bundled CMU Serif failed to load: '+weight);
          }
          if (!family.startsWith('"CMU Serif", Pretendard') || (stylePreset && label.getComputedTextLength()<10)) throw Error('Unexpected mixed-script title font: '+family);
        }
      }
      cleanup(); return 'OK';
    }
    verify().then(result=>document.querySelector('pre').textContent=result).catch(error=>document.querySelector('pre').textContent=error.message);`);
  const result = await build({ configFile:false, logLevel:'silent', define:{'process.env.NODE_ENV':'"production"'}, build:{lib:{entry, formats:['iife'], name:'zoomCheck'}, write:false} });
  await writeFile(join(tmp,'check.js'), (Array.isArray(result) ? result[0] : result).output[0].code);
  await writeFile(join(tmp,'index.html'), '<!doctype html><meta charset="utf-8"><pre>waiting</pre><script>onerror=(m)=>document.querySelector("pre").textContent=m</script><script src="check.js"></script>');
  const html = execFileSync(chrome, ['--headless','--disable-gpu','--no-first-run','--disable-background-networking','--user-data-dir='+join(tmp,'profile'),'--virtual-time-budget=8000','--dump-dom','file://'+join(tmp,'index.html')], {encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:20000});
  assert.equal(html.match(/<pre>(.*?)<\/pre>/s)?.[1], 'OK');
  console.log('Chrome: interactive → print → interactive; Korean title and zoom 50%, 140%, 200% passed.');
} finally { await rm(tmp, {recursive:true,force:true}); }
