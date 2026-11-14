var e=`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
<title>Sistema elétrico de potência</title>
<meta name="claude:viewport-fit-sides" content="cover">
<!-- Strategy OS (PO, 13/11/2026): the company name and the internal label were removed (the page goes to the public preview); the portfolio flags were renamed "portfolio".
     Strategy OS (M02): the Google Fonts links of the original page were removed — the app makes no automatic request to third parties (the publication guard
     refuses unknown hosts, and it would send the visitor's address to Google). The page's own fallbacks are used: "Arial Narrow", system-ui, Consolas… -->
<style>
/* Layout: página branca, preto e amarelo da marca; diagrama unifilar com ícones de traço; amarelo = portfólio da empresa e comunicação */
:root{
  --bg:#ffffff; --ink:#111111; --ink2:#333333; --muted:#666666; --faint:#a8a8a8; --rule:#e4e4e4; --soft:#f4f4f2; --soft2:#ececea;
  --brand:#ffdd00; --brand-d:#c9a600;
  --f-display:"Barlow Condensed","Arial Narrow",sans-serif;
  --f-body:"Barlow",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace;
  color-scheme:light;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:16.5px;line-height:1.55;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 56px}
.wrap{max-width:1320px;margin:0 auto}
p{margin:0 0 .9em}
h1,h2,h3,h4{text-wrap:balance}
h2{font:700 clamp(1.9rem,3.2vw,2.5rem)/1.02 var(--f-display);text-transform:uppercase;letter-spacing:.01em;margin:0 0 .45em;display:flex;align-items:center;gap:14px}
h2::before{content:"";width:34px;height:8px;background:var(--brand);flex:none}
h3{font:700 1.45rem/1.1 var(--f-display);margin:0 0 .35em;letter-spacing:.01em}
.kicker{font:600 13px var(--f-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
.mono{font-family:var(--f-mono)}
.muted{color:var(--muted)}
section{padding-block:44px 8px}
.intro{max-width:46em}

/* top strip */
.strip{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--rule);padding-block:14px;font-size:.88rem;color:var(--muted)}
.strip b{font:700 1.05rem var(--f-display);letter-spacing:.08em;text-transform:uppercase;color:var(--ink)}
.strip b i{display:inline-block;width:10px;height:10px;background:var(--brand);margin-right:8px;font-style:normal}

/* hero */
.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:48px;align-items:center;padding-block:40px 8px}
.hero h1{font:700 clamp(3rem,7vw,5.2rem)/.9 var(--f-display);text-transform:uppercase;margin:.1em 0 .32em;letter-spacing:-.005em}
.hero h1 span{background:linear-gradient(transparent 62%,var(--brand) 62%,var(--brand) 92%,transparent 92%);padding:0 .06em}
.hero .lede{font-size:1.18rem;max-width:34em}
.hero .why{color:var(--ink2);max-width:36em;font-size:1rem}
.hero figure{margin:0;border:1px solid var(--rule);border-radius:4px;padding:18px 18px 12px;background:var(--bg)}
.hero figcaption{font-size:.88rem;color:var(--muted);margin-top:6px}
.stair{display:block;width:100%;height:auto}
@media (max-width:900px){.hero{grid-template-columns:1fr;gap:22px;padding-block:24px 8px}}

/* toolbar */
.toolbar{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;margin:16px 0 12px}
.tour{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
.tour-pos{font-size:.98rem;padding:0 4px}
.tour-pos b{font-weight:700}
.hint{font-size:.92rem;color:var(--muted)}
.btn{font:600 14px var(--f-body);padding:9px 16px;border-radius:2px;border:1.5px solid var(--ink);background:var(--bg);color:var(--ink);cursor:pointer;line-height:1.2;letter-spacing:.02em}
.btn:hover{background:var(--soft)}
.btn.primary{background:var(--brand);border-color:var(--brand);color:var(--ink)}
.btn.primary:hover{background:#ffe633}
.btn.ghost{border-color:var(--rule)}
.btn:disabled{opacity:.3;cursor:default}
.btn:focus-visible,.chip:focus-visible,.switch input:focus-visible + .track{outline:3px solid var(--ink);outline-offset:2px}
.switch{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-size:.98rem;user-select:none;font-weight:500}
.switch input{position:absolute;opacity:0;width:1px;height:1px}
.track{width:40px;height:22px;border-radius:11px;background:#d6d6d6;position:relative;transition:background .2s;flex:none}
.track::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 2px rgb(0 0 0 / .25)}
.switch input:checked + .track{background:var(--ink)}
.switch input:checked + .track::after{transform:translateX(18px);background:var(--brand)}

/* diagram */
.dia{position:relative;border:1px solid var(--rule);border-radius:4px;background:var(--bg)}
.dia-scroll{overflow-x:auto;overscroll-behavior-x:contain}
.dia-svg{display:block;width:100%;height:auto}
@media (max-width:900px){.dia-svg{width:1160px}}
.dia-note{font-size:.88rem;color:var(--muted);margin:10px 2px 0}

.wire{fill:none;stroke:var(--ink);stroke-linecap:round;stroke-linejoin:round}
.w-tr{stroke-width:3.2} .w-st{stroke-width:2.5} .w-mt{stroke-width:1.9} .w-bt{stroke-width:1.3} .w-gen{stroke-width:1.9}
.w-dot{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:3 4}
.w-4g{fill:none;stroke:var(--brand-d);stroke-width:2;stroke-dasharray:3 5;stroke-linecap:round}
.vlab rect{fill:var(--bg)}
.vlab text{font:500 11.5px var(--f-mono);fill:var(--ink2)}
.grp{fill:none;stroke:var(--faint);stroke-width:1.2;stroke-dasharray:4 4}
.grp-t{font:600 11.5px var(--f-body);letter-spacing:.1em;text-transform:uppercase;fill:var(--muted)}
.cbox rect.cb{fill:var(--soft);stroke:var(--ink);stroke-width:1.4}
.cbox{cursor:pointer}
.cbox:hover rect.cb,.cbox:focus-visible rect.cb{fill:var(--soft2)}
.cbox:focus-visible{outline:none}
.cbox:focus-visible rect.cb{stroke-width:2.6}
.cb-t{font:700 15px var(--f-display);fill:var(--ink);letter-spacing:.02em}
.cb-k{font:500 11.5px var(--f-mono);fill:var(--ink2)}
.cb-a{font:600 11px var(--f-body);fill:var(--muted)}

.node{cursor:pointer;outline:none}
.node .nbg{fill:var(--bg);stroke:none;transition:fill .15s}
.node:hover .nbg{fill:var(--soft)}
.node.sel .nbg{stroke:var(--ink);stroke-width:2.2}
.node:focus-visible .nbg{stroke:var(--ink);stroke-width:2.2;stroke-dasharray:4 3}
.ic path,.ic rect,.ic circle,.ic line,.ic polyline{fill:none;stroke:var(--ink);stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round}
.ic .f{fill:var(--ink)}
.ic .w{fill:var(--bg)}
.ic .y{fill:var(--brand)}
.nl{font:500 12.5px var(--f-body);fill:var(--ink);paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round}
.node.sel .nl{font-weight:700}
.modem circle{fill:var(--brand);stroke:var(--ink);stroke-width:1.3}
.modem path{fill:none;stroke:var(--ink);stroke-width:1.4;stroke-linecap:round}
.modem .dot{fill:var(--ink);stroke:none}
.smk{cursor:pointer}
.smk circle{fill:var(--ink)}
.smk text{font:700 11.5px var(--f-body);fill:#fff}
.smk:hover circle,.smk.on circle{fill:var(--brand)}
.smk:hover text,.smk.on text{fill:var(--ink)}
.smk.on circle{stroke:var(--ink);stroke-width:1.5}
body.rom-on .node[data-rom="1"] .nbg{fill:var(--brand)}
body.rom-on .node:not([data-rom="1"]){opacity:.38}
body.rom-on .node:not([data-rom="1"]).sel{opacity:1}
.dia-svg .node,.dia-svg .cbox,.dia-svg .smk{transition:opacity .3s}
.dia-svg.touring .node:not(.on){opacity:.14}
.dia-svg.touring .cbox:not(.on){opacity:.3}
.legend-t{font:600 12px var(--f-body);letter-spacing:.1em;text-transform:uppercase;fill:var(--muted)}
.legend-x{font:400 13px var(--f-body);fill:var(--ink2)}

/* info card */
.info{position:absolute;top:14px;width:min(400px,36%);max-height:calc(100% - 28px);overflow:auto;background:var(--bg);border:1.5px solid var(--ink);
  border-radius:2px;box-shadow:8px 8px 0 var(--brand);padding:18px 20px;z-index:2}
.info.left{left:14px} .info.right{right:22px}
@media (max-width:900px){.info{position:static;width:auto;max-height:none;box-shadow:none;border-width:3px 0 0;border-color:var(--brand)}}
.info-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.info .eyebrow{font:600 12px var(--f-body);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:2px 0 6px}
.x{border:0;background:transparent;color:var(--muted);font-size:24px;line-height:1;cursor:pointer;padding:0 2px}
.x:hover{color:var(--ink)}
.x:focus-visible{outline:2px solid var(--ink)}
.info h3{font-size:1.65rem;text-transform:uppercase}
.info .kv{font:500 13px var(--f-mono);color:var(--ink2);margin:-2px 0 10px}
.info p,.info dd{font-size:.97rem}
.info dl{margin:0}
.info dt{font:600 12px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:10px}
.info dd{margin:2px 0 0}
.ana{background:var(--soft);border-left:4px solid var(--brand);padding:10px 12px;margin:12px 0 0;font-size:.95rem}
.ana span{display:block;font:600 11.5px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.mkt{border-top:1px solid var(--rule);margin-top:14px;padding-top:12px}
.mkt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.mkt h4{font:700 1.15rem var(--f-display);margin:0;text-transform:uppercase;letter-spacing:.02em}
.m{display:grid;grid-template-columns:104px auto;align-items:center;gap:8px;font-size:.9rem;margin:3px 0}
.segs{display:inline-flex;gap:3px}
.segs i{width:16px;height:8px;background:var(--rule);display:inline-block}
.segs i.on{background:var(--ink)}
.buy{margin:10px 0 6px;font-size:.95rem}
.read{font-size:.95rem;color:var(--ink2);margin:0}
.romtag{display:none;align-items:center;gap:6px;font:700 12px var(--f-body);letter-spacing:.04em;color:var(--ink);background:var(--brand);padding:3px 10px;margin:0 0 8px}
body.rom-on .romtag{display:inline-flex}
.sub{font:600 12px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:12px 0 6px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font:500 13.5px var(--f-body);padding:6px 11px;border:1px solid var(--ink);background:var(--bg);color:var(--ink);cursor:pointer;border-radius:2px}
.chip:hover{background:var(--soft)}
body.rom-on .chip.rom{background:var(--brand);border-color:var(--brand)}
.more{display:inline-block;margin-top:12px;font-size:.95rem;color:var(--ink);font-weight:600}
.stepnav{display:flex;gap:8px;margin-top:14px}
.vd{font:700 12px var(--f-body);padding:3px 10px;border:1.5px solid var(--ink);white-space:nowrap;letter-spacing:.03em}
.vd-alto{background:var(--ink);color:#fff}
.vd-medio{color:var(--ink)}
.vd-conc{color:var(--muted);border-color:var(--faint);border-style:dashed}

/* arrangements */
.rule-bar{display:flex;margin:18px 0 6px;max-width:780px;font-size:.9rem;border:1.5px solid var(--ink)}
.rule-bar div{padding:10px 12px;min-width:0;flex:1}
.rule-bar div + div{border-left:1.5px solid var(--ink)}
.rule-bar b{display:block;font:700 1.1rem var(--f-display);text-transform:uppercase;letter-spacing:.03em}
.rule-bar .on{background:var(--soft)}
.arr{border-top:1px solid var(--rule);padding-block:28px 6px;margin-top:24px}
.arr-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px 18px;align-items:start}
.vbadge{font:700 16px var(--f-display);padding:8px 12px;background:var(--ink);color:var(--brand);letter-spacing:.06em;line-height:1}
.arr-head h3{font-size:1.75rem;margin:0;text-transform:uppercase}
.facts-row{display:flex;flex-wrap:wrap;gap:4px 26px;margin:6px 0 0;font-size:.95rem}
.facts-row div{min-width:0}
.facts-row span{color:var(--muted)}
.chain-scroll{overflow-x:auto;margin:16px 0 4px}
svg.chain{display:block;height:auto;max-width:none}
.tile .tile-bg{fill:var(--bg);stroke:var(--rule);stroke-width:1.3}
.tile.hot{cursor:pointer;outline:none}
.tile.hot:hover .tile-bg,.tile.hot:focus-visible .tile-bg{stroke:var(--ink);stroke-width:1.8}
body.rom-on .tile.rom .tile-bg{fill:var(--brand);stroke:var(--brand)}
.client{fill:var(--soft)}
.bound{stroke:var(--ink);stroke-width:1.3;stroke-dasharray:5 4}
.own{font:600 12px var(--f-body);letter-spacing:.1em;text-transform:uppercase;fill:var(--muted)}
.brk-l{stroke:var(--muted);stroke-width:1.2;fill:none}
.brk-t{font:italic 400 13px var(--f-body);fill:var(--muted)}
body.rom-on .brk.rom .brk-l{stroke:var(--ink);stroke-width:2}
body.rom-on .brk.rom .brk-t{fill:var(--ink);font-weight:600}
.tl{font:500 13px var(--f-body);fill:var(--ink)}
.akv{font:500 11px var(--f-mono);fill:var(--ink2)}
.arrow{fill:var(--ink)}
.arr-take{max-width:52em;font-size:1rem;margin-top:4px}
.arr-take b{font-weight:700}
.variants{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0 6px}
@media (max-width:1000px){.variants{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.variants{grid-template-columns:1fr}}
.var{border:1px solid var(--rule);border-top:4px solid var(--ink);padding:14px 14px 12px;min-width:0}
.var h4{font:700 1.15rem var(--f-display);margin:0 0 4px;text-transform:uppercase;letter-spacing:.02em}
.var p{font-size:.93rem;color:var(--ink2);margin:0}
body.rom-on .var.rom{border-top-color:var(--brand);background:#fffbe0}
.var-tag{display:none;font:700 11px var(--f-body);background:var(--brand);padding:2px 8px;margin-bottom:6px}
body.rom-on .var.rom .var-tag{display:inline-block}

/* market */
.mk-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:32px;align-items:start;margin-top:18px}
@media (max-width:980px){.mk-grid{grid-template-columns:1fr}}
.card{border:1px solid var(--rule);border-top:4px solid var(--ink);padding:18px 18px 14px;min-width:0}
.card h3{font-size:1.35rem;text-transform:uppercase}
.cap-scroll{overflow-x:auto}
svg.capil{display:block;width:100%;height:auto;min-width:560px}
.cap-name{font:600 13.5px var(--f-body);fill:var(--ink)}
.cap-val{font:500 12px var(--f-mono);fill:var(--muted)}
.cap-tick{font:500 11px var(--f-mono);fill:var(--muted)}
.cap-grid{stroke:var(--rule);stroke-width:1}
.bar{fill:var(--ink)}
.bar.est{fill:#c9c9c9}
.bar-cap{fill:var(--brand)}
.forces{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 24px}
@media (max-width:620px){.forces{grid-template-columns:1fr}}
.force h4{font:700 1.2rem var(--f-display);margin:0 0 2px;text-transform:uppercase;letter-spacing:.02em}
.force .meas{font:500 11.5px var(--f-mono);color:var(--muted);margin:0 0 4px}
.force p{font-size:.95rem;margin:0}
.callouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:22px}
@media (max-width:760px){.callouts{grid-template-columns:1fr}}
.callout{background:var(--soft);border-left:6px solid var(--brand);padding:14px 16px}
.callout h4{font:700 1.2rem var(--f-display);margin:0 0 4px;text-transform:uppercase;letter-spacing:.02em}
.callout p{font-size:.97rem;margin:0}
.tbl-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px;margin:34px 0 10px}
.vd-key{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.88rem;color:var(--muted);align-items:center}
.vd-key span.vd{margin-right:4px}
.tbl-scroll{overflow-x:auto;border:1px solid var(--rule)}
table{border-collapse:collapse;width:100%;min-width:880px}
th,td{padding:11px 14px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:middle;font-size:.95rem}
tr:last-child td{border-bottom:0}
th{font:600 12px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--brand);background:var(--ink)}
td.eq{font-weight:600}
td.st{color:var(--muted);font-size:.88rem}
tr.row{cursor:pointer}
tr.row:hover td{background:var(--soft)}
tr.row:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.rdot{display:none;width:9px;height:9px;background:var(--brand);border:1px solid var(--ink);margin-right:8px;vertical-align:middle}
body.rom-on tr.rom .rdot{display:inline-block}
body.rom-on tr.row:not(.rom){opacity:.4}

footer{border-top:4px solid var(--ink);margin-top:44px;padding-top:20px;font-size:.88rem;color:var(--muted)}
footer h4{font:700 1.1rem var(--f-display);color:var(--ink);margin:0 0 8px;text-transform:uppercase;letter-spacing:.03em}
footer ul{margin:0;padding-left:18px;max-width:62em}
footer li{margin-bottom:6px}
footer a{color:var(--ink)}
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}.track,.track::after,.dia-svg .node{transition:none}}
</style>

<div class="wrap">
  <header class="hero">
    <div>
      <h1>Sistema elétrico <span>de potência</span></h1>
      <p class="lede">O caminho da energia elétrica, da turbina até a casa, a indústria e o shopping. Quais equipamentos ela encontra pelo caminho e por que cada um existe.</p>
      <p class="why">A tensão sobe e desce de propósito. Para levar a mesma energia, quanto maior a tensão, menor a corrente, e é a corrente que esquenta os cabos e desperdiça energia. Por isso a energia viaja em tensão muito alta e só é reduzida perto de quem vai usá-la, onde uma tensão baixa é mais segura.</p>
      <p class="why">É a mesma lógica da logística: a carga é consolidada numa carreta para a rodovia, dividida em caminhões nos centros de distribuição e entregue de van e moto até a porta.</p>
    </div>
    <figure>
      <svg class="stair" id="stair" viewBox="0 0 540 236" role="img" aria-label="Perfil de tensão: cerca de 13,8 kV na usina, 500 kV na transmissão, 138 kV na subtransmissão, 13,8 kV na rede de média tensão e 220 V na casa."></svg>
      <figcaption>Cada degrau é um transformador. Escala logarítmica: de 220 V para 500 kV a tensão aumenta mais de 2 mil vezes.</figcaption>
    </figure>
  </header>

  <section id="caminho">
    <h2>O caminho completo</h2>
    <p class="intro muted">Toque em qualquer ícone para ver o que o equipamento faz, por que ele existe e como é o seu mercado. Os quadros à direita são os tipos de consumidor, separados pela tensão em que se ligam à rede. Quanto mais grossa a linha, mais alta a tensão.</p>
    <div class="toolbar">
      <div class="tour" id="tour"></div>
      <label class="switch"><input type="checkbox" id="romToggle"><span class="track" aria-hidden="true"></span><span>Destacar o portfólio da empresa</span></label>
    </div>
    <div class="dia" id="dia">
      <div class="dia-scroll" id="diaScroll">
        <svg class="dia-svg" id="diaSvg" viewBox="0 0 1460 780" role="img" aria-label="Diagrama unifilar do sistema elétrico: usina, subestação elevadora, transmissão, subestação de transmissão, subtransmissão, subestação de distribuição, rede de média tensão com regulador, religador, capacitores e postes, posto de transformação, rede de baixa tensão e consumidores dos grupos A1, A2 e A3, A4 e B, além do centro de operação que se comunica com os equipamentos por modem."></svg>
      </div>
      <div class="info" id="info" hidden></div>
    </div>
    <p class="dia-note">No celular, arraste o desenho para os lados. Durante o tour, as setas do teclado também avançam e voltam.</p>
  </section>

  <section id="arranjos">
    <h2>Como cada cliente se liga à rede</h2>
    <p class="intro">Quanto maior o consumo, mais alta a tensão em que o cliente se conecta, e mais equipamentos passam a ser dele. É aí que a lista de compradores de equipamentos deixa de ser só as distribuidoras.</p>
    <div class="rule-bar" aria-label="Regra geral de conexão">
      <div><b>Grupo B · Baixa tensão</b>até 75 kW de carga</div>
      <div><b>A4 · Média tensão</b>acima de 75 kW, até 2.500 kW de demanda</div>
      <div><b>A3 a A1 · Alta tensão</b>acima de 2.500 kW</div>
    </div>
    <p class="muted" style="font-size:.88rem;max-width:46em">Regra geral da ANEEL (REN 1.000/2021). Há exceções definidas pela distribuidora.</p>

    <div class="arr" id="arr-bt">
      <div class="arr-head">
        <span class="vbadge">B</span>
        <div>
          <h3>Consumidor de baixa tensão</h3>
          <div class="facts-row"><div><span>Quem é:</span> casas, pequenos comércios, sítios</div><div><span>Tensão:</span> <span class="mono">127/220 V</span></div><div><span>Grupo tarifário:</span> B</div></div>
        </div>
      </div>
      <div class="chain-scroll" id="chain-bt"></div>
      <p class="arr-take">O cliente compra pouco equipamento elétrico. O transformador, o poste, o ramal e até o medidor instalado na casa pertencem à distribuidora. <b>Quem compra é a distribuidora.</b> Com painéis solares, o medidor passa a registrar a energia nos dois sentidos.</p>
    </div>

    <div class="arr" id="arr-mt">
      <div class="arr-head">
        <span class="vbadge">A4</span>
        <div>
          <h3>Consumidor de média tensão</h3>
          <div class="facts-row"><div><span>Quem é:</span> indústrias médias, shoppings, hospitais, supermercados, condomínios, agroindústrias</div><div><span>Tensão:</span> <span class="mono">13,8 kV</span> (2,3 a 44 kV)</div><div><span>Grupo tarifário:</span> A4</div></div>
        </div>
      </div>
      <div class="chain-scroll" id="chain-mt"></div>
      <p class="arr-take">Aqui o próprio cliente vira comprador. Cabine, proteção, transformador e painéis são dele, e quem especifica e compra são indústrias, construtoras e instaladoras. <b>A base de compradores se multiplica e fica pulverizada.</b> A mesma função pode ser montada de quatro formas:</p>
      <div class="variants" id="variants"></div>
    </div>

    <div class="arr" id="arr-at">
      <div class="arr-head">
        <span class="vbadge">A1–A3</span>
        <div>
          <h3>Consumidor de alta tensão</h3>
          <div class="facts-row"><div><span>Quem é:</span> siderúrgicas, mineradoras, petroquímicas, grandes data centers</div><div><span>Tensão:</span> <span class="mono">69 a 230 kV</span> ou mais</div><div><span>Grupo tarifário:</span> A3, A2 e A1</div></div>
        </div>
      </div>
      <div class="chain-scroll" id="chain-at"></div>
      <p class="arr-take">Na prática, é uma pequena distribuidora dentro da fábrica: uma subestação principal e, depois dela, uma rede interna de média tensão com várias cabines e transformadores perto das máquinas. <b>São poucos projetos, mas cada um compra muita coisa de uma vez.</b> Data centers ainda duplicam a entrada de energia e os transformadores, para que uma falha nunca desligue os servidores.</p>
    </div>
  </section>

<!-- Strategy OS (PO, 13/11/2026): the section «Por que alguns equipamentos têm mais mercado» and everything below it (sources) were removed. -->
</div>

<script>
(function(){
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

/* ================= DADOS (injetados pelo gerar.py a partir do dados.xlsx) ================= */
const DADOS = {"etapas": [{"numero": 1, "nome": "Geração", "nome_curto": "", "tensao": "cerca de 13,8 kV", "texto": "A energia nasce nas usinas. No Brasil, a maior parte vem das hidrelétricas, seguidas por eólicas, solares e térmicas. As usinas ficam onde estão o rio, o vento e o sol, quase sempre longe das cidades. O gerador produz energia em média tensão, por volta de 13,8 mil volts."}, {"numero": 2, "nome": "Subestação elevadora", "nome_curto": "SE elevadora", "tensao": "13,8 → 500 kV", "texto": "Antes de viajar, a tensão é elevada até centenas de milhares de volts. A mesma energia passa a circular com uma corrente muito menor, o que permite cabos mais finos e reduz a perda de energia no caminho."}, {"numero": 3, "nome": "Transmissão", "nome_curto": "", "tensao": "230 a 800 kV", "texto": "As linhas de transmissão são as rodovias da energia. Somam cerca de 181 mil km e interligam todos os estados no Sistema Interligado Nacional, operado pelo ONS."}, {"numero": 4, "nome": "SE de transmissão", "nome_curto": "", "tensao": "500 → 138 kV", "texto": "Perto das regiões de consumo, a tensão desce um degrau. É o grande centro de distribuição: a carga que veio de carreta é dividida em caminhões menores."}, {"numero": 5, "nome": "Subtransmissão", "nome_curto": "", "tensao": "69 a 138 kV", "texto": "Linhas regionais, quase sempre da distribuidora, levam a energia até as subestações das cidades e aos clientes muito grandes."}, {"numero": 6, "nome": "Consumidor de alta tensão", "nome_curto": "", "tensao": "69 a 230 kV", "texto": "Siderúrgicas, mineradoras, petroquímicas e grandes data centers consomem tanto que se ligam direto na alta tensão. Eles têm uma subestação própria, que funciona como uma pequena distribuidora dentro da fábrica."}, {"numero": 7, "nome": "SE de distribuição", "nome_curto": "", "tensao": "138 → 13,8 kV", "texto": "Cada subestação de distribuição atende um bairro ou uma cidade pequena. Dela saem os alimentadores, as avenidas de média tensão que percorrem as ruas."}, {"numero": 8, "nome": "Rede de média tensão", "nome_curto": "", "tensao": "13,8 kV (até 34,5 kV)", "texto": "Os fios do alto do poste. Ao longo deles, equipamentos protegem a rede, religam após falhas e corrigem a tensão. É a partir daqui que os equipamentos passam a ser contados aos milhões."}, {"numero": 9, "nome": "Consumidor de média tensão", "nome_curto": "", "tensao": "13,8 kV", "texto": "Indústrias médias, shoppings, hospitais e condomínios recebem a energia em 13,8 mil volts. O transformador e a cabine passam a ser do cliente, que vira comprador de equipamentos."}, {"numero": 10, "nome": "Transformador e rede BT", "nome_curto": "", "tensao": "13,8 kV → 220 V", "texto": "O transformador do poste faz a última redução, para 127/220 volts. A rede de baixa tensão leva a energia pelos mesmos postes até a frente de cada imóvel."}, {"numero": 11, "nome": "Consumidor de baixa tensão", "nome_curto": "", "tensao": "127/220 V", "texto": "Casas e pequenos comércios. São cerca de 90 milhões de unidades consumidoras no Brasil, cada uma com seu medidor. Muitas já geram a própria energia com painéis solares."}], "equipamentos": [{"id": "solar", "etapa": 1, "rotulo": "Usina solar", "titulo": "Usina solar e suas estruturas", "o_que_faz": "Painéis convertem a luz do sol em eletricidade. Eles ficam presos em estruturas metálicas fixadas no solo, muitas vezes com rastreadores que acompanham o sol ao longo do dia.", "por_que_existe": "O sol é gratuito e abundante no Brasil. A estrutura sustenta milhares de painéis por 25 a 30 anos, enfrentando vento, chuva e calor.", "analogia": "", "quem_compra": "desenvolvedores de usinas e integradores", "leitura_mercado": "Cada usina usa milhares de estruturas. O setor cresceu muito na última década; o ritmo agora depende de leilões, dos cortes de geração impostos pela rede e das regras da geração distribuída.", "volume": 4, "recorrencia": 2, "crescimento": 3, "portfolio": true}, {"id": "gerador", "etapa": 1, "rotulo": "Turbina e gerador", "titulo": "Turbina e gerador", "o_que_faz": "A água da represa (ou o vento, ou o vapor) gira uma turbina. A turbina gira o gerador, que produz eletricidade em cerca de 13,8 mil volts.", "por_que_existe": "É onde a energia nasce. As grandes usinas ficam onde estão os rios e os ventos, quase sempre longe das cidades. Por isso existe todo o resto do sistema.", "analogia": "", "quem_compra": "geradoras (poucas e grandes)", "leitura_mercado": "Projetos gigantes e raros, feitos sob encomenda por poucos fabricantes globais. Mercado grande em valor, pequeno em número de unidades.", "volume": 1, "recorrencia": 1, "crescimento": 2, "portfolio": false}, {"id": "elevador", "etapa": 2, "rotulo": "Transformador elevador", "titulo": "Transformador elevador", "o_que_faz": "Eleva a tensão de cerca de 13,8 mil volts para até 500 mil volts.", "por_que_existe": "Com tensão alta, a mesma energia viaja com corrente muito menor. Corrente menor significa cabos mais finos e muito menos energia perdida em forma de calor ao longo de centenas de quilômetros.", "analogia": "É como consolidar a carga em uma carreta antes de pegar a rodovia.", "quem_compra": "geradoras e transmissoras", "leitura_mercado": "Equipamento de milhões de reais, projetado sob medida e com fila de fabricação longa. Poucas unidades por ano.", "volume": 1, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "patio", "etapa": 2, "rotulo": "Disjuntores e chaves", "titulo": "Disjuntores, chaves e para-raios", "o_que_faz": "Disjuntores desligam o circuito em frações de segundo quando há falha. Chaves seccionadoras isolam trechos para manutenção. Para-raios desviam descargas atmosféricas para a terra. Transformadores de instrumento medem corrente e tensão para os relés de proteção.", "por_que_existe": "Sem eles, um curto-circuito em um ponto poderia danificar equipamentos caros e derrubar uma região inteira. Estão em todas as subestações.", "analogia": "São os disjuntores do quadro da sua casa, em escala gigante.", "quem_compra": "transmissoras, geradoras, distribuidoras e grandes indústrias", "leitura_mercado": "Presentes em toda subestação, mas em quantidade limitada por subestação. Mercado técnico, concentrado em poucos fabricantes.", "volume": 2, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "torres", "etapa": 3, "rotulo": "Torres, cabos e isoladores", "titulo": "Torres, cabos e isoladores", "o_que_faz": "Torres metálicas sustentam os cabos a dezenas de metros do chão. Isoladores de vidro, porcelana ou polímero impedem que a eletricidade escape para a torre.", "por_que_existe": "Ligam as usinas aos centros de consumo. O Brasil tem cerca de 181 mil km de linhas de transmissão, conectando todos os estados.", "analogia": "", "quem_compra": "transmissoras que vencem os leilões da ANEEL", "leitura_mercado": "Demanda em ondas, puxada pelos leilões de transmissão. Uma vez construída, a linha dura décadas.", "volume": 2, "recorrencia": 1, "crescimento": 3, "portfolio": false}, {"id": "auto", "etapa": 4, "rotulo": "Autotransformador", "titulo": "Autotransformador da subestação de transmissão", "o_que_faz": "Baixa a tensão da rede de transporte (por exemplo, 500 mil volts) para o nível regional (por exemplo, 138 mil volts).", "por_que_existe": "A energia chegou perto da região de consumo e agora precisa ser repartida em linhas menores que levam a várias cidades.", "analogia": "É o grande centro de distribuição logístico, onde a carreta é desmembrada em caminhões menores.", "quem_compra": "transmissoras", "leitura_mercado": "Mesmo perfil do transformador elevador: alto valor, poucas unidades, projeto sob medida.", "volume": 1, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "subtrans", "etapa": 5, "rotulo": "Linha de subtransmissão", "titulo": "Linha de subtransmissão", "o_que_faz": "Leva a energia em 69 a 138 mil volts da subestação de transmissão até as subestações das cidades e aos grandes clientes.", "por_que_existe": "É a malha regional, geralmente da própria distribuidora. Usa torres menores ou postes de concreto de grande porte.", "analogia": "", "quem_compra": "distribuidoras e grandes clientes", "leitura_mercado": "Cresce quando surgem novas subestações e grandes cargas, como data centers e indústrias.", "volume": 2, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "consAT", "etapa": 6, "rotulo": "Subestação do consumidor AT", "titulo": "Subestação do consumidor de alta tensão", "o_que_faz": "Grandes consumidores recebem energia direto em 69 a 230 mil volts e têm uma subestação própria, com transformador de potência, disjuntores e painéis.", "por_que_existe": "Consomem tanto (acima de 2.500 kW de demanda) que precisam estar ligados direto na alta tensão. Em troca, pagam tarifas de rede menores.", "analogia": "", "quem_compra": "a própria indústria, por meio de construtoras e integradores", "leitura_mercado": "Poucos projetos, mas grandes, e em alta: data centers, mineração e indústrias eletrointensivas. Cada projeto compra de uma vez transformadores, painéis e cabines.", "volume": 1, "recorrencia": 1, "crescimento": 4, "portfolio": false}, {"id": "trafoPot", "etapa": 7, "rotulo": "Transformador de potência", "titulo": "Transformador de potência da subestação de distribuição", "o_que_faz": "Reduz de 138 mil para 13,8 mil volts, a tensão que circula pelos postes das ruas.", "por_que_existe": "Cada subestação dessas alimenta um bairro ou uma cidade pequena. Quando a cidade cresce, a distribuidora troca por um maior ou instala outro ao lado.", "analogia": "", "quem_compra": "distribuidoras", "leitura_mercado": "Milhares de subestações no país, com ampliação constante. Mas cada unidade é cara e projetada sob medida, e o número comprado por ano é pequeno.", "volume": 2, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "paineis", "etapa": 7, "rotulo": "Painéis e proteção", "titulo": "Painéis, cubículos e proteção", "o_que_faz": "Armários metálicos que abrigam disjuntores, relés e medidores de cada saída da subestação.", "por_que_existe": "Cada alimentador é uma avenida de energia que sai para um bairro. O painel permite ligar, desligar e proteger cada uma separadamente.", "analogia": "", "quem_compra": "distribuidoras, indústrias e data centers", "leitura_mercado": "Compra recorrente pela modernização (relés digitais, comando à distância) e pela expansão de subestações e indústrias.", "volume": 2, "recorrencia": 3, "crescimento": 3, "portfolio": true}, {"id": "smart", "etapa": 7, "rotulo": "Automação e smart grid", "titulo": "Automação e smart grid", "o_que_faz": "Rádios, sensores e software ligam os equipamentos da rede ao centro de operação da distribuidora, que passa a ver e comandar a rede à distância.", "por_que_existe": "Quando algo falha, a rede se reconfigura sozinha ou o operador religa por controle remoto, sem esperar uma equipe chegar ao local.", "analogia": "", "quem_compra": "distribuidoras", "leitura_mercado": "O segmento que mais cresce. A ANEEL cobra menos tempo sem energia, e automação é uma das formas mais baratas de entregar isso.", "volume": 2, "recorrencia": 3, "crescimento": 5, "portfolio": true}, {"id": "religador", "etapa": 8, "rotulo": "Religador", "titulo": "Religador", "o_que_faz": "Um disjuntor inteligente instalado no poste. Quando há um curto, como um galho encostando no fio, ele desliga e tenta religar sozinho em segundos. Se a falha sumiu, a energia volta sem ninguém sair de casa.", "por_que_existe": "A maioria das falhas na rede aérea é passageira. Sem religador, cada galho viraria horas de bairro no escuro e uma equipe na rua.", "analogia": "É como reiniciar o roteador antes de chamar o técnico.", "quem_compra": "distribuidoras e cooperativas", "leitura_mercado": "Alto crescimento. A ANEEL mede e penaliza a duração e a frequência das interrupções (DEC e FEC), e o religador é um dos equipamentos com melhor custo-benefício para reduzir esses indicadores.", "volume": 3, "recorrencia": 3, "crescimento": 5, "portfolio": true}, {"id": "regulador", "etapa": 8, "rotulo": "Regulador de tensão", "titulo": "Regulador de tensão", "o_que_faz": "Corrige automaticamente a tensão ao longo da rede, para que ela chegue dentro da faixa correta até o fim da linha.", "por_que_existe": "Em redes longas, comuns no interior, a tensão vai caindo com a distância. E com muitos painéis solares nos telhados, ela também pode subir demais ao meio-dia.", "analogia": "É a bomba de reforço que mantém a pressão da água na última casa da rua.", "quem_compra": "distribuidoras", "leitura_mercado": "Demanda estável, reforçada pela geração distribuída, que deixa a tensão mais instável.", "volume": 3, "recorrencia": 2, "crescimento": 3, "portfolio": false}, {"id": "chave", "etapa": 8, "rotulo": "Chave fusível", "titulo": "Chave fusível", "o_que_faz": "Um fusível montado no alto do poste. Se houver curto em um ramal ou em um transformador, ele queima e isola só aquele trecho.", "por_que_existe": "Protege o restante da rede: o problema fica confinado a uma rua, em vez de desligar o alimentador inteiro.", "analogia": "É o fusível do aparelho, que queima para salvar a instalação.", "quem_compra": "distribuidoras, empreiteiras e consumidores de média tensão", "leitura_mercado": "Item barato, mas presente em quase todo transformador e ramal, e trocado com frequência.", "volume": 5, "recorrencia": 5, "crescimento": 3, "portfolio": false}, {"id": "capacitor", "etapa": 8, "rotulo": "Banco de capacitores", "titulo": "Banco de capacitores", "o_que_faz": "Compensa um efeito elétrico criado por motores e outros equipamentos, a chamada energia reativa, aliviando a rede.", "por_que_existe": "Sem compensação, os cabos carregam corrente que não realiza trabalho útil, esquentam mais e a tensão cai. O capacitor devolve eficiência à rede.", "analogia": "", "quem_compra": "distribuidoras e indústrias", "leitura_mercado": "Mercado maduro e estável.", "volume": 3, "recorrencia": 2, "crescimento": 2, "portfolio": false}, {"id": "ferragens", "etapa": 8, "rotulo": "Ferragens e isoladores", "titulo": "Ferragens e isoladores", "o_que_faz": "Cruzetas, braçadeiras, parafusos, mãos-francesas e isoladores: o conjunto que prende cabos e equipamentos no poste com segurança.", "por_que_existe": "Cada poste tem dezenas dessas peças. Elas seguram tudo no lugar por décadas, sob sol, chuva e vento.", "analogia": "", "quem_compra": "distribuidoras, empreiteiras de rede e cooperativas", "leitura_mercado": "Volume enorme e compra contínua: toda obra nova, toda manutenção e toda troca de poste consomem ferragens.", "volume": 5, "recorrencia": 5, "crescimento": 3, "portfolio": true}, {"id": "postes", "etapa": 8, "rotulo": "Postes de concreto", "titulo": "Postes de concreto", "o_que_faz": "Sustentam a rede de média e de baixa tensão e, de carona, os cabos de internet e telefonia.", "por_que_existe": "São a espinha dorsal da distribuição: o Brasil tem cerca de 46 milhões de postes. São trocados quando envelhecem, quando um carro bate, quando a rede é reforçada ou quando um poste de madeira dá lugar a um de concreto.", "analogia": "", "quem_compra": "distribuidoras, empreiteiras, cooperativas e loteamentos", "leitura_mercado": "Volume gigantesco. Um detalhe muda tudo: o poste é pesado e o frete é caro, então o mercado é regional e vence quem tem fábrica perto do cliente.", "volume": 5, "recorrencia": 4, "crescimento": 3, "portfolio": true}, {"id": "compacta", "etapa": 9, "rotulo": "Cabine / subestação compacta", "titulo": "Cabine e subestação compacta", "o_que_faz": "É a subestação particular do consumidor de média tensão: recebe 13,8 mil volts da rua, mede, protege e transforma para a tensão das máquinas.", "por_que_existe": "Indústrias, shoppings, hospitais e condomínios consomem demais para a rede de baixa tensão. Eles se ligam em média tensão e passam a ser donos do próprio transformador e da cabine.", "analogia": "É ter uma caixa d’água própria, em vez de depender da pressão da rua.", "quem_compra": "indústrias, construtoras, instaladoras e integradores", "leitura_mercado": "Base de compradores muito ampla e pulverizada. Cresce com indústria, agronegócio, comércio e data centers.", "volume": 3, "recorrencia": 2, "crescimento": 4, "portfolio": true}, {"id": "trafoDist", "etapa": 10, "rotulo": "Transformador de distribuição", "titulo": "Transformador de distribuição", "o_que_faz": "O tambor no alto do poste. Reduz de 13,8 mil volts para 127/220 volts, a tensão das tomadas.", "por_que_existe": "Cada um atende de algumas casas a um quarteirão, e existem milhões no país. Eles queimam com raios e sobrecarga, envelhecem e são trocados por maiores quando o consumo da rua cresce com ar-condicionado, carro elétrico e painéis solares.", "analogia": "", "quem_compra": "distribuidoras, cooperativas, construtoras e indústrias", "leitura_mercado": "O coração do mercado de distribuição: muitas unidades, troca recorrente e vários tipos de comprador.", "volume": 5, "recorrencia": 4, "crescimento": 4, "portfolio": true}, {"id": "redeBT", "etapa": 10, "rotulo": "Rede de baixa tensão", "titulo": "Rede de baixa tensão", "o_que_faz": "Cabos que saem do transformador e correm pelos mesmos postes até a frente dos imóveis. Hoje são quase sempre cabos isolados e trançados, os multiplexados.", "por_que_existe": "É o último trecho público da rede. O cabo isolado reduz curtos com galhos e dificulta furtos e ligações clandestinas.", "analogia": "", "quem_compra": "distribuidoras e empreiteiras", "leitura_mercado": "Grande volume em metros de cabo e acessórios, com reposição constante.", "volume": 5, "recorrencia": 4, "crescimento": 3, "portfolio": false}, {"id": "medidor", "etapa": 11, "rotulo": "Medidor", "titulo": "Medidor", "o_que_faz": "Registra quanta energia cada cliente consumiu e, com painel solar, quanto injetou na rede. Os modelos inteligentes enviam a leitura sozinhos e permitem desligar e religar à distância.", "por_que_existe": "É a caixa registradora da distribuidora: um por unidade consumidora, cerca de 90 milhões no Brasil.", "analogia": "", "quem_compra": "distribuidoras", "leitura_mercado": "Base gigantesca. A troca em massa por medidores inteligentes pode virar uma onda enorme, mas o ritmo depende da regulação e da decisão de cada distribuidora.", "volume": 5, "recorrencia": 3, "crescimento": 4, "portfolio": false}, {"id": "gd", "etapa": 11, "rotulo": "Geração distribuída", "titulo": "Geração distribuída (painéis no telhado)", "o_que_faz": "Painéis solares em casas, comércios e fazendas geram energia no próprio local. O que sobra vai para a rede.", "por_que_existe": "Já são mais de 4,5 milhões de sistemas no Brasil. A energia passa a circular nos dois sentidos, o que exige transformadores, reguladores e proteções preparados para isso.", "analogia": "", "quem_compra": "consumidores, por meio de integradores solares", "leitura_mercado": "Além dos próprios painéis, estruturas e inversores, gera demanda indireta na rede: reforço de transformadores e regulação de tensão.", "volume": 5, "recorrencia": 2, "crescimento": 3, "portfolio": false}], "base_instalada": [{"item": "Subestações de distribuição", "quantidade": 4000.0, "nivel": "AT", "estimativa": true, "nota": "Proporção da AES Sul (61 SEs / 1,3 mi UCs) aplicada a 90 mi UCs"}, {"item": "Transformadores de distribuição", "quantidade": 4000000.0, "nivel": "MT", "estimativa": true, "nota": "Proporção da AES Sul (60,7 mil trafos / 1,3 mi UCs); tende a superestimar"}, {"item": "Postes", "quantidade": 46000000.0, "nivel": "MT", "estimativa": false, "nota": "ANEEL, 2019"}, {"item": "Medidores", "quantidade": 90000000.0, "nivel": "BT", "estimativa": false, "nota": "1 por unidade consumidora; ANEEL, Relatório de Gestão 2025"}], "parametros": {"limiar_alto": 11, "limiar_medio": 8}, "fontes": [{"descricao": "Cerca de 90 milhões de unidades consumidoras e 181.305 km de linhas de transmissão: ANEEL", "titulo_link": "Relatório de Gestão 2025", "url": "https://www2.camara.leg.br/atividade-legislativa/comissoes/comissoes-permanentes/cffc/expedientes-recebidos/Relatorio_de_Gestao_2025Aneel.pdf/view"}, {"descricao": "46 milhões de postes: estimativa apresentada pela ANEEL em 2019", "titulo_link": "Teletime", "url": "https://teletime.com.br/23/05/2019/novas-regras-para-postes-devem-sair-ate-dezembro-de-2020/"}, {"descricao": "4,53 milhões de sistemas de geração distribuída: dados da ANEEL de 2026", "titulo_link": "Canal Solar", "url": "https://canalsolar.com.br/brasil-oito-milhoes-unidades-consumidores-energia-solar/"}, {"descricao": "Subestações e transformadores de distribuição são estimativas de ordem de grandeza: proporção da AES Sul (1,3 milhão de consumidores, 61 subestações e 60,7 mil transformadores) aplicada às 90 milhões de unidades consumidoras. Como a AES Sul tinha rede muito rural, o número de transformadores tende a estar superestimado", "titulo_link": "Apresentação à Câmara dos Deputados, 2015", "url": "https://www2.camara.leg.br/atividade-legislativa/comissoes/comissoes-permanentes/capadr/apresentacoes-em-eventos/audiencias-publicas-2015/audiencia-publica-15-de-setembro-de-2015-aes-sul/view"}, {"descricao": "Faixas de conexão por tensão: ANEEL, Resolução Normativa 1.000/2021. Tensões citadas são as mais comuns; variam por região e distribuidora", "titulo_link": "", "url": ""}, {"descricao": "As notas de volume, recorrência e crescimento são qualitativas e servem para explicar a lógica do mercado. Não são estimativas de faturamento", "titulo_link": "", "url": ""}], "gerado_em": "29/10/2026 às 14:07"};
if(!DADOS){ document.querySelector('.wrap').insertAdjacentHTML('afterbegin','<p style="margin:16px 0;padding:14px 16px;border:2px solid #111;background:#ffdd00">Este arquivo é o <b>modelo</b>. Abra o <b>painel.html</b>, gerado pelo atualizar.bat.</p>'); return; }

/* ================= LAYOUT DO DIAGRAMA (posições fixas; textos e notas vêm do Excel) ================= */
const Y = 430;
const LAYOUT_ETAPAS = {
 1:{m:[41,288]}, 2:{m:[161,288]}, 3:{m:[291,398]}, 4:{m:[416,398]}, 5:{m:[541,398]},
 6:{m:[1238,170],box:'A2'}, 7:{m:[666,288]}, 8:{m:[786,398]}, 9:{m:[1238,390],box:'A4'},
 10:{m:[1086,632]}, 11:{m:[836,632],box:'B'}
};
const MORE = {6:'arr-at', 9:'arr-mt', 11:'arr-bt'};
const LAYOUT_ROTULOS = {
 solar:{x:75,y:320,icon:'solar'}, gerador:{x:75,y:Y,icon:'hidro'},
 patio:{x:195,y:320,icon:'disjuntor'}, elevador:{x:195,y:Y,icon:'subUp'},
 torres:{x:325,y:Y,icon:'torre'}, auto:{x:450,y:Y,icon:'subDown',modem:1},
 subtrans:{x:575,y:Y,icon:'torreST'}, trafoPot:{x:700,y:Y,icon:'subDown',modem:1},
 paineis:{x:700,y:320,icon:'paineis'}, smart:{x:139,y:110,icon:'smart'},
 regulador:{x:820,y:Y,icon:'regulador',modem:1}, religador:{x:920,y:Y,icon:'religador',modem:1},
 capacitor:{x:1020,y:Y,icon:'capacitor'}, postes:{x:1120,y:Y,icon:'poste'},
 chave:{x:1120,y:560,icon:'chave',lab:'left'}, ferragens:{x:1225,y:560,icon:'ferragens'},
 trafoDist:{x:1120,y:665,icon:'trafoPoste',modem:1}, redeBT:{x:990,y:665,icon:'cabo'},
 medidor:{x:870,y:665,icon:'medidor',modem:1}, gd:{x:705,y:555,icon:'gd'},
 consAT:{x:1286,y:210,icon:'subCliente',nolabel:1}, compacta:{x:1286,y:Y,icon:'cabine',nolabel:1}
};

/* ================= ÍCONES (traço, 48×48 centrado em 0,0) ================= */
const ICONS = {
 hidro:\`<path d="M-18,14 V-4 L-11,-14 H11 L18,-4 V14"/><path d="M-10,-4 V10 M-3,-4 V10 M4,-4 V10 M11,-4 V10"/><path d="M-22,19 q3.7,-3 7.3,0 t7.3,0 t7.3,0 t7.3,0 t7.3,0 t7.3,0"/>\`,
 solar:\`<circle cx="15" cy="-15" r="5"/><path d="M15,-24 V-22 M24,-15 H22 M21.4,-21.4 L20,-20"/><path d="M-20,8 L-12,-10 H10 L2,8 Z"/><path d="M-16,-1 H6 M-5,-10 L-9,8"/><path d="M-9,8 V20 M-16,20 H-2"/>\`,
 disjuntor:\`<path d="M-22,0 H-10 M10,0 H22"/><circle cx="-10" cy="0" r="2.2" class="f"/><circle cx="10" cy="0" r="2.2" class="f"/><path d="M-10,0 L7,-11"/><rect x="-7" y="7" width="14" height="14"/><path d="M-7,7 L7,21 M7,7 L-7,21"/>\`,
 subUp:\`<rect x="-17" y="-6" width="30" height="22" rx="2"/><path d="M-11,-6 V-15 M-2,-6 V-17 M7,-6 V-15"/><circle cx="-6" cy="5" r="5.5"/><circle cx="1" cy="5" r="5.5"/><path d="M13,0 h5 v14 h-5"/><path d="M19,-14 V-22 M15.5,-18.5 L19,-22 L22.5,-18.5" style="stroke-width:2.2"/>\`,
 subDown:\`<rect x="-17" y="-6" width="30" height="22" rx="2"/><path d="M-11,-6 V-15 M-2,-6 V-17 M7,-6 V-15"/><circle cx="-6" cy="5" r="5.5"/><circle cx="1" cy="5" r="5.5"/><path d="M13,0 h5 v14 h-5"/><path d="M19,-22 V-14 M15.5,-17.5 L19,-14 L22.5,-17.5" style="stroke-width:2.2"/>\`,
 torre:\`<path d="M-11,22 L-4,-4 L0,-22 L4,-4 L11,22"/><path d="M-16,-12 H16 M-12,-3 H12"/><path d="M-8,10 L5,-1 M8,10 L-5,-1 M-10,18 L7,10 M10,18 L-7,10"/><path d="M-14,-12 V-7 M14,-12 V-7"/>\`,
 torreST:\`<path d="M-3,22 L-1.5,-22 H1.5 L3,22 Z"/><path d="M-13,-14 H13 M-11,-4 H11"/><path d="M-11,-14 V-10 M11,-14 V-10 M-9,-4 V0 M9,-4 V0"/><path d="M-9,22 H9"/>\`,
 paineis:\`<rect x="-19" y="-20" width="12" height="40"/><rect x="-6" y="-20" width="12" height="40"/><rect x="7" y="-20" width="12" height="40"/><circle cx="-13" cy="-13" r="1.6" class="f"/><circle cx="0" cy="-13" r="1.6" class="f"/><circle cx="13" cy="-13" r="1.6" class="f"/><path d="M-16,10 H-10 M-3,10 H3 M10,10 H16 M-16,14 H-10 M-3,14 H3 M10,14 H16"/>\`,
 smart:\`<rect x="-23" y="-20" width="21" height="15" rx="1.5"/><rect x="2" y="-20" width="21" height="15" rx="1.5"/><path d="M-12.5,-5 V-1 M12.5,-5 V-1 M-17,-1 H-8 M8,-1 H17"/><path d="M-19,-9 L-14,-14 L-10,-11 L-5,-16 M6,-11 h5 m2,0 h5 M6,-15 h12"/><rect x="-9" y="4" width="18" height="16" rx="1.5"/><path d="M-5,9 H5 M-5,14 H5"/><circle cx="5" cy="9" r=".8" class="f"/>\`,
 regulador:\`<rect x="-19" y="-10" width="10" height="20" rx="3"/><rect x="-5" y="-10" width="10" height="20" rx="3"/><rect x="9" y="-10" width="10" height="20" rx="3"/><path d="M-14,-10 V-16 M0,-10 V-16 M14,-10 V-16"/><path d="M-22,13 H22 M-18,13 V21 M18,13 V21"/>\`,
 religador:\`<path d="M-9,22 L-8,-22 H-4 L-3,22 Z"/><path d="M-20,-15 H8"/><path d="M-17,-15 V-20 M5,-15 V-20"/><rect x="0" y="-4" width="17" height="16" rx="2"/><path d="M5,-4 V-9 M12,-4 V-9"/><path d="M6,2 a3,3 0 1 1 5,2 M11,0 V4 H7" style="stroke-width:1.4"/>\`,
 capacitor:\`<path d="M0,-22 V-4 M0,4 V22"/><path d="M-14,-4 H14 M-14,4 H14" style="stroke-width:2.6"/><path d="M-20,22 H20" style="stroke-width:1.2"/>\`,
 poste:\`<path d="M-3,22 L-2,-20 H2 L3,22 Z"/><path d="M-17,-12 H17"/><path d="M-14,-12 V-18 M0,-20 V-24 M14,-12 V-18"/><path d="M-12,-12 L-2,-4 M12,-12 L2,-4"/><path d="M-10,22 H10"/>\`,
 chave:\`<path d="M-22,18 L-12,8 M12,-8 L22,-18"/><g transform="rotate(-45)"><rect x="-13" y="-5" width="26" height="10"/><path d="M-13,0 H13"/></g>\`,
 ferragens:\`<rect x="-21" y="-6" width="42" height="6"/><path d="M-14,0 L-3,13 M14,0 L3,13"/><path d="M-3,13 H3"/><path d="M-13,-6 V-11 M13,-6 V-11"/><circle cx="-13" cy="-15" r="4"/><circle cx="13" cy="-15" r="4"/><circle cx="-8" cy="-3" r="1" class="f"/><circle cx="8" cy="-3" r="1" class="f"/>\`,
 trafoPoste:\`<path d="M-11,22 L-10,-22 H-6 L-5,22 Z"/><path d="M-21,-15 H6"/><path d="M-18,-15 V-20 M3,-15 V-20"/><rect x="-2" y="-6" width="20" height="24" rx="4"/><path d="M3,-6 V-11 M13,-6 V-11"/><circle cx="5" cy="7" r="4"/><circle cx="11" cy="7" r="4"/>\`,
 cabo:\`<path d="M-22,-2 C-17,-10 -11,6 -5,-2 S7,-10 13,-2 S20,4 22,0"/><path d="M-22,4 C-17,12 -11,-4 -5,4 S7,12 13,4 S20,-2 22,2"/><path d="M-22,-14 V18 M22,-14 V18" style="stroke-width:1.2"/>\`,
 medidor:\`<rect x="-14" y="-21" width="28" height="42" rx="4"/><circle cx="0" cy="-6" r="8"/><path d="M0,-6 L5,-10"/><rect x="-8" y="8" width="16" height="7" rx="1"/><path d="M-5,11.5 h2 m2,0 h2 m2,0 h2" style="stroke-width:1.2"/>\`,
 gd:\`<path d="M-21,-1 L0,-18 L21,-1"/><path d="M-16,-5 V20 H16 V-5"/><rect x="-5" y="8" width="10" height="12"/><path d="M3,-14 L15,-4 L19,-9 L7,-19 Z" class="y"/>\`,
 subCliente:\`<path d="M-22,20 V0 L-15,-6 V0 L-8,-6 V0 L-1,-6 V20 Z"/><rect x="3" y="2" width="18" height="18" rx="2"/><path d="M7,2 V-6 M12,2 V-8 M17,2 V-6"/><circle cx="10" cy="11" r="3.6"/><circle cx="14" cy="11" r="3.6"/>\`,
 cabine:\`<rect x="-19" y="-18" width="38" height="36" rx="2"/><path d="M-19,-10 H19"/><path d="M-14,-4 H-4 M-14,1 H-4 M-14,6 H-4"/><rect x="2" y="-5" width="13" height="20"/><path d="M10,-1 L6,6 H10 L7,12" style="stroke-width:1.5"/>\`,
 casa:\`<path d="M-21,-1 L0,-18 L21,-1"/><path d="M-16,-5 V20 H16 V-5"/><rect x="-5" y="8" width="10" height="12"/><rect x="-12" y="0" width="7" height="6"/><rect x="5" y="0" width="7" height="6"/>\`,
 fabrica:\`<path d="M-22,20 V-2 L-12,-9 V-2 L-2,-9 V-2 L8,-9 V-2 L22,-2 V20 Z"/><path d="M14,-2 V-18 H19 V-2"/><path d="M-16,6 h5 M-6,6 h5 M4,6 h5"/><rect x="11" y="10" width="7" height="10"/>\`,
 quadro:\`<rect x="-16" y="-20" width="32" height="40" rx="2"/><path d="M-10,-12 v6 M-3,-12 v6 M4,-12 v6 M11,-12 v6 M-10,-1 v6 M-3,-1 v6 M4,-1 v6 M11,-1 v6" style="stroke-width:3"/><path d="M-10,13 H10"/>\`,
 medicao:\`<path d="M-22,-8 H6"/><circle cx="-14" cy="-8" r="4"/><circle cx="-2" cy="-8" r="4"/><path d="M-14,-4 V14 M-2,-4 V8"/><rect x="6" y="-8" width="16" height="24" rx="3"/><circle cx="14" cy="0" r="4"/><path d="M-2,8 H6" style="stroke-dasharray:2 2"/>\`,
 portico:\`<path d="M-17,22 V-18 M17,22 V-18 M-21,-14 H21"/><path d="M-7,-14 V-7 M7,-14 V-7"/><path d="M-3,22 V8 M-3,8 L8,0"/><circle cx="-3" cy="8" r="1.8" class="f"/>\`,
 cabine2:\`<rect x="-19" y="-18" width="38" height="36" rx="2"/><path d="M-19,-10 H19"/><path d="M-14,-4 H-4 M-14,1 H-4 M-14,6 H-4"/><rect x="2" y="-5" width="13" height="20"/><path d="M10,-1 L6,6 H10 L7,12" style="stroke-width:1.5"/>\`,
 caboSub:\`<path d="M-24,-10 H24" style="stroke-dasharray:3 3;stroke-width:1.2"/><rect x="-22" y="0" width="44" height="14" rx="3"/><path d="M-18,7 Q-12,1 -6,7 T6,7 T18,7"/>\`
};
function modem(x,y){ return \`<g class="modem" transform="translate(\${x},\${y})"><circle r="9.5"/><path d="M-5,-1 a7,7 0 0 1 10,0 M-2.8,1.6 a3.6,3.6 0 0 1 5.6,0"/><circle class="dot" cy="4.4" r="1.4"/></g>\`; }

/* ================= MESCLA DADOS + LAYOUT ================= */
const STAGES = DADOS.etapas.slice().sort((a,b)=>a.numero-b.numero).map(e=>Object.assign(
  {n:e.numero,name:e.nome,short:e.nome_curto||'',kv:e.tensao,lead:e.texto,items:[],more:MORE[e.numero]}, LAYOUT_ETAPAS[e.numero]));
const HOT = {};
DADOS.equipamentos.forEach(q=>{
  const L=LAYOUT_ROTULOS[q.id];
  HOT[q.id]={s:q.etapa,pill:q.rotulo||q.titulo,title:q.titulo,faz:q.o_que_faz,porque:q.por_que_existe,ana:q.analogia,
    compra:q.quem_compra,leitura:q.leitura_mercado,V:q.volume,R:q.recorrencia,C:q.crescimento,rom:q.portfolio?1:0,L};
  STAGES[q.etapa-1].items.push(q.id);
});
const ORDER = Object.keys(HOT);
const LIM = DADOS.parametros;
function score(h){ return h.V+h.R+h.C; }
function verdict(h){ const s=score(h); return s>=LIM.limiar_alto?['Alto','alto']:s>=LIM.limiar_medio?['Médio','medio']:['Concentrado','conc']; }
function posX(id){ const h=HOT[id]; return h.L? h.L.x : 730; }

/* ================= DIAGRAMA ================= */
function wrapLabel(t){
  const words=String(t).replace(/&amp;/g,'&').split(/\\s+/), lines=[]; let cur='';
  words.forEach(w=>{ if((cur+' '+w).trim().length>15 && cur){ lines.push(cur); cur=w; } else cur=(cur+' '+w).trim(); });
  if(cur) lines.push(cur);
  return lines.slice(0,3).map(l=>l.replace(/&/g,'&amp;'));
}
function vlab(x,y,t){ const w=t.length*7+12; return \`<g class="vlab"><rect x="\${x-w/2}" y="\${y-9}" width="\${w}" height="18"/><text x="\${x}" y="\${y+4}" text-anchor="middle">\${t}</text></g>\`; }
function cbox(id,y,title,kv,go,stage,iconDecor){
  return \`<g class="cbox" data-box="\${id}" data-go="\${go}" data-s="\${stage}" tabindex="0" role="button" aria-label="\${title}, \${kv}: ver como se liga à rede">
    <rect class="cb" x="1250" y="\${y-35}" width="200" height="70" rx="3"/>
    \${iconDecor?\`<g class="ic" transform="translate(1286,\${y})">\${ICONS[iconDecor]}</g>\`:''}
    <text x="1316" y="\${y-6}" class="cb-t">\${title}</text><text x="1316" y="\${y+12}" class="cb-k">\${kv}</text>
    <text x="1442" y="\${y+28}" text-anchor="end" class="cb-a">ver arranjo ↓</text></g>\`;
}
function drawDiagram(){
  let s='';
  // agrupamentos
  s+=\`<rect class="grp" x="16" y="16" width="246" height="214" rx="4"/><text x="30" y="40" class="grp-t">Centro de operação</text>\`;
  s+=\`<rect class="grp" x="16" y="262" width="246" height="246" rx="4"/>\`;
  // linhas (desenhadas antes dos ícones; o fundo branco dos ícones "corta" a linha)
  s+=\`<path class="wire w-gen" d="M75,\${Y} H195 M105,320 H135 V\${Y} M195,388 V\${Y}"/>\`;
  s+=\`<path class="wire w-tr" d="M195,\${Y} H450 M450,\${Y} V100 H1250"/>\`;
  s+=\`<path class="wire w-st" d="M450,\${Y} H700 M575,\${Y} V210 H1250"/>\`;
  s+=\`<path class="wire w-mt" d="M700,388 V\${Y} M700,\${Y} H1250 M1120,498 V665"/>\`;
  s+=\`<path class="wire w-bt" d="M1120,665 H800 M705,624 V630"/>\`;
  s+=\`<path class="w-dot" d="M1150,560 H1192"/>\`;
  s+=\`<path class="w-4g" d="M262,150 C360,150 400,300 462,398"/>\`;
  s+=\`<text x="300" y="138" class="cb-a" style="fill:var(--brand-d);font-weight:700">sinal 4G / rádio</text>\`;
  s+=vlab(860,100,'230 kV ou mais')+vlab(900,210,'69 a 138 kV')+vlab(388,Y,'500 kV')+vlab(637,Y,'138 kV')+vlab(760,Y,'13,8 kV')+vlab(1185,Y,'13,8 kV')+vlab(1055,665,'127/220 V')+vlab(930,665,'220 V');
  // consumidores
  s+=cbox('A1',100,'Consumidor A1','230 kV ou mais','arr-at',6,'fabrica');
  s+=cbox('A2',210,'Consumidor A2/A3','69 a 138 kV','arr-at',6,null);
  s+=cbox('A4',Y,'Consumidor A4','2,3 a 44 kV','arr-mt',9,null);
  s+=\`<g class="cbox" data-box="B" data-go="arr-bt" data-s="11" tabindex="0" role="button" aria-label="Consumidor B, menos de 2,3 kV: ver como se liga à rede">
     <rect class="cb" x="610" y="630" width="190" height="70" rx="3"/><g class="ic" transform="translate(646,665)">\${ICONS.casa}</g>
     <text x="682" y="659" class="cb-t">Consumidor B</text><text x="682" y="677" class="cb-k">abaixo de 2,3 kV</text><text x="792" y="693" text-anchor="end" class="cb-a">ver arranjo ↓</text></g>\`;
  // legenda
  s+=\`<g transform="translate(24,580)"><text class="legend-t" y="0">Legenda</text>
     <g transform="translate(10,30)">\${modem(0,0)}</g><text x="30" y="34" class="legend-x">Modem: envia dados e recebe comandos do centro de operação</text>
     <g transform="translate(10,64)" class="smk"><circle r="10"/><text y="4" text-anchor="middle">3</text></g><text x="30" y="68" class="legend-x">Etapa do tour (toque para abrir)</text>
     <path class="wire w-tr" d="M0,98 H20"/><path class="wire w-bt" d="M0,108 H20"/><text x="30" y="108" class="legend-x">Linha mais grossa, tensão mais alta</text>
     <rect x="0" y="126" width="20" height="16" style="fill:var(--brand)"/><text x="30" y="139" class="legend-x">Portfólio da empresa (com o destaque ligado)</text></g>\`;
  // ícones dos equipamentos
  let nodes='';
  ORDER.forEach(id=>{
    const h=HOT[id], L=h.L; if(!L) return;
    const lines=L.nolabel?[]:wrapLabel(h.pill);
    nodes+=\`<g class="node" data-id="\${id}" data-s="\${h.s}" data-rom="\${h.rom}" tabindex="0" role="button" aria-label="\${h.title}" transform="translate(\${L.x},\${L.y})">
      <rect class="nbg" x="-30" y="-30" width="60" height="60" rx="6"/>
      <g class="ic">\${ICONS[L.icon]||''}</g>\${L.modem?modem(24,-24):''}
      \${lines.map((l,i)=> L.lab==='left' ? \`<text class="nl" x="-36" y="\${4-(lines.length-1)*7.5+i*15}" text-anchor="end">\${l}</text>\` : \`<text class="nl" y="\${47+i*15}" text-anchor="middle">\${l}</text>\`).join('')}</g>\`;
  });
  // marcadores de etapa
  let mk='';
  STAGES.forEach(st=>{ if(!st.m) return; mk+=\`<g class="smk" data-s="\${st.n}" tabindex="0" role="button" aria-label="Etapa \${st.n}: \${st.name}" transform="translate(\${st.m[0]},\${st.m[1]})"><circle r="10.5"/><text y="4" text-anchor="middle">\${st.n}</text></g>\`; });
  $('#diaSvg').innerHTML = s + nodes + mk;
}

/* ================= DEGRAUS DE TENSÃO ================= */
function drawStair(){
  const y = v => 186 - (Math.log10(v)+1)/4*160;
  const x0=74, step=90;
  const lv=[{v:13.8,l:'Usina'},{v:500,l:'Transmissão'},{v:138,l:'Subtransmissão'},{v:13.8,l:'Rede MT'},{v:0.22,l:'Casa'}];
  let s='';
  [[0.22,'220 V'],[13.8,'13,8 kV'],[138,'138 kV'],[500,'500 kV']].forEach(([v,t])=>{ s+=\`<line x1="\${x0}" x2="\${x0+step*5}" y1="\${y(v).toFixed(1)}" y2="\${y(v).toFixed(1)}" class="cap-grid" stroke-dasharray="3 4"/><text x="\${x0-8}" y="\${(y(v)+4).toFixed(1)}" text-anchor="end" class="cap-tick">\${t}</text>\`; });
  lv.forEach((p,i)=>{
    const xa=x0+i*step+6, xb=x0+(i+1)*step-6, yy=y(p.v).toFixed(1);
    s+=\`<path d="M\${xa},\${yy} H\${xb}" style="stroke:var(--ink);stroke-width:5;stroke-linecap:square"/><text x="\${x0+i*step+step/2}" y="216" text-anchor="middle" class="cap-name" style="font-size:12.5px">\${p.l}</text>\`;
    if(i<lv.length-1){
      const xs=x0+(i+1)*step, ya=y(p.v), yb=y(lv[i+1].v), ym=(ya+yb)/2;
      s+=\`<path d="M\${xs-6},\${ya.toFixed(1)} Q\${xs},\${ya.toFixed(1)} \${xs},\${ym.toFixed(1)} Q\${xs},\${yb.toFixed(1)} \${xs+6},\${yb.toFixed(1)}" style="fill:none;stroke:var(--faint);stroke-width:1.2"/>\`;
      s+=\`<circle cx="\${xs-4}" cy="\${ym.toFixed(1)}" r="6" style="fill:var(--brand);stroke:var(--ink);stroke-width:1.3"/><circle cx="\${xs+4}" cy="\${ym.toFixed(1)}" r="6" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>\`;
      s+=\`<text x="\${xs+13}" y="\${(ym+4).toFixed(1)}" style="font:italic 12px var(--f-body);fill:var(--muted)">\${i===0?'eleva':'reduz'}</text>\`;
    }
  });
  $('#stair').innerHTML=s;
}

/* ================= ARRANJOS DOS CONSUMIDORES ================= */
const ARR = {
 bt:{aria:'Ligação de baixa tensão: transformador do poste, ramal de ligação, padrão de entrada com medidor, quadro de distribuição e aparelhos. Painéis solares injetam energia no quadro.', boundary:1,
  nodes:[{ic:'trafoPoste',l:['Transformador','do poste'],hot:'trafoDist'},{ic:'cabo',l:['Ramal','de ligação'],hot:'redeBT'},{ic:'medidor',l:['Padrão de entrada','e medidor'],hot:'medidor'},{ic:'quadro',l:['Quadro de','distribuição']},{ic:'casa',l:['Tomadas e','aparelhos']}],
  arrows:{0:'220 V'}, wt:['w-bt','w-bt','w-bt','w-bt'],
  branch:{at:2,to:3,ic:'solar',l:['Painéis solares','e inversor'],hot:'gd',label:'energia do sol'}},
 mt:{aria:'Ligação de média tensão: rede de 13,8 kV, chave fusível, medição em média tensão, disjuntor e relé, transformador do cliente, painel geral de baixa tensão e cargas.', boundary:1,
  nodes:[{ic:'poste',l:['Rede de','média tensão'],hot:'postes'},{ic:'chave',l:['Chave fusível','e para-raios'],hot:'chave'},{ic:'medicao',l:['Medição em MT','(TCs, TPs, medidor)']},{ic:'disjuntor',l:['Disjuntor MT e','relé de proteção']},{ic:'subDown',l:['Transformador','do cliente'],hot:'compacta'},{ic:'paineis',l:['Painel geral','de baixa tensão'],hot:'paineis'},{ic:'fabrica',l:['Máquinas, luz,','climatização']}],
  arrows:{0:'13,8 kV',4:'380 V'}, wt:['w-mt','w-mt','w-mt','w-mt','w-bt','w-bt'],
  brackets:[{from:2,to:4,label:'dentro da cabine ou subestação compacta',rom:'compacta'}]},
 at:{aria:'Ligação de alta tensão: linha de 138 kV, pórtico de entrada, medição de faturamento, disjuntor, transformador de potência, painéis de média tensão, rede interna, cabines junto às cargas e máquinas.', boundary:0,
  nodes:[{ic:'torre',l:['Linha de','138 kV'],hot:'subtrans'},{ic:'portico',l:['Pórtico, chaves','e para-raios'],hot:'patio'},{ic:'medicao',l:['Medição de','faturamento']},{ic:'disjuntor',l:['Disjuntor de','alta tensão'],hot:'patio'},{ic:'subDown',l:['Transformador','de potência'],hot:'consAT'},{ic:'paineis',l:['Painéis de','média tensão'],hot:'paineis'},{ic:'caboSub',l:['Rede interna','de MT']},{ic:'cabine',l:['Cabines junto','às cargas'],hot:'compacta'},{ic:'fabrica',l:['Fornos, motores,','servidores']}],
  arrows:{4:'13,8 kV',7:'380 V'}, wt:['w-st','w-st','w-st','w-st','w-mt','w-mt','w-mt','w-bt'],
  brackets:[{from:1,to:4,label:'subestação principal do cliente'},{from:5,to:7,label:'distribuição interna',rom:'paineis'}]}
};
function chainSVG(cfg){
  const TW=80, ST=136, X0=26, TY=64, n=cfg.nodes.length;
  const width = X0*2+(n-1)*ST+TW, H = cfg.branch? 346 : 206;
  const tx=i=>X0+i*ST;
  const bx = tx(cfg.boundary)+TW+(ST-TW)/2;
  let s=\`<svg class="chain" viewBox="0 0 \${width} \${H}" style="width:\${width}px" role="img" aria-label="\${cfg.aria}">\`;
  s+=\`<rect x="\${bx}" y="30" width="\${width-bx-4}" height="\${H-34}" class="client"/>\`;
  s+=\`<path d="M\${bx},28 V88 M\${bx},120 V\${H-6}" class="bound"/>\`;
  s+=\`<text x="\${bx-10}" y="22" text-anchor="end" class="own">Distribuidora</text><text x="\${bx+10}" y="22" class="own">Cliente</text>\`;
  (cfg.brackets||[]).forEach(b=>{ const x1=tx(b.from), x2=tx(b.to)+TW, br=b.rom&&HOT[b.rom]&&HOT[b.rom].rom; s+=\`<g class="brk\${br?' rom':''}"><path d="M\${x1},59 V52 H\${x2} V59" class="brk-l"/><text x="\${(x1+x2)/2}" y="45" text-anchor="middle" class="brk-t">\${b.label}</text></g>\`; });
  for(let i=0;i<n-1;i++){
    const x1=tx(i)+TW+5, x2=tx(i+1)-5;
    s+=\`<path d="M\${x1},104 H\${x2-7}" class="wire \${cfg.wt[i]}"/><path d="M\${x2-9},99 L\${x2},104 L\${x2-9},109 Z" class="arrow"/>\`;
    if(cfg.arrows[i]) s+=\`<text x="\${(x1+x2)/2}" y="95" text-anchor="middle" class="akv">\${cfg.arrows[i]}</text>\`;
  }
  const tile=(nd,x,y)=>{ const hot=nd.hot&&HOT[nd.hot]?nd.hot:null, rom=hot?HOT[hot].rom:0;
    return \`<g class="tile\${hot?' hot':''}\${rom?' rom':''}" transform="translate(\${x},\${y})"\${hot?\` data-hot="\${hot}" tabindex="0" role="button" aria-label="\${nd.l.join(' ')}: ver no desenho"\`:''}><rect width="\${TW}" height="\${TW}" rx="3" class="tile-bg"/><g class="ic" transform="translate(40,40) scale(1.15)">\${ICONS[nd.ic]}</g></g>\`; };
  cfg.nodes.forEach((nd,i)=>{ const x=tx(i); s+=tile(nd,x,TY); nd.l.forEach((ln,j)=> s+=\`<text x="\${x+TW/2}" y="\${TY+TW+18+j*15}" text-anchor="middle" class="tl">\${ln}</text>\`); });
  if(cfg.branch){
    const b=cfg.branch, x=tx(b.at), y=222, xc=x+TW+28, xt=tx(b.to)-5;
    s+=tile(b,x,y);
    b.l.forEach((ln,j)=> s+=\`<text x="\${x+TW/2}" y="\${y+TW+18+j*15}" text-anchor="middle" class="tl">\${ln}</text>\`);
    s+=\`<path d="M\${x+TW+4},\${y+40} H\${xc} V128 H\${xt-7}" class="wire w-bt"/><path d="M\${xt-9},123 L\${xt},128 L\${xt-9},133 Z" class="arrow"/>\`;
    s+=\`<text x="\${xc+8}" y="\${y+44}" class="akv">\${b.label}</text>\`;
  }
  return s+'</svg>';
}
const VARIANTS = [
 {t:'Subestação aérea', p:'O transformador fica num poste do próprio cliente. É a forma mais simples e barata, usada em potências menores (em geral até cerca de 300 kVA, conforme a distribuidora).'},
 {t:'Cabine de alvenaria', p:'Uma sala construída no local abriga medição, proteção e transformador. Comum em prédios e indústrias mais antigas.'},
 {t:'Subestação compacta', rom:'compacta', p:'Medição, proteção e transformador montados em fábrica dentro de um invólucro metálico. Chega pronta, instala rápido e ocupa pouco espaço.'},
 {t:'Transformador pedestal', p:'Um gabinete metálico fechado, instalado no chão, para redes subterrâneas de condomínios, loteamentos e áreas urbanas.'}
];

/* ================= MERCADO ================= */
function fmtQtd(v){
  const f=(x)=> x<10? x.toLocaleString('pt-BR',{maximumFractionDigits:1}) : Math.round(x).toLocaleString('pt-BR');
  if(v>=1e9) return '≈ '+f(v/1e9)+' bi';
  if(v>=1e6){ const x=v/1e6; return '≈ '+f(x)+(f(x)==='1'?' milhão':' milhões'); }
  if(v>=1e3) return '≈ '+f(v/1e3)+' mil';
  return v.toLocaleString('pt-BR');
}
function drawCapil(){
  const rows=DADOS.base_instalada;
  const vals=rows.map(r=>r.quantidade).filter(v=>v>0);
  const lo=Math.max(0,Math.floor(Math.log10(Math.min(...vals)))-1), hi=Math.max(lo+1,Math.ceil(Math.log10(Math.max(...vals))-1e-9));
  const L=244, R=606, X=v=>L+(Math.log10(Math.max(v,Math.pow(10,lo)))-lo)/(hi-lo)*(R-L);
  const NOMES={0:'1',1:'10',2:'100',3:'mil',4:'10 mil',5:'100 mil',6:'1 mi',7:'10 mi',8:'100 mi',9:'1 bi',10:'10 bi'};
  const bottom=18+rows.length*56-8, svg=$('#capil');
  svg.setAttribute('viewBox',\`0 0 640 \${bottom+30}\`);
  let s='';
  for(let k=lo;k<=hi;k++){ const x=X(Math.pow(10,k)).toFixed(1); s+=\`<line x1="\${x}" x2="\${x}" y1="8" y2="\${bottom}" class="cap-grid"/><text x="\${x}" y="\${bottom+20}" text-anchor="middle" class="cap-tick">\${NOMES[k]||('1e'+k)}</text>\`; }
  rows.forEach((r,i)=>{ const y=18+i*56, txt=fmtQtd(r.quantidade)+(r.estimativa?' (estimativa)':''), w=Math.max(0,X(r.quantidade)-L);
    s+=\`<text x="0" y="\${y+12}" class="cap-name">\${r.item}</text><text x="0" y="\${y+30}" class="cap-val">\${txt}</text>\`;
    s+=\`<rect x="\${L}" y="\${y}" width="\${w.toFixed(1)}" height="24" class="bar\${r.estimativa?' est':''}"><title>\${r.item}: \${txt}\${r.nota?' · '+r.nota:''}</title></rect>\`;
    s+=\`<rect x="\${(L+w-4).toFixed(1)}" y="\${y}" width="4" height="24" class="bar-cap"/>\`; });
  svg.innerHTML=s;
  svg.setAttribute('aria-label','Quantidade instalada no Brasil, em escala logarítmica: '+rows.map(r=>r.item+' '+fmtQtd(r.quantidade)+(r.estimativa?' (estimativa)':'')).join('; ')+'.');
}
const FORCES=[
 {t:'Quantidade instalada', m:'medido como Volume', p:'Poucas usinas no tronco, milhares de subestações nos galhos e dezenas de milhões de pontos nas folhas. Equipamento que fica perto do consumidor existe aos milhões.'},
 {t:'Reposição', m:'medido como Recorrência', p:'Postes são atingidos por carros, transformadores queimam com raios e sobrecarga, eletrônicos envelhecem mais rápido. Base grande com troca frequente gera compra todo mês, não só quando há obra nova.'},
 {t:'Crescimento e regulação', m:'medido como Crescimento', p:'Novas ligações, ar-condicionado, carro elétrico, painéis solares e data centers pedem reforço da rede. A ANEEL mede quanto tempo e quantas vezes cada região fica sem luz (DEC e FEC) e penaliza quem passa do limite, o que acelera a compra de religadores e automação.'},
 {t:'Número de compradores', m:'medido como Quem compra', p:'Na transmissão, poucas empresas fazem pedidos grandes e raros. Na distribuição, dezenas de distribuidoras e cooperativas compram o ano inteiro. Nos clientes de média tensão, milhares de indústrias, construtoras e instaladoras viram compradores.'}
];
const segs=v=>\`<span class="segs" aria-label="\${v} de 5">\${[1,2,3,4,5].map(i=>\`<i class="\${i<=v?'on':''}"></i>\`).join('')}</span>\`;
function buildMarket(){
  drawCapil();
  $('#forces').innerHTML=FORCES.map(f=>\`<div class="force"><h4>\${f.t}</h4><p class="meas">\${f.m}</p><p>\${f.p}</p></div>\`).join('');
  const ids=ORDER.slice().sort((a,b)=> score(HOT[b])-score(HOT[a]) || HOT[b].V-HOT[a].V || HOT[a].s-HOT[b].s);
  $('#tbl tbody').innerHTML=ids.map(id=>{ const h=HOT[id], [vt,vc]=verdict(h), st=STAGES[h.s-1];
    return \`<tr class="row\${h.rom?' rom':''}" data-hot="\${id}" tabindex="0"><td class="eq"><span class="rdot"></span>\${h.title}</td><td class="st">\${st.n}. \${st.name}</td><td>\${segs(h.V)}</td><td>\${segs(h.R)}</td><td>\${segs(h.C)}</td><td><span class="vd vd-\${vc}">\${vt}</span></td><td class="st">\${h.compra}</td></tr>\`; }).join('');
}

/* ================= ESTADO E INTERAÇÃO ================= */
const state={stage:null, hot:null};
const svg=()=>$('#diaSvg');
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hotCard(id){
  const h=HOT[id], st=STAGES[h.s-1], [vt,vc]=verdict(h);
  return \`<div class="info-head"><p class="eyebrow">Etapa \${st.n} · \${st.name}</p><button class="x" data-close aria-label="Fechar">×</button></div>
   <h3>\${h.title}</h3>\${h.rom?'<p class="romtag">Portfólio da empresa</p>':''}
   <dl><dt>O que faz</dt><dd>\${h.faz}</dd><dt>Por que existe</dt><dd>\${h.porque}</dd></dl>
   \${h.ana?\`<p class="ana"><span>Pense assim</span>\${h.ana}</p>\`:''}
   <div class="mkt"><div class="mkt-head"><h4>Potencial de mercado</h4><span class="vd vd-\${vc}">\${vt}</span></div>
     <div class="m"><span>Volume</span>\${segs(h.V)}</div><div class="m"><span>Recorrência</span>\${segs(h.R)}</div><div class="m"><span>Crescimento</span>\${segs(h.C)}</div>
     <p class="buy"><b>Quem compra:</b> \${h.compra}</p><p class="read">\${h.leitura}</p></div>
   \${state.stage?\`<div class="stepnav"><button class="btn" data-back>← Voltar à etapa \${state.stage}</button></div>\`:''}\`;
}
function stageCard(n){
  const st=STAGES[n-1];
  return \`<div class="info-head"><p class="eyebrow">Etapa \${n} de \${STAGES.length}</p><button class="x" data-close aria-label="Encerrar o tour">×</button></div>
   <h3>\${st.name}</h3><p class="kv">\${st.kv}</p><p>\${st.lead}</p>
   \${st.items.length?\`<p class="sub">Equipamentos desta etapa</p><div class="chips">\${st.items.map(id=>\`<button class="chip\${HOT[id].rom?' rom':''}" data-id="\${id}">\${HOT[id].title}</button>\`).join('')}</div>\`:''}
   \${st.more?\`<a class="more" href="#\${st.more}">Ver como esse cliente se liga à rede ↓</a>\`:''}
   <div class="stepnav"><button class="btn" data-nav="-1" \${n===1?'disabled':''}>← Anterior</button><button class="btn primary" data-nav="1" \${n===STAGES.length?'disabled':''}>Próxima →</button></div>\`;
}
function renderTour(){
  const t=$('#tour'), N=STAGES.length;
  if(!state.stage){ t.innerHTML=\`<button class="btn primary" data-act="start">Fazer o tour em \${N} etapas</button><span class="hint">ou toque em qualquer ícone</span>\`; return; }
  const st=STAGES[state.stage-1];
  t.innerHTML=\`<button class="btn" data-act="prev" aria-label="Etapa anterior" \${state.stage===1?'disabled':''}>←</button><span class="tour-pos">Etapa \${state.stage} de \${N} · <b>\${st.name}</b></span><button class="btn" data-act="next" aria-label="Próxima etapa" \${state.stage===N?'disabled':''}>→</button><button class="btn ghost" data-act="end">Encerrar</button>\`;
}
function stageX(n){ const st=STAGES[n-1]; return st.m? st.m[0]+30 : 730; }
function applyState(){
  const s=svg(); if(!s) return;
  s.classList.toggle('touring', !!state.stage);
  $$('.node',s).forEach(g=> g.classList.toggle('on', !!state.stage && +g.dataset.s===state.stage));
  $$('.cbox',s).forEach(g=> g.classList.toggle('on', !!state.stage && +g.dataset.s===state.stage));
  $$('.smk',s).forEach(g=> g.classList.toggle('on', !!state.stage && +g.dataset.s===state.stage));
  $$('.node',s).forEach(p=> p.classList.toggle('sel', p.dataset.id===state.hot));
  const info=$('#info'); let x=null;
  if(state.hot){ info.innerHTML=hotCard(state.hot); x=posX(state.hot); }
  else if(state.stage){ info.innerHTML=stageCard(state.stage); x=stageX(state.stage); }
  if(x===null){ info.hidden=true; info.innerHTML=''; }
  else { info.hidden=false; info.classList.toggle('left', x>760); info.classList.toggle('right', x<=760); info.scrollTop=0; }
  renderTour();
}
function scrollToX(x){
  const sc=$('#diaScroll'); if(sc.scrollWidth<=sc.clientWidth+2) return;
  const px=x/1460*sc.scrollWidth; sc.scrollTo({left:Math.max(0,px-sc.clientWidth/2),behavior:reduce?'auto':'smooth'});
}
function setStage(n){ state.stage=n; state.hot=null; applyState(); if(n) scrollToX(stageX(n)); }
function openHot(id, fromOutside){
  if(!HOT[id]) return;
  state.hot=id;
  if(state.stage && HOT[id].s!==state.stage) state.stage=HOT[id].s;
  applyState(); scrollToX(posX(id));
  if(fromOutside){ $('#dia').scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); }
}
function goBox(el){ const t=document.getElementById(el.dataset.go); if(t) t.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); }

function wire(){
  const s=svg();
  const act=(e)=>{
    const n=e.target.closest('.node'); if(n){ openHot(n.dataset.id); return true; }
    const m=e.target.closest('.smk'); if(m){ setStage(+m.dataset.s); return true; }
    const b=e.target.closest('.cbox'); if(b){ goBox(b); return true; }
    return false;
  };
  s.addEventListener('click',act);
  s.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && act(e)) e.preventDefault(); });
  $('#info').addEventListener('click',e=>{
    if(e.target.closest('[data-close]')){ if(state.hot && state.stage){ state.hot=null; applyState(); } else { setStage(null); } return; }
    if(e.target.closest('[data-back]')){ state.hot=null; applyState(); return; }
    const nav=e.target.closest('[data-nav]'); if(nav){ setStage(Math.min(STAGES.length,Math.max(1,state.stage+ +nav.dataset.nav))); return; }
    const c=e.target.closest('.chip'); if(c){ openHot(c.dataset.id); return; }
  });
  $('#tour').addEventListener('click',e=>{
    const a=e.target.closest('[data-act]'); if(!a) return;
    const k=a.dataset.act, N=STAGES.length;
    if(k==='start') setStage(1);
    else if(k==='prev') setStage(Math.max(1,state.stage-1));
    else if(k==='next') setStage(Math.min(N,state.stage+1));
    else if(k==='end') setStage(null);
  });
  document.addEventListener('keydown',e=>{
    if(e.target.matches && e.target.matches('input,textarea,select')) return;
    if(e.key==='Escape' && (state.hot||state.stage)){ if(state.hot && state.stage){ state.hot=null; applyState(); } else setStage(null); }
    if(!state.stage) return;
    if(e.key==='ArrowRight'){ e.preventDefault(); setStage(Math.min(STAGES.length,state.stage+1)); }
    if(e.key==='ArrowLeft'){ e.preventDefault(); setStage(Math.max(1,state.stage-1)); }
  });
  const tog=$('#romToggle');
  tog.addEventListener('change',()=>{ document.body.classList.toggle('rom-on',tog.checked); try{ localStorage.setItem('rom-on',tog.checked?'1':'0'); }catch(_){} });
  try{ if(localStorage.getItem('rom-on')==='1'){ tog.checked=true; document.body.classList.add('rom-on'); } }catch(_){}
  document.addEventListener('click',e=>{ const t=e.target.closest('.tile.hot, tr.row'); if(t) openHot(t.dataset.hot,true); });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter' && e.key!==' ') return;
    const t=e.target.closest && e.target.closest('.tile.hot, tr.row'); if(t){ e.preventDefault(); openHot(t.dataset.hot,true); }
  });
}

/* ================= INÍCIO ================= */
drawStair();
drawDiagram();
['bt','mt','at'].forEach(k=> $('#chain-'+k).innerHTML=chainSVG(ARR[k]));
$('#variants').innerHTML=VARIANTS.map(v=>\`<div class="var\${v.rom&&HOT[v.rom]&&HOT[v.rom].rom?' rom':''}"><span class="var-tag">Portfólio da empresa</span><h4>\${v.t}</h4><p>\${v.p}</p></div>\`).join('');
// Strategy OS: buildMarket(), the sources list and the update date are not drawn — their sections were removed (PO, 13/11/2026)
wire();
applyState();
})();
<\/script>

</body>
</html>
`;export{e as default};