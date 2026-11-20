/* ============================================================
   Ficha de Lectio Divina en PDF, rellenando la plantilla original.
   Página 1: nivel (en lugar de «JUNIORS 26/27») + título y serie.
   Página 2: texto bíblico ajustado al hueco del libro.
   Página 3: las tres preguntas en la cabecera de cada recuadro.
   Página 4: «Querido Jesús:» + oración 1 al principio y oración 2 a la mitad.
   Uso: CatequesisPDF.descargar(registro)  ·  CatequesisPDF.generar(registro) → Uint8Array
   Las medidas están en puntos, desde ARRIBA de la página (A4: 595 × 842).
   ============================================================ */
(function (raiz) {
  "use strict";
  const PLANTILLAS = { _defecto: "lectio-plantilla.pdf" };   // se puede poner una por nivel: { "Postcomunión": "…pdf" }
  const LIB = "vendor/pdf-lib.min.js";
  const H = 842;

  const C = {
    crema1: [250, 242, 229], crema4: [250, 244, 232], caja: [250, 248, 243],
    azul: [58, 70, 92], oro: [149, 105, 0], tinta: [45, 38, 30], pluma: [70, 55, 40]
  };

  function cargarLib() {
    if (raiz.PDFLib) return Promise.resolve(raiz.PDFLib);
    if (typeof require === "function" && typeof window === "undefined") return Promise.resolve(require("pdf-lib"));
    return new Promise((ok, mal) => {
      const s = document.createElement("script"); s.src = LIB;
      s.onload = () => ok(raiz.PDFLib); s.onerror = () => mal(new Error("No se pudo cargar pdf-lib"));
      document.head.appendChild(s);
    });
  }
  const cache = {};
  async function plantilla(nivel) {
    const url = PLANTILLAS[nivel] || PLANTILLAS._defecto;
    if (!cache[url]) cache[url] = fetch(url).then(r => { if (!r.ok) throw new Error("No se encuentra la plantilla " + url); return r.arrayBuffer(); });
    return cache[url];
  }

  /* ---------- Texto ---------- */
  const SUST = { "‘": "'", "’": "'", "‚": ",", "“": "\"", "”": "\"", "′": "'", " ": " ", " ": " ", " ": " ", "\t": " " };
  function limpio(font, s) {
    const ok = new Set(font.getCharacterSet());
    return [...String(s || "")].map(ch => {
      if (ch === "\n") return ch;
      if (ok.has(ch.codePointAt(0))) return ch;
      const t = SUST[ch]; if (t !== undefined) return t;
      const sin = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return sin && ok.has(sin.codePointAt(0)) ? sin : "";
    }).join("");
  }
  // Parte un texto en líneas que caben en «ancho»; los saltos de línea separan párrafos.
  function partir(font, size, texto, ancho) {
    const parrafos = texto.replace(/\r/g, "").split("\n");
    const lineas = [];
    parrafos.forEach((p, i) => {
      const palabras = p.split(/ +/).filter(Boolean);
      if (!palabras.length) { lineas.push({ t: "", vacia: true }); return; }
      let actual = "";
      for (const w of palabras) {
        const prueba = actual ? actual + " " + w : w;
        if (font.widthOfTextAtSize(prueba, size) <= ancho || !actual) {
          // palabra sola más ancha que la caja: se corta
          if (!actual && font.widthOfTextAtSize(w, size) > ancho) {
            let trozo = "";
            for (const ch of w) { if (font.widthOfTextAtSize(trozo + ch, size) > ancho) { lineas.push({ t: trozo }); trozo = ""; } trozo += ch; }
            actual = trozo;
          } else actual = prueba;
        } else { lineas.push({ t: actual }); actual = w; }
      }
      lineas.push({ t: actual, fin: true });
    });
    // quita párrafos vacíos al principio y al final
    while (lineas.length && lineas[0].vacia) lineas.shift();
    while (lineas.length && lineas[lineas.length - 1].vacia) lineas.pop();
    return lineas;
  }
  // Busca el mayor tamaño de letra con el que el texto cabe en la caja.
  function ajustar(font, texto, ancho, alto, max, min, interlinea, hueco) {
    let lo = min, hi = max, mejor = null;
    const medir = size => {
      const lineas = partir(font, size, texto, ancho);
      const alto = lineas.reduce((a, l) => a + (l.vacia ? size * hueco : size * interlinea), 0);
      return { size, lineas, alto };
    };
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2, m = medir(mid);
      if (m.alto <= alto) { mejor = m; lo = mid; } else hi = mid;
    }
    return mejor || medir(min);
  }
  const rgb = (L, c) => L.rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  function rect(L, pg, x, yTop, w, h, color, extra) {
    pg.drawRectangle(Object.assign({ x, y: H - yTop - h, width: w, height: h, color: rgb(L, color) }, extra || {}));
  }
  function texto(L, pg, t, x, yBase, font, size, color, alinear, ancho) {
    let xx = x;
    if (alinear === "centro") xx = x + (ancho - font.widthOfTextAtSize(t, size)) / 2;
    pg.drawText(t, { x: xx, y: H - yBase, size, font, color: rgb(L, color) });
  }
  function espaciado(L, pg, t, xCentro, yBase, font, size, color, esp) {
    const anchos = [...t].map(ch => font.widthOfTextAtSize(ch, size));
    const total = anchos.reduce((a, b) => a + b, 0) + esp * (anchos.length - 1);
    let x = xCentro - total / 2;
    [...t].forEach((ch, i) => { pg.drawText(ch, { x, y: H - yBase, size, font, color: rgb(L, color) }); x += anchos[i] + esp; });
  }

  /* ---------- Preguntas: separa «1. … | 2. … | 3. …» si vienen juntas ---------- */
  function preguntas(r) {
    let qs = [r.pregunta1, r.pregunta2, r.pregunta3].map(q => String(q || "").trim());
    if (qs[0].includes("|") && !qs[1] && !qs[2]) qs = qs[0].split("|").map(q => q.trim()).concat(["", ""]).slice(0, 3);
    return qs.map(q => q.replace(/^\s*\d+\s*[.)-]\s*/, ""));
  }

  async function generar(r) {
    const L = await cargarLib();
    const doc = await L.PDFDocument.load(await plantilla(r.nivel));
    const F = {
      rom: await doc.embedFont(L.StandardFonts.TimesRoman),
      neg: await doc.embedFont(L.StandardFonts.TimesRomanBold),
      cur: await doc.embedFont(L.StandardFonts.TimesRomanItalic),
      negcur: await doc.embedFont(L.StandardFonts.TimesRomanBoldItalic)
    };
    const [p1, p2, p3, p4] = doc.getPages();

    /* --- Página 1: portada --- */
    rect(L, p1, 190, 39, 222, 29, C.crema1);
    const nivel = limpio(F.rom, (r.nivel || "").toUpperCase());
    espaciado(L, p1, nivel, 297.5, 62, F.rom, nivel.length > 10 ? 18 : 20, C.azul, 2.2);
    // Cartela inferior con el título y la serie
    {
      const x = 86, w = 423, top = 716, h = 76;
      p1.drawSvgPath(`M ${x + 10} 0 H ${x + w - 10} Q ${x + w} 0 ${x + w} 10 V ${h - 10} Q ${x + w} ${h} ${x + w - 10} ${h} H ${x + 10} Q ${x} ${h} ${x} ${h - 10} V 10 Q ${x} 0 ${x + 10} 0 Z`,
        { x: 0, y: H - top, color: rgb(L, [253, 248, 238]), opacity: 0.93, borderColor: rgb(L, [205, 175, 110]), borderWidth: 0.8 });
      const tit = limpio(F.neg, (r.sesion ? r.sesion + ". " : "") + (r.titulo || ""));
      const ser = limpio(F.cur, (r.serie || "").replace(/\s+/g, " "));
      const t = ajustar(F.neg, tit, w - 28, 42, 21, 10, 1.12, 0);
      const s = ajustar(F.cur, ser, w - 28, 15, 13.5, 7, 1.1, 0);
      const altoTotal = t.alto + 4 + (ser ? s.size * 1.1 : 0);
      let y = top + (h - altoTotal) / 2 + t.size * 0.86;
      t.lineas.forEach(l => { texto(L, p1, l.t, x, y, F.neg, t.size, C.azul, "centro", w); y += t.size * 1.12; });
      if (ser) texto(L, p1, s.lineas[0].t, x, y - t.size * 1.12 + 4 + s.size * 1.05, F.cur, s.size, C.oro, "centro", w);
    }

    /* --- Página 2: texto bíblico en la página derecha del libro --- */
    {
      const x = 134, w = 352, top = 222, bottom = 650;
      let y0 = top;
      const pas = limpio(F.negcur, r.pasaje || "");
      if (pas) { texto(L, p2, pas, x, top + 12, F.negcur, 13, C.oro, "centro", w); y0 = top + 26; }
      const cuerpo = limpio(F.rom, r.texto || "");
      if (cuerpo.trim()) {
        const a = ajustar(F.rom, cuerpo, w, bottom - y0, 16, 6, 1.27, 0.45);
        const poesia = /[^\n]\n[^\n]/.test(cuerpo);   // salmos: un verso por línea, sin justificar
        let y = y0 + a.size;
        a.lineas.forEach(l => {
          if (l.vacia) { y += a.size * 0.45; return; }
          // justificado salvo la última línea de cada párrafo
          const palabras = l.t.split(" ");
          const libre = w - F.rom.widthOfTextAtSize(l.t, a.size);
          if (!poesia && !l.fin && palabras.length > 1 && libre < w * 0.25) {
            const extra = libre / (palabras.length - 1);
            let xx = x;
            palabras.forEach(pw => { p2.drawText(pw, { x: xx, y: H - y, size: a.size, font: F.rom, color: rgb(L, C.tinta) }); xx += F.rom.widthOfTextAtSize(pw + " ", a.size) + extra; });
          } else texto(L, p2, l.t, x, y, F.rom, a.size, C.tinta);
          y += a.size * 1.27;
        });
      }
    }

    /* --- Página 3: preguntas en la cabecera de cada recuadro --- */
    {
      const cajas = [[97, 146], [331, 377], [565, 614]];   // [arriba, abajo] de la zona que se cubre
      preguntas(r).forEach((q, i) => {
        if (!q) return;
        const [a, b] = cajas[i];
        rect(L, p3, 70, a, 456, b - a, C.caja);
        const t = ajustar(F.neg, limpio(F.neg, (i + 1) + ". " + q), 436, b - a - 6, 14, 7.5, 1.18, 0);
        let y = a + (b - a - t.alto) / 2 + t.size * 0.9;
        t.lineas.forEach(l => { texto(L, p3, l.t, 80, y, F.neg, t.size, C.oro); y += t.size * 1.18; });
      });
    }

    /* --- Página 4: carta a Jesús --- */
    {
      rect(L, p4, 238, 113, 122, 25, C.crema4);
      texto(L, p4, limpio(F.rom, "Querido Jesús:"), 0, 131, F.rom, 17, C.oro, "centro", 595);
      const lineas = Array.from({ length: 19 }, (_, i) => 166 + 33 * i);
      const escribir = (frase, desde) => {
        const t = limpio(F.cur, String(frase || "").trim());
        if (!t) return;
        let i = desde;
        const izq = y => y < 225 ? 150 : y > 480 ? 200 : 80;   // arriba a la izquierda hay flores; abajo, la niña rezando
        let resto = t.split(/\s+/);
        while (resto.length && i < lineas.length) {
          const x = izq(lineas[i]), ancho = 518 - x;
          let l = "";
          while (resto.length && F.cur.widthOfTextAtSize((l ? l + " " : "") + resto[0], 14) <= ancho) l = (l ? l + " " : "") + resto.shift();
          if (!l) l = resto.shift();
          texto(L, p4, l, x, lineas[i] - 4, F.cur, 14, C.pluma);
          i++;
        }
      };
      escribir(r.oracion1, 0);
      escribir(r.oracion2, 9);
    }

    doc.setTitle(`Lectio Divina · ${r.sesion ? r.sesion + ". " : ""}${r.titulo || ""}`);
    doc.setAuthor("Catequesis parroquial");
    return doc.save();
  }

  const nombre = r => (`Lectio ${r.nivel || ""} ${r.sesion || ""} ${r.titulo || ""}`.replace(/[\\/:*?"<>|¿?¡!]/g, "").replace(/\s+/g, " ").trim() || "Lectio") + ".pdf";
  async function descargar(r) {
    const bytes = await generar(r);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    a.download = nombre(r);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const api = { generar, descargar, nombre, preguntas, _cargar: (lib, bytes) => { raiz.PDFLib = lib; cache[PLANTILLAS._defecto] = Promise.resolve(bytes); } };
  if (typeof module === "object" && module.exports) module.exports = api;
  raiz.CatequesisPDF = api;
})(typeof window !== "undefined" ? window : globalThis);
