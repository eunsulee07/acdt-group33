/* Transparent one-predictor OLS calculations. No external dependencies. */
(() => {
  'use strict';
  const sum = a => a.reduce((s,x)=>s+x,0);
  const mean = a => a.length ? sum(a)/a.length : null;
  const clamp = x => Math.max(0,Math.min(1,x));
  function logGamma(z) {
    const p=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
    if(z<.5) return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
    z-=1; let x=.99999999999980993;
    p.forEach((v,i)=>x+=v/(z+i+1));
    const t=z+p.length-.5;
    return .9189385332046727+(z+.5)*Math.log(t)-t+Math.log(x);
  }
  function betaFraction(a,b,x) {
    const tiny=1e-300, qab=a+b, qap=a+1, qam=a-1;
    let c=1,d=1-qab*x/qap;if(Math.abs(d)<tiny)d=tiny;d=1/d;let h=d;
    for(let m=1;m<=400;m++) {
      let aa=m*(b-m)*x/((qam+2*m)*(a+2*m));
      d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;h*=d*c;
      aa=-(a+m)*(qab+m)*x/((a+2*m)*(qap+2*m));
      d=1+aa*d;if(Math.abs(d)<tiny)d=tiny;c=1+aa/c;if(Math.abs(c)<tiny)c=tiny;d=1/d;
      const delta=d*c;h*=delta;if(Math.abs(delta-1)<3e-14)break;
    }
    return h;
  }
  function betaI(x,a,b) {
    if(x<=0)return 0;if(x>=1)return 1;
    const bt=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
    return clamp(x<(a+1)/(a+b+2)?bt*betaFraction(a,b,x)/a:1-bt*betaFraction(b,a,1-x)/b);
  }
  function tP(t,df) {return df>0 ? betaI(df/(df+t*t),df/2,.5):null;}
  function fP(f,d1,d2) {return d1>0&&d2>0 ? betaI(d2/(d2+d1*Math.max(0,f)),d2/2,d1/2):null;}
  function tCritical(confidence,df) {
    if(df<=0)return null;
    let lo=0,hi=1;while(tP(hi,df)>1-confidence&&hi<1e12)hi*=2;
    for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(tP(mid,df)>1-confidence)lo=mid;else hi=mid;}
    return (lo+hi)/2;
  }
  function order(a,b) {return typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b));}
  function code(value) {return value==='yes'?1:value==='no'?0:Number(value);}
  function group(rows,predictor,confidence=.95) {
    const levels=[...new Set(rows.map(r=>r[predictor]))].sort(order);
    return levels.map(level=>{
      const y=rows.filter(r=>r[predictor]===level).map(r=>r.G3),n=y.length,m=mean(y);
      const sse=sum(y.map(v=>(v-m)**2)),sd=n>1?Math.sqrt(sse/(n-1)):null;
      const se=n>1?sd/Math.sqrt(n):null,e=se===null?null:tCritical(confidence,n-1)*se;
      return {level,n,mean:m,sd,se,sse,low:e===null?null:m-e,high:e===null?null:m+e};
    });
  }
  function fit(rows,predictor,encoding='categorical',confidence=.95) {
    const n=rows.length,y=rows.map(r=>r.G3),ym=mean(y),groups=group(rows,predictor,confidence);
    const model={n,predictor,encoding,confidence,groups,mean:ym,valid:false,reason:null,r2:null,F:null,p:null,rmse:null,mse:null};
    if(n<2){model.reason='At least two student records are needed.';return model;}
    const sst=sum(y.map(v=>(v-ym)**2));model.sst=sst;
    if(sst<=1e-12){model.reason='Grades do not vary in this selection; R² and the test are undefined.';return model;}
    let sse,k,intercept,slope,sxx,xm;
    if(encoding==='numeric'){
      const x=rows.map(r=>code(r[predictor]));xm=mean(x);sxx=sum(x.map(v=>(v-xm)**2));
      if(!x.every(Number.isFinite)||sxx<=1e-12){model.reason='The selected predictor has no variation.';return model;}
      slope=sum(x.map((v,i)=>(v-xm)*(y[i]-ym)))/sxx;intercept=ym-slope*xm;k=2;
      sse=sum(x.map((v,i)=>(y[i]-intercept-slope*v)**2));
      Object.assign(model,{slope,intercept,sxx,xm});
    }else{
      if(groups.length<2){model.reason='At least two predictor categories are needed.';return model;}
      k=groups.length;sse=sum(groups.map(g=>g.sse));
      model.intercept=groups[0].mean;
    }
    const df=n-k,q=k-1;Object.assign(model,{k,df,q,sse,r2:clamp(1-sse/sst),rmse:Math.sqrt(sse/n)});
    if(df<=0){model.reason='No residual degrees of freedom remain; confidence intervals and testing are unavailable.';return model;}
    const mse=sse/df,F=mse===0?Infinity:Math.max(0,(sst-sse)/q/mse);
    Object.assign(model,{mse,F,p:fP(F,q,df),valid:true,adjustedR2:1-(sse/df)/(sst/(n-1))});
    if(encoding==='numeric') {
      model.slopeSE=Math.sqrt(mse/sxx);const e=tCritical(confidence,df)*model.slopeSE;
      model.slopeLow=slope-e;model.slopeHigh=slope+e;
    }
    return model;
  }
  function contrast(model,reference,comparison) {
    if(!model.valid)return null;
    const a=model.groups.find(g=>String(g.level)===String(reference)),b=model.groups.find(g=>String(g.level)===String(comparison));
    if(!a||!b)return null;
    const same=a.level===b.level;
    const estimate=model.encoding==='numeric'?model.slope*(code(b.level)-code(a.level)):b.mean-a.mean;
    const se=same?0:model.encoding==='numeric'?model.slopeSE*Math.abs(code(b.level)-code(a.level)):Math.sqrt(model.mse*(1/a.n+1/b.n));
    const error=tCritical(model.confidence,model.df)*se;
    return {reference:a.level,comparison:b.level,estimate,se,low:estimate-error,high:estimate+error,p:same?null:se===0?(estimate===0?1:0):tP(estimate/se,model.df),df:model.df};
  }
  function fittedMean(model,level) {
    if(model.encoding!=='numeric')return model.groups.find(g=>g.level===level)?.mean??null;
    return model.intercept+model.slope*code(level);
  }
  function filter(rows,filters) {
    return rows.filter(r=>(filters.school==='all'||r.school===filters.school)&&(filters.sex==='all'||r.sex===filters.sex)&&(filters.support==='all'||r.famsup===filters.support)&&(filters.zeros!=='exclude'||r.G3>0));
  }
  function rank(rows,predictors) {
    return predictors.map(predictor=>{
      const encoding=['age','absences'].includes(predictor)?'numeric':'categorical';
      const m=fit(rows,predictor,encoding);
      return {predictor,encoding,r2:m.r2,p:m.p,df:m.q,valid:m.valid,reason:m.reason};
    }).sort((a,b)=>(b.r2??-1)-(a.r2??-1));
  }
  const api={logGamma,betaI,tP,fP,tCritical,group,fit,contrast,fittedMean,filter,rank,mean};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  globalThis.Group33Stats=api;
})();
