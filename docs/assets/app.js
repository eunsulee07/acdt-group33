(() => {
  'use strict';
  const D=globalThis.Group33Data,S=globalThis.Group33Stats;
  const $=id=>document.getElementById(id);
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fixed=(v,d=2)=>v===null||v===undefined||!Number.isFinite(v)?'—':v.toFixed(d);
  const pct=(v,d=2)=>v===null||v===undefined?'—':fixed(v*100,d)+'%';
  const superscript=s=>String(s).split('').map(c=>({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻','+':'⁺'}[c]||c)).join('');
  const pval=v=>v===null||v===undefined?'—':v===0?'< 1 × 10⁻³⁰⁰':v<.001?(()=>{const [a,b]=v.toExponential(2).split('e');return a+' × 10'+superscript(b);})():fixed(v,3);
  const signed=v=>(v>=0?'+':'−')+fixed(Math.abs(v));
  const interval=(lo,hi)=>lo===null||hi===null?'Unavailable':fixed(lo)+' to '+fixed(hi);
  const labels={school:'School',sex:'Recorded sex',age:'Age',address:'Home location',famsize:'Family size',Pstatus:'Parent cohabitation',Medu:'Mother’s education',Fedu:'Father’s education',Mjob:'Mother’s job',Fjob:'Father’s job',reason:'School choice reason',guardian:'Guardian',traveltime:'Travel time',studytime:'Weekly study time',failures:'Past class failures',schoolsup:'Extra school support',famsup:'Family educational support',paid:'Paid extra classes',activities:'Extracurricular activities',nursery:'Nursery attendance',higher:'Plans for higher education',internet:'Internet access',romantic:'Romantic relationship',famrel:'Family relationship quality',freetime:'Free time',goout:'Going out with friends',Dalc:'Weekday alcohol use',Walc:'Weekend alcohol use',health:'Self-reported health',absences:'Absences'};
  const ranges={1:'<2 h/week',2:'2–5 h/week',3:'5–10 h/week',4:'>10 h/week'};
  const levelName=(x,level)=>x==='studytime'?`Code ${level} · ${ranges[level]}`:x==='failures'?`Past-failure code ${level}`:level==='yes'?'Support: yes':'Support: no';
  const shortLevel=(x,l)=>x==='studytime'?ranges[l]:x==='failures'?`Code ${l}`:l==='yes'?'Yes':'No';
  const originalIds=new Map(D.rows.map((r,i)=>[r,i+1]));
  const defaults={predictor:'studytime',encoding:'categorical',school:'all',sex:'all',support:'all',zeros:'include',confidence:'.95'};
  const filterIds=Object.keys(defaults);
  let state={filters:{...defaults},rows:[],model:null,ranking:[],map:'a'},uid=0,previousPredictor=null;
  const width=(id,fallback=640)=>Math.max(320,$(id).clientWidth||fallback);
  function svg(w,h,title,content){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="svg-title-${++uid}"><title id="svg-title-${uid}">${e(title)}</title>${content}</svg>`;}
  function table(headers,rows,caption='') {return `<table>${caption?`<caption>${e(caption)}</caption>`:''}<thead><tr>${headers.map((h,i)=>`<th${i?' class="num"':''} scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<td${i?' class="num"':''}>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
  const tip=s=>`data-tip="${e(s)}"`;
  function readFilters(){return Object.fromEntries(filterIds.map(id=>[id,$(id).value]));}
  function metric(label,value,caption){return `<article class="metric"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(caption)}</small></article>`;}
  function update(){
    state.filters=readFilters();state.rows=S.filter(D.rows,state.filters);
    state.model=S.fit(state.rows,state.filters.predictor,state.filters.encoding,Number(state.filters.confidence));
    state.ranking=S.rank(state.rows,D.predictors);
    $('tooltip').hidden=true;
    const m=state.model,f=state.filters,zero=state.rows.filter(r=>r.G3===0).length;
    const selected=[f.school==='all'?'both schools':f.school,f.sex==='all'?'all recorded sexes':f.sex==='F'?'female':'male',f.support==='all'?'both support groups':`family support: ${f.support}`,f.zeros==='exclude'?'positive grades only':`${zero} zero grades retained`];
    $('sample-status').textContent=`${m.n} of ${D.rows.length} original students · ${selected.join(' · ')}`;
    $('metrics').innerHTML=metric('Students',String(m.n),'Current selected sample')+metric('R²',pct(m.r2),'In-sample explained variation')+metric('Overall test p',pval(m.p),m.valid?`F(${m.q}, ${m.df}) · α = 0.05`:'Model cannot be tested')+metric('RMSE',fixed(m.rmse),'In-sample error · grade points');
    renderGrades();renderTest();renderGroups();setPairs();renderContrast();renderRanking();renderMyth();
    previousPredictor=f.predictor;
  }
  function renderGrades(){
    const m=state.model,f=state.filters,x=f.predictor;
    $('chart-title').textContent=`${labels[x]} and final Portuguese grade`;
    $('chart-subtitle').textContent=x==='studytime'?'Recorded categories represent unequal hour ranges; no exact study hours are observed.':x==='failures'?'Past failures precede the final grade; they remain a prior outcome, not a proven cause.':'Yes/no family educational support; this item does not measure all aspects of family context.';
    if(!m.n){$('grade-chart').innerHTML='<div class="empty">No student records match these filters.</div>';return;}
    const w=width('grade-chart'),h=345,left=38,right=15,top=18,bottom=62;
    const levels=m.groups.map(g=>g.level), plotW=w-left-right;
    const positions=levels.map((l,i)=>left+plotW*(i+.5)/levels.length);
    let low=Math.min(0,...m.groups.map(g=>g.low??0)),high=Math.max(20,...m.groups.map(g=>g.high??20));
    low=Math.min(0,Math.floor(low/5)*5);high=Math.max(20,Math.ceil(high/5)*5);
    const y=v=>top+(high-v)/(high-low)*(h-top-bottom);
    let c='';for(let v=low;v<=high;v+=5)c+=`<line x1="${left}" x2="${w-right}" y1="${y(v)}" y2="${y(v)}" stroke="#e5ebf3"/><text class="axis-label" x="${left-9}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
    c+=`<text class="axis-label" x="${left}" y="${h-7}">Final grade G3 · 0–20 scale</text>`;
    const jitter=Math.min(47,plotW/levels.length*.34);
    state.rows.forEach(r=>{
      const i=levels.indexOf(r[x]),id=originalIds.get(r),offset=(((id*2654435761)>>>0)%1000/999-.5)*2*jitter;
      const info=`Original row ${id}\n${levelName(x,r[x])}\nFinal grade: ${r.G3} / 20\nSchool: ${r.school} · Sex: ${r.sex} · Family support: ${r.famsup}`;
      c+=`<circle class="dot" cx="${positions[i]+offset}" cy="${y(r.G3)}" r="2.8" ${tip(info)}/>`;
    });
    if(m.valid&&m.encoding==='numeric'){
      const order=levels.map((l,i)=>({l,i,code:l==='no'?0:l==='yes'?1:Number(l)})).sort((a,b)=>a.code-b.code);
      c+=`<path d="${order.map((o,i)=>`${i?'L':'M'}${positions[o.i]},${y(S.fittedMean(m,o.l))}`).join(' ')}" fill="none" stroke="#be642c" stroke-width="2.5"/>`;
    }
    m.groups.forEach((g,i)=>{
      const px=positions[i],info=`${levelName(x,g.level)}\nn = ${g.n} · Mean = ${fixed(g.mean)}\n${Math.round(m.confidence*100)}% CI: ${interval(g.low,g.high)}${m.valid?`\nFitted grade = ${fixed(S.fittedMean(m,g.level))}`:''}`;
      c+=`<g class="mean-point" tabindex="0" role="img" aria-label="${e(info.replace(/\n/g,', '))}" ${tip(info)}>`;
      if(g.low!==null)c+=`<path d="M${px},${y(g.low)}V${y(g.high)}M${px-7},${y(g.low)}H${px+7}M${px-7},${y(g.high)}H${px+7}" stroke="#1763c6" stroke-width="2" fill="none"/>`;
      if(m.valid&&m.encoding==='categorical')c+=`<line x1="${px-14}" x2="${px+14}" y1="${y(g.mean)}" y2="${y(g.mean)}" stroke="#be642c" stroke-width="2.5"/>`;
      c+=`<circle cx="${px}" cy="${y(g.mean)}" r="5" fill="#1763c6" stroke="white" stroke-width="1.5"/></g>`;
      const tickLabel=x==='studytime'&&w<500?ranges[g.level].replace(' h/week',' h'):shortLevel(x,g.level);
      c+=`<text class="group-label" x="${px}" y="${h-bottom+22}" text-anchor="middle">${e(tickLabel)}</text><text class="axis-label" x="${px}" y="${h-bottom+40}" text-anchor="middle">n = ${g.n}</text>`;
    });
    $('grade-chart').innerHTML=svg(w,h,`${labels[x]}: individual grades and ${Math.round(m.confidence*100)}% group-mean confidence intervals`,c);
  }
  function renderTest(){
    const m=state.model,x=state.filters.predictor,conf=Math.round(m.confidence*100);
    $('test-title').textContent=m.encoding==='numeric'?'Is the numeric slope different from zero?':'Do the observed category means differ?';
    $('decision').className='decision'+(!m.valid||m.p>=.05?' uncertain':'');
    $('decision').innerHTML=m.valid?(m.p<.05?'<strong>Reject H₀ at α = 0.05</strong><span>Evidence of an association in this selected sample.</span>':'<strong>Do not reject H₀ at α = 0.05</strong><span>This is not proof that the relationship is zero.</span>'):`<strong>Test unavailable</strong><span>${e(m.reason)}</span>`;
    const rows=[['Null hypothesis',m.encoding==='numeric'?'β₁ = 0':'All observed group means equal'],['F statistic',m.valid?`${fixed(m.F,3)} · df ${m.q}, ${m.df}`:'—'],['Test p-value',pval(m.p)],['Adjusted R²',pct(m.adjustedR2)],['Confidence level',`${conf}% (test α stays 0.05)`]];
    $('test-details').innerHTML=rows.map(([a,b])=>`<div class="test-row"><span>${e(a)}</span><strong>${e(b)}</strong></div>`).join('');
    if(!m.valid)$('equation').textContent='The selected regression is not estimable.';
    else if(m.encoding==='numeric')$('equation').textContent=`G3 = ${fixed(m.intercept,3)} ${signed(m.slope)} × ${x==='famsup'?'support (yes = 1, no = 0)':x+' code'}`;
    else $('equation').textContent=`G3 = ${fixed(m.groups[0].mean,3)}${m.groups.slice(1).map(g=>` ${signed(g.mean-m.groups[0].mean)} × I(${x} = ${g.level})`).join('')}`;
    $('inference-note').textContent=m.encoding==='numeric'?`${x==='studytime'?'A studytime-code step is not an extra hour. ':x==='famsup'?'Support is coded yes = 1, no = 0. ':''}One-predictor OLS does not control other student characteristics. A significant slope need not predict individual grades well.`:'This is one categorical predictor with indicator coefficients. It is not a multiple-confounder model. The overall F test uses ordinary OLS assumptions; subgroup filters are descriptive.';
  }
  function renderGroups(){
    const m=state.model,x=state.filters.predictor;
    $('group-title').textContent=`Observed group means · ${Math.round(m.confidence*100)}% CIs`;
    $('group-table').innerHTML=m.n?table(['Recorded category','n','Mean G3',`${Math.round(m.confidence*100)}% CI`],m.groups.map(g=>[shortLevel(x,g.level),g.n,fixed(g.mean),interval(g.low,g.high)])):'<p class="small">No groups available.</p>';
  }
  function setPairs(){
    const m=state.model,x=state.filters.predictor,changed=x!==previousPredictor;
    for(const id of ['reference','comparison']){
      const old=$(id).value;$(id).innerHTML=m.groups.map(g=>`<option value="${e(g.level)}">${e(levelName(x,g.level))}</option>`).join('');
      const selected=!changed&&m.groups.some(g=>String(g.level)===old)?old:id==='reference'?m.groups[0]?.level:m.groups[m.groups.length-1]?.level;
      if(selected!==undefined)$(id).value=String(selected);$(id).disabled=m.groups.length<2;
    }
  }
  function renderContrast(){
    const m=state.model,x=state.filters.predictor,c=S.contrast(m,$('reference').value,$('comparison').value);
    if(!c){$('contrast-chart').innerHTML='<div class="empty" style="min-height:100px">A comparison needs an estimable model and two categories.</div>';$('contrast-result').textContent='Comparison unavailable.';$('contrast-note').textContent=m.reason||'';return;}
    const w=width('contrast-chart',460),h=126,left=30,right=25,edge=Math.max(1,Math.abs(c.low),Math.abs(c.high))*1.2;
    const cx=v=>left+(v+edge)/(2*edge)*(w-left-right),y=45;
    let b=`<line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}" stroke="#dbe3ed"/><line x1="${cx(0)}" x2="${cx(0)}" y1="15" y2="78" stroke="#7d8ea5" stroke-dasharray="4 4"/>`;
    for(const t of [-edge,0,edge])b+=`<text class="axis-label" x="${cx(t)}" y="99" text-anchor="middle">${fixed(t,1)}</text>`;
    const info=`Estimated difference: ${signed(c.estimate)} grade points\n${Math.round(m.confidence*100)}% CI: ${interval(c.low,c.high)}\nTwo-sided p = ${pval(c.p)}`;
    b+=`<g tabindex="0" role="img" aria-label="${e(info.replace(/\n/g,', '))}" ${tip(info)}><path d="M${cx(c.low)},${y}H${cx(c.high)}M${cx(c.low)},${y-7}V${y+7}M${cx(c.high)},${y-7}V${y+7}" stroke="#1763c6" stroke-width="3" fill="none"/><circle cx="${cx(c.estimate)}" cy="${y}" r="6" fill="#1763c6" stroke="white" stroke-width="2"/></g><text class="axis-label" x="${left}" y="122">Difference in final-grade points · zero means equal</text>`;
    $('contrast-chart').innerHTML=svg(w,h,'Confidence interval for the selected category contrast',b);
    $('contrast-result').textContent=`${signed(c.estimate)} points · ${Math.round(m.confidence*100)}% CI ${interval(c.low,c.high)}`;
    $('contrast-note').textContent=`${shortLevel(x,c.comparison)} minus ${shortLevel(x,c.reference)}. ${m.encoding==='numeric'?'This is the numeric-code model’s fitted difference, with the slope’s OLS uncertainty.':'This interval uses pooled OLS residual variance.'} Pairwise p = ${pval(c.p)}; exploratory and not adjusted for multiple comparisons.`;
  }
  function barChart(id,items,{title,valueLabel,ml=false}={}){
    const w=width(id,780),rowH=38,h=items.length*rowH+28,left=w<480?132:205,right=55,max=Math.max(.01,...items.map(r=>Math.max(0,r.value??0)))*1.12;
    const plotW=Math.max(70,w-left-right);let c='';
    items.forEach((r,i)=>{
      const y=10+i*rowH,bw=Math.max(0,r.value??0)/max*plotW;
      const color=r.predictor===state.filters.predictor&&!ml?'#1763c6':r.predictor==='failures'?'#be642c':'#9eafc7';
      const label=labels[r.predictor]||r.predictor;
      const short=w<480&&label.length>20?`${label.slice(0,18)}…`:label;
      const info=`${label}\n${r.value===null?'Not estimable':`${valueLabel}: ${ml?fixed(r.value*100)+' percentage points':pct(r.value)}`}\n${ml?`Fold SD: ${fixed(r.fold_sd*100)} percentage points`:`Overall p: ${pval(r.p)} · ${r.encoding} coding · predictor df: ${r.df??'—'}`}`;
      c+=`<g tabindex="0" role="img" aria-label="${e(info.replace(/\n/g,', '))}" ${tip(info)}><text class="bar-label" x="${left-12}" y="${y+19}" text-anchor="end">${e(short)}</text><rect x="${left}" y="${y+2}" width="${plotW}" height="25" rx="4" fill="#f1f5fa"/><rect x="${left}" y="${y+2}" width="${bw}" height="25" rx="4" fill="${color}"/><text class="bar-value" x="${left+bw+7}" y="${y+19}">${r.value===null?'—':ml?fixed(r.value*100):pct(r.value)}</text></g>`;
    });
    c+=`<text class="axis-label" x="${left}" y="${h-1}">${e(ml?'Held-out R² drop · percentage points':'In-sample R² · separate one-predictor models')}</text>`;
    $(id).innerHTML=svg(w,h,title,c);
  }
  function renderRanking(){
    const items=state.ranking.slice(0,Number($('rank-count').value));
    barChart('ranking-chart',items.map(r=>({...r,value:r.r2})),{title:'Standalone predictor ranking for the selected students',valueLabel:'R²'});
    $('ranking-table').innerHTML=table(['Predictor','Coding','df','R²','Overall p'],state.ranking.map(r=>[labels[r.predictor],r.encoding,r.df??'—',pct(r.r2),pval(r.p)]),'All 30 screened predictors; unadjusted p-values');
  }
  function varianceVisual(r2){return r2===null?'<p class="small">R² is undefined for this selection.</p>':`<div class="variance-track" aria-label="${e(pct(r2))} of grade variation explained"><span class="explained" style="width:${r2*100}%"></span><span class="remaining" style="width:${(1-r2)*100}%"></span></div><div class="variance-labels"><span><strong>${pct(r2)}</strong> explained</span><span>${pct(1-r2)} remaining</span></div>`;}
  function renderMyth(){
    const chosen=$('myth').value,x=chosen==='failure'?'failures':chosen==='support'?'famsup':'studytime',m=S.fit(state.rows,x,'categorical',Number(state.filters.confidence));
    const claims={hours:['More study time guarantees better grades.','The claim assumes exact study hours are known and that time alone determines the result.'],failure:['Past failures determine a student’s future.','The claim turns an association with a prior outcome into a permanent label of ability.'],support:['A non-significant variable does not matter.','The claim treats a p-value above 0.05 as proof of no relationship or no policy relevance.'],prediction:['A significant result means accurate predictions.','The claim confuses evidence of an average difference with precision for a new student.']};
    $('myth-claim').textContent=claims[chosen][0];$('myth-assumption').textContent=claims[chosen][1];
    let verdict,evidence,implication;
    if(!m.valid){verdict='This selection cannot test the claim.';evidence=`n = ${m.n}. ${m.reason}`;implication='Reset the filters or select a sample with variation before interpreting a regression.';}
    else if(chosen==='hours'){
      verdict='An average association is not a guarantee.';
      evidence=`Among ${m.n} selected students, study-time categories explain ${pct(m.r2)} of grade variation (p = ${pval(m.p)}). Individual grades overlap; the recorded hour ranges do not reveal exact hours.`;
      implication=(m.p<.05?'There is evidence of average differences across the selected study-time groups. ':'These selected data do not provide clear evidence of different study-time group means. ')+'Increasing study hours is not an estimated causal intervention.';
    }else if(chosen==='failure'){
      verdict='Student history is a signal, not destiny.';
      evidence=`Past-failure categories explain ${pct(m.r2)} of grade variation in the selected sample. ${pct(1-m.r2)} remains outside this model, and students within each category differ.`;
      implication='Use this information to offer help and understand context. A prior outcome cannot by itself identify what caused the final grade.';
    }else if(chosen==='support'){
      const c=S.contrast(m,'no','yes');
      verdict=m.p<.05?'This subgroup shows evidence of a difference.':'No detected difference does not mean no value.';
      evidence=`Family support has R² = ${pct(m.r2)}, p = ${pval(m.p)}${c?`, and a yes-minus-no difference of ${signed(c.estimate)} points (${Math.round(m.confidence*100)}% CI ${interval(c.low,c.high)})`:''}. This yes/no item captures only part of family context.`;
      implication='Measurement quality, sampling uncertainty and other student characteristics matter. A p-value alone is not a reason to remove support from policy.';
    }else{
      verdict='Significance and prediction answer different questions.';
      evidence=`The selected study-time model has p = ${pval(m.p)}, but in-sample R² = ${pct(m.r2)} and RMSE = ${fixed(m.rmse)} points. Separately, full-sample five-fold validation gives R² = ${pct(D.reference.cv_study.r2)} and RMSE = ${fixed(D.reference.cv_study.rmse)}.`;
      implication='The validation numbers are a fixed reference for all 649 students; they are not newly trained estimates for the selected subgroup.';
    }
    $('myth-verdict').textContent=verdict;$('myth-evidence').textContent=evidence;$('myth-implication').textContent=implication;$('myth-visual').innerHTML=varianceVisual(m.r2);
  }
  function renderMaps(){
    const R=D.reference;let c='';
    const nodes=[{key:'study',label:'Weekly study time',sub:'4 recorded categories',y:30},{key:'failures',label:'Past class failures',sub:'Prior-outcome categories',y:158},{key:'famsup',label:'Family educational support',sub:'Yes / no',y:286}];
    nodes.forEach(o=>{
      const m=R[o.key],color=o.key==='failures'?'#be642c':'#1763c6';
      c+=`<path d="M255,${o.y+37}H355L560,199" fill="none" stroke="${m.p<.05?color:'#9aabc2'}" stroke-width="${o.key==='failures'?3:2}" ${m.p>=.05?'stroke-dasharray="6 5"':''}/><rect x="20" y="${o.y}" width="235" height="74" rx="10" fill="${o.key==='failures'?'#fff4e9':'#edf5ff'}" stroke="#dbe3ed"/><text class="map-label" x="37" y="${o.y+29}">${e(o.label)}</text><text class="map-small" x="37" y="${o.y+51}">${e(o.sub)}</text><rect x="280" y="${o.y+9}" width="204" height="47" rx="6" fill="white"/><text class="map-label" x="295" y="${o.y+28}">R² ${pct(m.r2)}</text><text class="map-small" x="295" y="${o.y+46}">p = ${e(pval(m.p))}</text>`;
    });
    c+=`<rect x="560" y="148" width="220" height="102" rx="12" fill="#11233d"/><text x="580" y="180" fill="white" font-size="14" font-weight="650">Final Portuguese grade</text><text x="580" y="205" fill="#bfd0e7" font-size="12">G3 · 0–20 scale</text><text x="580" y="228" fill="#bfd0e7" font-size="11">Original sample · n = 649</text>`;
    $('map-a-chart').innerHTML=svg(810,390,'Map A: undirected statistical associations with final Portuguese grade',c);
    c='<defs><marker id="arrow-theory" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#8093af"/></marker></defs>';
    const edge=(d)=>`<path d="${d}" stroke="#8093af" stroke-width="2" stroke-dasharray="5 5" fill="none" marker-end="url(#arrow-theory)"/>`;
    c+=edge('M140,91V173')+edge('M331,53H615V173')+edge('M220,204H294')+edge('M475,204H539')+edge('M331,76H501V335H467');
    const node=(x,y,w,h,t,s,hidden=false)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${hidden?'#fff4e9':'#edf5ff'}" stroke="${hidden?'#d9a47e':'#b8cce6'}" ${hidden?'stroke-dasharray="5 4"':''}/><text class="map-label" x="${x+15}" y="${y+25}">${e(t)}</text><text class="map-small" x="${x+15}" y="${y+46}">${e(s)}</text>`;
    c+=node(30,20,301,71,'Candidate common causes','Prior mastery · motivation · resources',true)+node(40,174,180,61,'Weekly study time','Recorded in four ranges')+node(295,174,180,61,'Learning gained','Unobserved mediator',true)+node(540,174,160,61,'Final grade G3','Observed outcome')+node(270,302,197,61,'Past class failures','Observed prior outcome');
    c+='<text class="map-small" x="45" y="141">May affect both X and Y</text><text class="map-small" x="291" y="270">Hypothesized pathway; no causal estimates</text>';
    $('map-b-chart').innerHTML=svg(730,390,'Map B: hypothesized common causes, mediator and outcomes; dashed arrows are not proven causal effects',c);
    const base=1-R.cv_study.baseline_rmse**2/(R.g3_sd**2*(R.n-1)/R.n);
    $('cv-table').innerHTML=table(['Model','Held-out R²','RMSE (points)'],[['Training-fold mean baseline',pct(base),fixed(R.cv_study.baseline_rmse)],['Study-time categorical regression',pct(R.cv_study.r2),fixed(R.cv_study.rmse)],['Past-failure categorical regression',pct(R.cv_failures.r2),fixed(R.cv_failures.rmse)],['Random forest · 30 predictors',pct(R.ml.r2),fixed(R.ml.rmse)]],'Pooled out-of-fold predictions · same five folds for every model');
    barChart('ml-chart',R.ml.importance.slice(0,8).map(r=>({...r,value:r.mean_drop_r2})),{title:'Held-out grouped permutation importance for the random forest',valueLabel:'Drop in R²',ml:true});
    $('sensitivity-table').innerHTML=table(['Check','n','R² / estimate','Test p'],[['Primary categorical study time',649,pct(R.study.r2),pval(R.study.p)],['Numeric-code study time',649,pct(R.study_numeric.r2),pval(R.study_numeric.p)],['Study time · positive grades only',R.positive_sensitivity.n,pct(R.positive_sensitivity.study_r2),pval(R.positive_sensitivity.study_p)],['Study time · HC3 robust overall test',649,pct(R.study.r2),pval(R.study.hc3_p)],['Study time after measured covariates',649,'Partial F = '+fixed(R.adjusted.studytime_partial_F,3),pval(R.adjusted.studytime_partial_p)]],'Fixed full-sample checks; these rows do not change with Explore filters');
  }
  function selectMap(map,focus=false){
    if(!['a','b','c'].includes(map))throw new Error('Map must be a, b, or c.');
    state.map=map;
    for(const v of ['a','b','c']){const active=v===map;$('map-'+v).hidden=!active;$('map-tab-'+v).setAttribute('aria-selected',String(active));$('map-tab-'+v).tabIndex=active?0:-1;}
    if(map==='c')barChart('ml-chart',D.reference.ml.importance.slice(0,8).map(r=>({...r,value:r.mean_drop_r2})),{title:'Held-out grouped permutation importance for the random forest',valueLabel:'Drop in R²',ml:true});
    if(focus)$('map-tab-'+map).focus();
  }
  function result(){
    const m=state.model;return {filters:{...state.filters},n:m.n,predictor:m.predictor,encoding:m.encoding,confidence:m.confidence,estimable:m.valid,reason:m.reason,r2:m.r2,F:Number.isFinite(m.F)?m.F:null,p:m.p,rmse:m.rmse,groups:m.groups.map(g=>({level:g.level,n:g.n,mean:g.mean,ci:[g.low,g.high]})),contrast:S.contrast(m,$('reference').value,$('comparison').value),active_map:state.map};
  }
  const allowed={predictor:['studytime','failures','famsup'],encoding:['categorical','numeric'],school:['all','GP','MS'],sex:['all','F','M'],support:['all','yes','no'],zeros:['include','exclude'],confidence:['.90','.95','.99']};
  function setFilters(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Filters must be an object.');
    for(const [key,value] of Object.entries(input))if(!allowed[key]||!allowed[key].includes(value))throw new Error(`Invalid filter: ${key}.`);
    for(const [key,value] of Object.entries(input))$(key).value=value;
    update();return result();
  }
  function registerAgentTools(){
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tools=[{name:'get_analysis',title:'Read current student-grade analysis',description:'Read the current visible filters, sample size, one-predictor regression and confidence intervals.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');return result();}},
      {name:'set_analysis_filters',title:'Set student-grade analysis filters',description:'Set one or more visible analysis controls, recalculate the charts and return the updated analysis. Confidence changes intervals; test alpha stays 0.05.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(allowed).map(([k,v])=>[k,{type:'string',enum:v}])),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:setFilters},
      {name:'select_system_map',title:'Open a system map',description:'Open the visible system map tab: a for statistical associations, b for theory, or c for machine learning.',inputSchema:{type:'object',properties:{map:{type:'string',enum:['a','b','c']}},required:['map'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).some(k=>k!=='map'))throw new Error('Only a map field is accepted.');selectMap(input.map);$('maps').scrollIntoView({block:'start',behavior:'instant'});return {active_map:state.map};}}];
    for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
  filterIds.forEach(id=>$(id).addEventListener('change',update));
  function resetAnalysis(){previousPredictor=null;return setFilters(defaults);}
  $('reset').addEventListener('click',resetAnalysis);
  $('reference').addEventListener('change',renderContrast);$('comparison').addEventListener('change',renderContrast);$('rank-count').addEventListener('change',renderRanking);$('myth').addEventListener('change',renderMyth);
  ['a','b','c'].forEach(map=>{
    $('map-tab-'+map).addEventListener('click',()=>selectMap(map));
    $('map-tab-'+map).addEventListener('keydown',event=>{const order=['a','b','c'];let i=order.indexOf(state.map);if(event.key==='ArrowRight')i=(i+1)%3;else if(event.key==='ArrowLeft')i=(i+2)%3;else if(event.key==='Home')i=0;else if(event.key==='End')i=2;else return;event.preventDefault();selectMap(order[i],true);});
  });
  $('analysis-controls').addEventListener('submit',event=>event.preventDefault());
  function showTip(event){
    const t=event.target.closest?.('[data-tip]');if(!t)return;
    const box=$('tooltip');box.textContent=t.getAttribute('data-tip');box.hidden=false;
    const rect=t.getBoundingClientRect(),x=event.clientX??rect.x+rect.width/2,y=event.clientY??rect.y+rect.height;
    const bw=box.offsetWidth||260,bh=box.offsetHeight||120;
    box.style.left=Math.max(8,Math.min(window.innerWidth-bw-8,x+12))+'px';box.style.top=Math.max(8,Math.min(window.innerHeight-bh-8,y+14))+'px';
  }
  document.addEventListener('pointerover',showTip);document.addEventListener('pointermove',showTip);document.addEventListener('focusin',showTip);document.addEventListener('click',showTip);
  document.addEventListener('pointerout',event=>{if(event.target.closest?.('[data-tip]'))$('tooltip').hidden=true;});document.addEventListener('focusout',()=>{$('tooltip').hidden=true;});document.addEventListener('keydown',event=>{if(event.key==='Escape')$('tooltip').hidden=true;});
  let resizePending=false;window.addEventListener('resize',()=>{if(resizePending)return;resizePending=true;requestAnimationFrame(()=>{resizePending=false;renderGrades();renderContrast();renderRanking();if(state.map==='c')selectMap('c');});});
  update();renderMaps();registerAgentTools();
  globalThis.Group33App={read:result,setFilters,selectMap,reset:resetAnalysis};
})();
