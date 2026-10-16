/* Browser-local CSV workspace. No network requests or external dependencies. */
(() => {
  'use strict';
  const S=globalThis.Group33Stats;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>typeof v==='number'?(Number.isFinite(v)?v:null):typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v.trim()))?Number(v.trim()):null;
  const fmt=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'Unavailable';
  const pformat=p=>p===null||p===undefined?'Unavailable':p<.001?'< 0.001':p.toFixed(3);
  function parse(text){
    if(typeof text!=='string'||!text.trim())throw Error('The file is empty.');
    text=text.replace(/^\uFEFF/,'');
    let first='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){first+='""';i++;continue;}quoted=!quoted;}if(!quoted&&(c==='\n'||c==='\r'))break;first+=c;}
    const counts=[',',';','\t'].map(d=>{let q=false,n=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(q&&first[i+1]==='"'){i++;continue;}q=!q;}else if(!q&&first[i]===d)n++;}return [d,n];}).sort((a,b)=>b[1]-a[1]);
    if(!counts[0][1])throw Error('At least two CSV columns are required.');
    const delimiter=counts[0][0],matrix=[];let row=[],field='',inside=false,closed=false;
    function pushRow(){row.push(field);if(row.some(x=>x.trim()!==''))matrix.push(row);row=[];field='';closed=false;}
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(inside){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{inside=false;closed=true;}}else field+=c;continue;}
      if(c==='"'){if(field!==''||closed)throw Error('Invalid quote placement in CSV.');inside=true;}
      else if(c===delimiter){row.push(field);field='';closed=false;}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();if(matrix.length>20001)throw Error('The limit is 20,000 data rows.');}
      else if(closed){if(c!==' '&&c!=='\t')throw Error('Unexpected text after a closing quote.');}
      else field+=c;
    }
    if(inside)throw Error('An opening quote was not closed.');
    if(field!==''||row.length)pushRow();
    if(matrix.length<2)throw Error('The file needs a header and at least one data row.');
    const headers=matrix.shift().map(x=>x.trim());
    if(headers.length>100)throw Error('The limit is 100 columns.');
    if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('Column names must be non-empty and unique.');
    if(matrix.length>20000)throw Error('The limit is 20,000 data rows.');
    if(matrix.some(r=>r.length!==headers.length))throw Error('A data row has a different number of columns from the header.');
    return {headers,rows:matrix.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]]))),delimiter};
  }
  function analyze(rows,x,y,encoding='categorical',confidence=.95){
    if(x===y)throw Error('Choose different columns for X and Y.');
    if(!['numeric','categorical'].includes(encoding))throw Error('Unknown model.');
    if(![.90,.95,.99].includes(confidence))throw Error('Choose 90%, 95% or 99% confidence.');
    const clean=[];let excluded=0;
    for(const r of rows){const yy=num(r[y]),xx=encoding==='numeric'?num(r[x]):r[x]===undefined||r[x]===null||String(r[x]).trim()===''?null:String(r[x]).trim();if(yy===null||xx===null){excluded++;continue;}clean.push({__x:xx,G3:yy});}
    if(clean.length<3)throw Error('At least three complete X/Y rows are needed.');
    let m;
    if(encoding==='categorical'){
      if(new Set(clean.map(r=>r.__x)).size>20)throw Error('More than 20 X categories: use numeric mode if X is a genuine numeric measurement.');
      m=S.fit(clean,'__x','categorical',confidence);
    }else{
      const n=clean.length,xm=S.mean(clean.map(r=>r.__x)),ym=S.mean(clean.map(r=>r.G3));
      let sxx=0,sxy=0,sst=0;for(const r of clean){sxx+=(r.__x-xm)**2;sxy+=(r.__x-xm)*(r.G3-ym);sst+=(r.G3-ym)**2;}
      if(sxx<=1e-12)throw Error('X has no numeric variation.');
      if(sst<=1e-12)throw Error('Y has no variation, so R² and the test are undefined.');
      const slope=sxy/sxx,intercept=ym-slope*xm,df=n-2;
      let sse=0;for(const r of clean)sse+=(r.G3-intercept-slope*r.__x)**2;
      const mse=sse/df,F=mse===0?Infinity:Math.max(0,(sst-sse)/mse),se=Math.sqrt(mse/sxx),error=S.tCritical(confidence,df)*se;
      m={n,valid:true,encoding,confidence,q:1,df,intercept,slope,slopeSE:se,slopeLow:slope-error,slopeHigh:slope+error,r2:Math.max(0,Math.min(1,1-sse/sst)),F,p:S.fP(F,1,df),rmse:Math.sqrt(sse/n),groups:[]};
    }
    if(!m.valid)throw Error(m.reason||'This model is not estimable.');
    if(!Number.isFinite(m.r2)||!Number.isFinite(m.rmse)||(encoding==='numeric'&&(!Number.isFinite(m.slope)||!Number.isFinite(m.intercept))))throw Error('Values exceed the numerical range. Check units and rescale the data.');
    return {x,y,encoding,confidence,input_rows:rows.length,included:clean.length,excluded,model:m,points:clean};
  }
  const API={parse,analyze};globalThis.Group33CSV=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);let dataset=null,last=null;
  function chart(a){
    const m=a.model,w=800,h=300,left=65,right=30,top=25,bottom=55;
    let ys=a.points.map(r=>r.G3),lo=Math.min(...ys),hi=Math.max(...ys),c='';
    if(a.encoding==='categorical'){lo=Math.min(lo,...m.groups.map(g=>g.low??lo));hi=Math.max(hi,...m.groups.map(g=>g.high??hi));}
    const pad=Math.max(1,(hi-lo)*.12);lo-=pad;hi+=pad;
    const yy=v=>top+(hi-v)/(hi-lo)*(h-top-bottom);
    for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;c+=`<line x1="${left}" x2="${w-right}" y1="${yy(v)}" y2="${yy(v)}" stroke="#e5ebf3"/><text x="${left-10}" y="${yy(v)+4}" text-anchor="end" fill="#65748a" font-size="12">${fmt(v,1)}</text>`;}
    if(a.encoding==='numeric'){
      const xs=a.points.map(r=>r.__x),xmin=Math.min(...xs),xmax=Math.max(...xs),xx=v=>left+(v-xmin)/(xmax-xmin)*(w-left-right);
      a.points.filter((_,i)=>i%Math.max(1,Math.ceil(a.points.length/1200))===0).forEach(r=>c+=`<circle cx="${xx(r.__x)}" cy="${yy(r.G3)}" r="2.5" fill="#8799b2" opacity=".4"/>`);
      c+=`<path d="M${xx(xmin)},${yy(m.intercept+m.slope*xmin)}L${xx(xmax)},${yy(m.intercept+m.slope*xmax)}" stroke="#be642c" stroke-width="3"/>`;
      for(let i=0;i<=4;i++){const v=xmin+(xmax-xmin)*i/4;c+=`<text x="${xx(v)}" y="${h-28}" text-anchor="middle" fill="#65748a" font-size="12">${fmt(v,1)}</text>`;}
    }else{
      m.groups.forEach((g,i)=>{const xx=left+(w-left-right)*(i+.5)/m.groups.length,short=String(g.level).length>13?String(g.level).slice(0,12)+'…':g.level;c+=`<g tabindex="0"><title>${esc(g.level)}: n=${g.n}, mean=${fmt(g.mean)}, CI=${fmt(g.low)} to ${fmt(g.high)}</title>`;if(g.low!==null)c+=`<path d="M${xx},${yy(g.low)}V${yy(g.high)}M${xx-5},${yy(g.low)}H${xx+5}M${xx-5},${yy(g.high)}H${xx+5}" stroke="#1763c6" stroke-width="2"/>`;c+=`<circle cx="${xx}" cy="${yy(g.mean)}" r="5" fill="#1763c6"/><text x="${xx}" y="${h-28}" text-anchor="middle" fill="#263750" font-size="11">${esc(short)}</text></g>`;});
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(a.x)} and ${esc(a.y)}"><text x="${left}" y="15" fill="#65748a" font-size="12">Y: ${esc(a.y)}</text>${c}<text x="${w/2}" y="${h-5}" text-anchor="middle" fill="#65748a" font-size="12">X: ${esc(a.x)}</text></svg>`;
  }
  function report(a){
    const m=a.model,conf=Math.round(a.confidence*100);
    const equation=a.encoding==='numeric'?`${esc(a.y)} = ${fmt(m.intercept,3)} ${m.slope>=0?'+':'−'} ${fmt(Math.abs(m.slope),3)} × ${esc(a.x)}`:'Category model: fitted values are the observed category means.';
    const extra=a.encoding==='numeric'?`<p>${conf}% slope CI: ${fmt(m.slopeLow,3)} to ${fmt(m.slopeHigh,3)} per recorded X unit.</p>`:`<div class="table-wrap"><table><thead><tr><th>X category</th><th>n</th><th>Mean Y</th><th>${conf}% mean CI</th></tr></thead><tbody>${m.groups.map(g=>`<tr><td>${esc(g.level)}</td><td>${g.n}</td><td>${fmt(g.mean)}</td><td>${g.low===null?'Unavailable (n = 1)':fmt(g.low)+' to '+fmt(g.high)}</td></tr>`).join('')}</tbody></table></div>`;
    return `<div class="lab-metrics"><p><strong>${a.included}</strong> included · ${a.excluded} excluded</p><p><strong>${fmt(m.r2*100)}%</strong> in-sample R²</p><p><strong>${esc(pformat(m.p))}</strong> overall p</p><p><strong>${fmt(m.rmse)}</strong> RMSE in Y units</p></div><p class="model-equation">${equation}</p><div class="chart">${chart(a)}</div>${extra}<p class="small">${m.p<.05?'Reject':'Do not reject'} H₀ at α = 0.05. This is an exploratory association. ${a.encoding==='numeric'?'H₀: slope = 0.':'H₀: all category means are equal. Group intervals use separate group variances; the omnibus test uses pooled OLS variance.'} No causal or out-of-sample claim follows.</p>`;
  }
  function run(){
    if(!dataset)return;
    try{last=analyze(dataset.rows,$('csv-x').value,$('csv-y').value,$('csv-model').value,Number($('csv-confidence').value));last.dataset=dataset.name;last.sha256=dataset.hash||null;$('csv-result').innerHTML=report(last);$('csv-export').disabled=false;}
    catch(err){last=null;$('csv-result').innerHTML=`<p class="lab-error" role="alert">${esc(err.message)}</p>`;$('csv-export').disabled=true;}
  }
  function load(data,name,hash=null){
    dataset={...data,name,hash};
    for(const id of ['csv-x','csv-y']){$(id).innerHTML=data.headers.map(h=>`<option value="${esc(h)}">${esc(h)}</option>`).join('');$(id).disabled=false;}
    const y=data.headers.includes('G3')?'G3':data.headers.find(h=>data.rows.every(r=>String(r[h]).trim()===''||num(r[h])!==null))||data.headers[data.headers.length-1];
    const x=data.headers.includes('studytime')?'studytime':data.headers.find(h=>h!==y);
    $('csv-x').value=x;$('csv-y').value=y;
    const values=data.rows.map(r=>r[x]).filter(v=>String(v).trim()!=='');
    $('csv-model').value=new Set(values).size>20&&values.every(v=>num(v)!==null)?'numeric':'categorical';
    $('csv-status').textContent=`${name} · ${data.rows.length} rows · ${data.headers.length} columns · ${hash?'SHA-256 '+hash:'browser-local data'} · original research above remains unchanged`;
    run();
  }
  function example(){const rows=globalThis.Group33Data.rows;load({headers:Object.keys(rows[0]),rows},'student-por.csv (original embedded records)',globalThis.Group33Data.reference.sha256);return last;}
  $('csv-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    dataset=null;last=null;$('csv-export').disabled=true;
    try{if(file.size>2*1024*1024)throw Error('The file limit is 2 MiB.');const text=await file.text(),data=parse(text);let hash=null;if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}load(data,file.name,hash);}
    catch(err){$('csv-status').textContent='File not loaded.';$('csv-result').innerHTML=`<p class="lab-error" role="alert">${esc(err.message)}</p>`;for(const id of ['csv-x','csv-y'])$(id).disabled=true;}
  });
  for(const id of ['csv-x','csv-y','csv-model','csv-confidence'])$(id).addEventListener('change',run);
  $('csv-example').addEventListener('click',example);
  $('csv-export').addEventListener('click',()=>{if(!last)return;const out={dataset:last.dataset,sha256:last.sha256,x:last.x,y:last.y,encoding:last.encoding,confidence:last.confidence,input_rows:last.input_rows,included:last.included,excluded:last.excluded,model:last.model,scope:'Exploratory one-predictor in-sample association; no causal claim'};const url=URL.createObjectURL(new Blob([JSON.stringify(out,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?null:v,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='analysis-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  Object.assign(API,{example,render:report,getResult:()=>last});
})();
