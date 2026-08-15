
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

function toggleNav(){
  const nav = $('#nav');
  nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
  nav.style.position='absolute'; nav.style.top='78px'; nav.style.left='0'; nav.style.right='0';
  nav.style.padding='20px'; nav.style.background='#fff'; nav.style.flexDirection='column';
  nav.style.borderBottom='1px solid #dce7df';
}
$('#menuBtn')?.addEventListener('click',toggleNav);
$$('nav a').forEach(a=>a.addEventListener('click',()=>{if(innerWidth<901) $('#nav').style.display='none'}));

const form = $('#pqrsForm');
form?.addEventListener('submit',(e)=>{
  e.preventDefault();
  $('#success').style.display='block';
  const data = Object.fromEntries(new FormData(form).entries());
  const items = JSON.parse(localStorage.getItem('jac_pqrs')||'[]');
  data.id='JAC-'+Date.now().toString().slice(-7);
  data.fecha=new Date().toLocaleString('es-CO');
  items.push(data);
  localStorage.setItem('jac_pqrs',JSON.stringify(items));
  $('#radicado').textContent=data.id;
  form.reset();
  window.scrollTo({top:form.offsetTop-100,behavior:'smooth'});
});

$$('[data-download]').forEach(btn=>btn.addEventListener('click',()=>{
  const text = btn.dataset.download;
  const blob = new Blob([text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='documento-jac.txt'; a.click(); URL.revokeObjectURL(url);
}));

function showToast(msg){
 const t=$('#toast'); t.textContent=msg; t.style.display='block';
 setTimeout(()=>t.style.display='none',2600);
}
window.addEventListener('load',()=>console.log('Portal JAC cargado'));
